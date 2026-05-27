"""Controlla coerenza e completezza dell'archivio di esercizi."""

from __future__ import annotations

from pathlib import Path
import re
import sys
import unicodedata


ROOT = Path(__file__).resolve().parents[1]
EXERCISES_DIR = ROOT / "esercizi"
TAXONOMY_YML = ROOT / "metadata" / "tassonomia.yml"

REQUIRED_FIELDS = {
    "ID",
    "Titolo",
    "Disciplina",
    "Area",
    "Argomento",
    "Classe",
    "Difficolta",
    "Tipo",
    "Tag",
}

DISCIPLINE_PREFIXES = {
    "fisica": "FIS",
    "matematica": "MAT",
}

STOPWORDS = {"da", "de", "del", "della", "delle", "di", "e"}


def normalize(value: str, *, remove_stopwords: bool = False) -> str:
    value = unicodedata.normalize("NFKD", value)
    value = "".join(char for char in value if not unicodedata.combining(char))
    parts = re.findall(r"[a-z0-9]+", value.casefold())
    if remove_stopwords:
        parts = [part for part in parts if part not in STOPWORDS]
    return "_".join(parts)


def read_metadata(path: Path) -> dict[str, str]:
    metadata: dict[str, str] = {}

    with path.open(encoding="utf-8") as tex_file:
        for line in tex_file:
            stripped = line.strip()
            if not stripped:
                continue
            if not stripped.startswith("%"):
                break

            content = stripped[1:].strip()
            if ":" not in content:
                continue

            key, value = content.split(":", 1)
            metadata[key.strip()] = value.strip()

    return metadata


def parse_quoted_value(value: str) -> str:
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] == '"':
        return value[1:-1]
    return value


def load_taxonomy(path: Path) -> dict[str, object]:
    taxonomy: dict[str, object] = {
        "discipline": {},
        "tipi_esercizio": set(),
        "difficolta": set(),
    }
    discipline: str | None = None
    area: str | None = None
    section: str | None = None
    in_argomenti = False

    with path.open(encoding="utf-8") as yml_file:
        for raw_line in yml_file:
            if not raw_line.strip() or raw_line.lstrip().startswith("#"):
                continue

            indent = len(raw_line) - len(raw_line.lstrip(" "))
            line = raw_line.strip()

            if indent == 0 and line.endswith(":"):
                section = line[:-1]
                discipline = section if section in DISCIPLINE_PREFIXES else None
                area = None
                in_argomenti = False
                if discipline:
                    taxonomy["discipline"].setdefault(discipline, {})  # type: ignore[index]
                continue

            if discipline and indent == 2 and line.endswith(":"):
                area = line[:-1]
                taxonomy["discipline"][discipline][area] = {  # type: ignore[index]
                    "label": "",
                    "argomenti": [],
                }
                in_argomenti = False
                continue

            if discipline and area and indent == 4 and line.startswith("label:"):
                label = parse_quoted_value(line.split(":", 1)[1])
                taxonomy["discipline"][discipline][area]["label"] = label  # type: ignore[index]
                continue

            if discipline and area and indent == 4 and line == "argomenti:":
                in_argomenti = True
                continue

            if discipline and area and in_argomenti and indent == 6 and line.startswith("- "):
                argomento = line[2:].strip()
                taxonomy["discipline"][discipline][area]["argomenti"].append(argomento)  # type: ignore[index]
                continue

            if section == "tipi_esercizio" and indent == 2 and line.startswith("- "):
                taxonomy["tipi_esercizio"].add(line[2:].strip())  # type: ignore[union-attr]
                continue

            if section == "difficolta" and indent == 2 and ":" in line:
                taxonomy["difficolta"].add(line.split(":", 1)[0].strip())  # type: ignore[union-attr]

    return taxonomy


def matches_label_or_slug(value: str, slug: str, label: str = "") -> bool:
    accepted = {
        normalize(slug),
        normalize(slug, remove_stopwords=True),
    }
    if label:
        accepted.add(normalize(label))
        accepted.add(normalize(label, remove_stopwords=True))

    normalized_values = {
        normalize(value),
        normalize(value, remove_stopwords=True),
    }
    return bool(accepted & normalized_values)


def validate_tex_structure(text: str, path: Path) -> list[str]:
    errors: list[str] = []
    relative_path = path.relative_to(ROOT)

    for environment in ("esercizio", "soluzione"):
        begin = text.count(rf"\begin{{{environment}}}")
        end = text.count(rf"\end{{{environment}}}")
        if begin != 1 or end != 1:
            errors.append(
                f"{relative_path}: ambiente {environment} atteso una volta, trovato begin={begin}, end={end}"
            )

    for environment in ("enumerate", "itemize"):
        begin = text.count(rf"\begin{{{environment}}}")
        end = text.count(rf"\end{{{environment}}}")
        if begin != end:
            errors.append(
                f"{relative_path}: ambiente {environment} sbilanciato, begin={begin}, end={end}"
            )

    if "soluzione da aggiungere" in text.casefold():
        errors.append(f"{relative_path}: contiene ancora il placeholder 'soluzione da aggiungere'")

    return errors


def validate_metadata(
    path: Path,
    metadata: dict[str, str],
    taxonomy: dict[str, object],
    seen_ids: dict[str, Path],
) -> list[str]:
    errors: list[str] = []
    relative_path = path.relative_to(ROOT)

    missing = sorted(REQUIRED_FIELDS - set(metadata))
    if missing:
        errors.append(f"{relative_path}: metadati mancanti: {', '.join(missing)}")

    exercise_id = metadata.get("ID", "")
    if exercise_id:
        if path.stem != exercise_id:
            errors.append(f"{relative_path}: ID {exercise_id} diverso dal nome file {path.stem}")
        if exercise_id in seen_ids:
            errors.append(
                f"{relative_path}: ID duplicato {exercise_id}, gia usato in {seen_ids[exercise_id].relative_to(ROOT)}"
            )
        else:
            seen_ids[exercise_id] = path

    difficulty = metadata.get("Difficolta", "")
    if difficulty:
        if difficulty not in taxonomy["difficolta"]:  # type: ignore[operator]
            errors.append(f"{relative_path}: Difficolta non valida: {difficulty}")

    exercise_type = metadata.get("Tipo", "")
    if exercise_type and exercise_type not in taxonomy["tipi_esercizio"]:  # type: ignore[operator]
        errors.append(f"{relative_path}: Tipo non presente in tassonomia: {exercise_type}")

    parts = path.relative_to(ROOT).parts
    if len(parts) < 4 or parts[0] != "esercizi":
        errors.append(f"{relative_path}: percorso esercizio non valido")
        return errors

    discipline_slug = parts[1]
    area_slug = parts[2]
    discipline_value = metadata.get("Disciplina", "")
    area_value = metadata.get("Area", "")
    argomento_value = metadata.get("Argomento", "")

    disciplines = taxonomy["discipline"]  # type: ignore[assignment]
    if discipline_slug not in disciplines:
        errors.append(f"{relative_path}: disciplina non presente in tassonomia: {discipline_slug}")
        return errors

    if not matches_label_or_slug(discipline_value, discipline_slug):
        errors.append(
            f"{relative_path}: Disciplina '{discipline_value}' non coerente con cartella {discipline_slug}"
        )

    expected_prefix = DISCIPLINE_PREFIXES.get(discipline_slug)
    if exercise_id and expected_prefix and not exercise_id.startswith(f"{expected_prefix}-"):
        errors.append(f"{relative_path}: ID {exercise_id} non inizia con {expected_prefix}-")

    discipline_areas = disciplines[discipline_slug]
    if area_slug not in discipline_areas:
        errors.append(
            f"{relative_path}: area '{area_slug}' non presente nella tassonomia di {discipline_slug}"
        )
        return errors

    area_entry = discipline_areas[area_slug]
    if not matches_label_or_slug(area_value, area_slug, area_entry["label"]):
        errors.append(f"{relative_path}: Area '{area_value}' non coerente con cartella {area_slug}")

    argomenti = area_entry["argomenti"]
    if argomento_value and not any(matches_label_or_slug(argomento_value, argomento) for argomento in argomenti):
        errors.append(
            f"{relative_path}: Argomento '{argomento_value}' non presente nella tassonomia dell'area {area_slug}"
        )

    return errors


def main() -> int:
    if not EXERCISES_DIR.exists():
        print(f"Cartella esercizi non trovata: {EXERCISES_DIR}", file=sys.stderr)
        return 1

    taxonomy = load_taxonomy(TAXONOMY_YML)
    errors: list[str] = []
    seen_ids: dict[str, Path] = {}
    exercise_paths = sorted(EXERCISES_DIR.rglob("*.tex"))

    for path in exercise_paths:
        text = path.read_text(encoding="utf-8")
        metadata = read_metadata(path)
        errors.extend(validate_metadata(path, metadata, taxonomy, seen_ids))
        errors.extend(validate_tex_structure(text, path))

    if errors:
        print("Archivio non valido:")
        for error in errors:
            print(f"- {error}")
        return 1

    print(f"Archivio valido: {len(exercise_paths)} esercizi controllati.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""Genera metadata/indice_esercizi.csv leggendo i metadati degli esercizi."""

from __future__ import annotations

import csv
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
EXERCISES_DIR = ROOT / "esercizi"
OUTPUT_CSV = ROOT / "metadata" / "indice_esercizi.csv"

CSV_FIELDS = [
    "id",
    "titolo",
    "disciplina",
    "area",
    "argomento",
    "sottoargomento",
    "classe",
    "difficolta",
    "tipo",
    "risultato",
    "tempo_stimato",
    "competenze",
    "prerequisiti",
    "tag",
    "fonte",
    "autore",
    "licenza",
    "path",
]

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

FIELD_MAP = {
    "ID": "id",
    "Titolo": "titolo",
    "Disciplina": "disciplina",
    "Area": "area",
    "Argomento": "argomento",
    "Sottoargomento": "sottoargomento",
    "Classe": "classe",
    "Difficolta": "difficolta",
    "Tipo": "tipo",
    "Risultato": "risultato",
    "Tempo_stimato": "tempo_stimato",
    "Competenze": "competenze",
    "Prerequisiti": "prerequisiti",
    "Tag": "tag",
    "Fonte": "fonte",
    "Autore": "autore",
    "Licenza": "licenza",
}


def normalize_list_value(value: str) -> str:
    """Converte liste separate da virgole in un formato CSV piu leggibile."""
    parts = [part.strip() for part in value.split(",")]
    return "; ".join(part for part in parts if part)


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


def validate_metadata(metadata: dict[str, str], path: Path) -> list[str]:
    errors: list[str] = []
    missing = sorted(REQUIRED_FIELDS - set(metadata))
    if missing:
        errors.append(f"{path}: metadati mancanti: {', '.join(missing)}")

    difficulty = metadata.get("Difficolta")
    if difficulty:
        try:
            difficulty_value = int(difficulty)
        except ValueError:
            errors.append(f"{path}: Difficolta non numerica: {difficulty}")
        else:
            if difficulty_value < 1 or difficulty_value > 5:
                errors.append(f"{path}: Difficolta fuori scala 1-5: {difficulty}")

    return errors


def row_from_metadata(metadata: dict[str, str], path: Path) -> dict[str, str]:
    row = {field: "" for field in CSV_FIELDS}

    for source_key, csv_key in FIELD_MAP.items():
        value = metadata.get(source_key, "")
        if source_key in {"Competenze", "Prerequisiti", "Tag"}:
            value = normalize_list_value(value)
        row[csv_key] = value

    row["path"] = path.relative_to(ROOT).as_posix()
    return row


def main() -> int:
    if not EXERCISES_DIR.exists():
        print(f"Cartella esercizi non trovata: {EXERCISES_DIR}", file=sys.stderr)
        return 1

    rows: list[dict[str, str]] = []
    errors: list[str] = []
    seen_ids: dict[str, Path] = {}

    for path in sorted(EXERCISES_DIR.rglob("*.tex")):
        metadata = read_metadata(path)
        errors.extend(validate_metadata(metadata, path.relative_to(ROOT)))

        exercise_id = metadata.get("ID")
        if exercise_id:
            if exercise_id in seen_ids:
                errors.append(
                    "ID duplicato "
                    f"{exercise_id}: {seen_ids[exercise_id].relative_to(ROOT)} e {path.relative_to(ROOT)}"
                )
            else:
                seen_ids[exercise_id] = path

        if not errors or exercise_id:
            rows.append(row_from_metadata(metadata, path))

    OUTPUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_CSV.open("w", encoding="utf-8", newline="") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=CSV_FIELDS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)

    print(f"Indice generato: {OUTPUT_CSV.relative_to(ROOT)}")
    print(f"Esercizi indicizzati: {len(rows)}")

    if errors:
        print("\nSegnalazioni:")
        for error in errors:
            print(f"- {error}")
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

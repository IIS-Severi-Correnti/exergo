"""Estrae candidati esercizio da archivi ZIP esportati da Overleaf.

Lo script non importa automaticamente gli esercizi nell'archivio definitivo.
Crea invece file locali in import_lavorazione/, ignorati da Git, da revisionare
e anonimizzare prima dell'eventuale trasformazione in esercizi ufficiali.
"""

from __future__ import annotations

import argparse
import csv
import io
import re
import textwrap
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "import_lavorazione" / "candidati"
DEFAULT_MANIFEST = ROOT / "import_lavorazione" / "candidati_manifest.csv"

BEGIN_ENUM_RE = re.compile(r"\\begin\{enumerate\}(?:\[[^\]]*\])?")
TOKEN_RE = re.compile(r"\\begin\{enumerate\}(?:\[[^\]]*\])?|\\end\{enumerate\}|\\item\b")
TEX_COMMAND_WITH_ARG_RE = re.compile(r"\\(?:textbf|emph|textit|large|Large|small)\{([^{}]*)\}")


def slugify(value: str) -> str:
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", "_", value)
    return value.strip("_") or "archivio"


def read_text_from_zip(zip_file: zipfile.ZipFile, name: str) -> str:
    data = zip_file.read(name)
    for encoding in ("utf-8", "latin-1"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="replace")


def strip_obvious_header_commands(text: str) -> str:
    """Rimuove righe tipiche di intestazioni e criteri non didattici."""
    kept_lines: list[str] = []
    blocked_fragments = (
        "I.I.S.",
        "Severi",
        "Correnti",
        "Classe:",
        "Data:",
        "Criteri di valutazione",
        "punto per",
        "punti per",
    )

    for line in text.splitlines():
        if any(fragment in line for fragment in blocked_fragments):
            continue
        kept_lines.append(line.rstrip())

    return "\n".join(kept_lines).strip()


def normalize_candidate_text(text: str) -> str:
    text = strip_obvious_header_commands(text)
    text = TEX_COMMAND_WITH_ARG_RE.sub(r"\1", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def find_first_enumerate_body(text: str) -> str | None:
    match = BEGIN_ENUM_RE.search(text)
    if not match:
        return None

    depth = 1
    position = match.end()
    for token in TOKEN_RE.finditer(text, position):
        token_text = token.group(0)
        if token_text.startswith(r"\begin"):
            depth += 1
        elif token_text == r"\end{enumerate}":
            depth -= 1
            if depth == 0:
                return text[position : token.start()]

    return None


def split_top_level_items(enumerate_body: str) -> list[str]:
    items: list[str] = []
    current_start: int | None = None
    depth = 0

    for token in TOKEN_RE.finditer(enumerate_body):
        token_text = token.group(0)

        if token_text.startswith(r"\begin"):
            depth += 1
            continue

        if token_text == r"\end{enumerate}":
            depth = max(0, depth - 1)
            continue

        if token_text == r"\item" and depth == 0:
            if current_start is not None:
                items.append(enumerate_body[current_start : token.start()])
            current_start = token.end()

    if current_start is not None:
        items.append(enumerate_body[current_start:])

    return [normalize_candidate_text(item) for item in items if normalize_candidate_text(item)]


def iter_nested_tex_files(outer_zip_path: Path):
    with zipfile.ZipFile(outer_zip_path) as outer_zip:
        for nested_name in outer_zip.namelist():
            if not nested_name.lower().endswith(".zip"):
                continue

            try:
                nested_zip = zipfile.ZipFile(io.BytesIO(outer_zip.read(nested_name)))
            except zipfile.BadZipFile:
                continue

            with nested_zip:
                tex_names = [name for name in nested_zip.namelist() if name.lower().endswith(".tex")]
                for tex_name in tex_names:
                    yield nested_name, tex_name, read_text_from_zip(nested_zip, tex_name)


def write_candidate(path: Path, candidate_id: str, disciplina: str, body: str) -> None:
    content = f"""% Candidato: {candidate_id}
% Disciplina_suggerita: {disciplina}
% Stato: da_revisionare

\\begin{{esercizio}}
{body}
\\end{{esercizio}}

\\begin{{soluzione}}
% Soluzione da aggiungere.
\\end{{soluzione}}
"""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def extract_from_archive(
    outer_zip_path: Path,
    disciplina: str,
    output_dir: Path,
    archive_index: int,
) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    disciplina_slug = slugify(disciplina)

    for nested_index, (nested_name, tex_name, text) in enumerate(iter_nested_tex_files(outer_zip_path), start=1):
        body = find_first_enumerate_body(text)
        if body is None:
            continue

        items = split_top_level_items(body)
        source_slug = f"{disciplina_slug}_{archive_index:02d}_{nested_index:04d}"

        for item_index, item in enumerate(items, start=1):
            if len(item) < 20:
                continue

            candidate_id = f"{disciplina_slug.upper()}-{nested_index:04d}-{item_index:03d}"
            relative_path = Path(disciplina_slug) / source_slug / f"{candidate_id}.tex"
            output_path = output_dir / relative_path
            write_candidate(output_path, candidate_id, disciplina, item)

            rows.append(
                {
                    "candidate_id": candidate_id,
                    "disciplina": disciplina,
                    "source_archive": outer_zip_path.name,
                    "source_nested_zip": nested_name,
                    "source_tex": tex_name,
                    "path": relative_path.as_posix(),
                    "chars": str(len(item)),
                    "preview": textwrap.shorten(re.sub(r"\s+", " ", item), width=120, placeholder="..."),
                }
            )

    return rows


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Estrae candidati esercizio da ZIP Overleaf annidati.")
    parser.add_argument("--fisica", type=Path, help="ZIP esterno con verifiche di Fisica")
    parser.add_argument("--matematica", type=Path, help="ZIP esterno con verifiche di Matematica")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    sources = []
    if args.fisica:
        sources.append((args.fisica, "Fisica"))
    if args.matematica:
        sources.append((args.matematica, "Matematica"))

    if not sources:
        print("Indica almeno uno ZIP con --fisica o --matematica.")
        return 1

    rows: list[dict[str, str]] = []
    for archive_index, (zip_path, disciplina) in enumerate(sources, start=1):
        if not zip_path.exists():
            print(f"ZIP non trovato: {zip_path}")
            return 1
        rows.extend(extract_from_archive(zip_path, disciplina, args.output, archive_index))

    args.manifest.parent.mkdir(parents=True, exist_ok=True)
    with args.manifest.open("w", encoding="utf-8", newline="") as manifest_file:
        fieldnames = [
            "candidate_id",
            "disciplina",
            "source_archive",
            "source_nested_zip",
            "source_tex",
            "path",
            "chars",
            "preview",
        ]
        writer = csv.DictWriter(manifest_file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Candidati estratti: {len(rows)}")
    print(f"Cartella output: {args.output.relative_to(ROOT) if args.output.is_relative_to(ROOT) else args.output}")
    print(f"Manifest: {args.manifest.relative_to(ROOT) if args.manifest.is_relative_to(ROOT) else args.manifest}")
    print("Nota: import_lavorazione/ e ignorata da Git.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


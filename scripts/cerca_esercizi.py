"""Cerca esercizi nel file metadata/indice_esercizi.csv."""

from __future__ import annotations

import argparse
import csv
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
INDEX_CSV = ROOT / "metadata" / "indice_esercizi.csv"


def normalize(value: str) -> str:
    return value.strip().casefold()


def contains_tag(row_tags: str, requested_tag: str) -> bool:
    tags = [normalize(tag) for tag in row_tags.replace(",", ";").split(";")]
    return normalize(requested_tag) in tags


def matches(row: dict[str, str], args: argparse.Namespace) -> bool:
    exact_filters = {
        "disciplina": args.disciplina,
        "area": args.area,
        "argomento": args.argomento,
        "difficolta": args.difficolta,
        "tipo": args.tipo,
    }

    for field, requested in exact_filters.items():
        if requested is not None and normalize(row.get(field, "")) != normalize(str(requested)):
            return False

    if args.tag and not contains_tag(row.get("tag", ""), args.tag):
        return False

    return True


def read_index() -> list[dict[str, str]]:
    if not INDEX_CSV.exists():
        print(
            "Indice non trovato. Esegui prima: python scripts/genera_indice.py",
            file=sys.stderr,
        )
        raise SystemExit(1)

    with INDEX_CSV.open(encoding="utf-8", newline="") as csv_file:
        return list(csv.DictReader(csv_file))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Cerca esercizi nell'indice CSV.")
    parser.add_argument("--disciplina", help="Esempio: Fisica")
    parser.add_argument("--area", help="Esempio: Termologia")
    parser.add_argument("--argomento", help="Esempio: Temperatura di equilibrio")
    parser.add_argument("--difficolta", type=int, help="Valore da 1 a 5")
    parser.add_argument("--tipo", help="Esempio: problema_numerico")
    parser.add_argument("--tag", help="Esempio: calorimetria")
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    rows = [row for row in read_index() if matches(row, args)]

    if not rows:
        print("Nessun esercizio trovato.")
        return 0

    for row in rows:
        print(
            f"{row['id']} | {row['titolo']} | diff. {row['difficolta']} | "
            f"{row['tipo']} | {row['path']}"
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())


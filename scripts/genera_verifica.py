"""Genera una verifica LaTeX a partire da una lista di ID esercizi."""

from __future__ import annotations

import argparse
import csv
import os
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
INDEX_CSV = ROOT / "metadata" / "indice_esercizi.csv"


def latex_escape(value: str) -> str:
    replacements = {
        "\\": r"\textbackslash{}",
        "&": r"\&",
        "%": r"\%",
        "$": r"\$",
        "#": r"\#",
        "_": r"\_",
        "{": r"\{",
        "}": r"\}",
    }
    return "".join(replacements.get(char, char) for char in value)


def read_index() -> dict[str, dict[str, str]]:
    if not INDEX_CSV.exists():
        print(
            "Indice non trovato. Esegui prima: python scripts/genera_indice.py",
            file=sys.stderr,
        )
        raise SystemExit(1)

    with INDEX_CSV.open(encoding="utf-8", newline="") as csv_file:
        return {row["id"]: row for row in csv.DictReader(csv_file)}


def parse_bool(value: str) -> bool:
    normalized = value.strip().casefold()
    if normalized in {"true", "si", "sì", "yes", "1"}:
        return True
    if normalized in {"false", "no", "0"}:
        return False
    raise argparse.ArgumentTypeError("Usa true oppure false.")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Genera una verifica LaTeX.")
    parser.add_argument("--titolo", required=True)
    parser.add_argument("--classe", required=True)
    parser.add_argument("--data", required=True)
    parser.add_argument("--ids", nargs="+", required=True, help="Lista di ID esercizi")
    parser.add_argument("--output", required=True, help="Percorso del file .tex da generare")
    parser.add_argument("--soluzioni", type=parse_bool, default=False)
    return parser


def generate_tex(args: argparse.Namespace, rows: list[dict[str, str]], output: Path) -> str:
    solution_switch = r"\soluzionitrue" if args.soluzioni else r"\soluzionifalse"
    output_dir = output.parent.resolve()
    preamble_path = ROOT / "templates" / "preambolo_verifica.tex"
    preamble_relative = Path(os.path.relpath(preamble_path, output_dir))

    lines = [
        r"\documentclass[11pt,a4paper]{article}",
        rf"\input{{{preamble_relative.as_posix()}}}",
        "",
        solution_switch,
        "",
        r"\begin{document}",
        "",
        r"\begin{center}",
        rf"  {{\Large \textbf{{{latex_escape(args.titolo)}}}}}\\",
        rf"  Classe: {latex_escape(args.classe)}\\",
        rf"  Data: {latex_escape(args.data)}",
        r"\end{center}",
        "",
    ]

    for row in rows:
        exercise_path = (ROOT / row["path"]).resolve()
        exercise_relative = Path(os.path.relpath(exercise_path, output_dir))
        lines.append(rf"\input{{{exercise_relative.as_posix()}}}")

    lines.extend(["", r"\end{document}", ""])
    return "\n".join(lines)


def main() -> int:
    args = build_parser().parse_args()
    index = read_index()

    missing_ids = [exercise_id for exercise_id in args.ids if exercise_id not in index]
    if missing_ids:
        print(f"ID non trovati: {', '.join(missing_ids)}", file=sys.stderr)
        return 1

    output = (ROOT / args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)

    rows = [index[exercise_id] for exercise_id in args.ids]
    tex = generate_tex(args, rows, output)
    output.write_text(tex, encoding="utf-8")

    print(f"Verifica generata: {output.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

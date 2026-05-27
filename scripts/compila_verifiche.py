"""Compila le verifiche LaTeX e un controllo con tutte le soluzioni."""

from __future__ import annotations

import argparse
from pathlib import Path
import shutil
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]
GENERATED_DIR = ROOT / "verifiche_generate"
CHECK_DIR = ROOT / ".latex_check"
ARCHIVE_CHECK = CHECK_DIR / "archivio_soluzioni.tex"

AUX_SUFFIXES = (
    ".aux",
    ".fdb_latexmk",
    ".fls",
    ".log",
    ".out",
    ".pdf",
    ".synctex.gz",
    ".toc",
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Compila le verifiche LaTeX generate.")
    parser.add_argument(
        "--generated-dir",
        type=Path,
        default=GENERATED_DIR,
        help="Cartella con le verifiche .tex da compilare.",
    )
    parser.add_argument(
        "--skip-generated",
        action="store_true",
        help="Non compilare i file in verifiche_generate/.",
    )
    parser.add_argument(
        "--skip-archive-check",
        action="store_true",
        help="Non creare il documento temporaneo con tutti gli esercizi e le soluzioni.",
    )
    parser.add_argument(
        "--keep-artifacts",
        action="store_true",
        help="Mantiene PDF, log e file ausiliari generati dalla compilazione.",
    )
    return parser


def find_compiler() -> str | None:
    for compiler in ("latexmk", "pdflatex"):
        if shutil.which(compiler):
            return compiler
    return None


def generated_tex_files(directory: Path) -> list[Path]:
    if not directory.exists():
        return []
    return sorted(path for path in directory.rglob("*.tex") if path.is_file())


def write_archive_check() -> Path:
    CHECK_DIR.mkdir(parents=True, exist_ok=True)
    exercise_paths = sorted((ROOT / "esercizi").rglob("*.tex"))

    lines = [
        r"\documentclass[11pt,a4paper]{article}",
        r"\input{../templates/preambolo_verifica.tex}",
        "",
        r"\soluzionitrue",
        "",
        r"\begin{document}",
        "",
        r"\begin{center}",
        r"  {\Large \textbf{Controllo archivio esercizi}}\\",
        r"  Soluzioni attive",
        r"\end{center}",
        "",
    ]

    for path in exercise_paths:
        relative_path = path.relative_to(ROOT).as_posix()
        lines.append(rf"\input{{../{relative_path}}}")

    lines.extend(["", r"\end{document}", ""])
    ARCHIVE_CHECK.write_text("\n".join(lines), encoding="utf-8")
    return ARCHIVE_CHECK


def compile_with_latexmk(tex_path: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [
            "latexmk",
            "-pdf",
            "-interaction=nonstopmode",
            "-halt-on-error",
            "-file-line-error",
            tex_path.name,
        ],
        cwd=tex_path.parent,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=False,
    )


def compile_with_pdflatex(tex_path: Path) -> subprocess.CompletedProcess[str]:
    result = subprocess.CompletedProcess(args=[], returncode=0, stdout="")
    command = [
        "pdflatex",
        "-interaction=nonstopmode",
        "-halt-on-error",
        "-file-line-error",
        tex_path.name,
    ]

    for _ in range(2):
        result = subprocess.run(
            command,
            cwd=tex_path.parent,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            check=False,
        )
        if result.returncode != 0:
            break

    return result


def clean_artifacts(tex_path: Path) -> None:
    stem = tex_path.stem
    for suffix in AUX_SUFFIXES:
        artifact = tex_path.parent / f"{stem}{suffix}"
        if artifact.exists():
            artifact.unlink()


def log_tail(tex_path: Path) -> str:
    log_path = tex_path.with_suffix(".log")
    if not log_path.exists():
        return ""

    lines = log_path.read_text(encoding="utf-8", errors="replace").splitlines()
    return "\n".join(lines[-40:])


def compile_tex(tex_path: Path, compiler: str, keep_artifacts: bool) -> bool:
    print(f"Compilo {tex_path.relative_to(ROOT)}")

    if compiler == "latexmk":
        result = compile_with_latexmk(tex_path)
    else:
        result = compile_with_pdflatex(tex_path)

    if result.returncode != 0:
        print(f"Errore nella compilazione di {tex_path.relative_to(ROOT)}", file=sys.stderr)
        tail = log_tail(tex_path)
        if tail:
            print("\nUltime righe del log LaTeX:", file=sys.stderr)
            print(tail, file=sys.stderr)
        else:
            print(result.stdout[-3000:], file=sys.stderr)
        return False

    if not keep_artifacts:
        clean_artifacts(tex_path)

    print(f"OK {tex_path.relative_to(ROOT)}")
    return True


def main() -> int:
    args = build_parser().parse_args()
    compiler = find_compiler()

    if compiler is None:
        print(
            "Nessun compilatore LaTeX trovato. Installa latexmk oppure pdflatex.",
            file=sys.stderr,
        )
        return 1

    targets: list[Path] = []

    if not args.skip_generated:
        targets.extend(generated_tex_files((ROOT / args.generated_dir).resolve()))

    if not args.skip_archive_check:
        targets.append(write_archive_check())

    if not targets:
        print("Nessun file LaTeX da compilare.")
        return 0

    failed = [
        path
        for path in targets
        if not compile_tex(path, compiler=compiler, keep_artifacts=args.keep_artifacts)
    ]

    if failed:
        print("\nCompilazione fallita per:", file=sys.stderr)
        for path in failed:
            print(f"- {path.relative_to(ROOT)}", file=sys.stderr)
        return 1

    if not args.keep_artifacts and CHECK_DIR.exists():
        try:
            CHECK_DIR.rmdir()
        except OSError:
            pass

    print(f"Compilazione completata: {len(targets)} file controllati.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

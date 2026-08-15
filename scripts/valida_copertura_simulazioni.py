from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX_CSV = Path("metadata/indice_esercizi.csv")
COVERAGE_CSV = Path("metadata/simulation_coverage.csv")

VALID_STATUSES = {"implemented", "planned", "extension", "composite", "not_required"}
VALID_PRIORITIES = {"P0", "P1", "P2", "P3"}
REQUIRED_COLUMNS = {"id", "status", "engine", "model", "priority", "rationale"}


def _read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def validate_coverage(root: Path = ROOT) -> list[str]:
    errors: list[str] = []
    index_path = root / INDEX_CSV
    coverage_path = root / COVERAGE_CSV

    if not index_path.exists():
        return [f"indice non trovato: {INDEX_CSV}"]
    if not coverage_path.exists():
        return [f"coverage map non trovata: {COVERAGE_CSV}"]

    index_rows = _read_csv(index_path)
    physics_rows = {
        row["id"]: row
        for row in index_rows
        if row.get("disciplina", "").strip().casefold() == "fisica"
    }

    with coverage_path.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames:
            return [f"{COVERAGE_CSV}: intestazione mancante"]
        missing_columns = REQUIRED_COLUMNS.difference(reader.fieldnames)
        if missing_columns:
            errors.append(
                f"{COVERAGE_CSV}: colonne mancanti: {', '.join(sorted(missing_columns))}"
            )
        coverage_rows = list(reader)

    coverage_by_id: dict[str, dict[str, str]] = {}
    for line_number, row in enumerate(coverage_rows, start=2):
        exercise_id = row.get("id", "").strip()
        if not exercise_id:
            errors.append(f"{COVERAGE_CSV}:{line_number}: id mancante")
            continue
        if exercise_id in coverage_by_id:
            errors.append(f"{COVERAGE_CSV}:{line_number}: id duplicato {exercise_id}")
            continue
        coverage_by_id[exercise_id] = row

    physics_ids = set(physics_rows)
    coverage_ids = set(coverage_by_id)

    for exercise_id in sorted(physics_ids - coverage_ids):
        errors.append(f"coverage mancante per esercizio di Fisica: {exercise_id}")
    for exercise_id in sorted(coverage_ids - physics_ids):
        errors.append(f"coverage orfana/non-Fisica: {exercise_id}")

    for exercise_id in sorted(physics_ids & coverage_ids):
        row = coverage_by_id[exercise_id]
        index_row = physics_rows[exercise_id]

        status = row.get("status", "").strip()
        engine = row.get("engine", "").strip()
        model = row.get("model", "").strip()
        priority = row.get("priority", "").strip()
        rationale = row.get("rationale", "").strip()
        index_engine = index_row.get("simulazione", "").strip()

        if status not in VALID_STATUSES:
            errors.append(f"{exercise_id}: status non valido: {status!r}")
        if priority not in VALID_PRIORITIES:
            errors.append(f"{exercise_id}: priority non valida: {priority!r}")
        if not rationale:
            errors.append(f"{exercise_id}: rationale mancante")

        if status == "not_required":
            if engine or model:
                errors.append(
                    f"{exercise_id}: not_required richiede engine e model vuoti"
                )
        else:
            if not engine:
                errors.append(f"{exercise_id}: engine mancante per status {status}")
            if not model:
                errors.append(f"{exercise_id}: model mancante per status {status}")

        if index_engine:
            if status != "implemented":
                errors.append(
                    f"{exercise_id}: indice dichiara simulazione {index_engine}, "
                    f"ma coverage status={status}"
                )
            if engine != index_engine:
                errors.append(
                    f"{exercise_id}: engine coverage={engine!r} diverso "
                    f"dall'indice={index_engine!r}"
                )

            config_path = root / "simulazioni" / "config" / f"{exercise_id}.json"
            if not config_path.exists():
                errors.append(
                    f"{exercise_id}: config simulazione mancante: "
                    f"{config_path.relative_to(root)}"
                )
            else:
                try:
                    config = json.loads(config_path.read_text(encoding="utf-8"))
                except json.JSONDecodeError as exc:
                    errors.append(f"{exercise_id}: config JSON non valido: {exc}")
                else:
                    if config.get("engine") != engine:
                        errors.append(
                            f"{exercise_id}: config engine={config.get('engine')!r} "
                            f"diverso dalla coverage={engine!r}"
                        )
                    if config.get("model") != model:
                        errors.append(
                            f"{exercise_id}: config model={config.get('model')!r} "
                            f"diverso dalla coverage={model!r}"
                        )
        elif status == "implemented":
            errors.append(
                f"{exercise_id}: coverage implemented ma indice senza metadato Simulazione"
            )

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Verifica che tutti gli esercizi di Fisica siano classificati "
            "nella simulation coverage map."
        )
    )
    parser.add_argument("--root", type=Path, default=ROOT)
    args = parser.parse_args()

    root = args.root.resolve()
    errors = validate_coverage(root)
    if errors:
        print("Coverage simulazioni NON valida:")
        for error in errors:
            print(f"- {error}")
        return 1

    physics_count = sum(
        1
        for row in _read_csv(root / INDEX_CSV)
        if row.get("disciplina", "").strip().casefold() == "fisica"
    )
    print(f"Coverage simulazioni valida: {physics_count} esercizi di Fisica classificati.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

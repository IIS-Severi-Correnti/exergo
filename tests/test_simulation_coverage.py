from __future__ import annotations

import csv
from pathlib import Path
import shutil
import tempfile
import unittest

from scripts.valida_copertura_simulazioni import validate_coverage


ROOT = Path(__file__).resolve().parents[1]


class SimulationCoverageTests(unittest.TestCase):
    def test_repository_coverage_is_complete_and_consistent(self) -> None:
        self.assertEqual(validate_coverage(ROOT), [])

    def _copy_fixture(self, destination: Path) -> None:
        (destination / "metadata").mkdir(parents=True)
        shutil.copy2(
            ROOT / "metadata" / "indice_esercizi.csv",
            destination / "metadata" / "indice_esercizi.csv",
        )
        shutil.copy2(
            ROOT / "metadata" / "simulation_coverage.csv",
            destination / "metadata" / "simulation_coverage.csv",
        )
        shutil.copytree(
            ROOT / "simulazioni" / "config",
            destination / "simulazioni" / "config",
        )

    def test_missing_physics_exercise_is_reported(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            self._copy_fixture(root)
            coverage_path = root / "metadata" / "simulation_coverage.csv"

            with coverage_path.open(encoding="utf-8", newline="") as handle:
                rows = list(csv.DictReader(handle))
                fieldnames = list(rows[0])
            removed_id = rows[0]["id"]

            with coverage_path.open("w", encoding="utf-8", newline="") as handle:
                writer = csv.DictWriter(handle, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(rows[1:])

            errors = validate_coverage(root)
            self.assertTrue(
                any(removed_id in error and "coverage mancante" in error for error in errors)
            )

    def test_implemented_engine_must_match_index_and_config(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            self._copy_fixture(root)
            coverage_path = root / "metadata" / "simulation_coverage.csv"

            with coverage_path.open(encoding="utf-8", newline="") as handle:
                rows = list(csv.DictReader(handle))
                fieldnames = list(rows[0])

            target = next(row for row in rows if row["id"] == "FIS-ROT-ANG-001")
            target["engine"] = "wrong_engine"

            with coverage_path.open("w", encoding="utf-8", newline="") as handle:
                writer = csv.DictWriter(handle, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(rows)

            errors = validate_coverage(root)
            self.assertTrue(
                any(
                    "FIS-ROT-ANG-001" in error and "diverso" in error
                    for error in errors
                )
            )

    def test_not_required_must_not_name_an_engine(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            self._copy_fixture(root)
            coverage_path = root / "metadata" / "simulation_coverage.csv"

            with coverage_path.open(encoding="utf-8", newline="") as handle:
                rows = list(csv.DictReader(handle))
                fieldnames = list(rows[0])

            target = next(row for row in rows if row["status"] == "not_required")
            target["engine"] = "unnecessary_engine"
            target["model"] = "unnecessary_model"

            with coverage_path.open("w", encoding="utf-8", newline="") as handle:
                writer = csv.DictWriter(handle, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(rows)

            errors = validate_coverage(root)
            self.assertTrue(
                any(
                    target["id"] in error and "not_required" in error
                    for error in errors
                )
            )


if __name__ == "__main__":
    unittest.main()

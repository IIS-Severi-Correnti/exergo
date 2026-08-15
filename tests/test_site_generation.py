from __future__ import annotations

from pathlib import Path
import tempfile
import unittest

from scripts import genera_sito


PILOT_ID = "FIS-ROT-ANG-001"
REUSE_ID = "FIS-ROT-ANG-002"
GAS_PILOT_ID = "FIS-TER-GAS-003"
GAS_REUSE_ID = "FIS-TER-GAS-006"


class StaticSiteGenerationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.exercises = genera_sito.read_exercises()
        cls.pilot = next(
            exercise for exercise in cls.exercises if exercise.exercise_id == PILOT_ID
        )
        cls.reuse = next(
            exercise for exercise in cls.exercises if exercise.exercise_id == REUSE_ID
        )
        cls.gas_pilot = next(
            exercise for exercise in cls.exercises if exercise.exercise_id == GAS_PILOT_ID
        )
        cls.gas_reuse = next(
            exercise for exercise in cls.exercises if exercise.exercise_id == GAS_REUSE_ID
        )
        cls.normal = next(
            exercise
            for exercise in cls.exercises
            if exercise.simulation_config is None
        )

    def test_normal_exercise_does_not_load_simulation_assets(self) -> None:
        page = genera_sito.render_exercise_page(self.normal)
        self.assertNotIn("data-exergo-simulation", page)
        self.assertNotIn("runtime.js", page)
        self.assertNotIn("simulation.css", page)
        self.assertIn("<summary>Soluzione</summary>", page)

    def test_rotational_exercises_use_same_engine_before_solution(self) -> None:
        for exercise in (self.pilot, self.reuse):
            with self.subTest(exercise=exercise.exercise_id):
                page = genera_sito.render_exercise_page(exercise)
                self.assertIn('data-simulation-engine="rotational_platform"', page)
                self.assertIn("runtime.js", page)
                self.assertIn("simulation.css", page)
                self.assertLess(
                    page.index(">Simulazione</h2>"),
                    page.index("<summary>Soluzione</summary>"),
                )

    def test_gas_exercises_reuse_second_engine_before_solution(self) -> None:
        for exercise in (self.gas_pilot, self.gas_reuse):
            with self.subTest(exercise=exercise.exercise_id):
                page = genera_sito.render_exercise_page(exercise)
                self.assertIn('data-simulation-engine="ideal_gas_process"', page)
                self.assertIn("runtime.js", page)
                self.assertIn("simulation.css", page)
                self.assertIn("engines/ideal_gas_process/style.css", page)
                self.assertLess(
                    page.index(">Simulazione</h2>"),
                    page.index("<summary>Soluzione</summary>"),
                )

    def test_site_contains_both_engines_and_four_configs(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            output = Path(temporary_directory) / "site"
            genera_sito.write_site(self.exercises, output)

            expected_assets = {
                "core/runtime.js",
                "core/controls.js",
                "core/registry.js",
                "core/simulation.css",
                "engines/rotational_platform/engine.js",
                "engines/rotational_platform/view.js",
                "engines/rotational_platform/style.css",
                "engines/ideal_gas_process/engine.js",
                "engines/ideal_gas_process/view.js",
                "engines/ideal_gas_process/style.css",
                f"config/{PILOT_ID}.json",
                f"config/{REUSE_ID}.json",
                f"config/{GAS_PILOT_ID}.json",
                f"config/{GAS_REUSE_ID}.json",
            }
            asset_root = output / "assets" / "simulazioni"
            actual_assets = {
                path.relative_to(asset_root).as_posix()
                for path in asset_root.rglob("*")
                if path.is_file()
            }
            self.assertEqual(actual_assets, expected_assets)
            self.assertTrue((output / "index.html").is_file())
            for exercise_id in (PILOT_ID, REUSE_ID, GAS_PILOT_ID, GAS_REUSE_ID):
                with self.subTest(exercise=exercise_id):
                    self.assertTrue(
                        (
                            output
                            / "esercizi"
                            / exercise_id.casefold()
                            / "index.html"
                        ).is_file()
                    )

    def test_gas_subset_copies_only_ideal_gas_engine(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            output = Path(temporary_directory) / "site"
            genera_sito.write_site([self.gas_pilot, self.gas_reuse], output)

            asset_root = output / "assets" / "simulazioni"
            actual_assets = {
                path.relative_to(asset_root).as_posix()
                for path in asset_root.rglob("*")
                if path.is_file()
            }
            self.assertIn("engines/ideal_gas_process/engine.js", actual_assets)
            self.assertIn("engines/ideal_gas_process/view.js", actual_assets)
            self.assertIn("engines/ideal_gas_process/style.css", actual_assets)
            self.assertIn(f"config/{GAS_PILOT_ID}.json", actual_assets)
            self.assertIn(f"config/{GAS_REUSE_ID}.json", actual_assets)
            self.assertFalse(
                any(path.startswith("engines/rotational_platform/") for path in actual_assets)
            )


if __name__ == "__main__":
    unittest.main()

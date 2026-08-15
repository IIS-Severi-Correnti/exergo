from __future__ import annotations

from pathlib import Path
import tempfile
import unittest

from scripts import genera_sito


EXERCISE_ID = "FIS-FLU-PAS-001"


class HydraulicPressSiteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.exercises = genera_sito.read_exercises()
        cls.exercise = next(
            exercise for exercise in cls.exercises if exercise.exercise_id == EXERCISE_ID
        )

    def test_exercise_uses_fluid_statics_before_solution(self) -> None:
        page = genera_sito.render_exercise_page(self.exercise)
        self.assertIn('data-simulation-engine="fluid_statics"', page)
        self.assertIn("runtime.js", page)
        self.assertIn("engines/fluid_statics/style.css", page)
        self.assertLess(
            page.index(">Simulazione</h2>"),
            page.index("<summary>Soluzione</summary>"),
        )

    def test_subset_copies_hydraulic_view_and_config(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            output = Path(temporary_directory) / "site"
            genera_sito.write_site([self.exercise], output)
            asset_root = output / "assets" / "simulazioni"
            actual_assets = {
                path.relative_to(asset_root).as_posix()
                for path in asset_root.rglob("*")
                if path.is_file()
            }

            for expected in (
                "core/runtime.js",
                "core/controls.js",
                "core/registry.js",
                "core/simulation.css",
                "engines/fluid_statics/multi_engine.js",
                "engines/fluid_statics/engine.js",
                "engines/fluid_statics/apparent_weight_engine.js",
                "engines/fluid_statics/multi_view.js",
                "engines/fluid_statics/view.js",
                "engines/fluid_statics/floating_view.js",
                "engines/fluid_statics/apparent_weight_view.js",
                "engines/fluid_statics/pressure_points_view.js",
                "engines/fluid_statics/hydraulic_press_view.js",
                "engines/fluid_statics/style.css",
                f"config/{EXERCISE_ID}.json",
            ):
                with self.subTest(asset=expected):
                    self.assertIn(expected, actual_assets)

            self.assertTrue(
                (output / "esercizi" / EXERCISE_ID.casefold() / "index.html").is_file()
            )


if __name__ == "__main__":
    unittest.main()

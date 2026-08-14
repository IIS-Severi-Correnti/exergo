from __future__ import annotations

from pathlib import Path
import tempfile
import unittest

from scripts import genera_sito


PILOT_ID = "FIS-ROT-ANG-001"


class StaticSiteGenerationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.exercises = genera_sito.read_exercises()
        cls.pilot = next(
            exercise for exercise in cls.exercises if exercise.exercise_id == PILOT_ID
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

    def test_simulated_exercise_contains_section_before_solution(self) -> None:
        page = genera_sito.render_exercise_page(self.pilot)
        self.assertIn('data-simulation-engine="rotational_platform"', page)
        self.assertIn("runtime.js", page)
        self.assertIn("simulation.css", page)
        self.assertLess(
            page.index(">Simulazione</h2>"),
            page.index("<summary>Soluzione</summary>"),
        )

    def test_site_contains_only_required_simulation_assets(self) -> None:
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
                f"config/{PILOT_ID}.json",
            }
            asset_root = output / "assets" / "simulazioni"
            actual_assets = {
                path.relative_to(asset_root).as_posix()
                for path in asset_root.rglob("*")
                if path.is_file()
            }
            self.assertEqual(actual_assets, expected_assets)
            self.assertTrue((output / "index.html").is_file())
            self.assertTrue(
                (output / "esercizi" / PILOT_ID.casefold() / "index.html").is_file()
            )


if __name__ == "__main__":
    unittest.main()

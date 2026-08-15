from __future__ import annotations

from pathlib import Path
import tempfile
import unittest

from scripts import genera_sito


EXERCISE_ID = "FIS-FLU-VAS-001"


class CommunicatingVesselsSiteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.exercise = next(
            exercise for exercise in genera_sito.read_exercises()
            if exercise.exercise_id == EXERCISE_ID
        )

    def test_exercise_loads_fluid_statics_before_solution(self) -> None:
        page = genera_sito.render_exercise_page(self.exercise)
        self.assertIn('data-simulation-engine="fluid_statics"', page)
        self.assertIn("FIS-FLU-VAS-001.json", page)
        self.assertLess(page.index(">Simulazione</h2>"), page.index("<summary>Soluzione</summary>"))

    def test_subset_contains_communicating_vessels_assets(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            output = Path(temporary_directory) / "site"
            genera_sito.write_site([self.exercise], output)
            root = output / "assets" / "simulazioni"
            self.assertTrue((root / "engines/fluid_statics/communicating_vessels_view.js").is_file())
            self.assertTrue((root / "config/FIS-FLU-VAS-001.json").is_file())


if __name__ == "__main__":
    unittest.main()

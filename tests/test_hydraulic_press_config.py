from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path
import unittest

from scripts.simulation_config import load_engine_manifest, load_simulation_config, validate_config_data


ROOT = Path(__file__).resolve().parents[1]
ENGINE = "fluid_statics"
EXERCISE_ID = "FIS-FLU-PAS-001"


class HydraulicPressConfigTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.manifest = load_engine_manifest(ENGINE, root=ROOT)
        cls.raw = json.loads(
            (ROOT / "simulazioni" / "config" / f"{EXERCISE_ID}.json").read_text(
                encoding="utf-8"
            )
        )

    def errors_for(self, config: dict) -> list[str]:
        return validate_config_data(config, self.manifest, expected_engine=ENGINE)

    def test_real_config_is_strict_and_loadable(self) -> None:
        config, _ = load_simulation_config(EXERCISE_ID, ENGINE, root=ROOT)
        self.assertEqual(config["model"], "hydraulic_press")
        self.assertEqual(config["parameters"]["small_piston_force_N"], 140)
        self.assertEqual(config["parameters"]["load_mass_kg"], 3800)
        self.assertEqual(config["parameters"]["gravity_m_s2"], 9.8)
        self.assertEqual(self.errors_for(deepcopy(self.raw)), [])

    def test_missing_force_is_rejected(self) -> None:
        config = deepcopy(self.raw)
        del config["parameters"]["small_piston_force_N"]
        errors = self.errors_for(config)
        self.assertTrue(any("small_piston_force_N" in error and "mancante" in error for error in errors))

    def test_absolute_area_is_not_part_of_the_contract(self) -> None:
        config = deepcopy(self.raw)
        config["parameters"]["small_piston_area_m2"] = 0.01
        errors = self.errors_for(config)
        self.assertTrue(any("small_piston_area_m2" in error and "sconosciuta" in error for error in errors))

    def test_negative_mass_is_rejected_before_runtime(self) -> None:
        config = deepcopy(self.raw)
        config["parameters"]["load_mass_kg"] = -1
        errors = self.errors_for(config)
        self.assertTrue(any("load_mass_kg" in error and "> 0" in error for error in errors))


if __name__ == "__main__":
    unittest.main()

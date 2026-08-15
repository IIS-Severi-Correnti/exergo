from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path
import unittest

from scripts.simulation_config import load_engine_manifest, load_simulation_config, validate_config_data


ROOT = Path(__file__).resolve().parents[1]
ENGINE_NAME = "one_dimensional_collision"
EXERCISE_ID = "FIS-URT-COM-001"


class CollisionSimulationConfigTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.manifest = load_engine_manifest(ENGINE_NAME, root=ROOT)
        cls.config = json.loads(
            (ROOT / "simulazioni" / "config" / f"{EXERCISE_ID}.json").read_text(
                encoding="utf-8"
            )
        )

    def errors_for(self, config: dict) -> list[str]:
        return validate_config_data(
            config,
            self.manifest,
            expected_engine=ENGINE_NAME,
        )

    def test_manifest_and_pilot_configuration_are_valid(self) -> None:
        config, manifest = load_simulation_config(
            EXERCISE_ID,
            ENGINE_NAME,
            root=ROOT,
        )
        self.assertEqual(config["model"], "elastic_1d")
        self.assertEqual(manifest["engine"], ENGINE_NAME)
        self.assertEqual(self.errors_for(deepcopy(self.config)), [])

    def test_schema_rejects_unknown_keys(self) -> None:
        config = deepcopy(self.config)
        config["parameters"]["mass_kg"] = 1
        config["display"]["show_positions_m"] = True
        errors = self.errors_for(config)
        self.assertTrue(any("mass_kg" in error and "sconosciuta" in error for error in errors))
        self.assertTrue(
            any("show_positions_m" in error and "sconosciuta" in error for error in errors)
        )

    def test_positive_mass_ratios_and_approach_constraint(self) -> None:
        config = deepcopy(self.config)
        config["parameters"]["mass_1_ratio"] = 0
        config["parameters"]["velocity_1_initial_m_s"] = -1
        config["parameters"]["velocity_2_initial_m_s"] = 1
        errors = self.errors_for(config)
        self.assertTrue(any("mass_1_ratio" in error and "> 0" in error for error in errors))
        self.assertTrue(any("urto di avvicinamento" in error for error in errors))

    def test_reference_frame_default_is_enumerated(self) -> None:
        config = deepcopy(self.config)
        config["display"]["reference_frame_default"] = "laboratory"
        errors = self.errors_for(config)
        self.assertTrue(any("valore non supportato" in error for error in errors))


if __name__ == "__main__":
    unittest.main()

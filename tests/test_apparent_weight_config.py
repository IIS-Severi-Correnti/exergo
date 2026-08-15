from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path
import unittest

from scripts.simulation_config import load_engine_manifest, load_simulation_config, validate_config_data


ROOT = Path(__file__).resolve().parents[1]
ENGINE = "fluid_statics"
EXERCISE_ID = "FIS-FLU-ARC-002"


class ApparentWeightConfigTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.manifest = load_engine_manifest(ENGINE, root=ROOT)
        cls.config = json.loads(
            (ROOT / "simulazioni" / "config" / f"{EXERCISE_ID}.json").read_text(
                encoding="utf-8"
            )
        )

    def errors_for(self, config: dict) -> list[str]:
        return validate_config_data(config, self.manifest, expected_engine=ENGINE)

    def test_real_configuration_is_valid(self) -> None:
        config, manifest = load_simulation_config(EXERCISE_ID, ENGINE, root=ROOT)
        self.assertEqual(config["model"], "buoyancy_apparent_weight")
        self.assertIn("buoyancy_apparent_weight", manifest["supported_models"])
        self.assertEqual(self.errors_for(deepcopy(self.config)), [])

    def test_model_specific_required_parameter_is_enforced(self) -> None:
        config = deepcopy(self.config)
        del config["parameters"]["weight_air_N"]
        errors = self.errors_for(config)
        self.assertTrue(any("weight_air_N" in error and "mancante" in error for error in errors))

    def test_parameters_from_other_fluid_model_are_rejected(self) -> None:
        config = deepcopy(self.config)
        config["parameters"]["depth_reference_m"] = 0.2
        errors = self.errors_for(config)
        self.assertTrue(any("depth_reference_m" in error and "sconosciuta" in error for error in errors))

    def test_apparent_weight_must_be_smaller_than_air_weight(self) -> None:
        config = deepcopy(self.config)
        config["parameters"]["apparent_weight_fully_submerged_N"] = 820
        errors = self.errors_for(config)
        self.assertTrue(
            any(
                "apparent_weight_fully_submerged_N" in error
                and "minore di weight_air_N" in error
                for error in errors
            )
        )

    def test_fraction_bounds_are_validated(self) -> None:
        config = deepcopy(self.config)
        config["parameters"]["submerged_fraction_final"] = 1.1
        errors = self.errors_for(config)
        self.assertTrue(any("submerged_fraction_final" in error and "<= 1" in error for error in errors))


if __name__ == "__main__":
    unittest.main()

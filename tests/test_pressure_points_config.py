from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path
import unittest

from scripts.simulation_config import load_engine_manifest, load_simulation_config, validate_config_data


ROOT = Path(__file__).resolve().parents[1]
ENGINE = "fluid_statics"
EXERCISE_ID = "FIS-FLU-PID-003"


class PressurePointsConfigTests(unittest.TestCase):
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

    def test_real_config_loads_as_pressure_points(self) -> None:
        config, manifest = load_simulation_config(EXERCISE_ID, ENGINE, root=ROOT)
        self.assertEqual(config["model"], "hydrostatic_pressure_points")
        self.assertIn("hydrostatic_pressure_points", manifest["supported_models"])
        self.assertEqual(config["parameters"]["fluid_density_kg_m3"], 1000)
        self.assertLess(
            config["parameters"]["upper_depth_m"],
            config["parameters"]["lower_depth_m"],
        )

    def test_lower_depth_must_exceed_upper_depth(self) -> None:
        config = deepcopy(self.config)
        config["parameters"]["lower_depth_m"] = config["parameters"]["upper_depth_m"]
        errors = self.errors_for(config)
        self.assertTrue(
            any("lower_depth_m deve essere maggiore di upper_depth_m" in error for error in errors)
        )

    def test_oneof_rejects_foreign_model_parameters(self) -> None:
        config = deepcopy(self.config)
        config["parameters"]["weight_air_N"] = 100
        errors = self.errors_for(config)
        self.assertTrue(
            any("weight_air_N" in error and "sconosciuta" in error for error in errors)
        )

    def test_didactic_scale_note_is_required(self) -> None:
        config = deepcopy(self.config)
        del config["didactics"]["exploration_note_it"]
        errors = self.errors_for(config)
        self.assertTrue(
            any("exploration_note_it" in error and "mancante" in error for error in errors)
        )


if __name__ == "__main__":
    unittest.main()

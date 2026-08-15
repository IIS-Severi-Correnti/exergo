from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path
import unittest

from scripts.simulation_config import load_engine_manifest, load_simulation_config, validate_config_data


ROOT = Path(__file__).resolve().parents[1]
ENGINE_NAME = "fluid_statics"
HYDRO_ID = "FIS-FLU-PID-001"
FLOATING_ID = "FIS-FLU-ARC-001"
FLOATING_REUSE_ID = "FIS-FLU-ARC-003"
APPARENT_WEIGHT_ID = "FIS-FLU-ARC-002"
PRESSURE_POINTS_ID = "FIS-FLU-PID-003"
HYDRAULIC_PRESS_ID = "FIS-FLU-PAS-001"
COMMUNICATING_VESSELS_ID = "FIS-FLU-VAS-001"


class FluidStaticsMultiModelConfigTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.manifest = load_engine_manifest(ENGINE_NAME, root=ROOT)
        cls.floating = json.loads(
            (ROOT / "simulazioni" / "config" / f"{FLOATING_ID}.json").read_text(
                encoding="utf-8"
            )
        )

    def errors_for(self, config: dict) -> list[str]:
        return validate_config_data(
            config,
            self.manifest,
            expected_engine=ENGINE_NAME,
        )

    def test_manifest_accepts_all_models_and_real_configs(self) -> None:
        self.assertEqual(
            self.manifest["supported_models"],
            [
                "hydrostatic_column",
                "floating_body",
                "buoyancy_apparent_weight",
                "hydrostatic_pressure_points",
                "hydraulic_press",
                "communicating_vessels",
            ],
        )
        for exercise_id, model in (
            (HYDRO_ID, "hydrostatic_column"),
            (FLOATING_ID, "floating_body"),
            (FLOATING_REUSE_ID, "floating_body"),
            (APPARENT_WEIGHT_ID, "buoyancy_apparent_weight"),
            (PRESSURE_POINTS_ID, "hydrostatic_pressure_points"),
            (HYDRAULIC_PRESS_ID, "hydraulic_press"),
            (COMMUNICATING_VESSELS_ID, "communicating_vessels"),
        ):
            with self.subTest(exercise=exercise_id):
                config, _ = load_simulation_config(
                    exercise_id,
                    ENGINE_NAME,
                    root=ROOT,
                )
                self.assertEqual(config["model"], model)

    def test_oneof_requires_floating_specific_parameters(self) -> None:
        config = deepcopy(self.floating)
        del config["parameters"]["body_density_initial_kg_m3"]
        errors = self.errors_for(config)
        self.assertTrue(
            any(
                "body_density_initial_kg_m3" in error and "mancante" in error
                for error in errors
            )
        )

    def test_oneof_rejects_parameters_from_another_model(self) -> None:
        config = deepcopy(self.floating)
        config["parameters"]["depth_reference_m"] = 0.2
        errors = self.errors_for(config)
        self.assertTrue(
            any(
                "depth_reference_m" in error and "sconosciuta" in error
                for error in errors
            )
        )

    def test_fraction_bounds_are_checked_before_runtime(self) -> None:
        config = deepcopy(self.floating)
        config["parameters"]["submerged_fraction_final"] = 1.2
        errors = self.errors_for(config)
        self.assertTrue(
            any(
                "submerged_fraction_final" in error and "<= 1" in error
                for error in errors
            )
        )


if __name__ == "__main__":
    unittest.main()

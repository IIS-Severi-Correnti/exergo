from __future__ import annotations

import copy
import unittest

from scripts.simulation_config import load_simulation_config, validate_config_data


GAS_EXPANSION_IDS = (
    "FIS-TER-GAS-001",
    "FIS-TER-GAS-002",
    "FIS-TER-GAS-004",
    "FIS-TER-GAS-005",
)


class IdealGasExpansionConfigTests(unittest.TestCase):
    def test_all_new_configs_validate_against_multi_model_manifest(self) -> None:
        for exercise_id in GAS_EXPANSION_IDS:
            with self.subTest(exercise=exercise_id):
                config, manifest = load_simulation_config(exercise_id, "ideal_gas_process")
                self.assertEqual(validate_config_data(config, manifest), [])

    def test_process_comparison_rejects_parameters_from_piecewise_model(self) -> None:
        config, manifest = load_simulation_config("FIS-TER-GAS-001", "ideal_gas_process")
        invalid = copy.deepcopy(config)
        invalid["parameters"]["pressure_C_over_B_ratio"] = 0.5
        errors = validate_config_data(invalid, manifest)
        self.assertTrue(errors)
        self.assertTrue(any("pressure_C_over_B_ratio" in error for error in errors))

    def test_piecewise_model_rejects_compression_larger_than_initial_volume(self) -> None:
        config, manifest = load_simulation_config("FIS-TER-GAS-002", "ideal_gas_process")
        invalid = copy.deepcopy(config)
        invalid["parameters"]["volume_compression_m3"] = invalid["parameters"]["volume_A_m3"]
        errors = validate_config_data(invalid, manifest)
        self.assertTrue(errors)
        self.assertTrue(any("volume_A_m3" in error for error in errors))

    def test_cycle_rejects_swapped_normalized_bounds(self) -> None:
        config, manifest = load_simulation_config("FIS-TER-GAS-004", "ideal_gas_process")
        invalid = copy.deepcopy(config)
        invalid["parameters"]["pressure_high_ratio"] = 0.5
        errors = validate_config_data(invalid, manifest)
        self.assertTrue(errors)
        self.assertTrue(any("pressure_high_ratio" in error for error in errors))


if __name__ == "__main__":
    unittest.main()

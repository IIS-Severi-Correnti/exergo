from __future__ import annotations

import copy
import unittest

from scripts.simulation_config import load_simulation_config, validate_config_data


WAVE_IDS = (
    "FIS-OND-DOP-001",
    "FIS-OND-DOP-002",
    "FIS-OND-COR-001",
    "FIS-OND-MEC-001",
    "FIS-OND-SUO-001",
)


class WaveConfigTests(unittest.TestCase):
    def test_all_real_wave_configs_validate(self) -> None:
        for exercise_id in WAVE_IDS:
            with self.subTest(exercise=exercise_id):
                config, manifest = load_simulation_config(exercise_id, "wave_1d")
                self.assertEqual(validate_config_data(config, manifest), [])

    def test_model_specific_parameters_do_not_leak(self) -> None:
        config, manifest = load_simulation_config("FIS-OND-DOP-002", "wave_1d")
        invalid = copy.deepcopy(config)
        invalid["parameters"]["wave_speed_m_s"] = 343
        errors = validate_config_data(invalid, manifest)
        self.assertTrue(errors)
        self.assertTrue(any("wave_speed_m_s" in error for error in errors))

    def test_normalized_energy_model_rejects_dimensional_parameters(self) -> None:
        config, manifest = load_simulation_config("FIS-OND-MEC-001", "wave_1d")
        invalid = copy.deepcopy(config)
        invalid["parameters"]["emitted_frequency_Hz"] = 100
        errors = validate_config_data(invalid, manifest)
        self.assertTrue(errors)


if __name__ == "__main__":
    unittest.main()

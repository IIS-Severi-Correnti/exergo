from __future__ import annotations

import copy
import unittest

from scripts.simulation_config import load_simulation_config, validate_config_data


OPTICS_IDS = (
    "FIS-OTT-RFL-001",
    "FIS-OTT-RIF-001",
    "FIS-OTT-RIF-002",
    "FIS-OTT-RIF-003",
    "FIS-OTT-SPE-001",
)


class RayOpticsConfigTests(unittest.TestCase):
    def test_all_real_optics_configs_validate(self) -> None:
        for exercise_id in OPTICS_IDS:
            with self.subTest(exercise=exercise_id):
                config, manifest = load_simulation_config(exercise_id, "ray_optics")
                self.assertEqual(validate_config_data(config, manifest), [])

    def test_model_specific_parameters_do_not_leak_between_variants(self) -> None:
        config, manifest = load_simulation_config("FIS-OTT-RIF-003", "ray_optics")
        invalid = copy.deepcopy(config)
        invalid["parameters"]["magnification"] = 3
        errors = validate_config_data(invalid, manifest)
        self.assertTrue(errors)
        self.assertTrue(any("magnification" in error for error in errors))

    def test_mirror_requires_its_own_parameter_set(self) -> None:
        config, manifest = load_simulation_config("FIS-OTT-SPE-001", "ray_optics")
        invalid = copy.deepcopy(config)
        del invalid["parameters"]["focal_length_m"]
        errors = validate_config_data(invalid, manifest)
        self.assertTrue(errors)


if __name__ == "__main__":
    unittest.main()

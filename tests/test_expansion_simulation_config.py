from __future__ import annotations

import copy
import unittest

from scripts.simulation_config import (
    load_simulation_config,
    validate_config_data,
)


DC_IDS = (
    "FIS-CIR-BAS-001",
    "FIS-CIR-COR-001",
    "FIS-CIR-OHM-001",
    "FIS-CIR-OHM-002",
    "FIS-CIR-RES-001",
)
CAL_IDS = (
    "FIS-TER-CAL-001",
    "FIS-TER-CAL-002",
    "FIS-TER-EQ-001",
    "FIS-TER-EQ-002",
    "FIS-TER-PAS-001",
)


class ExpansionSimulationConfigTests(unittest.TestCase):
    def test_all_ten_configs_validate_against_their_manifests(self) -> None:
        for engine, ids in (("dc_circuit", DC_IDS), ("calorimetry", CAL_IDS)):
            for exercise_id in ids:
                with self.subTest(engine=engine, exercise=exercise_id):
                    config, manifest = load_simulation_config(exercise_id, engine)
                    self.assertEqual(validate_config_data(config, manifest), [])

    def test_topology_config_rejects_invented_electrical_parameters(self) -> None:
        config, manifest = load_simulation_config("FIS-CIR-BAS-001", "dc_circuit")
        invalid = copy.deepcopy(config)
        invalid["parameters"]["voltage_V"] = 12
        errors = validate_config_data(invalid, manifest)
        self.assertTrue(errors)
        self.assertTrue(any("voltage_V" in error for error in errors))

    def test_calorimetry_variants_reject_parameters_from_other_models(self) -> None:
        config, manifest = load_simulation_config("FIS-TER-CAL-001", "calorimetry")
        invalid = copy.deepcopy(config)
        invalid["parameters"]["duration_s"] = 3600
        errors = validate_config_data(invalid, manifest)
        self.assertTrue(errors)
        self.assertTrue(any("duration_s" in error for error in errors))


if __name__ == "__main__":
    unittest.main()

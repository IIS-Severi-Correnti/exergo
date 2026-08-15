from __future__ import annotations

import copy
from pathlib import Path
import unittest

from scripts.simulation_config import load_config, load_engine_manifest, validate_config_data


ROOT = Path(__file__).resolve().parents[1]
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
            manifest = load_engine_manifest(engine)
            for exercise_id in ids:
                with self.subTest(engine=engine, exercise=exercise_id):
                    config = load_config(ROOT / "simulazioni" / "config" / f"{exercise_id}.json")
                    validate_config_data(config, manifest)

    def test_topology_config_rejects_invented_electrical_parameters(self) -> None:
        manifest = load_engine_manifest("dc_circuit")
        config = load_config(ROOT / "simulazioni" / "config" / "FIS-CIR-BAS-001.json")
        invalid = copy.deepcopy(config)
        invalid["parameters"]["voltage_V"] = 12
        with self.assertRaises(ValueError):
            validate_config_data(invalid, manifest)

    def test_calorimetry_variants_reject_parameters_from_other_models(self) -> None:
        manifest = load_engine_manifest("calorimetry")
        config = load_config(ROOT / "simulazioni" / "config" / "FIS-TER-CAL-001.json")
        invalid = copy.deepcopy(config)
        invalid["parameters"]["duration_s"] = 3600
        with self.assertRaises(ValueError):
            validate_config_data(invalid, manifest)


if __name__ == "__main__":
    unittest.main()

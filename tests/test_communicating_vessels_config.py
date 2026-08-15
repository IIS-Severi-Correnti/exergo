from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path
import unittest

from scripts.simulation_config import load_engine_manifest, validate_config_data


ROOT = Path(__file__).resolve().parents[1]
ENGINE = "fluid_statics"
CONFIG_PATH = ROOT / "simulazioni" / "config" / "FIS-FLU-VAS-001.json"


class CommunicatingVesselsConfigTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.manifest = load_engine_manifest(ENGINE, root=ROOT)
        cls.config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))

    def errors(self, config: dict) -> list[str]:
        return validate_config_data(config, self.manifest, expected_engine=ENGINE)

    def test_real_config_is_valid_and_uses_only_structural_problem_data(self) -> None:
        self.assertEqual(self.errors(self.config), [])
        self.assertEqual(self.config["model"], "communicating_vessels")
        self.assertEqual(self.config["parameters"], {"branch_count": 4})

    def test_branch_count_bounds_are_validated_before_runtime(self) -> None:
        for value in (1, 7):
            with self.subTest(value=value):
                config = deepcopy(self.config)
                config["parameters"]["branch_count"] = value
                self.assertTrue(self.errors(config))

    def test_metric_height_or_density_cannot_be_smuggled_into_qualitative_config(self) -> None:
        for key, value in (("fluid_density_kg_m3", 1000), ("reference_height_m", 0.4)):
            with self.subTest(key=key):
                config = deepcopy(self.config)
                config["parameters"][key] = value
                errors = self.errors(config)
                self.assertTrue(any(key in error and "sconosciuta" in error for error in errors))


if __name__ == "__main__":
    unittest.main()

from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path
import shutil
import tempfile
import unittest

from scripts.simulation_config import (
    SimulationConfigError,
    load_engine_manifest,
    load_simulation_config,
    validate_config_data,
)


ROOT = Path(__file__).resolve().parents[1]
ENGINE_NAME = "rotational_platform"
EXERCISE_ID = "FIS-ROT-ANG-001"


class SimulationConfigTests(unittest.TestCase):
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

    def test_valid_configuration(self) -> None:
        self.assertEqual(self.errors_for(deepcopy(self.config)), [])

    def test_missing_parameter(self) -> None:
        config = deepcopy(self.config)
        del config["parameters"]["participant_mass_kg"]
        errors = self.errors_for(config)
        self.assertTrue(
            any(
                "participant_mass_kg" in error and "mancante" in error
                for error in errors
            )
        )

    def test_misspelled_parameter_is_not_silently_ignored(self) -> None:
        config = deepcopy(self.config)
        config["parameters"]["participant_mass_k"] = config["parameters"].pop(
            "participant_mass_kg"
        )
        errors = self.errors_for(config)
        self.assertTrue(
            any(
                "participant_mass_k" in error and "sconosciuta" in error
                for error in errors
            )
        )
        self.assertTrue(
            any(
                "participant_mass_kg" in error and "mancante" in error
                for error in errors
            )
        )

    def test_wrong_parameter_type(self) -> None:
        config = deepcopy(self.config)
        config["parameters"]["platform_mass_kg"] = "200"
        self.assertTrue(
            any("tipo non valido" in error for error in self.errors_for(config))
        )

    def test_physically_invalid_values(self) -> None:
        config = deepcopy(self.config)
        config["parameters"]["participant_mass_kg"] = 0
        config["parameters"]["participant_radius_m"] = 1.1
        config["parameters"]["participant_count"] = 2.5
        errors = self.errors_for(config)
        self.assertTrue(
            any(
                "participant_mass_kg" in error and "> 0" in error
                for error in errors
            )
        )
        self.assertTrue(
            any(
                "participant_radius_m" in error and "platform_radius_m" in error
                for error in errors
            )
        )
        self.assertTrue(
            any(
                "participant_count" in error and "tipo non valido" in error
                for error in errors
            )
        )

    def test_unknown_schema_version(self) -> None:
        config = deepcopy(self.config)
        config["schema_version"] = 2
        self.assertTrue(
            any(
                "versione non supportata" in error
                for error in self.errors_for(config)
            )
        )

    def test_unsupported_model(self) -> None:
        config = deepcopy(self.config)
        config["model"] = "full_angular_momentum"
        self.assertTrue(
            any(
                "modello non supportato" in error
                for error in self.errors_for(config)
            )
        )

    def test_engine_mismatch(self) -> None:
        config = deepcopy(self.config)
        config["engine"] = "another_engine"
        errors = self.errors_for(config)
        self.assertTrue(any("metadato Simulazione" in error for error in errors))

    def test_nonexistent_engine(self) -> None:
        with self.assertRaisesRegex(SimulationConfigError, "motore inesistente"):
            load_engine_manifest("missing_engine", root=ROOT)

    def test_invalid_json_file(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            temporary_root = Path(temporary_directory)
            target_engine = (
                temporary_root / "simulazioni" / "engines" / ENGINE_NAME
            )
            target_engine.parent.mkdir(parents=True)
            shutil.copytree(
                ROOT / "simulazioni" / "engines" / ENGINE_NAME,
                target_engine,
            )
            config_directory = temporary_root / "simulazioni" / "config"
            config_directory.mkdir()
            (config_directory / f"{EXERCISE_ID}.json").write_text(
                '{"schema_version": 1,',
                encoding="utf-8",
            )

            with self.assertRaisesRegex(SimulationConfigError, "JSON non valido"):
                load_simulation_config(
                    EXERCISE_ID,
                    ENGINE_NAME,
                    root=temporary_root,
                )


if __name__ == "__main__":
    unittest.main()

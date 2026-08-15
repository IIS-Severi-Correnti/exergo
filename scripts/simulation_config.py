"""Carica e valida configurazioni di simulazione dichiarate dagli esercizi."""

from __future__ import annotations

import json
import math
from pathlib import Path
import re
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SIMULATIONS_DIRNAME = "simulazioni"
SUPPORTED_MANIFEST_VERSION = 1
ENGINE_NAME_PATTERN = re.compile(r"^[a-z][a-z0-9_]*$")


class SimulationConfigError(ValueError):
    """Errore leggibile relativo a manifest o configurazioni di simulazione."""


def _read_json_object(path: Path, description: str) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise SimulationConfigError(f"{description} non trovato: {path}") from exc
    except json.JSONDecodeError as exc:
        raise SimulationConfigError(
            f"{description} JSON non valido ({path}:{exc.lineno}:{exc.colno}): {exc.msg}"
        ) from exc

    if not isinstance(value, dict):
        raise SimulationConfigError(f"{description} deve contenere un oggetto JSON: {path}")
    return value


def engine_directory(engine_name: str, *, root: Path = ROOT) -> Path:
    if not ENGINE_NAME_PATTERN.fullmatch(engine_name):
        raise SimulationConfigError(f"nome motore non valido: {engine_name!r}")
    return root / SIMULATIONS_DIRNAME / "engines" / engine_name


def config_path_for(exercise_id: str, *, root: Path = ROOT) -> Path:
    if not re.fullmatch(r"[A-Z0-9-]+", exercise_id):
        raise SimulationConfigError(f"ID esercizio non valido per una configurazione: {exercise_id!r}")
    return root / SIMULATIONS_DIRNAME / "config" / f"{exercise_id}.json"


def load_engine_manifest(engine_name: str, *, root: Path = ROOT) -> dict[str, Any]:
    directory = engine_directory(engine_name, root=root)
    if not directory.is_dir():
        raise SimulationConfigError(f"motore inesistente: {engine_name}")

    manifest_path = directory / "manifest.json"
    manifest = _read_json_object(manifest_path, "manifest del motore")

    if manifest.get("manifest_version") != SUPPORTED_MANIFEST_VERSION:
        raise SimulationConfigError(
            f"{manifest_path}: manifest_version non supportata: "
            f"{manifest.get('manifest_version')!r}"
        )
    if manifest.get("engine") != engine_name:
        raise SimulationConfigError(
            f"{manifest_path}: engine {manifest.get('engine')!r} non corrisponde a {engine_name!r}"
        )

    for key in ("entry_points", "supported_schema_versions", "supported_models", "config_schema"):
        if key not in manifest:
            raise SimulationConfigError(f"{manifest_path}: chiave obbligatoria mancante: {key}")

    entry_points = manifest["entry_points"]
    if not isinstance(entry_points, dict):
        raise SimulationConfigError(f"{manifest_path}: entry_points deve essere un oggetto")
    for role in ("engine", "view"):
        relative_entry = entry_points.get(role)
        if not isinstance(relative_entry, str) or not relative_entry:
            raise SimulationConfigError(f"{manifest_path}: entry_points.{role} non valido")

    for role, relative_entry in entry_points.items():
        if not isinstance(relative_entry, str) or not relative_entry:
            raise SimulationConfigError(f"{manifest_path}: entry_points.{role} non valido")
        entry_path = (directory / relative_entry).resolve()
        if not entry_path.is_relative_to(directory.resolve()) or not entry_path.is_file():
            raise SimulationConfigError(
                f"{manifest_path}: entry point {role} non trovato nel motore: {relative_entry!r}"
            )

    if not isinstance(manifest["supported_schema_versions"], list):
        raise SimulationConfigError(f"{manifest_path}: supported_schema_versions deve essere una lista")
    if not isinstance(manifest["supported_models"], list):
        raise SimulationConfigError(f"{manifest_path}: supported_models deve essere una lista")
    if not isinstance(manifest["config_schema"], dict):
        raise SimulationConfigError(f"{manifest_path}: config_schema deve essere un oggetto")

    return manifest


def _matches_type(value: Any, expected: str) -> bool:
    if expected == "object":
        return isinstance(value, dict)
    if expected == "array":
        return isinstance(value, list)
    if expected == "string":
        return isinstance(value, str)
    if expected == "boolean":
        return isinstance(value, bool)
    if expected == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if expected == "number":
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            return False
        try:
            return math.isfinite(value)
        except OverflowError:
            return False
    return False


def _validate_schema(value: Any, schema: dict[str, Any], path: str, errors: list[str]) -> None:
    expected_type = schema.get("type")
    if isinstance(expected_type, str) and not _matches_type(value, expected_type):
        errors.append(f"{path}: tipo non valido, atteso {expected_type}")
        return

    if "const" in schema and value != schema["const"]:
        errors.append(f"{path}: valore atteso {schema['const']!r}, trovato {value!r}")
    if "enum" in schema and value not in schema["enum"]:
        errors.append(f"{path}: valore non supportato: {value!r}")

    if isinstance(value, dict):
        properties = schema.get("properties", {})
        required = schema.get("required", [])
        if not isinstance(properties, dict) or not isinstance(required, list):
            errors.append(f"{path}: schema interno non valido")
            return

        for key in required:
            if key not in value:
                errors.append(f"{path}.{key}: parametro obbligatorio mancante")

        if schema.get("additionalProperties") is False:
            for key in value:
                if key not in properties:
                    errors.append(f"{path}.{key}: chiave sconosciuta")

        for key, child_value in value.items():
            child_schema = properties.get(key)
            if isinstance(child_schema, dict):
                _validate_schema(child_value, child_schema, f"{path}.{key}", errors)

    if isinstance(value, str) and "minLength" in schema:
        if len(value.strip()) < schema["minLength"]:
            errors.append(f"{path}: stringa vuota o troppo corta")

    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if "minimum" in schema and value < schema["minimum"]:
            errors.append(f"{path}: deve essere >= {schema['minimum']}")
        if "exclusiveMinimum" in schema and value <= schema["exclusiveMinimum"]:
            errors.append(f"{path}: deve essere > {schema['exclusiveMinimum']}")
        if "maximum" in schema and value > schema["maximum"]:
            errors.append(f"{path}: deve essere <= {schema['maximum']}")

    if "oneOf" in schema:
        variants = schema["oneOf"]
        if not isinstance(variants, list) or not variants:
            errors.append(f"{path}: oneOf deve contenere almeno una variante")
            return

        matches = 0
        variant_errors: list[list[str]] = []
        for variant in variants:
            if not isinstance(variant, dict):
                errors.append(f"{path}: variante oneOf non valida")
                continue
            candidate_errors: list[str] = []
            _validate_schema(value, variant, path, candidate_errors)
            variant_errors.append(candidate_errors)
            if not candidate_errors:
                matches += 1

        if matches != 1:
            errors.append(
                f"{path}: deve corrispondere esattamente a una variante oneOf; "
                f"corrispondenze trovate: {matches}"
            )
            if matches == 0 and variant_errors:
                closest = min(variant_errors, key=len)
                errors.extend(closest)


def _read_nested(config: dict[str, Any], dotted_path: str) -> Any:
    value: Any = config
    for part in dotted_path.split("."):
        if not isinstance(value, dict) or part not in value:
            raise KeyError(dotted_path)
        value = value[part]
    return value


def _validate_constraints(
    config: dict[str, Any], manifest: dict[str, Any], errors: list[str]
) -> None:
    operators = {
        "<=": lambda left, right: left <= right,
        "<": lambda left, right: left < right,
        ">=": lambda left, right: left >= right,
        ">": lambda left, right: left > right,
        "==": lambda left, right: left == right,
    }
    constraints = manifest.get("constraints", [])
    if not isinstance(constraints, list):
        errors.append("manifest.constraints: deve essere una lista")
        return

    for constraint in constraints:
        if not isinstance(constraint, dict):
            errors.append("manifest.constraints: vincolo non valido")
            continue
        operator = operators.get(constraint.get("operator"))
        if operator is None:
            errors.append(f"manifest.constraints: operatore non supportato {constraint.get('operator')!r}")
            continue
        try:
            left = _read_nested(config, constraint["left"])
            right = _read_nested(config, constraint["right"])
            valid = operator(left, right)
        except (KeyError, TypeError):
            continue
        if not valid:
            errors.append(constraint.get("message", "vincolo di configurazione non rispettato"))


def validate_config_data(
    config: dict[str, Any],
    manifest: dict[str, Any],
    *,
    expected_engine: str | None = None,
) -> list[str]:
    """Restituisce tutti gli errori di una configurazione rispetto al manifest."""
    errors: list[str] = []
    _validate_schema(config, manifest["config_schema"], "config", errors)

    engine_name = config.get("engine")
    manifest_engine = manifest.get("engine")
    if expected_engine is not None and engine_name != expected_engine:
        errors.append(
            f"config.engine: {engine_name!r} non corrisponde al metadato Simulazione {expected_engine!r}"
        )
    if engine_name != manifest_engine:
        errors.append(
            f"config.engine: {engine_name!r} non corrisponde al manifest {manifest_engine!r}"
        )

    version = config.get("schema_version")
    if version not in manifest["supported_schema_versions"]:
        errors.append(f"config.schema_version: versione non supportata: {version!r}")

    model = config.get("model")
    if model not in manifest["supported_models"]:
        errors.append(f"config.model: modello non supportato: {model!r}")

    _validate_constraints(config, manifest, errors)
    return errors


def load_simulation_config(
    exercise_id: str,
    engine_name: str,
    *,
    root: Path = ROOT,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Carica manifest e config, sollevando un unico errore leggibile se non validi."""
    manifest = load_engine_manifest(engine_name, root=root)
    config_path = config_path_for(exercise_id, root=root)
    config = _read_json_object(config_path, "configurazione della simulazione")
    errors = validate_config_data(config, manifest, expected_engine=engine_name)
    if errors:
        details = "\n".join(f"- {error}" for error in errors)
        raise SimulationConfigError(f"{config_path}: configurazione non valida:\n{details}")
    return config, manifest

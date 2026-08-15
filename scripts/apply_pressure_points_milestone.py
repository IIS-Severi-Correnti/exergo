from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: Path, before: str, after: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    if after in text:
        return
    if before not in text:
        raise SystemExit(f"marker non trovato ({label}): {before[:120]!r}")
    path.write_text(text.replace(before, after, 1), encoding="utf-8")


def patch_engine() -> None:
    path = ROOT / "simulazioni/engines/fluid_statics/engine.js"
    replace_once(
        path,
        "function clamp(value, minimum, maximum) {\n  return Math.min(maximum, Math.max(minimum, value));\n}\n",
        "function clamp(value, minimum, maximum) {\n  return Math.min(maximum, Math.max(minimum, value));\n}\n\nfunction hydrostaticGaugePressure(densityKgM3, gravityMS2, depthM) {\n  return densityKgM3 * gravityMS2 * depthM;\n}\n",
        "hydrostatic helper",
    )
    replace_once(
        path,
        "      const pressureReference = density * parameters.gravity_m_s2 * parameters.depth_reference_m;\n      const pressureMoving = density * parameters.gravity_m_s2 * depthMoving;",
        "      const pressureReference = hydrostaticGaugePressure(\n        density,\n        parameters.gravity_m_s2,\n        parameters.depth_reference_m,\n      );\n      const pressureMoving = hydrostaticGaugePressure(\n        density,\n        parameters.gravity_m_s2,\n        depthMoving,\n      );",
        "reuse Stevino helper",
    )

    marker = "function createHydrostaticColumnRuntime(parameters, interaction) {"
    insertion = """function validateHydrostaticPressurePoints(parameters, interaction) {
  requireObject(parameters, \"parameters\");
  validateCommonInteraction(interaction);
  requireFiniteNumber(parameters.fluid_density_kg_m3, \"fluid_density_kg_m3\", {
    positive: true,
  });
  requireFiniteNumber(parameters.gravity_m_s2, \"gravity_m_s2\", { positive: true });
  requireFiniteNumber(parameters.upper_depth_m, \"upper_depth_m\", { positive: true });
  requireFiniteNumber(parameters.lower_depth_m, \"lower_depth_m\", { positive: true });
  if (parameters.lower_depth_m <= parameters.upper_depth_m) {
    throw new RangeError(\"lower_depth_m deve essere maggiore di upper_depth_m\");
  }
}

""" + marker
    replace_once(path, marker, insertion, "pressure-points validator")

    marker = "function floatingRegime(bodyDensity, fluidDensity) {"
    insertion = """function createHydrostaticPressurePointsRuntime(parameters) {
  const depthSpan = parameters.lower_depth_m - parameters.upper_depth_m;

  return Object.freeze({
    derive(progress) {
      const movingDepth = parameters.upper_depth_m + progress * depthSpan;
      const pressureUpper = hydrostaticGaugePressure(
        parameters.fluid_density_kg_m3,
        parameters.gravity_m_s2,
        parameters.upper_depth_m,
      );
      const pressureMoving = hydrostaticGaugePressure(
        parameters.fluid_density_kg_m3,
        parameters.gravity_m_s2,
        movingDepth,
      );
      const pressureLower = hydrostaticGaugePressure(
        parameters.fluid_density_kg_m3,
        parameters.gravity_m_s2,
        parameters.lower_depth_m,
      );
      const depthTolerance = Math.max(1e-12, depthSpan * 1e-9);

      return Object.freeze({
        fluid_density_kg_m3: parameters.fluid_density_kg_m3,
        gravity_m_s2: parameters.gravity_m_s2,
        upper_depth_m: parameters.upper_depth_m,
        moving_depth_m: movingDepth,
        lower_depth_m: parameters.lower_depth_m,
        gauge_pressure_upper_Pa: pressureUpper,
        gauge_pressure_moving_Pa: pressureMoving,
        gauge_pressure_lower_Pa: pressureLower,
        moving_matches_upper:
          Math.abs(movingDepth - parameters.upper_depth_m) <= depthTolerance,
        moving_matches_lower:
          Math.abs(movingDepth - parameters.lower_depth_m) <= depthTolerance,
      });
    },
    dispatch() {
      return false;
    },
    reset() {},
  });
}

""" + marker
    replace_once(path, marker, insertion, "pressure-points runtime")

    replace_once(
        path,
        "  floating_body: Object.freeze({\n    validate: validateFloatingBody,\n    createRuntime: createFloatingBodyRuntime,\n  }),",
        "  floating_body: Object.freeze({\n    validate: validateFloatingBody,\n    createRuntime: createFloatingBodyRuntime,\n  }),\n  hydrostatic_pressure_points: Object.freeze({\n    validate: validateHydrostaticPressurePoints,\n    createRuntime: createHydrostaticPressurePointsRuntime,\n  }),",
        "pressure-points model definition",
    )


def patch_manifest() -> None:
    path = ROOT / "simulazioni/engines/fluid_statics/manifest.json"
    manifest = json.loads(path.read_text(encoding="utf-8"))
    if "hydrostatic_pressure_points" in manifest["supported_models"]:
        return

    manifest["entry_points"]["pressure_points_view"] = "pressure_points_view.js"
    manifest["supported_models"].append("hydrostatic_pressure_points")
    manifest["config_schema"]["properties"]["model"]["enum"].append(
        "hydrostatic_pressure_points"
    )

    parameters = manifest["config_schema"]["properties"]["parameters"]["properties"]
    parameters["upper_depth_m"] = {"type": "number", "exclusiveMinimum": 0}
    parameters["lower_depth_m"] = {"type": "number", "exclusiveMinimum": 0}

    display = manifest["config_schema"]["properties"]["display"]["properties"]
    display["show_pressure_values"] = {"type": "boolean"}
    display["show_horizontal_independence_note"] = {"type": "boolean"}

    didactics = manifest["config_schema"]["properties"]["didactics"]["properties"]
    for key in (
        "upper_fixed_label_it",
        "moving_point_label_it",
        "lower_left_label_it",
        "lower_center_label_it",
        "lower_right_label_it",
    ):
        didactics[key] = {"type": "string", "minLength": 1}

    manifest["config_schema"]["oneOf"].append(
        {
            "properties": {
                "model": {"const": "hydrostatic_pressure_points"},
                "parameters": {
                    "required": [
                        "fluid_density_kg_m3",
                        "gravity_m_s2",
                        "upper_depth_m",
                        "lower_depth_m",
                    ],
                    "additionalProperties": False,
                    "properties": {
                        "fluid_density_kg_m3": {},
                        "gravity_m_s2": {},
                        "upper_depth_m": {},
                        "lower_depth_m": {},
                    },
                },
                "interaction": {
                    "required": [
                        "allow_play",
                        "allow_pause",
                        "allow_reset",
                        "allow_scrub",
                        "playback_duration_s",
                    ],
                    "additionalProperties": False,
                    "properties": {
                        "allow_play": {},
                        "allow_pause": {},
                        "allow_reset": {},
                        "allow_scrub": {},
                        "playback_duration_s": {},
                    },
                },
                "display": {
                    "required": [
                        "show_equations",
                        "show_pressure_values",
                        "show_horizontal_independence_note",
                    ],
                    "additionalProperties": False,
                    "properties": {
                        "show_equations": {},
                        "show_pressure_values": {},
                        "show_horizontal_independence_note": {},
                    },
                },
                "didactics": {
                    "required": [
                        "model_note_it",
                        "learning_action_it",
                        "fluid_label_it",
                        "upper_fixed_label_it",
                        "moving_point_label_it",
                        "lower_left_label_it",
                        "lower_center_label_it",
                        "lower_right_label_it",
                        "exploration_note_it",
                    ],
                    "additionalProperties": False,
                    "properties": {
                        "model_note_it": {},
                        "learning_action_it": {},
                        "fluid_label_it": {},
                        "upper_fixed_label_it": {},
                        "moving_point_label_it": {},
                        "lower_left_label_it": {},
                        "lower_center_label_it": {},
                        "lower_right_label_it": {},
                        "exploration_note_it": {},
                    },
                },
            }
        }
    )
    manifest["constraints"].append(
        {
            "left": "parameters.lower_depth_m",
            "operator": ">",
            "right": "parameters.upper_depth_m",
            "message": "lower_depth_m deve essere maggiore di upper_depth_m",
        }
    )
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def patch_view_router() -> None:
    path = ROOT / "simulazioni/engines/fluid_statics/multi_view.js"
    replace_once(
        path,
        'import { createSimulationView as createApparentWeightView } from "./apparent_weight_view.js";\n',
        'import { createSimulationView as createApparentWeightView } from "./apparent_weight_view.js";\nimport { createSimulationView as createPressurePointsView } from "./pressure_points_view.js";\n',
        "pressure view import",
    )
    replace_once(
        path,
        '  if (context.config.model === "buoyancy_apparent_weight") {\n    return createApparentWeightView(context);\n  }\n',
        '  if (context.config.model === "buoyancy_apparent_weight") {\n    return createApparentWeightView(context);\n  }\n  if (context.config.model === "hydrostatic_pressure_points") {\n    return createPressurePointsView(context);\n  }\n',
        "pressure view routing",
    )


def patch_style() -> None:
    path = ROOT / "simulazioni/engines/fluid_statics/style.css"
    text = path.read_text(encoding="utf-8")
    if ".fluid-pressure-point" in text:
        return
    text += """

.fluid-pressure-guide {
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-dasharray: 5 6;
  opacity: 0.28;
}

.fluid-pressure-point {
  fill: #d77724;
  stroke: currentColor;
  stroke-width: 2.5;
}

.fluid-pressure-point-moving {
  fill: #087f8c;
}

.fluid-pressure-point-label,
.fluid-pressure-relation {
  fill: currentColor;
  font-family: system-ui, sans-serif;
}

.fluid-pressure-point-label {
  font-size: 16px;
  font-weight: 750;
}

.fluid-pressure-relation {
  font-size: 16px;
  font-weight: 700;
}
"""
    path.write_text(text, encoding="utf-8")


def patch_exercise() -> None:
    path = ROOT / "esercizi/fisica/fluidostatica/pressione_idrostatica/FIS-FLU-PID-003.tex"
    replace_once(
        path,
        "% Licenza: CC-BY-SA-4.0\n",
        "% Licenza: CC-BY-SA-4.0\n% Simulazione: fluid_statics\n",
        "exercise simulation metadata",
    )


def patch_contract_tests() -> None:
    path = ROOT / "tests/test_fluid_statics_config.py"
    replace_once(
        path,
        'APPARENT_WEIGHT_ID = "FIS-FLU-ARC-002"\n',
        'APPARENT_WEIGHT_ID = "FIS-FLU-ARC-002"\nPRESSURE_POINTS_ID = "FIS-FLU-PID-003"\n',
        "config test constant",
    )
    replace_once(
        path,
        '                "buoyancy_apparent_weight",\n            ],',
        '                "buoyancy_apparent_weight",\n                "hydrostatic_pressure_points",\n            ],',
        "supported models expectation",
    )
    replace_once(
        path,
        '            (APPARENT_WEIGHT_ID, "buoyancy_apparent_weight"),\n',
        '            (APPARENT_WEIGHT_ID, "buoyancy_apparent_weight"),\n            (PRESSURE_POINTS_ID, "hydrostatic_pressure_points"),\n',
        "pressure config expectation",
    )

    path = ROOT / "tests/test_site_generation.py"
    replace_once(
        path,
        'FLUID_APPARENT_WEIGHT_ID = "FIS-FLU-ARC-002"\n',
        'FLUID_APPARENT_WEIGHT_ID = "FIS-FLU-ARC-002"\nFLUID_PRESSURE_POINTS_ID = "FIS-FLU-PID-003"\n',
        "site test constant",
    )
    replace_once(
        path,
        "        cls.normal = next(\n",
        "        cls.fluid_pressure_points = next(\n            exercise\n            for exercise in cls.exercises\n            if exercise.exercise_id == FLUID_PRESSURE_POINTS_ID\n        )\n        cls.normal = next(\n",
        "site pressure exercise fixture",
    )
    replace_once(
        path,
        "    def test_fluid_exercises_share_one_engine_across_three_models(self) -> None:\n",
        "    def test_fluid_exercises_share_one_engine_across_four_models(self) -> None:\n",
        "site model count test name",
    )
    replace_once(
        path,
        "            self.fluid_apparent_weight,\n        )",
        "            self.fluid_apparent_weight,\n            self.fluid_pressure_points,\n        )",
        "site fluid exercise tuple",
    )
    replace_once(
        path,
        "    def test_site_contains_four_engines_and_ten_configs(self) -> None:\n",
        "    def test_site_contains_four_engines_and_eleven_configs(self) -> None:\n",
        "site config count name",
    )
    replace_once(
        path,
        '                "engines/fluid_statics/apparent_weight_view.js",\n                "engines/fluid_statics/style.css",',
        '                "engines/fluid_statics/apparent_weight_view.js",\n                "engines/fluid_statics/pressure_points_view.js",\n                "engines/fluid_statics/style.css",',
        "site expected pressure view asset",
    )
    replace_once(
        path,
        '                f"config/{FLUID_APPARENT_WEIGHT_ID}.json",\n            }',
        '                f"config/{FLUID_APPARENT_WEIGHT_ID}.json",\n                f"config/{FLUID_PRESSURE_POINTS_ID}.json",\n            }',
        "site expected pressure config",
    )
    replace_once(
        path,
        "                FLUID_APPARENT_WEIGHT_ID,\n            ):",
        "                FLUID_APPARENT_WEIGHT_ID,\n                FLUID_PRESSURE_POINTS_ID,\n            ):",
        "site page existence pressure config",
    )
    replace_once(
        path,
        "    def test_fluid_subset_copies_one_engine_and_three_models(self) -> None:\n",
        "    def test_fluid_subset_copies_one_engine_and_four_models(self) -> None:\n",
        "fluid subset model count name",
    )
    replace_once(
        path,
        "                self.fluid_apparent_weight,\n            ]",
        "                self.fluid_apparent_weight,\n                self.fluid_pressure_points,\n            ]",
        "fluid subset exercise list",
    )
    replace_once(
        path,
        '                "engines/fluid_statics/apparent_weight_view.js",\n                "engines/fluid_statics/style.css",\n            ):',
        '                "engines/fluid_statics/apparent_weight_view.js",\n                "engines/fluid_statics/pressure_points_view.js",\n                "engines/fluid_statics/style.css",\n            ):',
        "fluid subset asset list",
    )
    replace_once(
        path,
        "                FLUID_APPARENT_WEIGHT_ID,\n            ):\n                self.assertIn(f\"config/{exercise_id}.json\", actual_assets)",
        "                FLUID_APPARENT_WEIGHT_ID,\n                FLUID_PRESSURE_POINTS_ID,\n            ):\n                self.assertIn(f\"config/{exercise_id}.json\", actual_assets)",
        "fluid subset config list",
    )


def main() -> None:
    patch_engine()
    patch_manifest()
    patch_view_router()
    patch_style()
    patch_exercise()
    patch_contract_tests()


if __name__ == "__main__":
    main()

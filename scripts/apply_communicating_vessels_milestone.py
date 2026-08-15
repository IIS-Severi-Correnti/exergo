from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected exactly one occurrence, found {count}: {old[:100]!r}")
    write(path, text.replace(old, new, 1))


def replace_all_checked(path: str, old: str, new: str, expected: int) -> None:
    text = read(path)
    count = text.count(old)
    if count != expected:
        raise RuntimeError(f"{path}: expected {expected} occurrences, found {count}: {old[:100]!r}")
    write(path, text.replace(old, new))


# Exercise metadata ------------------------------------------------------
exercise_path = "esercizi/fisica/fluidostatica/vasi_comunicanti/FIS-FLU-VAS-001.tex"
replace_once(
    exercise_path,
    "% Licenza: CC-BY-SA-4.0\n\n\\begin{esercizio}",
    "% Licenza: CC-BY-SA-4.0\n% Simulazione: fluid_statics\n\n\\begin{esercizio}",
)

# Configuration ----------------------------------------------------------
config = {
    "schema_version": 1,
    "engine": "fluid_statics",
    "model": "communicating_vessels",
    "parameters": {"branch_count": 4},
    "interaction": {
        "allow_play": True,
        "allow_pause": True,
        "allow_reset": True,
        "allow_scrub": True,
        "playback_duration_s": 5.0,
    },
    "display": {
        "show_equations": True,
        "show_pressure_comparison": True,
        "show_shape_independence_note": True,
    },
    "didactics": {
        "model_note_it": (
            "Confronto schematico di stati idrostatici nei vasi comunicanti. "
            "Gli scarti di livello sono normalizzati e non rappresentano quote metriche; "
            "il playback non descrive il tempo né un travaso volume-conservativo."
        ),
        "learning_action_it": (
            "Riduci il dislivello schematico e osserva che l'equilibrio è possibile solo "
            "quando, alla stessa quota di collegamento, le pressioni coincidono e i livelli "
            "dello stesso liquido diventano uguali."
        ),
        "fluid_label_it": "stesso liquido",
        "exploration_note_it": (
            "La forma dei quattro recipienti è volutamente diversa. La coordinata di "
            "esplorazione confronta stati, non ricostruisce la dinamica reale del fluido."
        ),
    },
}
write(
    "simulazioni/config/FIS-FLU-VAS-001.json",
    json.dumps(config, indent=2, ensure_ascii=False) + "\n",
)

# Base engine ------------------------------------------------------------
engine_path = "simulazioni/engines/fluid_statics/engine.js"
validation = r'''
function validateCommunicatingVessels(parameters, interaction) {
  requireObject(parameters, "parameters");
  validateCommonInteraction(interaction);
  requireFiniteNumber(parameters.branch_count, "branch_count", { minimum: 2, maximum: 6 });
  if (!Number.isInteger(parameters.branch_count)) {
    throw new RangeError("branch_count deve essere un intero");
  }
}

'''
replace_once(
    engine_path,
    "function createHydrostaticColumnRuntime(parameters, interaction) {",
    validation + "function createHydrostaticColumnRuntime(parameters, interaction) {",
)

runtime = r'''
function createCommunicatingVesselsRuntime(parameters) {
  const center = (parameters.branch_count - 1) / 2;
  const scale = Math.max(center, 0.5);
  const pattern = Object.freeze(
    Array.from(
      { length: parameters.branch_count },
      (_, index) => (index - center) / scale,
    ),
  );

  return Object.freeze({
    derive(progress) {
      const imbalanceFraction = 1 - progress;
      const levelOffsets = Object.freeze(
        pattern.map((value) => value * imbalanceFraction),
      );
      const minimumOffset = Math.min(...levelOffsets);
      const maximumOffset = Math.max(...levelOffsets);
      const pressureSpread = maximumOffset - minimumOffset;
      const tolerance = 1e-12;

      return Object.freeze({
        branch_count: parameters.branch_count,
        imbalance_fraction: imbalanceFraction,
        level_offsets_relative: levelOffsets,
        pressure_head_offsets_relative: levelOffsets,
        pressure_spread_relative: pressureSpread,
        equilibrium_reached: pressureSpread <= tolerance,
      });
    },
    dispatch() {
      return false;
    },
    reset() {},
  });
}

'''
replace_once(
    engine_path,
    "function floatingRegime(bodyDensity, fluidDensity) {",
    runtime + "function floatingRegime(bodyDensity, fluidDensity) {",
)
replace_once(
    engine_path,
    "  hydraulic_press: Object.freeze({\n    validate: validateHydraulicPress,\n    createRuntime: createHydraulicPressRuntime,\n  }),\n});",
    "  hydraulic_press: Object.freeze({\n    validate: validateHydraulicPress,\n    createRuntime: createHydraulicPressRuntime,\n  }),\n  communicating_vessels: Object.freeze({\n    validate: validateCommunicatingVessels,\n    createRuntime: createCommunicatingVesselsRuntime,\n  }),\n});",
)

# Multi-view dispatcher --------------------------------------------------
multi_view_path = "simulazioni/engines/fluid_statics/multi_view.js"
replace_once(
    multi_view_path,
    'import { createSimulationView as createHydraulicPressView } from "./hydraulic_press_view.js";\n',
    'import { createSimulationView as createHydraulicPressView } from "./hydraulic_press_view.js";\n'
    'import { createSimulationView as createCommunicatingVesselsView } from "./communicating_vessels_view.js";\n',
)
replace_once(
    multi_view_path,
    '  if (context.config.model === "hydraulic_press") {\n    return createHydraulicPressView(context);\n  }\n',
    '  if (context.config.model === "hydraulic_press") {\n    return createHydraulicPressView(context);\n  }\n'
    '  if (context.config.model === "communicating_vessels") {\n    return createCommunicatingVesselsView(context);\n  }\n',
)

# Communicating-vessels view --------------------------------------------
view = r'''let instanceCount = 0;

function formatPercent(value) {
  return new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: 0,
  }).format(value * 100);
}

const SHAPES = Object.freeze([
  Object.freeze({ topHalf: 22, bodyHalf: 28 }),
  Object.freeze({ topHalf: 38, bodyHalf: 24 }),
  Object.freeze({ topHalf: 25, bodyHalf: 44 }),
  Object.freeze({ topHalf: 34, bodyHalf: 34 }),
  Object.freeze({ topHalf: 18, bodyHalf: 38 }),
  Object.freeze({ topHalf: 42, bodyHalf: 29 }),
]);

function vesselPath(cx, shape, topY = 68, shoulderY = 142, bottomY = 270) {
  return [
    `M ${cx - shape.topHalf} ${topY}`,
    `L ${cx - shape.topHalf} ${shoulderY - 18}`,
    `L ${cx - shape.bodyHalf} ${shoulderY}`,
    `L ${cx - shape.bodyHalf} ${bottomY}`,
    `L ${cx + shape.bodyHalf} ${bottomY}`,
    `L ${cx + shape.bodyHalf} ${shoulderY}`,
    `L ${cx + shape.topHalf} ${shoulderY - 18}`,
    `L ${cx + shape.topHalf} ${topY}`,
  ].join(" ");
}

function closedVesselPath(cx, shape, topY = 68, shoulderY = 142, bottomY = 270) {
  return `${vesselPath(cx, shape, topY, shoulderY, bottomY)} L ${cx - shape.topHalf} ${topY} Z`;
}

export function createSimulationView({ container, config }) {
  instanceCount += 1;
  const figureTitleId = `communicating-vessels-title-${instanceCount}`;
  const figureDescriptionId = `communicating-vessels-description-${instanceCount}`;
  const progressId = `communicating-vessels-progress-${instanceCount}`;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const branchCount = config.parameters.branch_count;
  const xStart = 105;
  const xEnd = 655;
  const xStep = branchCount === 1 ? 0 : (xEnd - xStart) / (branchCount - 1);
  const branchMarkup = [];

  for (let index = 0; index < branchCount; index += 1) {
    const cx = xStart + index * xStep;
    const shape = SHAPES[index % SHAPES.length];
    const clipId = `communicating-vessel-clip-${instanceCount}-${index}`;
    branchMarkup.push(`
      <defs>
        <clipPath id="${clipId}">
          <path d="${closedVesselPath(cx, shape)}"></path>
        </clipPath>
      </defs>
      <g data-branch="${index}">
        <rect class="communicating-vessels-liquid" x="${cx - 50}" y="170" width="100" height="100"
          clip-path="url(#${clipId})" data-liquid></rect>
        <path class="communicating-vessels-outline" d="${vesselPath(cx, shape)}"></path>
        <circle class="communicating-vessels-pressure-point" cx="${cx}" cy="255" r="7"></circle>
        <text class="communicating-vessels-pressure-label" x="${cx}" y="306" text-anchor="middle">p${index + 1}</text>
      </g>
    `);
  }

  container.innerHTML = `
    <p class="simulation-instruction">
      <strong>Esplora:</strong> <span data-learning-action></span>
    </p>

    <figure class="fluid-statics-figure communicating-vessels-figure">
      <svg class="fluid-statics-svg communicating-vessels-svg" viewBox="0 0 760 350" role="img"
        aria-labelledby="${figureTitleId} ${figureDescriptionId}">
        <title id="${figureTitleId}">Quattro vasi comunicanti di forma diversa</title>
        <desc id="${figureDescriptionId}">Con livelli diversi le pressioni idrostatiche alla base differiscono; nello stato di equilibrio i livelli e le pressioni alla stessa quota coincidono.</desc>
        <line class="communicating-vessels-reference" x1="62" y1="170" x2="698" y2="170"></line>
        ${branchMarkup.join("")}
        <rect class="communicating-vessels-channel" x="70" y="252" width="620" height="34" rx="12"></rect>
        <text class="communicating-vessels-fluid-label" x="380" y="335" text-anchor="middle" data-fluid-label></text>
      </svg>
      <figcaption>
        Le forme sono schematiche. Gli scarti verticali servono solo a confrontare stati idrostatici:
        non sono quote metriche e l'animazione non ricostruisce il travaso reale.
      </figcaption>
    </figure>

    <div class="fluid-statics-panel">
      <div class="fluid-statics-scrubber">
        <label for="${progressId}">
          <span>Avvicinamento all'equilibrio — coordinata didattica</span>
          <output data-progress-output for="${progressId}">0%</output>
        </label>
        <input id="${progressId}" type="range" min="0" max="1000" step="1" value="0"
          data-simulation-action="set_progress" data-simulation-event="input">
        <div class="fluid-statics-slider-scale" aria-hidden="true">
          <span>livelli diversi</span><span>livelli uguali</span>
        </div>
      </div>

      <div class="simulation-controls" aria-label="Controlli simulazione">
        <button type="button" data-simulation-action="play">Play</button>
        <button type="button" data-simulation-action="pause">Pausa</button>
        <button type="button" data-simulation-action="reset">Reset</button>
      </div>

      <dl class="simulation-values fluid-statics-values" aria-label="Stato del confronto idrostatico">
        <div><dt>Rami comunicanti</dt><dd><span data-value="branch-count">--</span></dd></div>
        <div><dt>Dislivello schematico</dt><dd><span data-value="imbalance">--</span>%</dd></div>
        <div data-display="pressure-comparison"><dt>Pressioni alla base</dt><dd><span data-value="pressure-state">--</span></dd></div>
      </dl>

      <div class="simulation-equations" data-display="equations" aria-label="Relazioni del modello">
        <p><var>p</var><sub>i</sub> = <var>p</var><sub>0</sub> + ρg<var>h</var><sub>i</sub></p>
        <p>stesso <var>p</var><sub>0</sub>, stessa ρ e stesso g ⇒ <var>p</var><sub>i</sub> = <var>p</var><sub>j</sub> ⇔ <var>h</var><sub>i</sub> = <var>h</var><sub>j</sub></p>
      </div>

      <p class="fluid-statics-width-note" data-display="shape-note">
        <strong>Forma dei recipienti:</strong> modifica il volume contenuto a una data quota, ma non la condizione di equilibrio dello stesso liquido aperto alla stessa pressione esterna.
      </p>
      <p class="simulation-status" data-simulation-status aria-live="polite"></p>
      <p class="simulation-model-note"><strong>Limiti del modello:</strong> <span data-model-note></span></p>
      <p class="simulation-model-note"><span data-exploration-note></span></p>
      <p class="simulation-error" data-simulation-error role="alert" hidden></p>
    </div>
  `;

  const progressSlider = container.querySelector('[data-simulation-action="set_progress"]');
  const status = container.querySelector("[data-simulation-status]");
  const figureDescription = container.querySelector(`#${figureDescriptionId}`);
  const branchGroups = [...container.querySelectorAll("[data-branch]")];

  container.querySelector("[data-learning-action]").textContent = config.didactics.learning_action_it;
  container.querySelector("[data-model-note]").textContent = config.didactics.model_note_it;
  container.querySelector("[data-exploration-note]").textContent = config.didactics.exploration_note_it;
  container.querySelector("[data-fluid-label]").textContent = config.didactics.fluid_label_it;
  container.querySelector('[data-display="equations"]').hidden = !config.display.show_equations;
  container.querySelector('[data-display="pressure-comparison"]').hidden = !config.display.show_pressure_comparison;
  container.querySelector('[data-display="shape-note"]').hidden = !config.display.show_shape_independence_note;

  return Object.freeze({
    get motionAllowed() {
      return !reducedMotion.matches;
    },

    onMotionPreferenceChange(callback) {
      reducedMotion.addEventListener("change", callback);
      return () => reducedMotion.removeEventListener("change", callback);
    },

    resolveActionPayload({ action, control }) {
      if (action === "set_progress") {
        return { progress: Number(control.value) / Number(control.max) };
      }
      return undefined;
    },

    describeControls(state, { motionAllowed = true } = {}) {
      const reducedMotionTitle =
        "Playback disattivato dalla preferenza di riduzione del movimento; usa il cursore";
      return {
        play: {
          disabled: state.is_running || state.is_complete || !motionAllowed,
          hidden: !config.interaction.allow_play,
          title: motionAllowed
            ? "Confronta progressivamente lo stato a livelli diversi con l'equilibrio"
            : reducedMotionTitle,
        },
        pause: {
          disabled: !state.is_running || !motionAllowed,
          hidden: !config.interaction.allow_pause,
          title: motionAllowed ? "Metti in pausa l'esplorazione" : reducedMotionTitle,
        },
        reset: { hidden: !config.interaction.allow_reset },
        set_progress: {
          disabled: !config.interaction.allow_scrub,
          value: Math.round(state.progress * Number(progressSlider.max)),
          ariaValueText: state.equilibrium_reached
            ? "equilibrio: livelli e pressioni alla base uguali"
            : `confronto didattico ${formatPercent(state.progress)} per cento verso l'equilibrio`,
        },
      };
    },

    render(state) {
      branchGroups.forEach((group, index) => {
        const offset = state.level_offsets_relative[index];
        const liquid = group.querySelector("[data-liquid]");
        const levelY = 170 - offset * 54;
        liquid.setAttribute("y", String(levelY));
        liquid.setAttribute("height", String(270 - levelY));
        group.dataset.levelOffset = String(offset);
      });

      container.querySelector("[data-progress-output]").textContent =
        `${formatPercent(state.progress)}%`;
      container.querySelector('[data-value="branch-count"]').textContent = String(state.branch_count);
      container.querySelector('[data-value="imbalance"]').textContent =
        formatPercent(state.imbalance_fraction);
      container.querySelector('[data-value="pressure-state"]').textContent =
        state.equilibrium_reached ? "uguali" : "diverse";

      status.textContent = state.equilibrium_reached
        ? "Equilibrio idrostatico: p₁ = p₂ = … alla quota di collegamento e tutti i livelli coincidono."
        : "Se i livelli sono diversi, le colonne hanno altezze diverse e quindi alla base le pressioni non coincidono: questo non può essere uno stato di equilibrio statico.";

      figureDescription.textContent = state.equilibrium_reached
        ? `${state.branch_count} vasi comunicanti di forma diversa con lo stesso livello e pressioni uguali alla base.`
        : `${state.branch_count} vasi comunicanti con livelli schematicamente diversi e pressioni idrostatiche diverse alla base.`;

      container.dataset.branchCount = String(state.branch_count);
      container.dataset.imbalanceFraction = String(state.imbalance_fraction);
      container.dataset.pressureSpreadRelative = String(state.pressure_spread_relative);
      container.dataset.equilibriumReached = String(state.equilibrium_reached);
      container.dataset.levelOffsets = state.level_offsets_relative.join(",");
    },
  });
}
'''
write("simulazioni/engines/fluid_statics/communicating_vessels_view.js", view)

# CSS --------------------------------------------------------------------
style_path = "simulazioni/engines/fluid_statics/style.css"
style = read(style_path)
if "/* Communicating vessels" not in style:
    style += r'''

/* Communicating vessels ------------------------------------------------ */
.communicating-vessels-svg {
  max-width: 820px;
}

.communicating-vessels-outline {
  fill: none;
  stroke: currentColor;
  stroke-width: 4;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.communicating-vessels-liquid,
.communicating-vessels-channel {
  fill: #5ba7d8;
  fill-opacity: 0.34;
}

.communicating-vessels-channel {
  stroke: currentColor;
  stroke-width: 3;
}

.communicating-vessels-reference {
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-dasharray: 7 7;
  opacity: 0.34;
}

.communicating-vessels-pressure-point {
  fill: #d77724;
  stroke: currentColor;
  stroke-width: 2;
}

.communicating-vessels-pressure-label,
.communicating-vessels-fluid-label {
  fill: currentColor;
  font-family: system-ui, sans-serif;
  font-weight: 750;
}

.communicating-vessels-pressure-label {
  font-size: 15px;
}

.communicating-vessels-fluid-label {
  font-size: 16px;
}

@media (max-width: 520px) {
  .communicating-vessels-pressure-label {
    font-size: 13px;
  }
}
'''
    write(style_path, style)

# Manifest ---------------------------------------------------------------
manifest_path = ROOT / "simulazioni/engines/fluid_statics/manifest.json"
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
manifest["entry_points"]["communicating_vessels_view"] = "communicating_vessels_view.js"
if "communicating_vessels" not in manifest["supported_models"]:
    manifest["supported_models"].append("communicating_vessels")
model_enum = manifest["config_schema"]["properties"]["model"]["enum"]
if "communicating_vessels" not in model_enum:
    model_enum.append("communicating_vessels")
manifest["config_schema"]["properties"]["parameters"]["properties"]["branch_count"] = {
    "type": "integer",
    "minimum": 2,
    "maximum": 6,
}
manifest["config_schema"]["properties"]["display"]["properties"]["show_pressure_comparison"] = {"type": "boolean"}
manifest["config_schema"]["properties"]["display"]["properties"]["show_shape_independence_note"] = {"type": "boolean"}
variant = {
    "properties": {
        "model": {"const": "communicating_vessels"},
        "parameters": {
            "required": ["branch_count"],
            "additionalProperties": False,
            "properties": {"branch_count": {}},
        },
        "interaction": {
            "required": ["allow_play", "allow_pause", "allow_reset", "allow_scrub", "playback_duration_s"],
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
            "required": ["show_equations", "show_pressure_comparison", "show_shape_independence_note"],
            "additionalProperties": False,
            "properties": {
                "show_equations": {},
                "show_pressure_comparison": {},
                "show_shape_independence_note": {},
            },
        },
        "didactics": {
            "required": ["model_note_it", "learning_action_it", "fluid_label_it", "exploration_note_it"],
            "additionalProperties": False,
            "properties": {
                "model_note_it": {},
                "learning_action_it": {},
                "fluid_label_it": {},
                "exploration_note_it": {},
            },
        },
    }
}
if not any(item.get("properties", {}).get("model", {}).get("const") == "communicating_vessels" for item in manifest["config_schema"]["oneOf"]):
    manifest["config_schema"]["oneOf"].append(variant)
manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

# JavaScript model tests -------------------------------------------------
js_test = r'''import test from "node:test";
import assert from "node:assert/strict";

import { createSimulationEngine } from "../../simulazioni/engines/fluid_statics/engine.js";

function config(branchCount = 4) {
  return {
    schema_version: 1,
    engine: "fluid_statics",
    model: "communicating_vessels",
    parameters: { branch_count: branchCount },
    interaction: {
      allow_play: true,
      allow_pause: true,
      allow_reset: true,
      allow_scrub: true,
      playback_duration_s: 5,
    },
  };
}

test("communicating vessels converge from unequal normalized heads to one level", () => {
  const engine = createSimulationEngine(config());
  const initial = engine.getState();
  assert.equal(initial.branch_count, 4);
  assert.deepEqual(initial.level_offsets_relative, [-1, -1 / 3, 1 / 3, 1]);
  assert.equal(initial.pressure_spread_relative, 2);
  assert.equal(initial.equilibrium_reached, false);

  const middle = engine.setProgress(0.5);
  assert.deepEqual(middle.level_offsets_relative, [-0.5, -1 / 6, 1 / 6, 0.5]);
  assert.equal(middle.pressure_spread_relative, 1);
  assert.equal(middle.imbalance_fraction, 0.5);

  const final = engine.setProgress(1);
  assert.deepEqual(final.level_offsets_relative, [0, 0, 0, 0]);
  assert.equal(final.pressure_spread_relative, 0);
  assert.equal(final.equilibrium_reached, true);
});

test("communicating vessels generalize to a different branch count", () => {
  const engine = createSimulationEngine(config(2));
  assert.deepEqual(engine.getState().level_offsets_relative, [-1, 1]);
  assert.deepEqual(engine.setProgress(1).level_offsets_relative, [0, 0]);
});

test("communicating vessels lifecycle remains generic", () => {
  const engine = createSimulationEngine(config());
  assert.equal(engine.play().is_running, true);
  const advanced = engine.advance(2.5);
  assert.equal(advanced.progress, 0.5);
  assert.equal(engine.pause().is_running, false);
  const reset = engine.reset();
  assert.equal(reset.progress, 0);
  assert.equal(reset.pressure_spread_relative, 2);
});

test("communicating vessels reject non-integer or unsupported branch counts", () => {
  assert.throws(() => createSimulationEngine(config(1)), /branch_count/);
  assert.throws(() => createSimulationEngine(config(7)), /branch_count/);
  assert.throws(() => createSimulationEngine(config(3.5)), /branch_count deve essere un intero/);
});
'''
write("tests/js/fluid_statics_communicating_vessels.test.mjs", js_test)

# Python config tests ----------------------------------------------------
py_test = r'''from __future__ import annotations

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
'''
write("tests/test_communicating_vessels_config.py", py_test)

# Static site focused test -----------------------------------------------
site_test = r'''from __future__ import annotations

from pathlib import Path
import tempfile
import unittest

from scripts import genera_sito


EXERCISE_ID = "FIS-FLU-VAS-001"


class CommunicatingVesselsSiteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.exercise = next(
            exercise for exercise in genera_sito.read_exercises()
            if exercise.exercise_id == EXERCISE_ID
        )

    def test_exercise_loads_fluid_statics_before_solution(self) -> None:
        page = genera_sito.render_exercise_page(self.exercise)
        self.assertIn('data-simulation-engine="fluid_statics"', page)
        self.assertIn("FIS-FLU-VAS-001.json", page)
        self.assertLess(page.index(">Simulazione</h2>"), page.index("<summary>Soluzione</summary>"))

    def test_subset_contains_communicating_vessels_assets(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            output = Path(temporary_directory) / "site"
            genera_sito.write_site([self.exercise], output)
            root = output / "assets" / "simulazioni"
            self.assertTrue((root / "engines/fluid_statics/communicating_vessels_view.js").is_file())
            self.assertTrue((root / "config/FIS-FLU-VAS-001.json").is_file())


if __name__ == "__main__":
    unittest.main()
'''
write("tests/test_communicating_vessels_site.py", site_test)

# Shared config test -----------------------------------------------------
config_test_path = "tests/test_fluid_statics_config.py"
replace_once(
    config_test_path,
    'HYDRAULIC_PRESS_ID = "FIS-FLU-PAS-001"\n',
    'HYDRAULIC_PRESS_ID = "FIS-FLU-PAS-001"\nCOMMUNICATING_VESSELS_ID = "FIS-FLU-VAS-001"\n',
)
replace_once(
    config_test_path,
    '                "hydraulic_press",\n',
    '                "hydraulic_press",\n                "communicating_vessels",\n',
)
replace_once(
    config_test_path,
    '            (HYDRAULIC_PRESS_ID, "hydraulic_press"),\n',
    '            (HYDRAULIC_PRESS_ID, "hydraulic_press"),\n            (COMMUNICATING_VESSELS_ID, "communicating_vessels"),\n',
)

# Shared site generation test -------------------------------------------
site_generation = "tests/test_site_generation.py"
replace_once(
    site_generation,
    'FLUID_HYDRAULIC_PRESS_ID = "FIS-FLU-PAS-001"\n',
    'FLUID_HYDRAULIC_PRESS_ID = "FIS-FLU-PAS-001"\nFLUID_COMMUNICATING_VESSELS_ID = "FIS-FLU-VAS-001"\n',
)
replace_once(
    site_generation,
    '        cls.fluid_hydraulic_press = next(\n            exercise\n            for exercise in cls.exercises\n            if exercise.exercise_id == FLUID_HYDRAULIC_PRESS_ID\n        )\n',
    '        cls.fluid_hydraulic_press = next(\n            exercise\n            for exercise in cls.exercises\n            if exercise.exercise_id == FLUID_HYDRAULIC_PRESS_ID\n        )\n'
    '        cls.fluid_communicating_vessels = next(\n            exercise\n            for exercise in cls.exercises\n            if exercise.exercise_id == FLUID_COMMUNICATING_VESSELS_ID\n        )\n',
)
replace_once(site_generation, "test_fluid_exercises_share_one_engine_across_five_models", "test_fluid_exercises_share_one_engine_across_six_models")
replace_all_checked(
    site_generation,
    "            self.fluid_hydraulic_press,\n",
    "            self.fluid_hydraulic_press,\n            self.fluid_communicating_vessels,\n",
    2,
)
replace_once(site_generation, "test_site_contains_four_engines_and_twelve_configs", "test_site_contains_four_engines_and_thirteen_configs")
replace_all_checked(
    site_generation,
    '                "engines/fluid_statics/hydraulic_press_view.js",\n',
    '                "engines/fluid_statics/hydraulic_press_view.js",\n                "engines/fluid_statics/communicating_vessels_view.js",\n',
    2,
)
replace_once(
    site_generation,
    '                f"config/{FLUID_HYDRAULIC_PRESS_ID}.json",\n',
    '                f"config/{FLUID_HYDRAULIC_PRESS_ID}.json",\n                f"config/{FLUID_COMMUNICATING_VESSELS_ID}.json",\n',
)
replace_all_checked(
    site_generation,
    "                FLUID_HYDRAULIC_PRESS_ID,\n",
    "                FLUID_HYDRAULIC_PRESS_ID,\n                FLUID_COMMUNICATING_VESSELS_ID,\n",
    2,
)
replace_once(site_generation, "test_fluid_subset_copies_one_engine_and_five_models", "test_fluid_subset_copies_one_engine_and_six_models")

# Browser smoke ----------------------------------------------------------
browser = r'''<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <title>Exergo communicating vessels smoke test</title>
  <link rel="stylesheet" href="../../_site/assets/style.css">
  <link rel="stylesheet" href="../../_site/assets/simulazioni/core/simulation.css">
  <link rel="stylesheet" href="../../_site/assets/simulazioni/engines/fluid_statics/style.css">
</head>
<body>
  <main class="page">
    <p id="result">RUNNING</p>
    <section class="simulation-shell">
      <h2>Vasi comunicanti</h2>
      <div id="vessels" data-exergo-simulation
        data-simulation-engine="fluid_statics"
        data-simulation-config="../../_site/assets/simulazioni/config/FIS-FLU-VAS-001.json">
        <p data-simulation-error hidden></p>
      </div>
    </section>
  </main>

  <script type="module" src="../../_site/assets/simulazioni/core/runtime.js"></script>
  <script>
    const result = document.querySelector("#result");
    const simulation = document.querySelector("#vessels");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function finish(status, details) {
      result.textContent = status + ": " + details;
      result.dataset.status = status;
      document.title = status + " - Exergo communicating vessels smoke test";
    }

    function close(actual, expected, tolerance = 1e-8) {
      if (Math.abs(actual - expected) > tolerance) {
        throw new Error(actual + " != " + expected);
      }
    }

    const deadline = Date.now() + 6000;
    const timer = window.setInterval(() => {
      if (simulation?.dataset.simulationReady !== "true") {
        if (Date.now() > deadline) {
          window.clearInterval(timer);
          finish("FAIL", "inizializzazione scaduta");
        }
        return;
      }

      window.clearInterval(timer);
      try {
        const slider = simulation.querySelector('[data-simulation-action="set_progress"]');
        const play = simulation.querySelector('[data-simulation-action="play"]');
        const pause = simulation.querySelector('[data-simulation-action="pause"]');
        const reset = simulation.querySelector('[data-simulation-action="reset"]');

        if (simulation.dataset.branchCount !== "4") throw new Error("numero rami errato");
        close(Number(simulation.dataset.imbalanceFraction), 1);
        close(Number(simulation.dataset.pressureSpreadRelative), 2);
        if (simulation.dataset.equilibriumReached !== "false") throw new Error("equilibrio iniziale errato");
        if (play.disabled !== reducedMotion) throw new Error("semantica Play/reduced-motion errata");
        if (!pause.disabled) throw new Error("Pausa dovrebbe essere inizialmente disabilitata");

        slider.value = "500";
        slider.dispatchEvent(new Event("input", { bubbles: true }));
        close(Number(simulation.dataset.imbalanceFraction), 0.5);
        close(Number(simulation.dataset.pressureSpreadRelative), 1);
        if (simulation.dataset.equilibriumReached !== "false") throw new Error("equilibrio anticipato");

        slider.value = "1000";
        slider.dispatchEvent(new Event("input", { bubbles: true }));
        close(Number(simulation.dataset.imbalanceFraction), 0);
        close(Number(simulation.dataset.pressureSpreadRelative), 0);
        if (simulation.dataset.equilibriumReached !== "true") throw new Error("equilibrio finale non rilevato");
        if (!simulation.querySelector('[data-simulation-status]').textContent.includes("Equilibrio idrostatico")) {
          throw new Error("feedback finale mancante");
        }
        const offsets = simulation.dataset.levelOffsets.split(",").map(Number);
        if (!offsets.every((value) => Math.abs(value) < 1e-10)) throw new Error("livelli finali non uguali");

        reset.click();
        close(Number(simulation.dataset.pressureSpreadRelative), 2);
        if (slider.value !== "0") throw new Error("reset slider non riuscito");

        if (document.documentElement.scrollWidth > window.innerWidth + 1) {
          throw new Error("overflow orizzontale " + document.documentElement.scrollWidth + "px su viewport " + window.innerWidth + "px");
        }

        finish("PASS", "4 vasi, livelli -> equilibrio, reset, reduced motion=" + reducedMotion);
      } catch (error) {
        finish("FAIL", error.message);
      }
    }, 25);
  </script>
</body>
</html>
'''
write("tests/browser/communicating_vessels_smoke.html", browser)

# CI browser coverage ----------------------------------------------------
workflow_path = ".github/workflows/validate.yml"
workflow = read(workflow_path)
anchor = '''          grep -q 'data-status="PASS"' browser-artifacts/hydraulic-press-mobile-dom.html\n\n'''
commands = r'''          google-chrome \
            --headless=new \
            --no-sandbox \
            --disable-gpu \
            --virtual-time-budget=7000 \
            --dump-dom \
            http://127.0.0.1:8765/tests/browser/communicating_vessels_smoke.html \
            > browser-artifacts/communicating-vessels-dom.html

          grep -q 'data-status="PASS"' browser-artifacts/communicating-vessels-dom.html

          google-chrome \
            --headless=new \
            --no-sandbox \
            --disable-gpu \
            --force-prefers-reduced-motion \
            --virtual-time-budget=7000 \
            --dump-dom \
            http://127.0.0.1:8765/tests/browser/communicating_vessels_smoke.html \
            > browser-artifacts/communicating-vessels-reduced-motion-dom.html

          grep -q 'data-status="PASS"' browser-artifacts/communicating-vessels-reduced-motion-dom.html

          google-chrome \
            --headless=new \
            --no-sandbox \
            --disable-gpu \
            --window-size=430,3000 \
            --virtual-time-budget=7000 \
            --dump-dom \
            http://127.0.0.1:8765/tests/browser/communicating_vessels_smoke.html \
            > browser-artifacts/communicating-vessels-mobile-dom.html

          grep -q 'data-status="PASS"' browser-artifacts/communicating-vessels-mobile-dom.html

'''
if anchor not in workflow:
    raise RuntimeError("validate.yml: hydraulic mobile smoke anchor not found")
workflow = workflow.replace(anchor, anchor + commands, 1)

screenshot_anchor = '''          google-chrome \\\n            --headless=new \\\n            --no-sandbox \\\n            --disable-gpu \\\n            --hide-scrollbars \\\n            --virtual-time-budget=2500 \\\n            --window-size=430,3000 \\\n            --screenshot=browser-artifacts/hydraulic-press-mobile.png \\\n            http://127.0.0.1:8765/_site/esercizi/fis-flu-pas-001/\n'''
screenshot_commands = r'''

          google-chrome \
            --headless=new \
            --no-sandbox \
            --disable-gpu \
            --hide-scrollbars \
            --virtual-time-budget=2500 \
            --window-size=1440,2300 \
            --screenshot=browser-artifacts/communicating-vessels-desktop.png \
            http://127.0.0.1:8765/_site/esercizi/fis-flu-vas-001/

          google-chrome \
            --headless=new \
            --no-sandbox \
            --disable-gpu \
            --hide-scrollbars \
            --virtual-time-budget=2500 \
            --window-size=430,3000 \
            --screenshot=browser-artifacts/communicating-vessels-mobile.png \
            http://127.0.0.1:8765/_site/esercizi/fis-flu-vas-001/
'''
if screenshot_anchor not in workflow:
    raise RuntimeError("validate.yml: hydraulic screenshot anchor not found")
workflow = workflow.replace(screenshot_anchor, screenshot_anchor + screenshot_commands, 1)
write(workflow_path, workflow)

# Coverage map -----------------------------------------------------------
coverage_path = "metadata/simulation_coverage.csv"
replace_once(
    coverage_path,
    "FIS-FLU-VAS-001,planned,fluid_statics,communicating_vessels,P1,I livelli e l'uguaglianza della pressione alla stessa quota sono naturalmente interattivi.",
    "FIS-FLU-VAS-001,implemented,fluid_statics,communicating_vessels,P1,I livelli e l'uguaglianza della pressione alla stessa quota sono naturalmente interattivi.",
)

# Roadmap ---------------------------------------------------------------
roadmap = "docs/SIMULATION_ROADMAP.md"
replace_once(roadmap, "| `implemented` | 12 |", "| `implemented` | 13 |")
replace_once(roadmap, "| `planned` | 37 |", "| `planned` | 36 |")
replace_once(
    roadmap,
    "- `fluid_statics` — 7 esercizi, modelli `hydrostatic_column`, `floating_body`, `buoyancy_apparent_weight`, `hydrostatic_pressure_points` e `hydraulic_press`.",
    "- `fluid_statics` — 8 esercizi, modelli `hydrostatic_column`, `floating_body`, `buoyancy_apparent_weight`, `hydrostatic_pressure_points`, `hydraulic_press` e `communicating_vessels`.",
)
replace_once(roadmap, "## Backlog ordinato dopo `hydraulic_press`", "## Backlog ordinato dopo `communicating_vessels`")
replace_once(
    roadmap,
    '| 1 | `fluid_statics` | estensione engine attivo | 2 | 5 | 3 | 3.33 | Vasi comunicanti e getti |',
    '| 1 | `fluid_statics` | estensione engine attivo | 1 | 5 | 3 | 1.67 | Getti da fori a diversa profondità |',
)
section_anchor = "## Schema multi-model\n"
new_section = r'''### `communicating_vessels`

Copre `FIS-FLU-VAS-001` senza introdurre densità, quote metriche, sezioni o volumi assenti dal quesito. La config contiene soltanto `branch_count=4`, dato strutturale esplicito nel testo. Il motore usa scarti di livello normalizzati per confrontare stati:

```text
p_i = p_0 + ρ g h_i
stesso p_0, stessa ρ e stesso g
p_i = p_j  <=>  h_i = h_j
```

Il parametro di avanzamento riduce un indicatore di dislivello da `1` a `0`; non rappresenta tempo fisico e non simula un travaso volume-conservativo. Le forme diverse dei recipienti appartengono alla vista e non modificano la condizione idrostatica di equilibrio.

'''
text = read(roadmap)
if "### `communicating_vessels`" not in text:
    if section_anchor not in text:
        raise RuntimeError("roadmap: schema multi-model anchor missing")
    text = text.replace(section_anchor, new_section + section_anchor, 1)
write(roadmap, text)
replace_once(
    roadmap,
    "1. **`communicating_vessels`** — `FIS-FLU-VAS-001`;\n2. `orifice_outflow` — `FIS-FLU-PID-004`, mantenuto separato dalla parte strettamente idrostatica perché introduce il moto del fluido.\n\nIl prossimo modello da implementare è **`communicating_vessels`**: riusa l'uguaglianza della pressione alla stessa quota per mostrare come livelli e densità si vincolano tra rami comunicanti, completando la parte strettamente statica prima di introdurre il moto del fluido con `orifice_outflow`.",
    "1. **`orifice_outflow`** — `FIS-FLU-PID-004`, mantenuto separato dalla parte strettamente idrostatica perché introduce il moto del fluido.\n\nCon `communicating_vessels` la parte strettamente idrostatica del catalogo corrente è coperta. Il prossimo modello `fluid_statics` è **`orifice_outflow`**, che costituisce il passaggio controllato dall'equilibrio statico al moto del fluido e va quindi trattato come estensione concettualmente distinta.",
)

print("communicating_vessels milestone patch applied")

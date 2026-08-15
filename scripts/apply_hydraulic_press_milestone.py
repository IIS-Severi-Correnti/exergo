from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected exactly one occurrence, found {count}: {old[:80]!r}")
    write(path, content.replace(old, new, 1))


# 1. Link the existing exercise to fluid_statics without altering its numerical data.
exercise_path = "esercizi/fisica/fluidostatica/torchio_idraulico/FIS-FLU-PAS-001.tex"
replace_once(
    exercise_path,
    "% Licenza: CC-BY-SA-4.0\n\n\\begin{esercizio}",
    "% Licenza: CC-BY-SA-4.0\n% Simulazione: fluid_statics\n\n\\begin{esercizio}",
)

# 2. Strict exercise configuration: only quantities actually supplied by the problem.
config = {
    "schema_version": 1,
    "engine": "fluid_statics",
    "model": "hydraulic_press",
    "parameters": {
        "small_piston_force_N": 140,
        "load_mass_kg": 3800,
        "gravity_m_s2": 9.8,
    },
    "interaction": {
        "allow_play": True,
        "allow_pause": True,
        "allow_reset": True,
        "allow_scrub": True,
        "playback_duration_s": 6,
    },
    "display": {
        "show_equations": True,
        "show_force_balance": True,
        "show_area_ratio": True,
        "show_pressure_equality_note": True,
    },
    "didactics": {
        "model_note_it": (
            "Torchio idraulico ideale: fluido incomprimibile, pistoni senza attrito e differenze di quota trascurate. "
            "La vista usa soltanto il rapporto A₂/A₁: le larghezze disegnate dei pistoni sono schematiche e non rappresentano aree assolute. "
            "Il cursore modifica un parametro di progetto e non rappresenta lo scorrere del tempo."
        ),
        "learning_action_it": (
            "Aumenta il rapporto A₂/A₁ e osserva come cresce F₂ mantenendo la stessa pressione sui due pistoni. "
            "Individua il rapporto minimo che permette di equilibrare il peso dell'automobile."
        ),
        "small_piston_label_it": "Pistone piccolo",
        "large_piston_label_it": "Pistone grande",
        "load_label_it": "Automobile",
    },
}
write(
    "simulazioni/config/FIS-FLU-PAS-001.json",
    json.dumps(config, ensure_ascii=False, indent=2) + "\n",
)

# 3. Extend the DOM-free base engine with the Pascal/hydraulic-press model.
engine_path = "simulazioni/engines/fluid_statics/engine.js"
validator = r'''
function validateHydraulicPress(parameters, interaction) {
  requireObject(parameters, "parameters");
  validateCommonInteraction(interaction);
  requireFiniteNumber(parameters.small_piston_force_N, "small_piston_force_N", {
    positive: true,
  });
  requireFiniteNumber(parameters.load_mass_kg, "load_mass_kg", { positive: true });
  requireFiniteNumber(parameters.gravity_m_s2, "gravity_m_s2", { positive: true });

  const loadWeight = parameters.load_mass_kg * parameters.gravity_m_s2;
  if (loadWeight <= parameters.small_piston_force_N) {
    throw new RangeError(
      "load_mass_kg * gravity_m_s2 deve produrre un peso maggiore di small_piston_force_N",
    );
  }
}

'''
replace_once(
    engine_path,
    "function createHydrostaticColumnRuntime(parameters, interaction) {",
    validator + "function createHydrostaticColumnRuntime(parameters, interaction) {",
)

runtime = r'''
function createHydraulicPressRuntime(parameters) {
  const loadWeight = parameters.load_mass_kg * parameters.gravity_m_s2;
  const targetAreaRatio = loadWeight / parameters.small_piston_force_N;
  const ratioSpan = targetAreaRatio - 1;

  return Object.freeze({
    derive(progress) {
      const areaRatio = 1 + progress * ratioSpan;
      const largePistonForce = parameters.small_piston_force_N * areaRatio;
      const forceCoverage = largePistonForce / loadWeight;
      const tolerance = Math.max(1e-9, loadWeight * 1e-10);

      return Object.freeze({
        small_piston_force_N: parameters.small_piston_force_N,
        load_mass_kg: parameters.load_mass_kg,
        gravity_m_s2: parameters.gravity_m_s2,
        load_weight_N: loadWeight,
        area_ratio: areaRatio,
        target_area_ratio: targetAreaRatio,
        large_piston_force_N: largePistonForce,
        force_coverage: forceCoverage,
        force_deficit_N: Math.max(0, loadWeight - largePistonForce),
        balance_reached: Math.abs(largePistonForce - loadWeight) <= tolerance,
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
    '''  hydrostatic_pressure_points: Object.freeze({
    validate: validateHydrostaticPressurePoints,
    createRuntime: createHydrostaticPressurePointsRuntime,
  }),
});''',
    '''  hydrostatic_pressure_points: Object.freeze({
    validate: validateHydrostaticPressurePoints,
    createRuntime: createHydrostaticPressurePointsRuntime,
  }),
  hydraulic_press: Object.freeze({
    validate: validateHydraulicPress,
    createRuntime: createHydraulicPressRuntime,
  }),
});''',
)

# 4. Route the model to its dedicated view.
multi_view_path = "simulazioni/engines/fluid_statics/multi_view.js"
replace_once(
    multi_view_path,
    'import { createSimulationView as createPressurePointsView } from "./pressure_points_view.js";\n',
    'import { createSimulationView as createPressurePointsView } from "./pressure_points_view.js";\n'
    'import { createSimulationView as createHydraulicPressView } from "./hydraulic_press_view.js";\n',
)
replace_once(
    multi_view_path,
    '''  if (context.config.model === "hydrostatic_pressure_points") {
    return createPressurePointsView(context);
  }
  throw new RangeError(''',
    '''  if (context.config.model === "hydrostatic_pressure_points") {
    return createPressurePointsView(context);
  }
  if (context.config.model === "hydraulic_press") {
    return createHydraulicPressView(context);
  }
  throw new RangeError(''',
)

# 5. Extend the strict manifest programmatically.
manifest_path = ROOT / "simulazioni/engines/fluid_statics/manifest.json"
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
manifest["entry_points"]["hydraulic_press_view"] = "hydraulic_press_view.js"
if "hydraulic_press" in manifest["supported_models"]:
    raise RuntimeError("hydraulic_press already present in supported_models")
manifest["supported_models"].append("hydraulic_press")
props = manifest["config_schema"]["properties"]
props["model"]["enum"].append("hydraulic_press")
props["parameters"]["properties"]["small_piston_force_N"] = {
    "type": "number",
    "exclusiveMinimum": 0,
}
props["parameters"]["properties"]["load_mass_kg"] = {
    "type": "number",
    "exclusiveMinimum": 0,
}
props["display"]["properties"]["show_area_ratio"] = {"type": "boolean"}
props["display"]["properties"]["show_pressure_equality_note"] = {"type": "boolean"}
props["didactics"]["properties"]["small_piston_label_it"] = {
    "type": "string",
    "minLength": 1,
}
props["didactics"]["properties"]["large_piston_label_it"] = {
    "type": "string",
    "minLength": 1,
}
props["didactics"]["properties"]["load_label_it"] = {
    "type": "string",
    "minLength": 1,
}
manifest["config_schema"]["oneOf"].append(
    {
        "properties": {
            "model": {"const": "hydraulic_press"},
            "parameters": {
                "required": ["small_piston_force_N", "load_mass_kg", "gravity_m_s2"],
                "additionalProperties": False,
                "properties": {
                    "small_piston_force_N": {},
                    "load_mass_kg": {},
                    "gravity_m_s2": {},
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
                    "show_force_balance",
                    "show_area_ratio",
                    "show_pressure_equality_note",
                ],
                "additionalProperties": False,
                "properties": {
                    "show_equations": {},
                    "show_force_balance": {},
                    "show_area_ratio": {},
                    "show_pressure_equality_note": {},
                },
            },
            "didactics": {
                "required": [
                    "model_note_it",
                    "learning_action_it",
                    "small_piston_label_it",
                    "large_piston_label_it",
                    "load_label_it",
                ],
                "additionalProperties": False,
                "properties": {
                    "model_note_it": {},
                    "learning_action_it": {},
                    "small_piston_label_it": {},
                    "large_piston_label_it": {},
                    "load_label_it": {},
                },
            },
        }
    }
)
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# 6. Dedicated accessible view. Absolute piston areas are deliberately absent.
view = r'''let instanceCount = 0;

function formatNumber(value, maximumFractionDigits = 1) {
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value);
}

function setArrow(line, length, direction) {
  const baseY = direction === "up" ? 218 : 62;
  const endY = direction === "up" ? baseY - length : baseY + length;
  line.setAttribute("y1", String(baseY));
  line.setAttribute("y2", String(endY));
}

export function createSimulationView({ container, config }) {
  instanceCount += 1;
  const figureTitleId = `hydraulic-press-title-${instanceCount}`;
  const figureDescriptionId = `hydraulic-press-description-${instanceCount}`;
  const progressId = `hydraulic-press-progress-${instanceCount}`;
  const markerUpId = `hydraulic-arrow-up-${instanceCount}`;
  const markerDownId = `hydraulic-arrow-down-${instanceCount}`;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  container.innerHTML = `
    <p class="simulation-instruction">
      <strong>Esplora:</strong> <span data-learning-action></span>
    </p>

    <figure class="fluid-statics-figure hydraulic-press-figure">
      <svg class="fluid-statics-svg hydraulic-press-svg" viewBox="0 0 760 360" role="img"
        aria-labelledby="${figureTitleId} ${figureDescriptionId}">
        <title id="${figureTitleId}">Torchio idraulico ideale con due pistoni e automobile</title>
        <desc id="${figureDescriptionId}">La stessa pressione agisce sui due pistoni. Aumentando il rapporto tra le aree cresce la forza disponibile sul pistone grande.</desc>
        <defs>
          <marker id="${markerUpId}" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z"></path>
          </marker>
          <marker id="${markerDownId}" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z"></path>
          </marker>
        </defs>

        <rect class="hydraulic-fluid" x="118" y="215" width="524" height="67" rx="8"></rect>
        <rect class="hydraulic-chamber" x="118" y="132" width="92" height="150" rx="5"></rect>
        <rect class="hydraulic-chamber" x="430" y="132" width="212" height="150" rx="5"></rect>
        <line class="hydraulic-piston" x1="118" y1="156" x2="210" y2="156"></line>
        <line class="hydraulic-piston" x1="430" y1="156" x2="642" y2="156"></line>
        <rect class="hydraulic-piston-rod" x="157" y="112" width="14" height="44" rx="4"></rect>
        <rect class="hydraulic-piston-rod" x="529" y="104" width="14" height="52" rx="4"></rect>

        <g data-load-group>
          <rect class="hydraulic-car-body" x="468" y="72" width="136" height="36" rx="12"></rect>
          <circle class="hydraulic-wheel" cx="492" cy="110" r="11"></circle>
          <circle class="hydraulic-wheel" cx="580" cy="110" r="11"></circle>
          <text class="hydraulic-label" x="536" y="64" text-anchor="middle" data-load-label></text>
        </g>

        <line class="hydraulic-force hydraulic-force-input" x1="164" x2="164" marker-end="url(#${markerDownId})" data-input-force></line>
        <text class="hydraulic-force-text hydraulic-force-input-text" x="180" y="86" data-input-force-label></text>

        <line class="hydraulic-force hydraulic-force-output" x1="682" x2="682" marker-end="url(#${markerUpId})" data-output-force></line>
        <text class="hydraulic-force-text hydraulic-force-output-text" x="698" y="150" data-output-force-label></text>

        <line class="hydraulic-force hydraulic-force-weight" x1="536" x2="536" marker-end="url(#${markerDownId})" data-weight-force></line>
        <text class="hydraulic-force-text hydraulic-force-weight-text" x="550" y="88" data-weight-force-label></text>

        <text class="hydraulic-label" x="164" y="310" text-anchor="middle" data-small-piston-label></text>
        <text class="hydraulic-label" x="536" y="310" text-anchor="middle" data-large-piston-label></text>
        <text class="hydraulic-ratio-label" x="380" y="338" text-anchor="middle" data-ratio-label></text>
      </svg>
      <figcaption>
        Schema qualitativo: le larghezze disegnate dei pistoni non sono in scala.
        La simulazione usa il rapporto <var>A</var><sub>2</sub>/<var>A</var><sub>1</sub>, non aree assolute inventate.
      </figcaption>
    </figure>

    <div class="fluid-statics-panel">
      <div class="fluid-statics-scrubber">
        <label for="${progressId}">
          <span>Rapporto tra le superfici, A₂/A₁</span>
          <output data-progress-output for="${progressId}">--</output>
        </label>
        <input id="${progressId}" type="range" min="0" max="1000" step="1" value="0"
          data-simulation-action="set_progress" data-simulation-event="input">
        <div class="fluid-statics-slider-scale" aria-hidden="true">
          <span>1×</span>
          <span data-target-ratio></span>
        </div>
      </div>

      <div class="simulation-controls" aria-label="Controlli simulazione">
        <button type="button" data-simulation-action="play">Play</button>
        <button type="button" data-simulation-action="pause">Pausa</button>
        <button type="button" data-simulation-action="reset">Reset</button>
      </div>

      <dl class="simulation-values fluid-statics-values" aria-label="Grandezze fisiche correnti">
        <div><dt>Forza applicata F₁</dt><dd><span data-value="input-force">--</span> N</dd></div>
        <div><dt>Massa automobile</dt><dd><span data-value="load-mass">--</span> kg</dd></div>
        <div><dt>Peso automobile P</dt><dd><span data-value="load-weight">--</span> N</dd></div>
        <div data-display="area-ratio"><dt>A₂/A₁</dt><dd><span data-value="area-ratio">--</span>×</dd></div>
        <div><dt>Forza disponibile F₂</dt><dd><span data-value="output-force">--</span> N</dd></div>
        <div data-display="force-balance"><dt>F₂/P</dt><dd><span data-value="force-coverage">--</span>%</dd></div>
      </dl>

      <div class="simulation-equations" data-display="equations" aria-label="Relazioni del modello">
        <p><var>p</var><sub>1</sub> = <var>p</var><sub>2</sub></p>
        <p><var>F</var><sub>1</sub>/<var>A</var><sub>1</sub> = <var>F</var><sub>2</sub>/<var>A</var><sub>2</sub></p>
        <p><var>F</var><sub>2</sub> = <var>F</var><sub>1</sub> · (<var>A</var><sub>2</sub>/<var>A</var><sub>1</sub>)</p>
        <p><var>A</var><sub>2</sub>/<var>A</var><sub>1</sub> = <var>mg</var>/<var>F</var><sub>1</sub> all'equilibrio</p>
      </div>

      <p class="fluid-statics-width-note" data-display="pressure-note">
        <strong>Principio di Pascal:</strong> nel modello ideale la variazione di pressione applicata al fluido si trasmette ai due pistoni; l'amplificazione della forza deriva dalla diversa superficie.
      </p>
      <p class="simulation-status" data-simulation-status aria-live="polite"></p>
      <p class="simulation-model-note"><strong>Limiti del modello:</strong> <span data-model-note></span></p>
      <p class="simulation-error" data-simulation-error role="alert" hidden></p>
    </div>
  `;

  const progressSlider = container.querySelector('[data-simulation-action="set_progress"]');
  const status = container.querySelector("[data-simulation-status]");
  const outputArrow = container.querySelector("[data-output-force]");
  const inputArrow = container.querySelector("[data-input-force]");
  const weightArrow = container.querySelector("[data-weight-force]");
  const loadGroup = container.querySelector("[data-load-group]");
  const figureDescription = container.querySelector(`#${figureDescriptionId}`);

  container.querySelector("[data-learning-action]").textContent = config.didactics.learning_action_it;
  container.querySelector("[data-model-note]").textContent = config.didactics.model_note_it;
  container.querySelector("[data-small-piston-label]").textContent = config.didactics.small_piston_label_it;
  container.querySelector("[data-large-piston-label]").textContent = config.didactics.large_piston_label_it;
  container.querySelector("[data-load-label]").textContent = config.didactics.load_label_it;
  container.querySelector('[data-display="equations"]').hidden = !config.display.show_equations;
  container.querySelector('[data-display="force-balance"]').hidden = !config.display.show_force_balance;
  container.querySelector('[data-display="area-ratio"]').hidden = !config.display.show_area_ratio;
  container.querySelector('[data-display="pressure-note"]').hidden = !config.display.show_pressure_equality_note;

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
            ? "Aumenta automaticamente il rapporto tra le superfici fino all'equilibrio"
            : reducedMotionTitle,
        },
        pause: {
          disabled: !state.is_running || !motionAllowed,
          hidden: !config.interaction.allow_pause,
          title: motionAllowed ? "Metti in pausa l'esplorazione" : reducedMotionTitle,
        },
        reset: {
          hidden: !config.interaction.allow_reset,
        },
        set_progress: {
          disabled: !config.interaction.allow_scrub,
          value: Math.round(state.progress * Number(progressSlider.max)),
          ariaValueText: `rapporto tra le superfici ${formatNumber(state.area_ratio, 1)}, forza sul pistone grande ${formatNumber(state.large_piston_force_N, 0)} newton`,
        },
      };
    },

    render(state) {
      const coverage = Math.min(1, Math.max(0, state.force_coverage));
      setArrow(inputArrow, 72, "down");
      setArrow(weightArrow, 76, "down");
      setArrow(outputArrow, 34 + 82 * coverage, "up");

      container.querySelector("[data-input-force-label]").textContent =
        `F₁ = ${formatNumber(state.small_piston_force_N, 0)} N`;
      container.querySelector("[data-output-force-label]").textContent =
        `F₂ = ${formatNumber(state.large_piston_force_N, 0)} N`;
      container.querySelector("[data-weight-force-label]").textContent =
        `P = ${formatNumber(state.load_weight_N, 0)} N`;
      container.querySelector("[data-ratio-label]").textContent =
        `A₂/A₁ = ${formatNumber(state.area_ratio, 1)}×`;
      container.querySelector("[data-progress-output]").textContent =
        `${formatNumber(state.area_ratio, 1)}×`;
      container.querySelector("[data-target-ratio]").textContent =
        `${formatNumber(state.target_area_ratio, 1)}× richiesto`;

      container.querySelector('[data-value="input-force"]').textContent =
        formatNumber(state.small_piston_force_N, 0);
      container.querySelector('[data-value="load-mass"]').textContent =
        formatNumber(state.load_mass_kg, 0);
      container.querySelector('[data-value="load-weight"]').textContent =
        formatNumber(state.load_weight_N, 0);
      container.querySelector('[data-value="area-ratio"]').textContent =
        formatNumber(state.area_ratio, 1);
      container.querySelector('[data-value="output-force"]').textContent =
        formatNumber(state.large_piston_force_N, 0);
      container.querySelector('[data-value="force-coverage"]').textContent =
        formatNumber(state.force_coverage * 100, 1);

      loadGroup.classList.toggle("hydraulic-load-balanced", state.balance_reached);
      if (state.balance_reached) {
        status.textContent =
          `Equilibrio raggiunto: F₂ = P = ${formatNumber(state.load_weight_N, 0)} N. ` +
          `Serve A₂/A₁ = ${formatNumber(state.target_area_ratio, 1)}.`;
      } else {
        status.textContent =
          `Forza insufficiente: F₂ = ${formatNumber(state.large_piston_force_N, 0)} N; ` +
          `mancano ${formatNumber(state.force_deficit_N, 0)} N per equilibrare l'automobile.`;
      }

      figureDescription.textContent =
        `Torchio idraulico ideale: rapporto A2 su A1 ${formatNumber(state.area_ratio, 1)}, ` +
        `forza applicata ${formatNumber(state.small_piston_force_N, 0)} newton, ` +
        `forza sul pistone grande ${formatNumber(state.large_piston_force_N, 0)} newton, ` +
        `peso dell'automobile ${formatNumber(state.load_weight_N, 0)} newton.`;

      container.dataset.areaRatio = String(state.area_ratio);
      container.dataset.targetAreaRatio = String(state.target_area_ratio);
      container.dataset.inputForceN = String(state.small_piston_force_N);
      container.dataset.outputForceN = String(state.large_piston_force_N);
      container.dataset.loadWeightN = String(state.load_weight_N);
      container.dataset.forceCoverage = String(state.force_coverage);
      container.dataset.balanceReached = String(state.balance_reached);
    },
  });
}
'''
write("simulazioni/engines/fluid_statics/hydraulic_press_view.js", view)

# 7. Styling remains shared with fluid_statics and keeps the press schematic explicitly non-scale.
style_path = "simulazioni/engines/fluid_statics/style.css"
style_append = r'''

/* Hydraulic press ------------------------------------------------------- */
.hydraulic-press-svg {
  max-width: 820px;
}

.hydraulic-fluid {
  fill: #5ba7d8;
  fill-opacity: 0.28;
  stroke: none;
}

.hydraulic-chamber {
  fill: none;
  stroke: currentColor;
  stroke-width: 4;
}

.hydraulic-piston {
  stroke: currentColor;
  stroke-width: 8;
  stroke-linecap: round;
}

.hydraulic-piston-rod {
  fill: currentColor;
  opacity: 0.78;
}

.hydraulic-car-body {
  fill: #d69a4b;
  fill-opacity: 0.78;
  stroke: currentColor;
  stroke-width: 2.5;
}

.hydraulic-wheel {
  fill: currentColor;
}

.hydraulic-force {
  stroke-width: 4;
  stroke-linecap: round;
}

.hydraulic-force-input {
  stroke: #a64a44;
}

.hydraulic-force-output {
  stroke: #287fae;
}

.hydraulic-force-weight {
  stroke: #7c4a88;
}

.hydraulic-force-text,
.hydraulic-label,
.hydraulic-ratio-label {
  fill: currentColor;
  font-family: system-ui, sans-serif;
}

.hydraulic-force-text {
  font-size: 14px;
  font-weight: 700;
}

.hydraulic-label {
  font-size: 15px;
  font-weight: 700;
}

.hydraulic-ratio-label {
  font-size: 17px;
  font-weight: 800;
}

.hydraulic-load-balanced {
  transform: translateY(-5px);
}

@media (prefers-reduced-motion: no-preference) {
  .hydraulic-load-balanced {
    transition: transform 160ms ease-out;
  }
}
'''
style = read(style_path)
if "/* Hydraulic press" in style:
    raise RuntimeError("hydraulic press CSS already present")
write(style_path, style.rstrip() + style_append + "\n")

# 8. Node model tests: source values, invariants, lifecycle, reuse and invalid regime.
js_test = r'''import test from "node:test";
import assert from "node:assert/strict";

import { createSimulationEngine } from "../../simulazioni/engines/fluid_statics/engine.js";

function config(overrides = {}) {
  return {
    schema_version: 1,
    engine: "fluid_statics",
    model: "hydraulic_press",
    parameters: {
      small_piston_force_N: 140,
      load_mass_kg: 3800,
      gravity_m_s2: 9.8,
      ...(overrides.parameters ?? {}),
    },
    interaction: {
      allow_play: true,
      allow_pause: true,
      allow_reset: true,
      allow_scrub: true,
      playback_duration_s: 6,
      ...(overrides.interaction ?? {}),
    },
  };
}

function close(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

test("hydraulic press starts from equal areas without inventing absolute areas", () => {
  const engine = createSimulationEngine(config());
  const state = engine.getState();
  close(state.load_weight_N, 37240);
  close(state.target_area_ratio, 266);
  close(state.area_ratio, 1);
  close(state.large_piston_force_N, 140);
  close(state.force_coverage, 140 / 37240);
  assert.equal(state.balance_reached, false);
});

test("Pascal force amplification follows F2 = F1 * A2/A1 at every scrubbed state", () => {
  const engine = createSimulationEngine(config());
  for (const progress of [0, 0.1, 0.5, 0.9, 1]) {
    const state = engine.setProgress(progress);
    close(state.large_piston_force_N, state.small_piston_force_N * state.area_ratio);
    close(state.force_coverage, state.large_piston_force_N / state.load_weight_N);
  }
});

test("midpoint and final state recover the required area ratio", () => {
  const engine = createSimulationEngine(config());
  const midpoint = engine.setProgress(0.5);
  close(midpoint.area_ratio, 133.5);
  close(midpoint.large_piston_force_N, 18690);
  assert.equal(midpoint.balance_reached, false);

  const finalState = engine.setProgress(1);
  close(finalState.area_ratio, 266);
  close(finalState.large_piston_force_N, 37240);
  close(finalState.force_coverage, 1);
  close(finalState.force_deficit_N, 0);
  assert.equal(finalState.balance_reached, true);
});

test("playback is only a progress coordinate and reset restores the equal-area state", () => {
  const engine = createSimulationEngine(config());
  engine.play();
  const halfway = engine.advance(3);
  close(halfway.progress, 0.5);
  assert.equal(halfway.is_running, true);
  const finalState = engine.advance(3);
  close(finalState.progress, 1);
  assert.equal(finalState.is_running, false);
  assert.equal(finalState.is_complete, true);
  const reset = engine.reset();
  close(reset.progress, 0);
  close(reset.area_ratio, 1);
  assert.equal(reset.balance_reached, false);
});

test("same hydraulic press model reuses cleanly with another numerical dataset", () => {
  const engine = createSimulationEngine(config({
    parameters: {
      small_piston_force_N: 250,
      load_mass_kg: 1000,
      gravity_m_s2: 10,
    },
  }));
  const finalState = engine.setProgress(1);
  close(finalState.load_weight_N, 10000);
  close(finalState.target_area_ratio, 40);
  close(finalState.large_piston_force_N, 10000);
  assert.equal(finalState.balance_reached, true);
});

test("model rejects a load that does not require hydraulic amplification", () => {
  assert.throws(
    () => createSimulationEngine(config({
      parameters: {
        small_piston_force_N: 1000,
        load_mass_kg: 100,
        gravity_m_s2: 9.8,
      },
    })),
    /peso maggiore di small_piston_force_N/,
  );
});
'''
write("tests/js/fluid_statics_hydraulic_press.test.mjs", js_test)

# 9. Strict Python config tests.
py_config_test = r'''from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path
import unittest

from scripts.simulation_config import load_engine_manifest, load_simulation_config, validate_config_data


ROOT = Path(__file__).resolve().parents[1]
ENGINE = "fluid_statics"
EXERCISE_ID = "FIS-FLU-PAS-001"


class HydraulicPressConfigTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.manifest = load_engine_manifest(ENGINE, root=ROOT)
        cls.raw = json.loads(
            (ROOT / "simulazioni" / "config" / f"{EXERCISE_ID}.json").read_text(
                encoding="utf-8"
            )
        )

    def errors_for(self, config: dict) -> list[str]:
        return validate_config_data(config, self.manifest, expected_engine=ENGINE)

    def test_real_config_is_strict_and_loadable(self) -> None:
        config, _ = load_simulation_config(EXERCISE_ID, ENGINE, root=ROOT)
        self.assertEqual(config["model"], "hydraulic_press")
        self.assertEqual(config["parameters"]["small_piston_force_N"], 140)
        self.assertEqual(config["parameters"]["load_mass_kg"], 3800)
        self.assertEqual(config["parameters"]["gravity_m_s2"], 9.8)
        self.assertEqual(self.errors_for(deepcopy(self.raw)), [])

    def test_missing_force_is_rejected(self) -> None:
        config = deepcopy(self.raw)
        del config["parameters"]["small_piston_force_N"]
        errors = self.errors_for(config)
        self.assertTrue(any("small_piston_force_N" in error and "mancante" in error for error in errors))

    def test_absolute_area_is_not_part_of_the_contract(self) -> None:
        config = deepcopy(self.raw)
        config["parameters"]["small_piston_area_m2"] = 0.01
        errors = self.errors_for(config)
        self.assertTrue(any("small_piston_area_m2" in error and "sconosciuta" in error for error in errors))

    def test_negative_mass_is_rejected_before_runtime(self) -> None:
        config = deepcopy(self.raw)
        config["parameters"]["load_mass_kg"] = -1
        errors = self.errors_for(config)
        self.assertTrue(any("load_mass_kg" in error and "> 0" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
'''
write("tests/test_hydraulic_press_config.py", py_config_test)

# 10. Static site subset test.
py_site_test = r'''from __future__ import annotations

from pathlib import Path
import tempfile
import unittest

from scripts import genera_sito


EXERCISE_ID = "FIS-FLU-PAS-001"


class HydraulicPressSiteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.exercises = genera_sito.read_exercises()
        cls.exercise = next(
            exercise for exercise in cls.exercises if exercise.exercise_id == EXERCISE_ID
        )

    def test_exercise_uses_fluid_statics_before_solution(self) -> None:
        page = genera_sito.render_exercise_page(self.exercise)
        self.assertIn('data-simulation-engine="fluid_statics"', page)
        self.assertIn("runtime.js", page)
        self.assertIn("engines/fluid_statics/style.css", page)
        self.assertLess(
            page.index(">Simulazione</h2>"),
            page.index("<summary>Soluzione</summary>"),
        )

    def test_subset_copies_hydraulic_view_and_config(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            output = Path(temporary_directory) / "site"
            genera_sito.write_site([self.exercise], output)
            asset_root = output / "assets" / "simulazioni"
            actual_assets = {
                path.relative_to(asset_root).as_posix()
                for path in asset_root.rglob("*")
                if path.is_file()
            }

            for expected in (
                "core/runtime.js",
                "core/controls.js",
                "core/registry.js",
                "core/simulation.css",
                "engines/fluid_statics/multi_engine.js",
                "engines/fluid_statics/engine.js",
                "engines/fluid_statics/apparent_weight_engine.js",
                "engines/fluid_statics/multi_view.js",
                "engines/fluid_statics/view.js",
                "engines/fluid_statics/floating_view.js",
                "engines/fluid_statics/apparent_weight_view.js",
                "engines/fluid_statics/pressure_points_view.js",
                "engines/fluid_statics/hydraulic_press_view.js",
                "engines/fluid_statics/style.css",
                f"config/{EXERCISE_ID}.json",
            ):
                with self.subTest(asset=expected):
                    self.assertIn(expected, actual_assets)

            self.assertTrue(
                (output / "esercizi" / EXERCISE_ID.casefold() / "index.html").is_file()
            )


if __name__ == "__main__":
    unittest.main()
'''
write("tests/test_hydraulic_press_site.py", py_site_test)

# 11. Browser smoke test, including reduced motion and mobile overflow when run by CI.
browser_smoke = r'''<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <title>Exergo hydraulic press smoke test</title>
  <link rel="stylesheet" href="../../_site/assets/style.css">
  <link rel="stylesheet" href="../../_site/assets/simulazioni/core/simulation.css">
  <link rel="stylesheet" href="../../_site/assets/simulazioni/engines/fluid_statics/style.css">
</head>
<body>
  <main class="page">
    <p id="result">RUNNING</p>
    <section class="simulation-shell">
      <h2>Torchio idraulico</h2>
      <div id="press" data-exergo-simulation
        data-simulation-engine="fluid_statics"
        data-simulation-config="../../_site/assets/simulazioni/config/FIS-FLU-PAS-001.json">
        <p data-simulation-error hidden></p>
      </div>
    </section>
  </main>

  <script type="module" src="../../_site/assets/simulazioni/core/runtime.js"></script>
  <script>
    const result = document.querySelector("#result");
    const simulation = document.querySelector("#press");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function finish(status, details) {
      result.textContent = status + ": " + details;
      result.dataset.status = status;
      document.title = status + " - Exergo hydraulic press smoke test";
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

        close(Number(simulation.dataset.areaRatio), 1);
        close(Number(simulation.dataset.targetAreaRatio), 266);
        close(Number(simulation.dataset.inputForceN), 140);
        close(Number(simulation.dataset.outputForceN), 140);
        close(Number(simulation.dataset.loadWeightN), 37240);
        if (simulation.dataset.balanceReached !== "false") {
          throw new Error("equilibrio iniziale errato");
        }
        if (play.disabled !== reducedMotion) {
          throw new Error("semantica Play/reduced-motion errata");
        }
        if (!pause.disabled) {
          throw new Error("Pausa dovrebbe essere inizialmente disabilitata");
        }

        slider.value = "500";
        slider.dispatchEvent(new Event("input", { bubbles: true }));
        close(Number(simulation.dataset.areaRatio), 133.5);
        close(Number(simulation.dataset.outputForceN), 18690);
        if (simulation.dataset.balanceReached !== "false") {
          throw new Error("equilibrio anticipato");
        }

        slider.value = "1000";
        slider.dispatchEvent(new Event("input", { bubbles: true }));
        close(Number(simulation.dataset.areaRatio), 266);
        close(Number(simulation.dataset.outputForceN), 37240);
        close(Number(simulation.dataset.forceCoverage), 1);
        if (simulation.dataset.balanceReached !== "true") {
          throw new Error("equilibrio finale non rilevato");
        }
        if (!simulation.querySelector('[data-simulation-status]').textContent.includes("Equilibrio raggiunto")) {
          throw new Error("feedback finale mancante");
        }

        reset.click();
        close(Number(simulation.dataset.areaRatio), 1);
        close(Number(simulation.dataset.outputForceN), 140);
        if (slider.value !== "0") {
          throw new Error("reset slider non riuscito");
        }

        if (document.documentElement.scrollWidth > window.innerWidth + 1) {
          throw new Error(
            "overflow orizzontale " + document.documentElement.scrollWidth +
            "px su viewport " + window.innerWidth + "px"
          );
        }

        finish(
          "PASS",
          "torchio 140 N -> 37240 N, rapporto 266, reset, reduced motion=" + reducedMotion
        );
      } catch (error) {
        finish("FAIL", error.message);
      }
    }, 25);
  </script>
</body>
</html>
'''
write("tests/browser/hydraulic_press_smoke.html", browser_smoke)

# 12. Keep enumerative regression tests strict rather than dynamic.
central_config = "tests/test_fluid_statics_config.py"
replace_once(
    central_config,
    'PRESSURE_POINTS_ID = "FIS-FLU-PID-003"\n',
    'PRESSURE_POINTS_ID = "FIS-FLU-PID-003"\nHYDRAULIC_PRESS_ID = "FIS-FLU-PAS-001"\n',
)
replace_once(
    central_config,
    '                "hydrostatic_pressure_points",\n            ],',
    '                "hydrostatic_pressure_points",\n                "hydraulic_press",\n            ],',
)
replace_once(
    central_config,
    '            (PRESSURE_POINTS_ID, "hydrostatic_pressure_points"),\n        ):',
    '            (PRESSURE_POINTS_ID, "hydrostatic_pressure_points"),\n            (HYDRAULIC_PRESS_ID, "hydraulic_press"),\n        ):',
)

site_test = "tests/test_site_generation.py"
replace_once(
    site_test,
    'FLUID_PRESSURE_POINTS_ID = "FIS-FLU-PID-003"\n',
    'FLUID_PRESSURE_POINTS_ID = "FIS-FLU-PID-003"\nFLUID_HYDRAULIC_PRESS_ID = "FIS-FLU-PAS-001"\n',
)
replace_once(
    site_test,
    '''        cls.fluid_pressure_points = next(
            exercise
            for exercise in cls.exercises
            if exercise.exercise_id == FLUID_PRESSURE_POINTS_ID
        )
        cls.normal = next(''',
    '''        cls.fluid_pressure_points = next(
            exercise
            for exercise in cls.exercises
            if exercise.exercise_id == FLUID_PRESSURE_POINTS_ID
        )
        cls.fluid_hydraulic_press = next(
            exercise
            for exercise in cls.exercises
            if exercise.exercise_id == FLUID_HYDRAULIC_PRESS_ID
        )
        cls.normal = next(''',
)
replace_once(
    site_test,
    "    def test_fluid_exercises_share_one_engine_across_four_models(self) -> None:\n",
    "    def test_fluid_exercises_share_one_engine_across_five_models(self) -> None:\n",
)
replace_once(
    site_test,
    "            self.fluid_pressure_points,\n        )\n",
    "            self.fluid_pressure_points,\n            self.fluid_hydraulic_press,\n        )\n",
)
replace_once(
    site_test,
    "    def test_site_contains_four_engines_and_eleven_configs(self) -> None:\n",
    "    def test_site_contains_four_engines_and_twelve_configs(self) -> None:\n",
)
replace_once(
    site_test,
    '                "engines/fluid_statics/pressure_points_view.js",\n                "engines/fluid_statics/style.css",',
    '                "engines/fluid_statics/pressure_points_view.js",\n                "engines/fluid_statics/hydraulic_press_view.js",\n                "engines/fluid_statics/style.css",',
)
replace_once(
    site_test,
    '                f"config/{FLUID_PRESSURE_POINTS_ID}.json",\n            }',
    '                f"config/{FLUID_PRESSURE_POINTS_ID}.json",\n                f"config/{FLUID_HYDRAULIC_PRESS_ID}.json",\n            }',
)
replace_once(
    site_test,
    '                FLUID_PRESSURE_POINTS_ID,\n            ):',
    '                FLUID_PRESSURE_POINTS_ID,\n                FLUID_HYDRAULIC_PRESS_ID,\n            ):',
)
replace_once(
    site_test,
    "    def test_fluid_subset_copies_one_engine_and_four_models(self) -> None:\n",
    "    def test_fluid_subset_copies_one_engine_and_five_models(self) -> None:\n",
)
# The first occurrence was already extended above; extend the fluid_exercises list specifically by context.
replace_once(
    site_test,
    '''                self.fluid_apparent_weight,
                self.fluid_pressure_points,
            ]''',
    '''                self.fluid_apparent_weight,
                self.fluid_pressure_points,
                self.fluid_hydraulic_press,
            ]''',
)
replace_once(
    site_test,
    '                "engines/fluid_statics/pressure_points_view.js",\n                "engines/fluid_statics/style.css",\n            ):',
    '                "engines/fluid_statics/pressure_points_view.js",\n                "engines/fluid_statics/hydraulic_press_view.js",\n                "engines/fluid_statics/style.css",\n            ):',
)
replace_once(
    site_test,
    '                FLUID_PRESSURE_POINTS_ID,\n            ):\n                self.assertIn(f"config/{exercise_id}.json", actual_assets)',
    '                FLUID_PRESSURE_POINTS_ID,\n                FLUID_HYDRAULIC_PRESS_ID,\n            ):\n                self.assertIn(f"config/{exercise_id}.json", actual_assets)',
)

# 13. Coverage and roadmap stay synchronized with the implementation.
coverage_path = "metadata/simulation_coverage.csv"
replace_once(
    coverage_path,
    "FIS-FLU-PAS-001,planned,fluid_statics,hydraulic_press,P1,",
    "FIS-FLU-PAS-001,implemented,fluid_statics,hydraulic_press,P1,",
)

roadmap_path = "docs/SIMULATION_ROADMAP.md"
replace_once(roadmap_path, "| `implemented` | 11 |", "| `implemented` | 12 |")
replace_once(roadmap_path, "| `planned` | 38 |", "| `planned` | 37 |")
replace_once(
    roadmap_path,
    "- `fluid_statics` — 6 esercizi, modelli `hydrostatic_column`, `floating_body`, `buoyancy_apparent_weight` e `hydrostatic_pressure_points`.",
    "- `fluid_statics` — 7 esercizi, modelli `hydrostatic_column`, `floating_body`, `buoyancy_apparent_weight`, `hydrostatic_pressure_points` e `hydraulic_press`.",
)
replace_once(
    roadmap_path,
    "## Backlog ordinato dopo `hydrostatic_pressure_points`",
    "## Backlog ordinato dopo `hydraulic_press`",
)
replace_once(
    roadmap_path,
    "| 1 | `fluid_statics` | estensione engine attivo | 3 | 5 | 3 | 5.00 | Pascal, vasi comunicanti, getti |",
    "| 1 | `fluid_statics` | estensione engine attivo | 2 | 5 | 3 | 3.33 | Vasi comunicanti e getti |",
)
hydraulic_section = '''### `hydraulic_press`

Copre `FIS-FLU-PAS-001`. Il modello usa direttamente i dati del problema, `F₁=140 N`, `m=3800 kg` e `g=9,8 m/s²`, e calcola

```text
P = mg
F₁/A₁ = F₂/A₂
F₂ = F₁ * (A₂/A₁)
A₂/A₁ = mg/F₁ = 266
```

La coordinata interattiva è il rapporto dimensionale `A₂/A₁`, da `1` al valore minimo necessario per equilibrare l'automobile. Non vengono introdotte aree assolute né diametri non forniti dal testo; le larghezze dei pistoni nella vista sono dichiarate schematiche e non in scala. Il playback modifica un parametro di progetto e non rappresenta tempo fisico.

'''
replace_once(
    roadmap_path,
    "## Schema multi-model\n",
    hydraulic_section + "## Schema multi-model\n",
)
replace_once(
    roadmap_path,
    '''## Prossimi modelli `fluid_statics`

1. **`hydraulic_press`** — `FIS-FLU-PAS-001`;
2. `communicating_vessels` — `FIS-FLU-VAS-001`;
3. `orifice_outflow` — `FIS-FLU-PID-004`, mantenuto separato dalla parte strettamente idrostatica perché introduce il moto del fluido.

Il prossimo modello da implementare è **`hydraulic_press`**: introduce la legge di Pascal e un rapporto tra aree e forze, quindi amplia `fluid_statics` senza duplicare la logica della pressione idrostatica già consolidata.
''',
    '''## Prossimi modelli `fluid_statics`

1. **`communicating_vessels`** — `FIS-FLU-VAS-001`;
2. `orifice_outflow` — `FIS-FLU-PID-004`, mantenuto separato dalla parte strettamente idrostatica perché introduce il moto del fluido.

Il prossimo modello da implementare è **`communicating_vessels`**: riusa l'uguaglianza della pressione alla stessa quota per mostrare come livelli e densità si vincolano tra rami comunicanti, completando la parte strettamente statica prima di introdurre il moto del fluido con `orifice_outflow`.
''',
)

print("hydraulic_press milestone patch applied")

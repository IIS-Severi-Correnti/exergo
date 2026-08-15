let instanceCount = 0;

const FLOATING_SVG = Object.freeze({
  surfaceY: 156,
  tankLeft: 76,
  tankRight: 524,
  tankBottom: 330,
  bodyCenterX: 300,
  bodyWidth: 150,
  bodyHeight: 118,
});

function formatNumber(value, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value);
}

function percentage(value, digits = 1) {
  return `${formatNumber(value * 100, digits)}%`;
}

function reducedMotionMedia() {
  return window.matchMedia("(prefers-reduced-motion: reduce)");
}

function setFloatingBodyGeometry(container, state) {
  const body = container.querySelector("[data-floating-body]");
  const waterOverlay = container.querySelector("[data-floating-water-overlay]");
  const bodyTop = FLOATING_SVG.surfaceY - (1 - state.submerged_fraction) * FLOATING_SVG.bodyHeight;
  const bodyBottom = bodyTop + FLOATING_SVG.bodyHeight;
  const bodyLeft = FLOATING_SVG.bodyCenterX - FLOATING_SVG.bodyWidth / 2;

  body.setAttribute("x", String(bodyLeft));
  body.setAttribute("y", String(bodyTop));
  body.setAttribute("width", String(FLOATING_SVG.bodyWidth));
  body.setAttribute("height", String(FLOATING_SVG.bodyHeight));

  const submergedTop = Math.max(FLOATING_SVG.surfaceY, bodyTop);
  const submergedHeight = Math.max(0, bodyBottom - submergedTop);
  waterOverlay.setAttribute("x", String(bodyLeft));
  waterOverlay.setAttribute("y", String(submergedTop));
  waterOverlay.setAttribute("width", String(FLOATING_SVG.bodyWidth));
  waterOverlay.setAttribute("height", String(submergedHeight));

  const weightArrow = container.querySelector("[data-force-weight]");
  const buoyancyArrow = container.querySelector("[data-force-buoyancy]");
  const weightLabel = container.querySelector("[data-weight-label]");
  const buoyancyLabel = container.querySelector("[data-buoyancy-label]");
  const ratio = Math.max(0, state.buoyancy_to_weight_ratio);
  const scale = Math.max(1, ratio);
  const weightLength = 76 / scale;
  const buoyancyLength = (76 * ratio) / scale;
  const centerY = bodyTop + FLOATING_SVG.bodyHeight / 2;

  weightArrow.setAttribute("x1", String(FLOATING_SVG.bodyCenterX - 42));
  weightArrow.setAttribute("x2", String(FLOATING_SVG.bodyCenterX - 42));
  weightArrow.setAttribute("y1", String(centerY));
  weightArrow.setAttribute("y2", String(centerY + weightLength));
  buoyancyArrow.setAttribute("x1", String(FLOATING_SVG.bodyCenterX + 42));
  buoyancyArrow.setAttribute("x2", String(FLOATING_SVG.bodyCenterX + 42));
  buoyancyArrow.setAttribute("y1", String(centerY));
  buoyancyArrow.setAttribute("y2", String(centerY - buoyancyLength));

  weightLabel.setAttribute("y", String(centerY + 18));
  buoyancyLabel.setAttribute("y", String(centerY - 12));

  const hasBuoyancy = buoyancyLength > 0.5;
  buoyancyArrow.hidden = !hasBuoyancy;
  buoyancyLabel.hidden = !hasBuoyancy;
}

function createFloatingBodyView({ container, config, instanceId }) {
  const figureTitleId = `fluid-floating-title-${instanceId}`;
  const figureDescriptionId = `fluid-floating-description-${instanceId}`;
  const progressId = `fluid-floating-progress-${instanceId}`;
  const bodyDensityId = `fluid-floating-body-density-${instanceId}`;
  const weightArrowMarkerId = `fluid-floating-weight-arrow-${instanceId}`;
  const buoyancyArrowMarkerId = `fluid-floating-buoyancy-arrow-${instanceId}`;
  const reducedMotion = reducedMotionMedia();

  container.innerHTML = `
    <p class="simulation-instruction">
      <strong>Esplora:</strong> <span data-learning-action></span>
      Il cursore modifica la frazione di volume immerso: non rappresenta il tempo di caduta o risalita.
    </p>

    <figure class="fluid-statics-figure fluid-floating-figure">
      <svg class="fluid-statics-svg fluid-floating-svg" viewBox="0 0 600 390" role="img"
        aria-labelledby="${figureTitleId} ${figureDescriptionId}">
        <title id="${figureTitleId}">Corpo parzialmente immerso in un fluido con forza peso e spinta di Archimede</title>
        <desc id="${figureDescriptionId}">Un corpo rettangolare attraversa la superficie del liquido. Due frecce mostrano peso e spinta di Archimede.</desc>
        <defs>
          <marker id="${weightArrowMarkerId}" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto-start-reverse">
            <path d="M 0 0 L 8 4 L 0 8 z" class="fluid-force-weight-head"></path>
          </marker>
          <marker id="${buoyancyArrowMarkerId}" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto-start-reverse">
            <path d="M 0 0 L 8 4 L 0 8 z" class="fluid-force-buoyancy-head"></path>
          </marker>
        </defs>

        <path class="fluid-floating-tank" d="M 76 70 V 330 H 524 V 70"></path>
        <rect class="fluid-floating-water" x="80" y="156" width="440" height="170"></rect>
        <line class="fluid-surface-guide" x1="80" y1="156" x2="520" y2="156"></line>
        <text class="fluid-surface-label" x="88" y="315" data-fluid-label></text>

        <rect class="fluid-floating-body" data-floating-body rx="8"></rect>
        <rect class="fluid-floating-water-overlay" data-floating-water-overlay rx="0"></rect>
        <text class="fluid-floating-body-label" x="300" y="24" text-anchor="middle" data-body-label></text>

        <line class="fluid-force-arrow fluid-force-weight" data-force-weight marker-end="url(#${weightArrowMarkerId})"></line>
        <line class="fluid-force-arrow fluid-force-buoyancy" data-force-buoyancy marker-end="url(#${buoyancyArrowMarkerId})"></line>
        <text class="fluid-force-label fluid-force-weight-label" x="244" data-weight-label text-anchor="middle">P</text>
        <text class="fluid-force-label fluid-force-buoyancy-label" x="356" data-buoyancy-label text-anchor="middle">Fₐ</text>

        <text class="fluid-floating-fraction-label" x="300" y="372" text-anchor="middle" data-submerged-label></text>
      </svg>
      <figcaption>
        Le frecce confrontano <var>P</var> e <var>F</var><sub>A</sub> sulla stessa scala relativa.
        Non servono massa o volume assoluti: conta il rapporto tra densità e frazione immersa.
      </figcaption>
    </figure>

    <div class="fluid-statics-panel">
      <div class="fluid-statics-scrubber">
        <label for="${progressId}">
          <span>Frazione di volume immerso</span>
          <output data-progress-output for="${progressId}">--</output>
        </label>
        <input id="${progressId}" type="range" min="0" max="1000" step="1" value="0"
          data-simulation-action="set_progress" data-simulation-event="input">
        <div class="fluid-statics-slider-scale" aria-hidden="true">
          <span>0%</span><span>100%</span>
        </div>
      </div>

      <div class="fluid-statics-density-control" data-body-density-control>
        <label for="${bodyDensityId}">
          <span>Densità del corpo, ρ<sub>c</sub></span>
          <output data-body-density-output for="${bodyDensityId}">--</output>
        </label>
        <input id="${bodyDensityId}" type="range" step="10"
          data-simulation-action="set_body_density" data-simulation-event="input">
      </div>

      <div class="simulation-controls" aria-label="Controlli simulazione">
        <button type="button" data-simulation-action="play">Play</button>
        <button type="button" data-simulation-action="pause">Pausa</button>
        <button type="button" data-simulation-action="reset">Reset</button>
      </div>

      <dl class="simulation-values fluid-statics-values" aria-label="Grandezze fisiche correnti">
        <div><dt>Densità fluido, ρ<sub>f</sub></dt><dd><span data-value="fluid-density">--</span> kg/m³</dd></div>
        <div><dt>Densità corpo, ρ<sub>c</sub></dt><dd><span data-value="body-density">--</span> kg/m³</dd></div>
        <div><dt>Volume immerso</dt><dd><span data-value="submerged-fraction">--</span></dd></div>
        <div data-display="force-ratio"><dt>Rapporto F<sub>A</sub>/P</dt><dd><span data-value="force-ratio">--</span></dd></div>
        <div data-display="density-ratio"><dt>Rapporto ρ<sub>c</sub>/ρ<sub>f</sub></dt><dd><span data-value="density-ratio">--</span></dd></div>
        <div><dt>Equilibrio previsto</dt><dd><span data-value="equilibrium-fraction">--</span></dd></div>
      </dl>

      <div class="simulation-equations" data-display="equations" aria-label="Relazioni del modello">
        <p><var>P</var> = <var>ρ</var><sub>c</sub><var>gV</var><sub>tot</sub></p>
        <p><var>F</var><sub>A</sub> = <var>ρ</var><sub>f</sub><var>gV</var><sub>imm</sub></p>
        <p>In equilibrio: <var>V</var><sub>imm</sub>/<var>V</var><sub>tot</sub> = <var>ρ</var><sub>c</sub>/<var>ρ</var><sub>f</sub></p>
      </div>

      <p class="fluid-statics-exploration-note" data-exploration-note hidden></p>
      <p class="simulation-status" data-simulation-status aria-live="polite"></p>
      <p class="simulation-model-note"><strong>Limiti del modello:</strong> <span data-model-note></span></p>
      <p class="simulation-error" data-simulation-error role="alert" hidden></p>
    </div>
  `;

  const progressSlider = container.querySelector('[data-simulation-action="set_progress"]');
  const bodyDensitySlider = container.querySelector('[data-simulation-action="set_body_density"]');
  const bodyDensityControl = container.querySelector("[data-body-density-control]");
  const status = container.querySelector("[data-simulation-status]");
  const figureDescription = container.querySelector(`#${figureDescriptionId}`);

  container.querySelector("[data-learning-action]").textContent = config.didactics.learning_action_it;
  container.querySelector("[data-model-note]").textContent = config.didactics.model_note_it;
  container.querySelector("[data-body-label]").textContent = config.didactics.body_label_it;
  container.querySelector("[data-fluid-label]").textContent = config.didactics.fluid_label_it;

  const explorationNote = container.querySelector("[data-exploration-note]");
  if (config.didactics.exploration_note_it) {
    explorationNote.hidden = false;
    explorationNote.textContent = config.didactics.exploration_note_it;
  }

  bodyDensitySlider.min = String(config.interaction.body_density_min_kg_m3);
  bodyDensitySlider.max = String(config.interaction.body_density_max_kg_m3);
  bodyDensitySlider.value = String(config.parameters.body_density_initial_kg_m3);
  bodyDensityControl.hidden = !config.interaction.allow_body_density_change;

  container.querySelector('[data-display="equations"]').hidden = !config.display.show_equations;
  container.querySelector('[data-display="force-ratio"]').hidden = !config.display.show_force_ratio;
  container.querySelector('[data-display="density-ratio"]').hidden = !config.display.show_density_ratio;

  return Object.freeze({
    get motionAllowed() {
      return !reducedMotion.matches;
    },
    onMotionPreferenceChange(callback) {
      reducedMotion.addEventListener("change", callback);
      return () => reducedMotion.removeEventListener("change", callback);
    },
    resolveActionPayload({ action, control }) {
      if (action === "set_progress") return { progress: Number(control.value) / Number(control.max) };
      if (action === "set_body_density") return { body_density_kg_m3: Number(control.value) };
      return undefined;
    },
    describeControls(state, { motionAllowed = true } = {}) {
      const reducedMotionTitle =
        "Playback disattivato dalla preferenza di riduzione del movimento; usa il cursore";
      return {
        play: {
          disabled: state.is_running || state.is_complete || !motionAllowed,
          hidden: !config.interaction.allow_play,
          title: motionAllowed ? "Aumenta automaticamente la frazione immersa" : reducedMotionTitle,
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
          ariaValueText: `${percentage(state.submerged_fraction, 1)} del volume immerso, rapporto spinta peso ${formatNumber(state.buoyancy_to_weight_ratio, 3)}`,
        },
        set_body_density: {
          hidden: !config.interaction.allow_body_density_change,
          disabled: !config.interaction.allow_body_density_change,
          value: Math.round(state.body_density_kg_m3),
          ariaValueText: `${formatNumber(state.body_density_kg_m3, 0)} chilogrammi per metro cubo`,
        },
      };
    },
    render(state) {
      setFloatingBodyGeometry(container, state);
      container.querySelector("[data-submerged-label]").textContent =
        `Volume immerso: ${percentage(state.submerged_fraction, 1)}`;
      container.querySelector('[data-value="fluid-density"]').textContent = formatNumber(state.fluid_density_kg_m3, 0);
      container.querySelector('[data-value="body-density"]').textContent = formatNumber(state.body_density_kg_m3, 0);
      container.querySelector('[data-value="submerged-fraction"]').textContent = percentage(state.submerged_fraction, 1);
      container.querySelector('[data-value="force-ratio"]').textContent = formatNumber(state.buoyancy_to_weight_ratio, 3);
      container.querySelector('[data-value="density-ratio"]').textContent = formatNumber(state.density_ratio_body_to_fluid, 3);
      container.querySelector('[data-value="equilibrium-fraction"]').textContent =
        state.equilibrium_submerged_fraction === null
          ? "non raggiungibile"
          : percentage(state.equilibrium_submerged_fraction, 1);
      container.querySelector("[data-progress-output]").textContent = percentage(state.submerged_fraction, 1);
      container.querySelector("[data-body-density-output]").textContent = `${formatNumber(state.body_density_kg_m3, 0)} kg/m³`;

      if (state.force_balance_reached) {
        if (state.floating_regime === "neutral") {
          status.textContent = "Equilibrio neutro: a immersione completa Fₐ = P.";
        } else {
          status.textContent = `Equilibrio raggiunto: Fₐ ≈ P con ${percentage(state.submerged_fraction, 1)} del volume immerso.`;
        }
      } else if (state.floating_regime === "sinking" && state.submerged_fraction >= 0.999) {
        status.textContent = `Anche a immersione completa Fₐ/P = ${formatNumber(state.buoyancy_to_weight_ratio, 3)} < 1: il corpo è più denso del fluido e affonda.`;
      } else if (state.buoyancy_to_weight_ratio < 1) {
        status.textContent = "Fₐ < P: la risultante è verso il basso. Aumentando il volume immerso cresce la spinta di Archimede.";
      } else {
        status.textContent = "Fₐ > P: la risultante è verso l'alto. Riducendo il volume immerso diminuisce la spinta di Archimede.";
      }

      figureDescription.textContent =
        `Il corpo ha densità ${formatNumber(state.body_density_kg_m3, 0)} chilogrammi per metro cubo, il fluido ${formatNumber(state.fluid_density_kg_m3, 0)}. ` +
        `${percentage(state.submerged_fraction, 1)} del volume è immerso e il rapporto tra spinta di Archimede e peso è ${formatNumber(state.buoyancy_to_weight_ratio, 3)}.`;

      container.dataset.submergedFraction = String(state.submerged_fraction);
      container.dataset.buoyancyWeightRatio = String(state.buoyancy_to_weight_ratio);
      container.dataset.bodyDensityKgM3 = String(state.body_density_kg_m3);
      container.dataset.fluidDensityKgM3 = String(state.fluid_density_kg_m3);
      container.dataset.equilibriumFraction =
        state.equilibrium_submerged_fraction === null ? "" : String(state.equilibrium_submerged_fraction);
      container.dataset.floatingRegime = state.floating_regime;
      container.dataset.targetReached = String(state.force_balance_reached);
      container.dataset.complete = String(state.is_complete);
    },
  });
}

export function createSimulationView({ container, config }) {
  if (config.model !== "floating_body") {
    throw new RangeError(`floating view ricevuta per il modello: ${String(config.model)}`);
  }
  instanceCount += 1;
  return createFloatingBodyView({ container, config, instanceId: instanceCount });
}

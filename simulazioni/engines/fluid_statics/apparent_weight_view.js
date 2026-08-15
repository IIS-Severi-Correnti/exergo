let instanceCount = 0;

const SVG = Object.freeze({
  surfaceY: 170,
  tankLeft: 76,
  tankRight: 524,
  tankBottom: 350,
  bodyCenterX: 300,
  bodyWidth: 140,
  bodyHeight: 100,
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

function setGeometry(container, state) {
  const bodyTop = SVG.surfaceY - (1 - state.submerged_fraction) * SVG.bodyHeight;
  const bodyLeft = SVG.bodyCenterX - SVG.bodyWidth / 2;
  const body = container.querySelector("[data-apparent-body]");
  const waterOverlay = container.querySelector("[data-apparent-water-overlay]");
  const suspension = container.querySelector("[data-suspension-line]");
  const bodyLabel = container.querySelector("[data-body-label]");

  body.setAttribute("x", String(bodyLeft));
  body.setAttribute("y", String(bodyTop));
  body.setAttribute("width", String(SVG.bodyWidth));
  body.setAttribute("height", String(SVG.bodyHeight));

  waterOverlay.setAttribute("x", String(bodyLeft));
  waterOverlay.setAttribute("y", String(Math.max(SVG.surfaceY, bodyTop)));
  waterOverlay.setAttribute("width", String(SVG.bodyWidth));
  waterOverlay.setAttribute(
    "height",
    String(Math.max(0, bodyTop + SVG.bodyHeight - SVG.surfaceY)),
  );
  suspension.setAttribute("y2", String(bodyTop));

  const centerY = bodyTop + SVG.bodyHeight / 2;
  bodyLabel.setAttribute("x", String(bodyLeft - 12));
  bodyLabel.setAttribute("y", String(centerY + 5));

  // Tutte le frecce usano la stessa scala relativa. La lunghezza massima
  // compatta evita che la tensione entri nel riquadro del dinamometro.
  const scale = 48 / state.weight_air_N;
  const weightLength = state.weight_air_N * scale;
  const tensionLength = state.tension_force_N * scale;
  const buoyancyLength = state.buoyancy_force_N * scale;

  const weight = container.querySelector("[data-force-weight]");
  weight.setAttribute("y1", String(centerY));
  weight.setAttribute("y2", String(centerY + weightLength));
  container.querySelector("[data-weight-label]").setAttribute(
    "y",
    String(centerY + weightLength + 18),
  );

  const tension = container.querySelector("[data-force-tension]");
  tension.setAttribute("y1", String(centerY));
  tension.setAttribute("y2", String(centerY - tensionLength));
  container.querySelector("[data-tension-label]").setAttribute(
    "y",
    String(centerY - tensionLength - 9),
  );

  const buoyancy = container.querySelector("[data-force-buoyancy]");
  const buoyancyLabel = container.querySelector("[data-buoyancy-label]");
  buoyancy.setAttribute("y1", String(centerY));
  buoyancy.setAttribute("y2", String(centerY - buoyancyLength));
  buoyancyLabel.setAttribute("y", String(centerY - buoyancyLength - 9));
  const showBuoyancy = state.buoyancy_force_N > 1e-9;
  buoyancy.style.display = showBuoyancy ? "" : "none";
  buoyancyLabel.style.display = showBuoyancy ? "" : "none";
}

export function createSimulationView({ container, config }) {
  instanceCount += 1;
  const figureTitleId = `fluid-apparent-title-${instanceCount}`;
  const figureDescriptionId = `fluid-apparent-description-${instanceCount}`;
  const progressId = `fluid-apparent-progress-${instanceCount}`;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  container.innerHTML = `
    <p class="simulation-instruction">
      <strong>Esplora:</strong> <span data-learning-action></span>
      Il cursore rappresenta la frazione di volume immerso, non il tempo.
    </p>

    <figure class="fluid-statics-figure fluid-floating-figure">
      <svg class="fluid-statics-svg fluid-floating-svg" viewBox="0 0 600 415" role="img"
        aria-labelledby="${figureTitleId} ${figureDescriptionId}">
        <title id="${figureTitleId}">Corpo sospeso a un dinamometro e immerso progressivamente in un fluido</title>
        <desc id="${figureDescriptionId}">Un corpo appeso a un dinamometro entra nell'acqua di mare. Tre frecce mostrano peso, tensione e spinta di Archimede.</desc>
        <defs>
          <marker id="apparent-weight-head-${instanceCount}" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto-start-reverse">
            <path d="M 0 0 L 8 4 L 0 8 z" fill="#8b3f2f"></path>
          </marker>
          <marker id="apparent-tension-head-${instanceCount}" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto-start-reverse">
            <path d="M 0 0 L 8 4 L 0 8 z" fill="#d77724"></path>
          </marker>
          <marker id="apparent-buoyancy-head-${instanceCount}" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto-start-reverse">
            <path d="M 0 0 L 8 4 L 0 8 z" fill="#087f8c"></path>
          </marker>
        </defs>

        <rect x="246" y="18" width="108" height="38" rx="8" fill="none" stroke="currentColor" stroke-width="3"></rect>
        <text x="300" y="43" text-anchor="middle" class="fluid-column-label" data-dynamometer-label></text>
        <line x1="300" y1="56" x2="300" y2="80" stroke="currentColor" stroke-width="2" data-suspension-line></line>

        <path class="fluid-floating-tank" d="M 76 92 V 350 H 524 V 92"></path>
        <rect class="fluid-floating-water" x="80" y="170" width="440" height="176"></rect>
        <line class="fluid-surface-guide" x1="80" y1="170" x2="520" y2="170"></line>
        <text class="fluid-surface-label" x="88" y="195" data-fluid-label></text>

        <rect class="fluid-floating-body" data-apparent-body rx="8"></rect>
        <rect class="fluid-floating-water-overlay" data-apparent-water-overlay></rect>
        <text class="fluid-floating-body-label" text-anchor="end" data-body-label></text>

        <g data-force-balance>
          <line x1="252" x2="252" class="fluid-force-arrow" style="stroke:#8b3f2f" data-force-weight marker-end="url(#apparent-weight-head-${instanceCount})"></line>
          <line x1="300" x2="300" class="fluid-force-arrow" style="stroke:#d77724" data-force-tension marker-end="url(#apparent-tension-head-${instanceCount})"></line>
          <line x1="348" x2="348" class="fluid-force-arrow" style="stroke:#087f8c" data-force-buoyancy marker-end="url(#apparent-buoyancy-head-${instanceCount})"></line>
          <text class="fluid-force-label" x="252" data-weight-label text-anchor="middle">P</text>
          <text class="fluid-force-label" x="300" data-tension-label text-anchor="middle">T</text>
          <text class="fluid-force-label" x="348" data-buoyancy-label text-anchor="middle">Fₐ</text>
        </g>

        <text class="fluid-floating-fraction-label" x="300" y="393" text-anchor="middle" data-submerged-label></text>
      </svg>
      <figcaption>
        In equilibrio quasi-statico <var>T</var> + <var>F</var><sub>A</sub> = <var>P</var>.
        La lettura del dinamometro è <var>T</var>, cioè il peso apparente.
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
        <div class="fluid-statics-slider-scale" aria-hidden="true"><span>0%</span><span>100%</span></div>
      </div>

      <div class="simulation-controls" aria-label="Controlli simulazione">
        <button type="button" data-simulation-action="play">Play</button>
        <button type="button" data-simulation-action="pause">Pausa</button>
        <button type="button" data-simulation-action="reset">Reset</button>
      </div>

      <dl class="simulation-values fluid-statics-values" aria-label="Grandezze fisiche correnti">
        <div><dt>Peso in aria, P</dt><dd><span data-value="weight">--</span> N</dd></div>
        <div><dt>Spinta, F<sub>A</sub></dt><dd><span data-value="buoyancy">--</span> N</dd></div>
        <div><dt>Lettura dinamometro, T</dt><dd><span data-value="apparent">--</span> N</dd></div>
        <div data-display="volume"><dt>Volume ricavato</dt><dd><span data-value="volume">--</span> m³</dd></div>
        <div><dt>Massa ricavata</dt><dd><span data-value="mass">--</span> kg</dd></div>
        <div data-display="density"><dt>Densità ricavata</dt><dd><span data-value="body-density">--</span> kg/m³</dd></div>
      </dl>

      <div class="simulation-equations" data-display="equations" aria-label="Relazioni del modello">
        <p><var>F</var><sub>A</sub> = <var>P</var> - <var>P</var><sub>app</sub></p>
        <p><var>V</var> = <var>F</var><sub>A</sub> / (<var>ρ</var><sub>f</sub><var>g</var>)</p>
        <p><var>m</var> = <var>P/g</var>, &nbsp; <var>ρ</var><sub>c</sub> = <var>m/V</var></p>
      </div>

      <p class="simulation-status" data-simulation-status aria-live="polite"></p>
      <p class="simulation-model-note"><strong>Limiti del modello:</strong> <span data-model-note></span></p>
      <p class="simulation-error" data-simulation-error role="alert" hidden></p>
    </div>
  `;

  const progressSlider = container.querySelector('[data-simulation-action="set_progress"]');
  const status = container.querySelector("[data-simulation-status]");
  const figureDescription = container.querySelector(`#${figureDescriptionId}`);
  const forceBalance = container.querySelector("[data-force-balance]");
  container.querySelector("[data-learning-action]").textContent = config.didactics.learning_action_it;
  container.querySelector("[data-model-note]").textContent = config.didactics.model_note_it;
  container.querySelector("[data-body-label]").textContent = config.didactics.body_label_it;
  container.querySelector("[data-fluid-label]").textContent = config.didactics.fluid_label_it;
  container.querySelector("[data-dynamometer-label]").textContent = config.didactics.dynamometer_label_it;
  container.querySelector('[data-display="equations"]').hidden = !config.display.show_equations;
  container.querySelector('[data-display="volume"]').hidden = !config.display.show_derived_volume;
  container.querySelector('[data-display="density"]').hidden = !config.display.show_derived_density;
  forceBalance.style.display = config.display.show_force_balance ? "" : "none";

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
          title: motionAllowed ? "Immergi progressivamente il corpo" : reducedMotionTitle,
        },
        pause: {
          disabled: !state.is_running || !motionAllowed,
          hidden: !config.interaction.allow_pause,
          title: motionAllowed ? "Metti in pausa l'immersione" : reducedMotionTitle,
        },
        reset: { hidden: !config.interaction.allow_reset },
        set_progress: {
          disabled: !config.interaction.allow_scrub,
          value: Math.round(state.progress * Number(progressSlider.max)),
          ariaValueText: `${percentage(state.submerged_fraction, 1)} immerso, lettura ${formatNumber(state.apparent_weight_N, 1)} newton`,
        },
      };
    },
    render(state) {
      setGeometry(container, state);
      container.querySelector("[data-submerged-label]").textContent =
        `Volume immerso: ${percentage(state.submerged_fraction, 1)}`;
      container.querySelector("[data-progress-output]").textContent = percentage(state.submerged_fraction, 1);
      container.querySelector('[data-value="weight"]').textContent = formatNumber(state.weight_air_N, 1);
      container.querySelector('[data-value="buoyancy"]').textContent = formatNumber(state.buoyancy_force_N, 1);
      container.querySelector('[data-value="apparent"]').textContent = formatNumber(state.apparent_weight_N, 1);
      container.querySelector('[data-value="volume"]').textContent = formatNumber(state.volume_m3, 5);
      container.querySelector('[data-value="mass"]').textContent = formatNumber(state.mass_kg, 2);
      container.querySelector('[data-value="body-density"]').textContent = formatNumber(state.body_density_kg_m3, 0);

      if (state.is_complete) {
        status.textContent =
          `Immersione completa: Fₐ = ${formatNumber(state.buoyancy_force_N, 1)} N e il dinamometro legge ${formatNumber(state.apparent_weight_N, 1)} N. Da questi dati si ricavano V ≈ ${formatNumber(state.volume_m3, 5)} m³ e ρ ≈ ${formatNumber(state.body_density_kg_m3, 0)} kg/m³.`;
      } else if (state.submerged_fraction <= 1e-9) {
        status.textContent =
          `In aria, trascurando la spinta dell'aria, il dinamometro legge tutto il peso: ${formatNumber(state.weight_air_N, 1)} N.`;
      } else {
        status.textContent =
          `A ${percentage(state.submerged_fraction, 1)} di immersione la spinta vale ${formatNumber(state.buoyancy_force_N, 1)} N e la lettura scende a ${formatNumber(state.apparent_weight_N, 1)} N.`;
      }

      figureDescription.textContent =
        `Il corpo è immerso per il ${percentage(state.submerged_fraction, 1)} del volume. ` +
        `Il peso è ${formatNumber(state.weight_air_N, 1)} newton, la spinta di Archimede ${formatNumber(state.buoyancy_force_N, 1)} newton e la tensione ${formatNumber(state.tension_force_N, 1)} newton.`;

      container.dataset.submergedFraction = String(state.submerged_fraction);
      container.dataset.weightN = String(state.weight_air_N);
      container.dataset.buoyancyN = String(state.buoyancy_force_N);
      container.dataset.apparentWeightN = String(state.apparent_weight_N);
      container.dataset.volumeM3 = String(state.volume_m3);
      container.dataset.massKg = String(state.mass_kg);
      container.dataset.bodyDensityKgM3 = String(state.body_density_kg_m3);
      container.dataset.balanceResidualN = String(state.force_balance_residual_N);
      container.dataset.complete = String(state.is_complete);
    },
  });
}

let instanceCount = 0;

const SVG = Object.freeze({
  surfaceY: 54,
  minimumBottomY: 98,
  maximumBottomY: 252,
  firstCenterX: 170,
  secondCenterX: 430,
});

function formatNumber(value, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value);
}

function vesselWidth(radius, otherRadius) {
  if (!(radius > 0) || !(otherRadius > 0)) return 118;
  const maximum = Math.max(radius, otherRadius);
  return 72 + 68 * (radius / maximum);
}

function bottomY(depth, maximumDepth) {
  const fraction = maximumDepth > 0 ? depth / maximumDepth : 0;
  return SVG.minimumBottomY +
    fraction * (SVG.maximumBottomY - SVG.minimumBottomY);
}

function setVesselGeometry(group, centerX, width, depth, maximumDepth, pressure, maximumPressure) {
  const bottom = bottomY(depth, maximumDepth);
  const left = centerX - width / 2;
  const right = centerX + width / 2;
  const water = group.querySelector("[data-water]");
  const outline = group.querySelector("[data-vessel-outline]");
  const depthLine = group.querySelector("[data-depth-line]");
  const depthStart = group.querySelector("[data-depth-start]");
  const depthEnd = group.querySelector("[data-depth-end]");
  const pressureBar = group.querySelector("[data-pressure-bar]");

  water.setAttribute("x", String(left + 4));
  water.setAttribute("y", String(SVG.surfaceY));
  water.setAttribute("width", String(Math.max(0, width - 8)));
  water.setAttribute("height", String(Math.max(0, bottom - SVG.surfaceY - 4)));
  outline.setAttribute(
    "d",
    `M ${left} ${SVG.surfaceY - 5} V ${bottom} H ${right} V ${SVG.surfaceY - 5}`,
  );
  depthLine.setAttribute("x1", String(right + 20));
  depthLine.setAttribute("x2", String(right + 20));
  depthLine.setAttribute("y1", String(SVG.surfaceY));
  depthLine.setAttribute("y2", String(bottom));
  depthStart.setAttribute("x", String(right + 13));
  depthStart.setAttribute("y", String(SVG.surfaceY + 4));
  depthEnd.setAttribute("x", String(right + 13));
  depthEnd.setAttribute("y", String(bottom + 1));

  const pressureFraction = maximumPressure > 0 ? pressure / maximumPressure : 0;
  pressureBar.setAttribute("x", String(left));
  pressureBar.setAttribute("y", String(bottom + 13));
  pressureBar.setAttribute("width", String(Math.max(8, width * pressureFraction)));
}

export function createSimulationView({ container, config }) {
  instanceCount += 1;
  const figureTitleId = `fluid-statics-title-${instanceCount}`;
  const figureDescriptionId = `fluid-statics-description-${instanceCount}`;
  const progressId = `fluid-statics-progress-${instanceCount}`;
  const densityId = `fluid-statics-density-${instanceCount}`;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const targetRatio = config.interaction.target_pressure_ratio;

  container.innerHTML = `
    <p class="simulation-instruction">
      <strong>Esplora:</strong> <span data-learning-action></span>
      Il cursore modifica una profondità di confronto: non rappresenta lo scorrere del tempo.
    </p>

    <figure class="fluid-statics-figure">
      <svg class="fluid-statics-svg" viewBox="0 0 600 335" role="img"
        aria-labelledby="${figureTitleId} ${figureDescriptionId}">
        <title id="${figureTitleId}">Confronto tra due colonne di liquido in equilibrio idrostatico</title>
        <desc id="${figureDescriptionId}">Due recipienti mostrano la profondità verticale e la pressione relativa sul fondo.</desc>

        <line class="fluid-surface-guide" x1="35" y1="54" x2="565" y2="54"></line>
        <text class="fluid-surface-label" x="38" y="43">superficie libera</text>

        <g data-vessel="1">
          <path class="fluid-vessel-outline" data-vessel-outline></path>
          <rect class="fluid-water" data-water></rect>
          <line class="fluid-depth-line" data-depth-line></line>
          <path class="fluid-depth-cap" data-depth-start d="m 0 0 h 14"></path>
          <path class="fluid-depth-cap" data-depth-end d="m 0 0 h 14"></path>
          <rect class="fluid-pressure-bar" data-pressure-bar height="9" rx="4"></rect>
          <text class="fluid-column-label" x="170" y="292" text-anchor="middle" data-column-label="1"></text>
          <text class="fluid-depth-label" x="170" y="313" text-anchor="middle" data-depth-label="1"></text>
        </g>

        <g data-vessel="2">
          <path class="fluid-vessel-outline" data-vessel-outline></path>
          <rect class="fluid-water" data-water></rect>
          <line class="fluid-depth-line" data-depth-line></line>
          <path class="fluid-depth-cap" data-depth-start d="m 0 0 h 14"></path>
          <path class="fluid-depth-cap" data-depth-end d="m 0 0 h 14"></path>
          <rect class="fluid-pressure-bar" data-pressure-bar height="9" rx="4"></rect>
          <text class="fluid-column-label" x="430" y="292" text-anchor="middle" data-column-label="2"></text>
          <text class="fluid-depth-label" x="430" y="313" text-anchor="middle" data-depth-label="2"></text>
        </g>

        <text class="fluid-pressure-label" x="170" y="329" text-anchor="middle" data-pressure-label="1"></text>
        <text class="fluid-pressure-label" x="430" y="329" text-anchor="middle" data-pressure-label="2"></text>
      </svg>
      <figcaption>
        La lunghezza della barra sotto ogni recipiente rappresenta la pressione relativa
        <var>Δp</var>. La larghezza del recipiente non entra nella legge idrostatica.
      </figcaption>
    </figure>

    <div class="fluid-statics-panel">
      <div class="fluid-statics-scrubber">
        <label for="${progressId}">
          <span>Profondità del secondo riferimento</span>
          <output data-progress-output for="${progressId}">--</output>
        </label>
        <input id="${progressId}" type="range" min="0" max="1000" step="1" value="0"
          data-simulation-action="set_progress" data-simulation-event="input">
        <div class="fluid-statics-slider-scale" aria-hidden="true">
          <span data-depth-min></span>
          <span data-depth-max></span>
        </div>
      </div>

      <div class="fluid-statics-density-control" data-density-control>
        <label for="${densityId}">
          <span>Densità del liquido, ρ</span>
          <output data-density-output for="${densityId}">--</output>
        </label>
        <input id="${densityId}" type="range" step="10"
          data-simulation-action="set_density" data-simulation-event="input">
      </div>

      <div class="simulation-controls" aria-label="Controlli simulazione">
        <button type="button" data-simulation-action="play">Play</button>
        <button type="button" data-simulation-action="pause">Pausa</button>
        <button type="button" data-simulation-action="reset">Reset</button>
      </div>

      <dl class="simulation-values fluid-statics-values" aria-label="Grandezze fisiche correnti">
        <div><dt>Densità, ρ</dt><dd><span data-value="density">--</span> kg/m³</dd></div>
        <div><dt>Profondità 1, h₁</dt><dd><span data-value="depth-1">--</span> m</dd></div>
        <div><dt>Δp₁</dt><dd><span data-value="pressure-1">--</span> Pa</dd></div>
        <div><dt>Profondità 2, h₂</dt><dd><span data-value="depth-2">--</span> m</dd></div>
        <div><dt>Δp₂</dt><dd><span data-value="pressure-2">--</span> Pa</dd></div>
        <div data-display="pressure-ratio"><dt>Rapporto Δp₂/Δp₁</dt><dd><span data-value="pressure-ratio">--</span></dd></div>
      </dl>

      <div class="simulation-equations" data-display="equations" aria-label="Relazioni del modello">
        <p><var>Δp</var> = <var>ρgh</var></p>
        <p><var>p</var> = <var>p</var><sub>0</sub> + <var>ρgh</var></p>
        <p>A parità di <var>ρ</var> e <var>g</var>: <var>Δp</var><sub>2</sub>/<var>Δp</var><sub>1</sub> = <var>h</var><sub>2</sub>/<var>h</var><sub>1</sub></p>
      </div>

      <p class="fluid-statics-width-note" data-display="width-note">
        <strong>Osservazione:</strong> il raggio o la forma del recipiente non compaiono in <var>Δp=ρgh</var>.
      </p>
      <p class="fluid-statics-exploration-note" data-exploration-note hidden></p>
      <p class="simulation-status" data-simulation-status aria-live="polite"></p>
      <p class="simulation-model-note"><strong>Limiti del modello:</strong> <span data-model-note></span></p>
      <p class="simulation-error" data-simulation-error role="alert" hidden></p>
    </div>
  `;

  const vessel1 = container.querySelector('[data-vessel="1"]');
  const vessel2 = container.querySelector('[data-vessel="2"]');
  const progressSlider = container.querySelector('[data-simulation-action="set_progress"]');
  const densitySlider = container.querySelector('[data-simulation-action="set_density"]');
  const densityControl = container.querySelector("[data-density-control]");
  const status = container.querySelector("[data-simulation-status]");
  const figureDescription = container.querySelector(`#${figureDescriptionId}`);

  container.querySelector("[data-learning-action]").textContent =
    config.didactics.learning_action_it;
  container.querySelector("[data-model-note]").textContent = config.didactics.model_note_it;
  container.querySelector('[data-column-label="1"]').textContent =
    config.didactics.column_1_label_it;
  container.querySelector('[data-column-label="2"]').textContent =
    config.didactics.column_2_label_it;

  const explorationNote = container.querySelector("[data-exploration-note]");
  if (config.didactics.exploration_note_it) {
    explorationNote.hidden = false;
    explorationNote.textContent = config.didactics.exploration_note_it;
  }

  container.querySelector("[data-depth-min]").textContent =
    `${formatNumber(config.parameters.depth_moving_initial_m, 2)} m`;
  container.querySelector("[data-depth-max]").textContent =
    `${formatNumber(config.parameters.depth_moving_final_m, 2)} m`;

  densitySlider.min = String(config.interaction.density_min_kg_m3);
  densitySlider.max = String(config.interaction.density_max_kg_m3);
  densitySlider.value = String(config.parameters.fluid_density_initial_kg_m3);
  densityControl.hidden = !config.interaction.allow_density_change;

  container.querySelector('[data-display="equations"]').hidden = !config.display.show_equations;
  container.querySelector('[data-display="pressure-ratio"]').hidden =
    !config.display.show_pressure_ratio;
  container.querySelector('[data-display="width-note"]').hidden =
    !config.display.show_vessel_width_note;

  const width1 = vesselWidth(
    config.parameters.vessel_radius_1_m,
    config.parameters.vessel_radius_2_m,
  );
  const width2 = vesselWidth(
    config.parameters.vessel_radius_2_m,
    config.parameters.vessel_radius_1_m,
  );
  const maximumDepth = Math.max(
    config.parameters.depth_reference_m,
    config.parameters.depth_moving_final_m,
  );
  const maximumPressure =
    config.interaction.density_max_kg_m3 *
    config.parameters.gravity_m_s2 *
    maximumDepth;

  function targetReached(state) {
    if (!(targetRatio > 0)) return false;
    const tolerance = Math.max(0.01, targetRatio * 0.005);
    return Math.abs(state.pressure_ratio - targetRatio) <= tolerance;
  }

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
      if (action === "set_density") {
        return { density_kg_m3: Number(control.value) };
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
          title: motionAllowed ? "Avvia l'esplorazione automatica della profondità" : reducedMotionTitle,
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
          ariaValueText: `profondità ${formatNumber(state.depth_moving_m, 3)} metri, pressione relativa ${formatNumber(state.gauge_pressure_moving_Pa, 0)} pascal`,
        },
        set_density: {
          hidden: !config.interaction.allow_density_change,
          disabled: !config.interaction.allow_density_change,
          value: Math.round(state.fluid_density_kg_m3),
          ariaValueText: `${formatNumber(state.fluid_density_kg_m3, 0)} chilogrammi per metro cubo`,
        },
      };
    },

    render(state) {
      setVesselGeometry(
        vessel1,
        SVG.firstCenterX,
        width1,
        state.depth_reference_m,
        maximumDepth,
        state.gauge_pressure_reference_Pa,
        maximumPressure,
      );
      setVesselGeometry(
        vessel2,
        SVG.secondCenterX,
        width2,
        state.depth_moving_m,
        maximumDepth,
        state.gauge_pressure_moving_Pa,
        maximumPressure,
      );

      container.querySelector('[data-depth-label="1"]').textContent =
        `h₁ = ${formatNumber(state.depth_reference_m, 3)} m`;
      container.querySelector('[data-depth-label="2"]').textContent =
        `h₂ = ${formatNumber(state.depth_moving_m, 3)} m`;
      container.querySelector('[data-pressure-label="1"]').textContent =
        `Δp₁ = ${formatNumber(state.gauge_pressure_reference_Pa, 0)} Pa`;
      container.querySelector('[data-pressure-label="2"]').textContent =
        `Δp₂ = ${formatNumber(state.gauge_pressure_moving_Pa, 0)} Pa`;

      container.querySelector('[data-value="density"]').textContent =
        formatNumber(state.fluid_density_kg_m3, 0);
      container.querySelector('[data-value="depth-1"]').textContent =
        formatNumber(state.depth_reference_m, 3);
      container.querySelector('[data-value="pressure-1"]').textContent =
        formatNumber(state.gauge_pressure_reference_Pa, 0);
      container.querySelector('[data-value="depth-2"]').textContent =
        formatNumber(state.depth_moving_m, 3);
      container.querySelector('[data-value="pressure-2"]').textContent =
        formatNumber(state.gauge_pressure_moving_Pa, 0);
      container.querySelector('[data-value="pressure-ratio"]').textContent =
        formatNumber(state.pressure_ratio, 3);
      container.querySelector("[data-progress-output]").textContent =
        `${formatNumber(state.depth_moving_m, 3)} m`;
      container.querySelector("[data-density-output]").textContent =
        `${formatNumber(state.fluid_density_kg_m3, 0)} kg/m³`;

      const reached = targetReached(state);
      if (targetRatio > 0) {
        status.textContent = reached
          ? `Obiettivo raggiunto: Δp₂/Δp₁ ≈ ${formatNumber(targetRatio, 2)}.`
          : `Cerca Δp₂/Δp₁ = ${formatNumber(targetRatio, 2)} variando la profondità del secondo recipiente.`;
      } else {
        status.textContent =
          `A densità costante, portando h₂ a ${formatNumber(state.depth_moving_m, 3)} m si ottiene Δp₂ = ${formatNumber(state.gauge_pressure_moving_Pa, 0)} Pa.`;
      }

      figureDescription.textContent =
        `La prima colonna ha profondità ${formatNumber(state.depth_reference_m, 3)} metri e pressione relativa ${formatNumber(state.gauge_pressure_reference_Pa, 0)} pascal. ` +
        `La seconda ha profondità ${formatNumber(state.depth_moving_m, 3)} metri e pressione relativa ${formatNumber(state.gauge_pressure_moving_Pa, 0)} pascal.`;

      container.dataset.depth1M = String(state.depth_reference_m);
      container.dataset.depth2M = String(state.depth_moving_m);
      container.dataset.pressure1Pa = String(state.gauge_pressure_reference_Pa);
      container.dataset.pressure2Pa = String(state.gauge_pressure_moving_Pa);
      container.dataset.pressureRatio = String(state.pressure_ratio);
      container.dataset.fluidDensityKgM3 = String(state.fluid_density_kg_m3);
      container.dataset.targetReached = String(reached);
      container.dataset.complete = String(state.is_complete);
    },
  });
}

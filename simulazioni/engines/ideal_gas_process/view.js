const PISTON_LEFT = 50;
const PISTON_FINAL_X = 292;
const CHART = Object.freeze({ left: 58, right: 492, top: 24, bottom: 292 });
let instanceCount = 0;

function formatNumber(value, maximumFractionDigits = 1) {
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value);
}

function scaleLinear(value, domainMin, domainMax, rangeMin, rangeMax) {
  const ratio = (value - domainMin) / (domainMax - domainMin);
  return rangeMin + ratio * (rangeMax - rangeMin);
}

function createChartGeometry(parameters, thermalScale) {
  const volumeMinimum = parameters.volume_initial_m3 * 0.9;
  const volumeMaximum = parameters.volume_final_m3 * 1.07;
  const pressureMaximum = (thermalScale / parameters.volume_initial_m3) * 1.12;

  function x(volume) {
    return scaleLinear(volume, volumeMinimum, volumeMaximum, CHART.left, CHART.right);
  }

  function y(pressure) {
    return scaleLinear(pressure, 0, pressureMaximum, CHART.bottom, CHART.top);
  }

  function pressureAt(volume) {
    return thermalScale / volume;
  }

  function sampledCurve(volumeEnd, samples = 72) {
    const start = parameters.volume_initial_m3;
    const span = volumeEnd - start;
    return Array.from({ length: samples + 1 }, (_, index) => {
      const volume = start + (span * index) / samples;
      return [x(volume), y(pressureAt(volume))];
    });
  }

  function curvePath() {
    return sampledCurve(parameters.volume_final_m3)
      .map(([pointX, pointY], index) => `${index === 0 ? "M" : "L"} ${pointX} ${pointY}`)
      .join(" ");
  }

  function workAreaPath(volume) {
    const points = sampledCurve(volume, 48);
    const startX = x(parameters.volume_initial_m3);
    const endX = x(volume);
    const curve = points
      .map(([pointX, pointY]) => `L ${pointX} ${pointY}`)
      .join(" ");
    return `M ${startX} ${CHART.bottom} ${curve} L ${endX} ${CHART.bottom} Z`;
  }

  return Object.freeze({ x, y, curvePath, workAreaPath });
}

export function createSimulationView({ container, config }) {
  instanceCount += 1;
  const pistonTitleId = `ideal-gas-piston-title-${instanceCount}`;
  const pistonDescriptionId = `ideal-gas-piston-description-${instanceCount}`;
  const chartTitleId = `ideal-gas-chart-title-${instanceCount}`;
  const chartDescriptionId = `ideal-gas-chart-description-${instanceCount}`;
  const sliderId = `ideal-gas-progress-${instanceCount}`;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const pistonInitialX =
    PISTON_LEFT +
    (PISTON_FINAL_X - PISTON_LEFT) *
      (config.parameters.volume_initial_m3 / config.parameters.volume_final_m3);
  let geometry = null;

  container.innerHTML = `
    <p class="simulation-instruction">
      <strong>Esplora:</strong> <span data-learning-action></span>
      Il cursore descrive il percorso tra stati di equilibrio, non lo scorrere del tempo fisico.
    </p>

    <div class="ideal-gas-visuals">
      <figure class="ideal-gas-figure" data-display="piston">
        <svg class="ideal-gas-piston-svg" viewBox="0 0 360 260" role="img"
          aria-labelledby="${pistonTitleId} ${pistonDescriptionId}">
          <title id="${pistonTitleId}">Cilindro con pistone durante l'espansione</title>
          <desc id="${pistonDescriptionId}">Il pistone delimita il volume occupato dal gas.</desc>
          <path class="gas-cylinder" d="M 42 48 H 318 V 216 H 42 Z"></path>
          <rect class="gas-fill" data-gas-fill x="50" y="56" width="100" height="152"></rect>
          <g data-piston>
            <rect class="gas-piston" x="-7" y="42" width="14" height="180" rx="4"></rect>
            <line class="gas-piston-rod" x1="7" y1="132" x2="52" y2="132"></line>
            <circle class="gas-piston-handle" cx="57" cy="132" r="8"></circle>
          </g>
          <path class="gas-heat-arrow" d="M 90 238 V 194"></path>
          <path class="gas-heat-arrow-head" d="M 82 203 L 90 192 L 98 203"></path>
          <text class="gas-heat-label" x="104" y="238">calore Q fornito</text>
          <text class="gas-temperature-label" x="72" y="138">T costante</text>
        </svg>
        <figcaption>Il pistone indica il volume dello stato, senza modellarne la dinamica.</figcaption>
      </figure>

      <figure class="ideal-gas-figure" data-display="pv-diagram">
        <svg class="ideal-gas-pv-svg" viewBox="0 0 520 340" role="img"
          aria-labelledby="${chartTitleId} ${chartDescriptionId}">
          <title id="${chartTitleId}">Diagramma pressione-volume dell'isoterma reversibile</title>
          <desc id="${chartDescriptionId}">Il punto di stato percorre l'isoterma; l'area evidenziata rappresenta il lavoro cumulativo.</desc>
          <line class="pv-axis" x1="58" y1="292" x2="500" y2="292"></line>
          <line class="pv-axis" x1="58" y1="300" x2="58" y2="18"></line>
          <path class="pv-axis-arrow" d="M 500 292 l -11 -6 v 12 z"></path>
          <path class="pv-axis-arrow" d="M 58 18 l -6 11 h 12 z"></path>
          <text class="pv-axis-label" x="456" y="326">V (m³)</text>
          <text class="pv-axis-label" x="12" y="24">p (Pa)</text>
          <path class="pv-work-area" data-work-area></path>
          <path class="pv-isotherm" data-isotherm></path>
          <line class="pv-guide" data-volume-guide y2="292"></line>
          <circle class="pv-state-point" data-state-point r="7"></circle>
          <text class="pv-tick-label" data-volume-initial-label y="315"></text>
          <text class="pv-tick-label" data-volume-final-label y="315"></text>
          <text class="pv-work-label" x="80" y="278">Lavoro L = area sotto p(V)</text>
        </svg>
        <figcaption>Isoterma <var>p</var> = <var>nRT</var>/<var>V</var> e lavoro accumulato da <var>V</var><sub>i</sub>.</figcaption>
      </figure>
    </div>

    <div class="ideal-gas-panel">
      <div class="ideal-gas-scrubber">
        <label for="${sliderId}">
          <span>Avanzamento didattico verso il volume finale</span>
          <output data-progress-output for="${sliderId}">0%</output>
        </label>
        <input id="${sliderId}" type="range" min="0" max="1000" step="1" value="0"
          data-simulation-action="set_progress" data-simulation-event="input">
        <div class="ideal-gas-slider-scale" aria-hidden="true">
          <span>V<sub>i</sub> = <span data-slider-initial></span> m³</span>
          <span>V<sub>f</sub> = <span data-slider-final></span> m³</span>
        </div>
      </div>

      <div class="simulation-controls" aria-label="Controlli simulazione">
        <button type="button" data-simulation-action="play">Play</button>
        <button type="button" data-simulation-action="pause">Pausa</button>
        <button type="button" data-simulation-action="reset">Reset</button>
      </div>

      <dl class="simulation-values ideal-gas-values" aria-label="Grandezze fisiche correnti">
        <div><dt>Volume, V</dt><dd><span data-value="volume">--</span> m<sup>3</sup></dd></div>
        <div><dt>Pressione, p</dt><dd><span data-value="pressure">--</span> Pa</dd></div>
        <div><dt>Temperatura, T</dt><dd><span data-value="temperature">--</span> K</dd></div>
        <div data-display="energy"><dt>Lavoro, L</dt><dd><span data-value="work">--</span> J</dd></div>
        <div data-display="energy"><dt>Calore, Q</dt><dd><span data-value="heat">--</span> J</dd></div>
        <div data-display="energy"><dt>Energia interna, ΔU</dt><dd><span data-value="delta-u">--</span> J</dd></div>
      </dl>

      <div class="simulation-equations" data-display="equations" aria-label="Relazioni del modello">
        <p><var>pV</var> = <var>nRT</var>, con <var>T</var> costante</p>
        <p><var>L</var>(<var>V</var>) = <var>nRT</var> ln(<var>V</var>/<var>V</var><sub>i</sub>)</p>
        <p>Δ<var>U</var> = 0 &nbsp;⇒&nbsp; <var>Q</var> = <var>L</var></p>
      </div>

      <p class="simulation-status" data-simulation-status aria-live="polite"></p>
      <p class="simulation-model-note"><strong>Limiti del modello:</strong> <span data-model-note></span></p>
      <p class="simulation-error" data-simulation-error role="alert" hidden></p>
    </div>
  `;

  const piston = container.querySelector("[data-piston]");
  const gasFill = container.querySelector("[data-gas-fill]");
  const pistonDescription = container.querySelector(`#${pistonDescriptionId}`);
  const chartDescription = container.querySelector(`#${chartDescriptionId}`);
  const statePoint = container.querySelector("[data-state-point]");
  const volumeGuide = container.querySelector("[data-volume-guide]");
  const workArea = container.querySelector("[data-work-area]");
  const status = container.querySelector("[data-simulation-status]");
  const slider = container.querySelector('[data-simulation-action="set_progress"]');
  const progressOutput = container.querySelector("[data-progress-output]");

  container.querySelector("[data-learning-action]").textContent =
    config.didactics.learning_action_it;
  container.querySelector("[data-model-note]").textContent = config.didactics.model_note_it;
  container.querySelector("[data-slider-initial]").textContent = formatNumber(
    config.parameters.volume_initial_m3,
    3,
  );
  container.querySelector("[data-slider-final]").textContent = formatNumber(
    config.parameters.volume_final_m3,
    3,
  );
  const initialLabel = container.querySelector("[data-volume-initial-label]");
  initialLabel.textContent = formatNumber(config.parameters.volume_initial_m3, 2);
  const finalLabel = container.querySelector("[data-volume-final-label]");
  finalLabel.textContent = formatNumber(config.parameters.volume_final_m3, 2);

  function ensureChartGeometry(state) {
    if (geometry === null) {
      geometry = createChartGeometry(
        config.parameters,
        state.pressure_Pa * state.volume_m3,
      );
      container.querySelector("[data-isotherm]").setAttribute("d", geometry.curvePath());
      initialLabel.setAttribute(
        "x",
        String(geometry.x(config.parameters.volume_initial_m3) - 13),
      );
      finalLabel.setAttribute(
        "x",
        String(geometry.x(config.parameters.volume_final_m3) - 13),
      );
    }
    return geometry;
  }

  container.querySelector('[data-display="piston"]').hidden = !config.display.show_piston;
  container.querySelector('[data-display="pv-diagram"]').hidden = !config.display.show_pv_diagram;
  workArea.hidden = !config.display.show_work_area;
  container.querySelector('[data-display="equations"]').hidden = !config.display.show_equations;
  for (const energyValue of container.querySelectorAll('[data-display="energy"]')) {
    energyValue.hidden = !config.display.show_energy_values;
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
      return undefined;
    },

    describeControls(state, { motionAllowed = true } = {}) {
      const reducedMotionTitle =
        "Playback disattivato dalla preferenza di riduzione del movimento; usa il cursore";
      return {
        play: {
          disabled: state.is_running || state.is_complete || !motionAllowed,
          hidden: !config.interaction.allow_play,
          title: motionAllowed ? "Avvia il playback didattico" : reducedMotionTitle,
        },
        pause: {
          disabled: !state.is_running || !motionAllowed,
          hidden: !config.interaction.allow_pause,
          title: motionAllowed ? "Metti in pausa il playback didattico" : reducedMotionTitle,
        },
        reset: {
          hidden: !config.interaction.allow_reset,
        },
        set_progress: {
          disabled: !config.interaction.allow_scrub,
          value: Math.round(state.progress * Number(slider.max)),
          ariaValueText: `${Math.round(state.progress * 100)}%, volume ${formatNumber(state.volume_m3, 3)} metri cubi`,
        },
      };
    },

    render(state) {
      const chartGeometry = ensureChartGeometry(state);
      const pistonX = scaleLinear(state.progress, 0, 1, pistonInitialX, PISTON_FINAL_X);
      piston.setAttribute("transform", `translate(${pistonX} 0)`);
      gasFill.setAttribute("width", String(pistonX - PISTON_LEFT));

      const pointX = chartGeometry.x(state.volume_m3);
      const pointY = chartGeometry.y(state.pressure_Pa);
      statePoint.setAttribute("cx", String(pointX));
      statePoint.setAttribute("cy", String(pointY));
      volumeGuide.setAttribute("x1", String(pointX));
      volumeGuide.setAttribute("x2", String(pointX));
      volumeGuide.setAttribute("y1", String(pointY));
      workArea.setAttribute("d", chartGeometry.workAreaPath(state.volume_m3));

      container.querySelector('[data-value="volume"]').textContent = formatNumber(
        state.volume_m3,
        3,
      );
      container.querySelector('[data-value="pressure"]').textContent = formatNumber(
        state.pressure_Pa,
        0,
      );
      container.querySelector('[data-value="temperature"]').textContent = formatNumber(
        state.temperature_K,
        0,
      );
      container.querySelector('[data-value="work"]').textContent = formatNumber(state.work_J, 1);
      container.querySelector('[data-value="heat"]').textContent = formatNumber(state.heat_J, 1);
      container.querySelector('[data-value="delta-u"]').textContent = formatNumber(
        state.delta_u_J,
        0,
      );
      progressOutput.textContent = `${Math.round(state.progress * 100)}%`;

      const motionText = this.motionAllowed
        ? (state.is_running ? "Playback didattico in corso" : "Playback didattico in pausa")
        : "Playback disattivato per ridurre il movimento; il cursore resta disponibile";
      status.textContent = state.is_complete
        ? `Stato finale raggiunto. ${motionText}.`
        : `${motionText}. Stato di equilibrio al ${Math.round(state.progress * 100)}% del percorso.`;
      status.classList.toggle("target-reached", state.is_complete);

      pistonDescription.textContent = `Il pistone delimita un volume di ${formatNumber(state.volume_m3, 3)} metri cubi; la temperatura resta ${formatNumber(state.temperature_K, 0)} kelvin.`;
      chartDescription.textContent = `Stato corrente: volume ${formatNumber(state.volume_m3, 3)} metri cubi, pressione ${formatNumber(state.pressure_Pa, 0)} pascal, lavoro cumulativo ${formatNumber(state.work_J, 1)} joule.`;
      container.dataset.progress = String(state.progress);
      container.dataset.volumeM3 = String(state.volume_m3);
      container.dataset.pressurePa = String(state.pressure_Pa);
      container.dataset.heatJ = String(state.heat_J);
      container.dataset.deltaUJ = String(state.delta_u_J);
      container.dataset.complete = String(state.is_complete);
      container.dataset.motionAllowed = String(this.motionAllowed);
    },
  });
}

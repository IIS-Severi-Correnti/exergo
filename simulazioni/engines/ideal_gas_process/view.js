const PISTON_LEFT = 50;
const PISTON_FINAL_X = 292;
const CHART = Object.freeze({ left: 58, right: 492, top: 24, bottom: 292 });
let instanceCount = 0;

function formatNumber(value, maximumFractionDigits = 1) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value);
}

function scaleLinear(value, domainMin, domainMax, rangeMin, rangeMax) {
  if (Math.abs(domainMax - domainMin) < 1e-15) return (rangeMin + rangeMax) / 2;
  const ratio = (value - domainMin) / (domainMax - domainMin);
  return rangeMin + ratio * (rangeMax - rangeMin);
}

function finiteValues(points, index) {
  return points.map((point) => point[index]).filter((value) => Number.isFinite(value));
}

function paddedDomain(values, { includeZero = false } = {}) {
  let minimum = Math.min(...values);
  let maximum = Math.max(...values);
  if (includeZero) minimum = Math.min(0, minimum);
  if (Math.abs(maximum - minimum) < 1e-12) {
    const padding = Math.max(Math.abs(maximum) * 0.08, 1e-6);
    return [minimum - padding, maximum + padding];
  }
  const span = maximum - minimum;
  return [minimum - span * 0.06, maximum + span * 0.08];
}

function createChartGeometry(chart) {
  const points = chart.path_points.length ? chart.path_points : [[chart.x_value, chart.y_value]];
  const [xMinimum, xMaximum] = paddedDomain(finiteValues(points, 0));
  const [yMinimum, yMaximum] = paddedDomain(finiteValues(points, 1), { includeZero: true });

  function x(value) {
    return scaleLinear(value, xMinimum, xMaximum, CHART.left, CHART.right);
  }

  function y(value) {
    return scaleLinear(value, yMinimum, yMaximum, CHART.bottom, CHART.top);
  }

  function pathFor(pointsToDraw, close = false) {
    if (!pointsToDraw.length) return "";
    const path = pointsToDraw
      .map(([px, py], index) => `${index === 0 ? "M" : "L"} ${x(px)} ${y(py)}`)
      .join(" ");
    return close ? `${path} Z` : path;
  }

  function workAreaPath(model) {
    if (!chart.area_points.length) return "";
    if (model === "thermodynamic_cycle") return pathFor(chart.area_points, true);
    const curve = chart.area_points;
    const first = curve[0];
    const last = curve[curve.length - 1];
    return `M ${x(first[0])} ${y(0)} ${curve
      .map(([px, py]) => `L ${x(px)} ${y(py)}`)
      .join(" ")} L ${x(last[0])} ${y(0)} Z`;
  }

  return Object.freeze({ x, y, pathFor, workAreaPath });
}

function maxVisualVolume(config) {
  const p = config.parameters;
  if (config.model === "reversible_isothermal") return p.volume_final_m3;
  if (config.model === "process_comparison") return p.volume_initial_m3 * p.expansion_ratio;
  if (config.model === "piecewise_isobaric_isothermal") {
    const volumeB = p.volume_A_m3 - p.volume_compression_m3;
    return Math.max(p.volume_A_m3, volumeB / p.pressure_C_over_B_ratio);
  }
  if (config.model === "isochoric_monoatomic") return p.volume_m3;
  return 1;
}

function processLabel(process) {
  return {
    isochoric: "Isocora",
    isobaric: "Isobara",
    isothermal: "Isoterma",
  }[process] ?? process;
}

function equationHtmlForState(state) {
  if (state.model === "reversible_isothermal") {
    return `<p><var>pV</var> = <var>nRT</var>, con <var>T</var> costante</p>
      <p><var>L</var> = <var>nRT</var> ln(<var>V</var>/<var>V</var><sub>i</sub>)</p>
      <p>Δ<var>U</var> = 0 &nbsp;⇒&nbsp; <var>Q</var> = <var>L</var></p>`;
  }
  if (state.model === "process_comparison") {
    if (state.selected_process === "isochoric") {
      return `<p><var>V</var> = costante &nbsp;⇒&nbsp; <var>L</var> = 0</p><p><var>Q</var> = Δ<var>U</var></p>`;
    }
    if (state.selected_process === "isobaric") {
      return `<p><var>p</var> = costante</p><p><var>L</var> = <var>p</var>Δ<var>V</var>, &nbsp; <var>Q</var> = Δ<var>U</var> + <var>L</var></p>`;
    }
    return `<p><var>T</var> = costante, &nbsp; <var>pV</var> = costante</p><p>Δ<var>U</var> = 0 &nbsp;⇒&nbsp; <var>Q</var> = <var>L</var></p>`;
  }
  if (state.model === "piecewise_isobaric_isothermal") {
    return `<p>A→B: <var>p</var> = costante, quindi <var>V/T</var> = costante.</p>
      <p>B→C: <var>T</var> = costante, quindi <var>pV</var> = costante.</p>`;
  }
  if (state.model === "thermodynamic_cycle") {
    return `<p>Su un ciclo completo: Δ<var>U</var><sub>ciclo</sub> = 0.</p>
      <p>Con Δ<var>U</var> = <var>Q</var> − <var>L</var>: &nbsp; <var>Q</var><sub>netto</sub> = <var>L</var><sub>netto</sub>.</p>`;
  }
  if (state.model === "isochoric_monoatomic") {
    return `<p><var>L</var> = 0, perché Δ<var>V</var> = 0.</p>
      <p>Δ<var>U</var> = 3/2 <var>V</var>Δ<var>p</var>, &nbsp; <var>Q</var> = Δ<var>U</var>.</p>`;
  }
  return "";
}

function sliderAriaText(state) {
  if (state.model === "piecewise_isobaric_isothermal") {
    return `${Math.round(state.progress * 100)}%, fase ${state.phase}, volume ${formatNumber(state.volume_m3, 4)} metri cubi`;
  }
  if (state.model === "thermodynamic_cycle") {
    return `${Math.round(state.progress * 100)}%, ${state.phase}`;
  }
  if (state.model === "isochoric_monoatomic") {
    return `${Math.round(state.progress * 100)}%, aumento di pressione ${formatNumber(state.pressure_change_Pa, 0)} pascal`;
  }
  return `${Math.round(state.progress * 100)}%, volume ${formatNumber(state.volume_m3, 4)} metri cubi`;
}

export function createSimulationView({ container, config }) {
  instanceCount += 1;
  const pistonTitleId = `ideal-gas-piston-title-${instanceCount}`;
  const pistonDescriptionId = `ideal-gas-piston-description-${instanceCount}`;
  const chartTitleId = `ideal-gas-chart-title-${instanceCount}`;
  const chartDescriptionId = `ideal-gas-chart-description-${instanceCount}`;
  const sliderId = `ideal-gas-progress-${instanceCount}`;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  container.innerHTML = `
    <p class="simulation-instruction">
      <strong>Esplora:</strong> <span data-learning-action></span>
      Il cursore ordina stati di equilibrio o fasi del modello: non rappresenta il tempo fisico.
    </p>

    <div class="ideal-gas-process-selector" data-process-selector hidden aria-label="Trasformazione da confrontare">
      <button type="button" data-simulation-action="select_process" data-process="isochoric">Isocora</button>
      <button type="button" data-simulation-action="select_process" data-process="isobaric">Isobara</button>
      <button type="button" data-simulation-action="select_process" data-process="isothermal">Isoterma</button>
    </div>

    <div class="ideal-gas-visuals">
      <figure class="ideal-gas-figure" data-display="piston">
        <svg class="ideal-gas-piston-svg" viewBox="0 0 360 260" role="img"
          aria-labelledby="${pistonTitleId} ${pistonDescriptionId}">
          <title id="${pistonTitleId}">Cilindro con pistone</title>
          <desc id="${pistonDescriptionId}">Il pistone rappresenta schematicamente il volume dello stato.</desc>
          <path class="gas-cylinder" d="M 42 48 H 318 V 216 H 42 Z"></path>
          <rect class="gas-fill" data-gas-fill x="50" y="56" width="100" height="152"></rect>
          <g data-piston>
            <rect class="gas-piston" x="-7" y="42" width="14" height="180" rx="4"></rect>
            <line class="gas-piston-rod" x1="7" y1="132" x2="52" y2="132"></line>
            <circle class="gas-piston-handle" cx="57" cy="132" r="8"></circle>
          </g>
          <text class="gas-temperature-label" x="72" y="138" data-piston-state-label></text>
        </svg>
        <figcaption>Il pistone indica il volume dello stato, senza modellarne la dinamica.</figcaption>
      </figure>

      <figure class="ideal-gas-figure" data-display="pv-diagram">
        <svg class="ideal-gas-pv-svg" viewBox="0 0 520 340" role="img"
          aria-labelledby="${chartTitleId} ${chartDescriptionId}">
          <title id="${chartTitleId}">Diagramma termodinamico</title>
          <desc id="${chartDescriptionId}">Il punto evidenzia lo stato corrente lungo la traiettoria selezionata.</desc>
          <line class="pv-axis" x1="58" y1="292" x2="500" y2="292"></line>
          <line class="pv-axis" x1="58" y1="300" x2="58" y2="18"></line>
          <path class="pv-axis-arrow" d="M 500 292 l -11 -6 v 12 z"></path>
          <path class="pv-axis-arrow" d="M 58 18 l -6 11 h 12 z"></path>
          <text class="pv-axis-label" x="430" y="326" data-axis-x-label></text>
          <text class="pv-axis-label" x="12" y="24" data-axis-y-label></text>
          <path class="pv-work-area" data-work-area></path>
          <path class="pv-isotherm" data-isotherm data-process-path></path>
          <line class="pv-guide" data-volume-guide y2="292"></line>
          <circle class="pv-state-point" data-state-point r="7"></circle>
          <text class="pv-tick-label" data-volume-initial-label y="315"></text>
          <text class="pv-tick-label" data-volume-final-label y="315"></text>
          <text class="pv-work-label" x="80" y="278" data-chart-note></text>
        </svg>
        <figcaption data-chart-caption></figcaption>
      </figure>
    </div>

    <div class="ideal-gas-panel">
      <div class="ideal-gas-scrubber">
        <label for="${sliderId}">
          <span data-slider-label>Avanzamento didattico</span>
          <output data-progress-output for="${sliderId}">0%</output>
        </label>
        <input id="${sliderId}" type="range" min="0" max="1000" step="1" value="0"
          data-simulation-action="set_progress" data-simulation-event="input">
        <div class="ideal-gas-slider-scale" aria-hidden="true"><span>inizio</span><span>fine</span></div>
      </div>

      <div class="simulation-controls" aria-label="Controlli simulazione">
        <button type="button" data-simulation-action="play">Play</button>
        <button type="button" data-simulation-action="pause">Pausa</button>
        <button type="button" data-simulation-action="reset">Reset</button>
      </div>

      <dl class="simulation-values ideal-gas-values" aria-label="Grandezze fisiche correnti">
        <div><dt>Volume</dt><dd><span data-value="volume">--</span> <span data-unit="volume">m³</span></dd></div>
        <div><dt data-label="pressure">Pressione</dt><dd><span data-value="pressure">--</span> <span data-unit="pressure">Pa</span></dd></div>
        <div><dt>Temperatura</dt><dd><span data-value="temperature">--</span> K</dd></div>
        <div><dt>Fase / processo</dt><dd><span data-value="phase">--</span></dd></div>
        <div data-display="energy"><dt>Lavoro, L</dt><dd><span data-value="work">--</span> J</dd></div>
        <div data-display="energy"><dt>Calore, Q</dt><dd><span data-value="heat">--</span> J</dd></div>
        <div data-display="energy"><dt>Energia interna, ΔU</dt><dd><span data-value="delta-u">--</span> J</dd></div>
        <div data-value-row="cycle" hidden><dt>Area orientata</dt><dd><span data-value="cycle-work">--</span> unità norm.</dd></div>
      </dl>

      <div class="simulation-equations" data-display="equations" aria-label="Relazioni del modello"></div>
      <p class="simulation-status" data-simulation-status aria-live="polite"></p>
      <p class="simulation-model-note"><strong>Limiti del modello:</strong> <span data-model-note></span></p>
      <p class="simulation-error" data-simulation-error role="alert" hidden></p>
    </div>
  `;

  const pistonFigure = container.querySelector('[data-display="piston"]');
  const chartFigure = container.querySelector('[data-display="pv-diagram"]');
  const piston = container.querySelector("[data-piston]");
  const gasFill = container.querySelector("[data-gas-fill]");
  const pistonDescription = container.querySelector(`#${pistonDescriptionId}`);
  const chartDescription = container.querySelector(`#${chartDescriptionId}`);
  const statePoint = container.querySelector("[data-state-point]");
  const volumeGuide = container.querySelector("[data-volume-guide]");
  const workArea = container.querySelector("[data-work-area]");
  const processPath = container.querySelector("[data-process-path]");
  const status = container.querySelector("[data-simulation-status]");
  const slider = container.querySelector('[data-simulation-action="set_progress"]');
  const progressOutput = container.querySelector("[data-progress-output]");
  const equations = container.querySelector('[data-display="equations"]');
  const processSelector = container.querySelector("[data-process-selector]");
  const initialLabel = container.querySelector("[data-volume-initial-label]");
  const finalLabel = container.querySelector("[data-volume-final-label]");

  container.querySelector("[data-learning-action]").textContent = config.didactics.learning_action_it;
  container.querySelector("[data-model-note]").textContent = config.didactics.model_note_it;
  container.querySelector("[data-slider-label]").textContent = config.didactics.slider_label_it || "Avanzamento didattico";
  processSelector.hidden = config.model !== "process_comparison";
  pistonFigure.hidden = !config.display.show_piston;
  chartFigure.hidden = !config.display.show_pv_diagram;
  workArea.hidden = !config.display.show_work_area;
  equations.hidden = !config.display.show_equations;
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
      if (action === "set_progress") return { progress: Number(control.value) / Number(control.max) };
      if (action === "select_process") return { process: control.dataset.process };
      return undefined;
    },

    describeControls(state, { motionAllowed = true } = {}) {
      const reducedMotionTitle = "Playback disattivato dalla preferenza di riduzione del movimento; usa il cursore";
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
        reset: { hidden: !config.interaction.allow_reset },
        set_progress: {
          disabled: !config.interaction.allow_scrub,
          value: Math.round(state.progress * Number(slider.max)),
          ariaValueText: sliderAriaText(state),
        },
      };
    },

    render(state) {
      const geometry = createChartGeometry(state.chart);
      processPath.setAttribute("d", geometry.pathFor(state.chart.path_points));
      workArea.setAttribute("d", geometry.workAreaPath(state.model));

      const pointX = geometry.x(state.chart.x_value);
      const pointY = geometry.y(state.chart.y_value);
      statePoint.setAttribute("cx", String(pointX));
      statePoint.setAttribute("cy", String(pointY));
      volumeGuide.setAttribute("x1", String(pointX));
      volumeGuide.setAttribute("x2", String(pointX));
      volumeGuide.setAttribute("y1", String(pointY));

      const firstPoint = state.chart.path_points[0];
      const lastPoint = state.chart.path_points[state.chart.path_points.length - 1];
      initialLabel.textContent = formatNumber(firstPoint?.[0], 3);
      finalLabel.textContent = formatNumber(lastPoint?.[0], 3);
      if (firstPoint) initialLabel.setAttribute("x", String(geometry.x(firstPoint[0]) - 13));
      if (lastPoint) finalLabel.setAttribute("x", String(geometry.x(lastPoint[0]) - 13));
      container.querySelector("[data-axis-x-label]").textContent = state.chart.x_label;
      container.querySelector("[data-axis-y-label]").textContent = state.chart.y_label;
      container.querySelector("[data-chart-note]").textContent = state.model === "thermodynamic_cycle" ? "Area orientata = lavoro netto" : "";
      container.querySelector("[data-chart-caption]").textContent = state.chart.note;

      if (Number.isFinite(state.volume_m3)) {
        const width = (PISTON_FINAL_X - PISTON_LEFT) * state.volume_m3 / maxVisualVolume(config);
        const boundedWidth = Math.max(8, Math.min(PISTON_FINAL_X - PISTON_LEFT, width));
        const pistonX = PISTON_LEFT + boundedWidth;
        piston.setAttribute("transform", `translate(${pistonX} 0)`);
        gasFill.setAttribute("width", String(boundedWidth));
      }
      const stateLabel = container.querySelector("[data-piston-state-label]");
      stateLabel.textContent = Number.isFinite(state.temperature_K)
        ? `T = ${formatNumber(state.temperature_K, 0)} K`
        : (Number.isFinite(state.pressure_change_Pa) ? `Δp = ${formatNumber(state.pressure_change_Pa, 0)} Pa` : "stato schematico");
      pistonDescription.textContent = Number.isFinite(state.volume_m3)
        ? `Il pistone delimita schematicamente un volume di ${formatNumber(state.volume_m3, 4)} metri cubi.`
        : "Il pistone non è usato per questo modello.";
      chartDescription.textContent = `Stato corrente: ${state.chart.x_label} = ${formatNumber(state.chart.x_value, 4)}, ${state.chart.y_label} = ${formatNumber(state.chart.y_value, 2)}.`;

      container.querySelector('[data-value="volume"]').textContent = Number.isFinite(state.volume_m3)
        ? formatNumber(state.volume_m3, 4)
        : formatNumber(state.volume_ratio, 2);
      container.querySelector('[data-unit="volume"]').textContent = Number.isFinite(state.volume_m3) ? "m³" : "V/V₀";

      const pressureLabel = container.querySelector('[data-label="pressure"]');
      const pressureUnit = container.querySelector('[data-unit="pressure"]');
      const pressureValue = container.querySelector('[data-value="pressure"]');
      if (Number.isFinite(state.pressure_Pa)) {
        pressureLabel.textContent = "Pressione";
        pressureValue.textContent = formatNumber(state.pressure_Pa, 0);
        pressureUnit.textContent = "Pa";
      } else if (Number.isFinite(state.pressure_change_Pa)) {
        pressureLabel.textContent = "Aumento di pressione";
        pressureValue.textContent = formatNumber(state.pressure_change_Pa, 0);
        pressureUnit.textContent = "Pa";
      } else {
        pressureLabel.textContent = "Pressione relativa";
        pressureValue.textContent = formatNumber(state.pressure_ratio, 3);
        pressureUnit.textContent = "p/p₀";
      }

      container.querySelector('[data-value="temperature"]').textContent = formatNumber(state.temperature_K, 1);
      container.querySelector('[data-value="phase"]').textContent = state.selected_process ? processLabel(state.selected_process) : String(state.phase ?? "—");
      container.querySelector('[data-value="work"]').textContent = formatNumber(state.work_J, 1);
      container.querySelector('[data-value="heat"]').textContent = formatNumber(state.heat_J, 1);
      container.querySelector('[data-value="delta-u"]').textContent = formatNumber(state.delta_u_J, 1);
      const cycleRow = container.querySelector('[data-value-row="cycle"]');
      cycleRow.hidden = state.model !== "thermodynamic_cycle";
      container.querySelector('[data-value="cycle-work"]').textContent = formatNumber(state.cycle_net_work_normalized, 2);
      equations.innerHTML = equationHtmlForState(state);
      progressOutput.textContent = `${Math.round(state.progress * 100)}%`;

      for (const button of processSelector.querySelectorAll("[data-process]")) {
        const selected = button.dataset.process === state.selected_process;
        button.setAttribute("aria-pressed", String(selected));
        button.classList.toggle("is-selected", selected);
      }

      const motionText = this.motionAllowed
        ? (state.is_running ? "Playback didattico in corso" : "Playback didattico in pausa")
        : "Playback disattivato per ridurre il movimento; il cursore resta disponibile";
      status.textContent = state.is_complete
        ? `Percorso completato. ${motionText}.`
        : `${motionText}. Avanzamento ${Math.round(state.progress * 100)}%.`;
      status.classList.toggle("target-reached", state.is_complete);

      container.dataset.progress = String(state.progress);
      container.dataset.volumeM3 = Number.isFinite(state.volume_m3) ? String(state.volume_m3) : "";
      container.dataset.pressurePa = Number.isFinite(state.pressure_Pa) ? String(state.pressure_Pa) : "";
      container.dataset.pressureRatio = Number.isFinite(state.pressure_ratio) ? String(state.pressure_ratio) : "";
      container.dataset.pressureChangePa = Number.isFinite(state.pressure_change_Pa) ? String(state.pressure_change_Pa) : "";
      container.dataset.temperatureK = Number.isFinite(state.temperature_K) ? String(state.temperature_K) : "";
      container.dataset.heatJ = Number.isFinite(state.heat_J) ? String(state.heat_J) : "";
      container.dataset.deltaUJ = Number.isFinite(state.delta_u_J) ? String(state.delta_u_J) : "";
      container.dataset.phase = String(state.phase ?? "");
      container.dataset.selectedProcess = String(state.selected_process ?? "");
      container.dataset.complete = String(state.is_complete);
      container.dataset.motionAllowed = String(this.motionAllowed);
    },
  });
}

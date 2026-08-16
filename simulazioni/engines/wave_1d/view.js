let instanceCount = 0;

function fmt(value, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: digits }).format(value);
}

function line(x1, y1, x2, y2, cls, extra = "") {
  return `<line class="${cls}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${extra}></line>`;
}

function arrow(x1, y, x2, cls) {
  const direction = x2 >= x1 ? 1 : -1;
  return `${line(x1, y, x2, y, cls)}<path class="wave-arrow-head ${cls}" d="M ${x2} ${y} l ${-direction * 12} -7 v 14 z"></path>`;
}

function sinePath({ x0 = 60, x1 = 580, axisY = 205, amplitude = 58, cycles = 1, phase = 0 }) {
  const points = [];
  const count = 120;
  for (let index = 0; index <= count; index += 1) {
    const fraction = index / count;
    const x = x0 + (x1 - x0) * fraction;
    const y = axisY - amplitude * Math.sin(2 * Math.PI * cycles * fraction + phase);
    points.push(`${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return points.join(" ");
}

function observerDopplerScene(state) {
  const sourceX = 95;
  const observerX = 545;
  const speedFraction = state.observer_speed_target_m_s > 0
    ? state.observer_speed_m_s / state.observer_speed_target_m_s
    : 0;
  const fronts = [];
  for (let x = 155; x < 520; x += 62) {
    fronts.push(`<circle class="wave-front" cx="${sourceX}" cy="195" r="${x - sourceX}"></circle>`);
  }
  const arrowLength = 130 * speedFraction;
  return `
    <circle class="wave-source" cx="${sourceX}" cy="195" r="18"></circle>
    <text class="wave-label" x="${sourceX}" y="235" text-anchor="middle">sorgente ferma</text>
    ${fronts.join("")}
    <g class="wave-observer"><circle cx="${observerX}" cy="195" r="20"></circle><circle cx="${observerX}" cy="160" r="11"></circle></g>
    <text class="wave-label" x="${observerX}" y="245" text-anchor="middle">osservatore</text>
    ${arrowLength > 1 ? arrow(observerX + 60, 125, observerX + 60 - arrowLength, "wave-velocity") : ""}
    <text class="wave-note" x="320" y="326" text-anchor="middle">I fronti restano quelli di una sorgente ferma; cambia la velocità con cui l'osservatore li incontra.</text>`;
}

function sourceDopplerScene(state) {
  const sourceX = 315;
  const base = 55;
  const aheadSpacing = base * state.wavelength_ahead_ratio;
  const behindSpacing = base * state.wavelength_behind_ratio;
  const fronts = [];
  for (let x = sourceX + aheadSpacing; x < 610; x += aheadSpacing) {
    fronts.push(line(x, 90, x, 285, "wave-front-line wave-front-ahead"));
  }
  for (let x = sourceX - behindSpacing; x > 30; x -= behindSpacing) {
    fronts.push(line(x, 90, x, 285, "wave-front-line wave-front-behind"));
  }
  const arrowLength = 150 * (state.source_speed_target_over_wave_speed > 0
    ? state.source_speed_over_wave_speed / state.source_speed_target_over_wave_speed
    : 0);
  return `
    ${fronts.join("")}
    <circle class="wave-source" cx="${sourceX}" cy="190" r="20"></circle>
    <text class="wave-label" x="${sourceX}" y="230" text-anchor="middle">sorgente</text>
    ${arrowLength > 1 ? arrow(sourceX - 75, 130, sourceX - 75 + arrowLength, "wave-velocity") : ""}
    <text class="wave-label" x="535" y="75" text-anchor="middle">fronti compressi davanti</text>
    <text class="wave-label" x="105" y="75" text-anchor="middle">fronti dilatati dietro</text>
    <text class="wave-note" x="320" y="326" text-anchor="middle">La spaziatura è relativa: λdavanti/λ₀ = 1 − vₛ/v.</text>`;
}

function stringScene(state) {
  const thickness = Math.min(12, 3 + 3 * (state.string_thickness_ratio_visual - 1));
  return `
    ${line(55, 205, 585, 205, "wave-string-axis")}
    <path class="wave-string" style="stroke-width:${thickness.toFixed(2)}px" d="${sinePath({ amplitude: 65 })}"></path>
    <circle class="wave-support" cx="55" cy="205" r="9"></circle>
    <circle class="wave-support" cx="585" cy="205" r="9"></circle>
    <text class="wave-label" x="320" y="84" text-anchor="middle">stessa lunghezza L e stessa tensione T</text>
    <text class="wave-label" x="320" y="300" text-anchor="middle">μ/μ₀ = ${fmt(state.linear_density_ratio, 2)} → f/f₀ = ${fmt(state.frequency_ratio, 3)}</text>
    <text class="wave-note" x="320" y="332" text-anchor="middle">Lo spessore grafico rappresenta qualitativamente l'aumento della densità lineare, non un diametro in scala.</text>`;
}

function energyScene(state) {
  const axisY = 230;
  const amplitude = 42 * state.amplitude_ratio;
  const floatX = 320;
  const floatY = axisY - amplitude;
  const energyBarHeight = 150 * state.elastic_energy_ratio;
  return `
    <path class="wave-water" d="${sinePath({ axisY, amplitude: Math.max(5, amplitude), cycles: 2, phase: -Math.PI / 2 })}"></path>
    ${line(320, 55, 320, floatY - 22, "wave-spring")}
    <rect class="wave-sensor" x="286" y="34" width="68" height="26" rx="5"></rect>
    <text class="wave-label wave-label-light" x="320" y="52" text-anchor="middle">sensore</text>
    <ellipse class="wave-float" cx="${floatX}" cy="${floatY}" rx="34" ry="14"></ellipse>
    <text class="wave-label" x="${floatX}" y="${floatY + 5}" text-anchor="middle">galleggiante</text>
    <rect class="wave-energy-track" x="535" y="100" width="32" height="150" rx="4"></rect>
    <rect class="wave-energy-bar" x="535" y="${250 - energyBarHeight}" width="32" height="${energyBarHeight}" rx="4"></rect>
    <text class="wave-label" x="551" y="82" text-anchor="middle">E/Eref</text>
    <text class="wave-label" x="551" y="276" text-anchor="middle">${fmt(state.elastic_energy_ratio, 2)}</text>
    <text class="wave-note" x="320" y="332" text-anchor="middle">Coordinate normalizzate: E/Eref = (A/Aref)² per una molla di k fissata.</text>`;
}

function sonarScene(state) {
  const sonarX = 80;
  const targetX = 560;
  const pulseX = sonarX + state.pulse_position_ratio * (targetX - sonarX);
  const returning = state.normalized_time > 0.5;
  return `
    <rect class="wave-water-bg" x="28" y="75" width="584" height="220" rx="10"></rect>
    <path class="wave-sonar" d="M 55 180 l 25 -32 h 32 l 20 32 -20 32 H 80 z"></path>
    <text class="wave-label" x="92" y="242" text-anchor="middle">sonar</text>
    <rect class="wave-target" x="548" y="105" width="24" height="150" rx="8"></rect>
    <text class="wave-label wave-label-light" x="560" y="180" text-anchor="middle" transform="rotate(-90 560 180)">ostacolo</text>
    ${line(sonarX + 38, 180, targetX - 12, 180, "wave-sonar-path")}
    <circle class="wave-pulse ${returning ? "wave-pulse-return" : ""}" cx="${pulseX}" cy="180" r="15"></circle>
    <text class="wave-label" x="320" y="104" text-anchor="middle">${state.phase}</text>
    <text class="wave-note" x="320" y="332" text-anchor="middle">Il cursore è t/Δt reale: a metà percorso l'impulso raggiunge l'ostacolo, a 1 torna al sonar.</text>`;
}

function sceneForState(state) {
  if (state.model === "doppler_observer_moving") return observerDopplerScene(state);
  if (state.model === "doppler_source_moving") return sourceDopplerScene(state);
  if (state.model === "string_mode") return stringScene(state);
  if (state.model === "mechanical_wave_energy") return energyScene(state);
  return sonarScene(state);
}

function valuesForState(state) {
  if (state.model === "doppler_observer_moving") return [
    ["Frequenza emessa", `${fmt(state.emitted_frequency_Hz, 0)} Hz`],
    ["Frequenza osservata", `${fmt(state.observed_frequency_Hz, 1)} Hz`],
    ["Aumento", `${fmt(state.frequency_increase_Hz, 1)} Hz`],
    ["Velocità osservatore", `${fmt(state.observer_speed_m_s, 3)} m/s`],
  ];
  if (state.model === "doppler_source_moving") return [
    ["vₛ / v", fmt(state.source_speed_over_wave_speed, 3)],
    ["f′ / f", fmt(state.frequency_ratio, 3)],
    ["λ davanti / λ₀", fmt(state.wavelength_ahead_ratio, 3)],
    ["λ dietro / λ₀", fmt(state.wavelength_behind_ratio, 3)],
  ];
  if (state.model === "string_mode") return [
    ["μ / μ₀", fmt(state.linear_density_ratio, 2)],
    ["v / v₀", fmt(state.wave_speed_ratio, 3)],
    ["f / f₀", fmt(state.frequency_ratio, 3)],
  ];
  if (state.model === "mechanical_wave_energy") return [
    ["A / Aref", fmt(state.amplitude_ratio, 2)],
    ["E / Eref", fmt(state.elastic_energy_ratio, 2)],
    ["Fmax / Fref", fmt(state.normalized_force_peak_ratio, 2)],
  ];
  return [
    ["t / Δt", fmt(state.normalized_time, 2)],
    ["Posizione impulso / d", fmt(state.pulse_position_ratio, 2)],
    ["Cammino percorso / d", fmt(state.path_length_ratio, 2)],
  ];
}

function equationsForState(state) {
  if (state.model === "doppler_observer_moving") return `<p><var>f′</var> = <var>f</var>(<var>v</var>+<var>vₒ</var>)/<var>v</var></p>`;
  if (state.model === "doppler_source_moving") return `<p><var>f′/f</var> = 1/(1−<var>vₛ/v</var>)</p>`;
  if (state.model === "string_mode") return `<p><var>f</var> = (1/2<var>L</var>)√(<var>T/μ</var>)</p><p>a L e T costanti: <var>f/f₀</var> = 1/√(<var>μ/μ₀</var>)</p>`;
  if (state.model === "mechanical_wave_energy") return `<p><var>Emax</var> = ½<var>kA²</var></p><p><var>L</var> = ∮ <var>F dy</var>, &nbsp; <var>Pmedia</var> = <var>L/T</var></p>`;
  return `<p>2<var>d</var> = <var>vΔt</var> &nbsp;⇒&nbsp; <var>d</var> = <var>vΔt</var>/2</p>`;
}

function ariaText(state) {
  if (state.model === "echo_time_of_flight") return `${Math.round(state.progress * 100)}%, ${state.phase}, t su Delta t ${fmt(state.normalized_time, 2)}`;
  if (state.model === "doppler_observer_moving") return `${Math.round(state.progress * 100)}%, velocita osservatore ${fmt(state.observer_speed_m_s, 2)} metri al secondo`;
  if (state.model === "doppler_source_moving") return `${Math.round(state.progress * 100)}%, velocita sorgente su velocita onda ${fmt(state.source_speed_over_wave_speed, 2)}`;
  return `${Math.round(state.progress * 100)}%, ${state.phase}`;
}

export function createSimulationView({ container, config }) {
  instanceCount += 1;
  const sliderId = `wave-1d-progress-${instanceCount}`;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  container.innerHTML = `
    <p class="simulation-instruction"><strong>Esplora:</strong> <span data-learning-action></span></p>
    <figure class="wave-figure">
      <svg class="wave-svg" viewBox="0 0 640 360" role="img" aria-label="Schema del modello ondulatorio" data-wave-scene></svg>
      <figcaption data-scene-caption></figcaption>
    </figure>
    <div class="wave-panel">
      <div class="wave-scrubber">
        <label for="${sliderId}"><span data-slider-label></span><output for="${sliderId}" data-progress-output>0%</output></label>
        <input id="${sliderId}" type="range" min="0" max="1000" step="1" value="0" data-simulation-action="set_progress" data-simulation-event="input">
        <div class="wave-slider-scale" aria-hidden="true"><span>inizio</span><span>fine</span></div>
      </div>
      <div class="simulation-controls" aria-label="Controlli simulazione">
        <button type="button" data-simulation-action="play">Play</button>
        <button type="button" data-simulation-action="pause">Pausa</button>
        <button type="button" data-simulation-action="reset">Reset</button>
      </div>
      <dl class="simulation-values wave-values" data-values aria-label="Grandezze del modello"></dl>
      <div class="simulation-equations" data-equations></div>
      <p class="simulation-status" data-simulation-status aria-live="polite"></p>
      <p class="simulation-model-note"><strong>Limiti del modello:</strong> <span data-model-note></span></p>
      <p class="simulation-error" data-simulation-error role="alert" hidden></p>
    </div>`;

  const slider = container.querySelector('[data-simulation-action="set_progress"]');
  const scene = container.querySelector("[data-wave-scene]");
  const values = container.querySelector("[data-values]");
  const equations = container.querySelector("[data-equations]");
  const status = container.querySelector("[data-simulation-status]");
  container.querySelector("[data-learning-action]").textContent = config.didactics.learning_action_it;
  container.querySelector("[data-model-note]").textContent = config.didactics.model_note_it;
  container.querySelector("[data-slider-label]").textContent = config.didactics.slider_label_it;
  equations.hidden = !config.display.show_equations;
  values.hidden = !config.display.show_values;

  return Object.freeze({
    get motionAllowed() { return !reducedMotion.matches; },
    onMotionPreferenceChange(callback) {
      reducedMotion.addEventListener("change", callback);
      return () => reducedMotion.removeEventListener("change", callback);
    },
    resolveActionPayload({ action, control }) {
      if (action === "set_progress") return { progress: Number(control.value) / Number(control.max) };
      return undefined;
    },
    describeControls(state, { motionAllowed = true } = {}) {
      const reducedTitle = "Playback disattivato dalla preferenza di riduzione del movimento; usa il cursore";
      return {
        play: { disabled: state.is_running || state.is_complete || !motionAllowed, hidden: !config.interaction.allow_play, title: motionAllowed ? "Avvia il percorso" : reducedTitle },
        pause: { disabled: !state.is_running || !motionAllowed, hidden: !config.interaction.allow_pause, title: motionAllowed ? "Metti in pausa" : reducedTitle },
        reset: { hidden: !config.interaction.allow_reset },
        set_progress: { disabled: !config.interaction.allow_scrub, value: Math.round(state.progress * Number(slider.max)), ariaValueText: ariaText(state) },
      };
    },
    render(state) {
      scene.innerHTML = sceneForState(state);
      values.innerHTML = valuesForState(state).map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join("");
      equations.innerHTML = equationsForState(state);
      container.querySelector("[data-progress-output]").textContent = `${Math.round(state.progress * 100)}%`;
      container.querySelector("[data-scene-caption]").textContent = state.phase;
      const motionText = this.motionAllowed ? (state.is_running ? "Playback in corso" : "Playback in pausa") : "Playback disattivato per ridurre il movimento";
      status.textContent = state.is_complete ? `Percorso completato. ${motionText}.` : `${motionText}. Avanzamento ${Math.round(state.progress * 100)}%.`;
      status.classList.toggle("target-reached", state.is_complete);

      container.dataset.model = state.model;
      container.dataset.progress = String(state.progress);
      container.dataset.phase = String(state.phase);
      container.dataset.observerSpeedMS = Number.isFinite(state.observer_speed_m_s) ? String(state.observer_speed_m_s) : "";
      container.dataset.observedFrequencyHz = Number.isFinite(state.observed_frequency_Hz) ? String(state.observed_frequency_Hz) : "";
      container.dataset.sourceSpeedOverWaveSpeed = Number.isFinite(state.source_speed_over_wave_speed) ? String(state.source_speed_over_wave_speed) : "";
      container.dataset.frequencyRatio = Number.isFinite(state.frequency_ratio) ? String(state.frequency_ratio) : "";
      container.dataset.linearDensityRatio = Number.isFinite(state.linear_density_ratio) ? String(state.linear_density_ratio) : "";
      container.dataset.elasticEnergyRatio = Number.isFinite(state.elastic_energy_ratio) ? String(state.elastic_energy_ratio) : "";
      container.dataset.normalizedTime = Number.isFinite(state.normalized_time) ? String(state.normalized_time) : "";
      container.dataset.pulsePositionRatio = Number.isFinite(state.pulse_position_ratio) ? String(state.pulse_position_ratio) : "";
      container.dataset.complete = String(state.is_complete);
      container.dataset.motionAllowed = String(this.motionAllowed);
    },
  });
}

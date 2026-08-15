let instanceCount = 0;

function fmt(value, digits = 2) {
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: digits }).format(value);
}

function topologyMarkup(titleId, descriptionId) {
  return `
    <figure class="dc-figure">
      <svg viewBox="0 0 640 300" role="img" aria-labelledby="${titleId} ${descriptionId}">
        <title id="${titleId}">Circuito elettrico semplice con interruttore</title>
        <desc id="${descriptionId}">Generatore, conduttori e utilizzatore formano un unico anello; l'interruttore può interrompere o chiudere il percorso.</desc>
        <rect class="dc-source" x="66" y="98" width="76" height="94" rx="12"></rect>
        <text x="104" y="143" text-anchor="middle">generatore</text>
        <text x="104" y="163" text-anchor="middle">(+ / −)</text>
        <circle class="dc-load" cx="522" cy="145" r="48"></circle>
        <path class="dc-lamp-filament" d="M 499 145 q 23 -26 46 0 q -23 26 -46 0"></path>
        <text x="522" y="222" text-anchor="middle">utilizzatore</text>
        <path class="dc-wire" d="M142 122 H300 M354 122 H474 M522 193 V242 H104 V192"></path>
        <line class="dc-switch" data-switch x1="300" y1="122" x2="354" y2="86"></line>
        <circle class="dc-node" cx="300" cy="122" r="5"></circle>
        <circle class="dc-node" cx="354" cy="122" r="5"></circle>
        <g data-carrier-cloud opacity="0.22">
          <circle class="dc-carrier" cx="205" cy="122" r="7"></circle>
          <circle class="dc-carrier" cx="420" cy="122" r="7"></circle>
          <circle class="dc-carrier" cx="310" cy="242" r="7"></circle>
        </g>
      </svg>
      <figcaption>La figura mostra soltanto la continuità topologica del percorso: non assegna valori elettrici che il quesito non fornisce.</figcaption>
    </figure>`;
}

function chargeMarkup(titleId, descriptionId) {
  return `
    <figure class="dc-figure">
      <svg viewBox="0 0 640 270" role="img" aria-labelledby="${titleId} ${descriptionId}">
        <title id="${titleId}">Carica che attraversa una sezione del conduttore</title>
        <desc id="${descriptionId}">Una sezione di riferimento permette di confrontare la carica trasferita con l'intervallo di tempo usato nella definizione di corrente.</desc>
        <rect class="dc-conductor" x="45" y="86" width="550" height="82" rx="41"></rect>
        <line class="dc-section" x1="414" y1="62" x2="414" y2="192"></line>
        <text x="414" y="220" text-anchor="middle">sezione di riferimento</text>
        <path class="dc-flow-arrow" d="M 95 55 H 540"></path>
        <polygon class="dc-flow-arrow-head" points="540,55 522,44 522,66"></polygon>
        <text x="315" y="38" text-anchor="middle">verso convenzionale del trasferimento illustrato</text>
        <g data-charge-cloud></g>
      </svg>
      <figcaption>Le particelle sono simboliche: il modello rappresenta la quantità di carica ΔQ, non il moto microscopico degli elettroni.</figcaption>
    </figure>`;
}

function ohmMarkup(titleId, descriptionId) {
  return `
    <figure class="dc-figure">
      <svg viewBox="0 0 680 320" role="img" aria-labelledby="${titleId} ${descriptionId}">
        <title id="${titleId}">Circuito ohmico e punto di lavoro tensione-corrente</title>
        <desc id="${descriptionId}">A sinistra un circuito schematico con generatore e resistore; a destra un piano V-I mostra il punto di lavoro e la retta corrispondente alla resistenza corrente.</desc>
        <path class="dc-wire" d="M58 76 H356 V238 H58 Z"></path>
        <rect class="dc-source" x="43" y="117" width="55" height="70" rx="8"></rect>
        <text x="70" y="158" text-anchor="middle">V</text>
        <path class="dc-resistor" d="M160 76 l15 -18 20 36 20 -36 20 36 20 -36 20 18"></path>
        <text x="218" y="39" text-anchor="middle">R</text>
        <line class="dc-axis" x1="430" y1="252" x2="640" y2="252"></line>
        <line class="dc-axis" x1="430" y1="252" x2="430" y2="54"></line>
        <text x="632" y="282">V</text>
        <text x="404" y="64">I</text>
        <path class="dc-ohm-line" data-ohm-line></path>
        <line class="dc-guide" data-v-guide y2="252"></line>
        <line class="dc-guide" data-i-guide x1="430"></line>
        <circle class="dc-point" data-ohm-point r="7"></circle>
      </svg>
      <figcaption>La retta V-I viene aggiornata con la resistenza dello stato corrente; il punto rosso è il punto di lavoro effettivo.</figcaption>
    </figure>`;
}

export function createSimulationView({ container, config }) {
  instanceCount += 1;
  const titleId = `dc-title-${instanceCount}`;
  const descriptionId = `dc-description-${instanceCount}`;
  const sliderId = `dc-progress-${instanceCount}`;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const figure =
    config.model === "single_loop_topology"
      ? topologyMarkup(titleId, descriptionId)
      : config.model === "charge_flow"
        ? chargeMarkup(titleId, descriptionId)
        : ohmMarkup(titleId, descriptionId);

  container.innerHTML = `
    <p class="simulation-instruction"><strong>Esplora:</strong> <span data-learning></span></p>
    ${figure}
    <div class="dc-panel">
      <div class="dc-scrubber">
        <label for="${sliderId}"><span data-slider-label></span><output data-progress-output for="${sliderId}">0%</output></label>
        <input id="${sliderId}" type="range" min="0" max="1000" step="1" value="0" data-simulation-action="set_progress" data-simulation-event="input">
      </div>
      <div class="simulation-controls" aria-label="Controlli simulazione">
        <button type="button" data-simulation-action="play">Play</button>
        <button type="button" data-simulation-action="pause">Pausa</button>
        <button type="button" data-simulation-action="reset">Reset</button>
      </div>
      <dl class="simulation-values dc-values" data-values></dl>
      <div class="simulation-equations" data-equations></div>
      <p class="simulation-status" data-simulation-status aria-live="polite"></p>
      <p class="simulation-model-note"><strong>Limiti del modello:</strong> <span data-note></span></p>
      <p class="simulation-error" data-simulation-error role="alert" hidden></p>
    </div>`;

  container.querySelector("[data-learning]").textContent = config.didactics.learning_action_it;
  container.querySelector("[data-note]").textContent = config.didactics.model_note_it;

  const slider = container.querySelector('[data-simulation-action="set_progress"]');
  const output = container.querySelector("[data-progress-output]");
  const values = container.querySelector("[data-values]");
  const equations = container.querySelector("[data-equations]");
  const status = container.querySelector("[data-simulation-status]");
  const sliderLabel = container.querySelector("[data-slider-label]");

  sliderLabel.textContent =
    config.model === "single_loop_topology"
      ? "Confronto circuito aperto → chiuso"
      : config.model === "charge_flow"
        ? `Carica trasferita in Δt = ${fmt(config.parameters.time_interval_s, 2)} s`
        : "Esplorazione del punto di lavoro ohmico";

  values.hidden = !config.display.show_values;
  equations.hidden = !config.display.show_equations;

  equations.innerHTML =
    config.model === "single_loop_topology"
      ? "<p>percorso chiuso ⇒ può stabilirsi una corrente elettrica</p>"
      : config.model === "charge_flow"
        ? "<p><var>I</var> = Δ<var>Q</var>/Δ<var>t</var> &nbsp; e &nbsp; 1 A = 1 C/s</p>"
        : "<p><var>V</var> = <var>R I</var> &nbsp; ⇒ &nbsp; <var>I</var> = <var>V</var>/<var>R</var></p>";

  function renderOhmGeometry(state) {
    const maxV = Math.max(config.parameters.voltage_initial_V, config.parameters.voltage_final_V, 1);
    const currentInitial = config.parameters.voltage_initial_V / config.parameters.resistance_initial_ohm;
    const currentFinal = config.parameters.voltage_final_V / config.parameters.resistance_final_ohm;
    const maxI = Math.max(currentInitial, currentFinal, state.current_A, 0.25);
    const x = (voltage) => 430 + (Math.max(0, voltage) / maxV) * 190;
    const y = (current) => 252 - (Math.max(0, current) / maxI) * 165;
    const endCurrent = maxV / state.resistance_ohm;
    const line = container.querySelector("[data-ohm-line]");
    line.setAttribute("d", `M ${x(0)} ${y(0)} L ${x(maxV)} ${y(endCurrent)}`);
    const point = container.querySelector("[data-ohm-point]");
    point.setAttribute("cx", String(x(state.voltage_V)));
    point.setAttribute("cy", String(y(state.current_A)));
    const vGuide = container.querySelector("[data-v-guide]");
    vGuide.setAttribute("x1", String(x(state.voltage_V)));
    vGuide.setAttribute("x2", String(x(state.voltage_V)));
    vGuide.setAttribute("y1", String(y(state.current_A)));
    const iGuide = container.querySelector("[data-i-guide]");
    iGuide.setAttribute("x2", String(x(state.voltage_V)));
    iGuide.setAttribute("y1", String(y(state.current_A)));
    iGuide.setAttribute("y2", String(y(state.current_A)));
  }

  return Object.freeze({
    get motionAllowed() { return !reducedMotion.matches; },
    onMotionPreferenceChange(callback) { reducedMotion.addEventListener("change", callback); return () => reducedMotion.removeEventListener("change", callback); },
    resolveActionPayload({ action, control }) { if (action === "set_progress") return { progress: Number(control.value) / Number(control.max) }; return undefined; },
    describeControls(state, { motionAllowed = true } = {}) {
      const reducedTitle = "Playback disattivato dalla preferenza di riduzione del movimento; usa il cursore";
      return {
        play: { disabled: state.is_running || state.is_complete || !motionAllowed, hidden: !config.interaction.allow_play, title: motionAllowed ? "Avvia il confronto didattico" : reducedTitle },
        pause: { disabled: !state.is_running || !motionAllowed, hidden: !config.interaction.allow_pause, title: motionAllowed ? "Metti in pausa" : reducedTitle },
        reset: { hidden: !config.interaction.allow_reset },
        set_progress: { disabled: !config.interaction.allow_scrub, value: Math.round(state.progress * 1000), ariaValueText: `${Math.round(state.progress * 100)} per cento` },
      };
    },
    render(state) {
      output.textContent = `${Math.round(state.progress * 100)}%`;
      if (state.model === "single_loop_topology") {
        const sw = container.querySelector("[data-switch]");
        sw.setAttribute("x2", "354");
        sw.setAttribute("y2", state.path_closed ? "122" : "86");
        container.querySelector("[data-carrier-cloud]").style.opacity = state.current_possible ? "1" : "0.22";
        values.innerHTML = `<div><dt>Percorso</dt><dd>${state.path_closed ? "chiuso" : "aperto"}</dd></div><div><dt>Corrente possibile</dt><dd>${state.current_possible ? "sì" : "no"}</dd></div>`;
        status.textContent = state.path_closed ? "Circuito chiuso: esiste un percorso continuo attraverso generatore, conduttori e utilizzatore." : "Circuito aperto: l'interruzione impedisce un percorso continuo.";
        container.dataset.pathClosed = String(state.path_closed);
      } else if (state.model === "charge_flow") {
        values.innerHTML = `<div><dt>ΔQ</dt><dd>${fmt(state.charge_C, 2)} C</dd></div><div><dt>Δt</dt><dd>${fmt(state.time_interval_s, 2)} s</dd></div><div><dt>I = ΔQ/Δt</dt><dd>${fmt(state.current_A, 2)} A</dd></div>`;
        const cloud = container.querySelector("[data-charge-cloud]");
        const count = Math.round(state.progress * 14);
        cloud.innerHTML = Array.from({ length: count }, (_, index) => {
          const cx = 78 + (index % 14) * 35;
          const cy = 112 + (index % 2) * 30;
          return `<circle class="dc-carrier" cx="${cx}" cy="${cy}" r="7"></circle>`;
        }).join("");
        status.textContent = `Nella finestra considerata ΔQ = ${fmt(state.charge_C, 2)} C corrisponde a I = ${fmt(state.current_A, 2)} A.`;
        container.dataset.currentA = String(state.current_A);
        container.dataset.chargeC = String(state.charge_C);
      } else {
        values.innerHTML = `<div><dt>Tensione V</dt><dd>${fmt(state.voltage_V, 2)} V</dd></div><div><dt>Resistenza R</dt><dd>${fmt(state.resistance_ohm, 2)} Ω</dd></div><div><dt>Corrente I</dt><dd>${fmt(state.current_A, 3)} A</dd></div><div><dt>Potenza VI</dt><dd>${fmt(state.power_W, 2)} W</dd></div>`;
        renderOhmGeometry(state);
        status.textContent = `Punto di lavoro: ${fmt(state.voltage_V, 2)} V / ${fmt(state.resistance_ohm, 2)} Ω = ${fmt(state.current_A, 3)} A.`;
        container.dataset.voltageV = String(state.voltage_V);
        container.dataset.resistanceOhm = String(state.resistance_ohm);
        container.dataset.currentA = String(state.current_A);
      }
      container.dataset.model = state.model;
      container.dataset.progress = String(state.progress);
    },
  });
}

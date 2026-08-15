let instanceCount = 0;

function fmt(value, digits = 1) {
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: digits }).format(value);
}

function modelTitle(model) {
  return ({
    sensible_heat_compare: "Confronto tra materiali con diverso calore specifico",
    heating_power: "Riscaldamento a potenza costante",
    thermal_mixing: "Equilibrio termico tra due masse",
    ice_water_balance: "Acqua e ghiaccio: bilancio energetico a fasi",
    phase_change_balance: "Solidificazione e vaporizzazione",
  })[model] || model;
}

function sensibleFigure(titleId, descriptionId) {
  return `<figure class="cal-figure"><svg viewBox="0 0 700 320" role="img" aria-labelledby="${titleId} ${descriptionId}"><title id="${titleId}">${modelTitle("sensible_heat_compare")}</title><desc id="${descriptionId}">Due blocchi separati ricevono la stessa quantità di calore da una sorgente comune.</desc><rect class="cal-block cal-left" x="75" y="105" width="190" height="130" rx="18"></rect><rect class="cal-block cal-right" x="435" y="105" width="190" height="130" rx="18"></rect><circle class="cal-source" cx="350" cy="60" r="36"></circle><text x="350" y="66" text-anchor="middle">Q</text><path class="cal-arrow" d="M 327 88 L 240 123"></path><polygon class="cal-arrow-head" points="240,123 253,109 258,126"></polygon><path class="cal-arrow" d="M 373 88 L 460 123"></path><polygon class="cal-arrow-head" points="460,123 442,126 447,109"></polygon><text x="170" y="90" text-anchor="middle" data-left-label></text><text x="530" y="90" text-anchor="middle" data-right-label></text><rect class="cal-energy-track" x="120" y="260" width="460" height="20" rx="10"></rect><rect class="cal-energy-fill" data-energy-fill x="120" y="260" width="0" height="20" rx="10"></rect></svg><figcaption data-caption></figcaption></figure>`;
}

function transferFigure(titleId, descriptionId, model) {
  const sourceIsPower = model === "heating_power";
  return `<figure class="cal-figure"><svg viewBox="0 0 700 320" role="img" aria-labelledby="${titleId} ${descriptionId}"><title id="${titleId}">${modelTitle(model)}</title><desc id="${descriptionId}">Due sistemi sono collegati da un flusso energetico schematico; la direzione e il significato sono specificati dal modello.</desc><rect class="cal-reservoir cal-left" x="65" y="95" width="210" height="145" rx="20"></rect><rect class="cal-reservoir cal-right" x="425" y="95" width="210" height="145" rx="20"></rect><path class="cal-arrow" d="M290 168 H410"></path><polygon class="cal-arrow-head" points="410,168 392,157 392,179"></polygon><text x="170" y="78" text-anchor="middle" data-left-label></text><text x="530" y="78" text-anchor="middle" data-right-label></text><text x="350" y="145" text-anchor="middle">${sourceIsPower ? "Q = Pᵤₜᵢₗₑ·t" : "energia trasferita"}</text><rect class="cal-energy-track" x="290" y="194" width="120" height="20" rx="10"></rect><rect class="cal-energy-fill" data-energy-fill x="290" y="194" width="0" height="20" rx="10"></rect><g data-phase-symbol></g></svg><figcaption data-caption></figcaption></figure>`;
}

function figureMarkup(titleId, descriptionId, model) {
  return model === "sensible_heat_compare" ? sensibleFigure(titleId, descriptionId) : transferFigure(titleId, descriptionId, model);
}

export function createSimulationView({ container, config }) {
  instanceCount += 1;
  const titleId = `cal-title-${instanceCount}`;
  const descriptionId = `cal-description-${instanceCount}`;
  const sliderId = `cal-progress-${instanceCount}`;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  container.innerHTML = `<p class="simulation-instruction"><strong>Esplora:</strong> <span data-learning></span></p>${figureMarkup(titleId, descriptionId, config.model)}<div class="cal-panel"><div class="cal-scrubber"><label for="${sliderId}"><span data-slider-label></span><output data-progress-output for="${sliderId}">0%</output></label><input id="${sliderId}" type="range" min="0" max="1000" step="1" value="0" data-simulation-action="set_progress" data-simulation-event="input"></div><div class="simulation-controls" aria-label="Controlli simulazione"><button type="button" data-simulation-action="play">Play</button><button type="button" data-simulation-action="pause">Pausa</button><button type="button" data-simulation-action="reset">Reset</button></div><dl class="simulation-values cal-values" data-values></dl><div class="simulation-equations" data-equations></div><p class="simulation-status" data-simulation-status aria-live="polite"></p><p class="simulation-model-note"><strong>Limiti del modello:</strong> <span data-note></span></p><p class="simulation-error" data-simulation-error role="alert" hidden></p></div>`;

  container.querySelector("[data-learning]").textContent = config.didactics.learning_action_it;
  container.querySelector("[data-note]").textContent = config.didactics.model_note_it;
  container.querySelector("[data-slider-label]").textContent = config.didactics.slider_label_it;
  container.querySelector("[data-caption]").textContent = config.didactics.figure_note_it;
  container.querySelector("[data-left-label]").textContent = config.didactics.left_label_it;
  container.querySelector("[data-right-label]").textContent = config.didactics.right_label_it;

  const output = container.querySelector("[data-progress-output]");
  const values = container.querySelector("[data-values]");
  const equations = container.querySelector("[data-equations]");
  const status = container.querySelector("[data-simulation-status]");
  const fill = container.querySelector("[data-energy-fill]");
  const phaseSymbol = container.querySelector("[data-phase-symbol]");
  values.hidden = !config.display.show_values;
  equations.hidden = !config.display.show_equations;
  equations.innerHTML = config.didactics.equation_html;

  function renderPhaseSymbol(state) {
    if (!phaseSymbol) return;
    if (state.model === "ice_water_balance") {
      const label = state.cold_phase === "ghiaccio" ? "ghiaccio" : state.cold_phase === "fusione" ? "ghiaccio → acqua" : "acqua";
      phaseSymbol.innerHTML = `<text x="530" y="190" text-anchor="middle" class="cal-phase-symbol">${label}</text>`;
    } else if (state.model === "phase_change_balance") {
      const label = state.vaporized_fraction > 0 ? "acqua → vapore" : "acqua";
      phaseSymbol.innerHTML = `<text x="530" y="190" text-anchor="middle" class="cal-phase-symbol">${label}</text>`;
    }
  }

  return Object.freeze({
    get motionAllowed() { return !reducedMotion.matches; },
    onMotionPreferenceChange(callback) { reducedMotion.addEventListener("change", callback); return () => reducedMotion.removeEventListener("change", callback); },
    resolveActionPayload({ action, control }) { if (action === "set_progress") return { progress: Number(control.value) / Number(control.max) }; return undefined; },
    describeControls(state, { motionAllowed = true } = {}) {
      const reducedTitle = "Playback disattivato dalla preferenza di riduzione del movimento; usa il cursore";
      return {
        play: { disabled: state.is_running || state.is_complete || !motionAllowed, hidden: !config.interaction.allow_play, title: motionAllowed ? "Avvia il bilancio energetico" : reducedTitle },
        pause: { disabled: !state.is_running || !motionAllowed, hidden: !config.interaction.allow_pause, title: motionAllowed ? "Metti in pausa" : reducedTitle },
        reset: { hidden: !config.interaction.allow_reset },
        set_progress: { disabled: !config.interaction.allow_scrub, value: Math.round(state.progress * 1000), ariaValueText: `${Math.round(state.progress * 100)} per cento` },
      };
    },
    render(state) {
      output.textContent = `${Math.round(state.progress * 100)}%`;
      fill.setAttribute("width", String((config.model === "sensible_heat_compare" ? 460 : 120) * state.progress));
      container.dataset.model = state.model;
      container.dataset.progress = String(state.progress);
      renderPhaseSymbol(state);

      if (state.model === "sensible_heat_compare") {
        values.innerHTML = `<div><dt>Q a ciascun blocco</dt><dd>${fmt(state.heat_J, 0)} J</dd></div><div><dt>ΔT ${config.didactics.left_label_it}</dt><dd>${fmt(state.delta_temperature_1_K, 1)} K</dd></div><div><dt>ΔT ${config.didactics.right_label_it}</dt><dd>${fmt(state.delta_temperature_2_K, 1)} K</dd></div><div><dt>Rapporto ΔT₁/ΔT₂</dt><dd>${fmt(state.ratio_delta_temperature, 2)}</dd></div>`;
        status.textContent = "A parità di massa e calore assorbito, la variazione di temperatura è inversamente proporzionale al calore specifico.";
        container.dataset.primaryValue = String(state.delta_temperature_1_K);
        container.dataset.secondaryValue = String(state.delta_temperature_2_K);
      } else if (state.model === "heating_power") {
        values.innerHTML = `<div><dt>Tempo</dt><dd>${fmt(state.elapsed_s, 0)} s</dd></div><div><dt>Potenza utile</dt><dd>${fmt(state.useful_power_W, 0)} W</dd></div><div><dt>Q assorbito</dt><dd>${fmt(state.heat_J, 0)} J</dd></div><div><dt>Temperatura</dt><dd>${fmt(state.temperature_C, 1)} °C</dd></div>`;
        status.textContent = "Con potenza utile costante e senza dispersioni ulteriori, Q cresce linearmente con il tempo e quindi anche la temperatura.";
        container.dataset.primaryValue = String(state.temperature_C);
      } else if (state.model === "thermal_mixing") {
        values.innerHTML = `<div><dt>T massa fredda</dt><dd>${fmt(state.temperature_1_C, 1)} °C</dd></div><div><dt>T massa calda</dt><dd>${fmt(state.temperature_2_C, 1)} °C</dd></div><div><dt>T equilibrio</dt><dd>${fmt(state.equilibrium_temperature_C, 1)} °C</dd></div><div><dt>Errore bilancio</dt><dd>${fmt(state.energy_balance_error_J, 6)} J</dd></div>`;
        status.textContent = state.is_complete ? "Equilibrio raggiunto: le due temperature coincidono." : "Il calore ceduto dalla massa calda è uguale, in modulo, a quello assorbito dalla massa fredda.";
        container.dataset.primaryValue = String(state.temperature_1_C);
        container.dataset.secondaryValue = String(state.temperature_2_C);
      } else if (state.model === "ice_water_balance") {
        values.innerHTML = `<div><dt>Acqua inizialmente calda</dt><dd>${fmt(state.warm_water_temperature_C, 1)} °C</dd></div><div><dt>Componente inizialmente ghiacciato</dt><dd>${fmt(state.cold_component_temperature_C, 1)} °C</dd></div><div><dt>Ghiaccio fuso</dt><dd>${fmt(state.melt_fraction * 100, 0)}%</dd></div><div><dt>Fase</dt><dd>${state.cold_phase}</dd></div>`;
        status.textContent = "Sequenza energetica: riscaldamento del ghiaccio → fusione → riscaldamento dell'acqua fusa fino all'equilibrio.";
        container.dataset.primaryValue = String(state.warm_water_temperature_C);
        container.dataset.secondaryValue = String(state.cold_component_temperature_C);
        container.dataset.phase = state.cold_phase;
      } else {
        values.innerHTML = `<div><dt>Acqua necessaria</dt><dd>${fmt(state.water_mass_kg * 1000, 2)} g</dd></div><div><dt>T acqua</dt><dd>${fmt(state.water_temperature_C, 1)} °C</dd></div><div><dt>Acqua vaporizzata</dt><dd>${fmt(state.vaporized_fraction * 100, 0)}%</dd></div><div><dt>Oro solidificato</dt><dd>${fmt(state.hot_solidified_fraction * 100, 0)}%</dd></div>`;
        status.textContent = "Il calore latente ceduto dall'oro alimenta prima il riscaldamento dell'acqua e poi la sua vaporizzazione.";
        container.dataset.primaryValue = String(state.water_mass_kg);
        container.dataset.phase = state.vaporized_fraction >= 1 ? "vapore" : state.vaporized_fraction > 0 ? "vaporizzazione" : "riscaldamento";
      }
    },
  });
}

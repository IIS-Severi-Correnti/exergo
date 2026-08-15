let instanceCount = 0;

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

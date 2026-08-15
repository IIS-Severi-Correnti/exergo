let instanceCount = 0;

function formatPercent(value) {
  return new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: 0,
  }).format(value * 100);
}

const SHAPES = Object.freeze([
  Object.freeze({ topHalf: 22, bodyHalf: 28 }),
  Object.freeze({ topHalf: 38, bodyHalf: 24 }),
  Object.freeze({ topHalf: 25, bodyHalf: 44 }),
  Object.freeze({ topHalf: 34, bodyHalf: 34 }),
  Object.freeze({ topHalf: 18, bodyHalf: 38 }),
  Object.freeze({ topHalf: 42, bodyHalf: 29 }),
]);

function vesselPath(cx, shape, topY = 68, shoulderY = 142, bottomY = 270) {
  return [
    `M ${cx - shape.topHalf} ${topY}`,
    `L ${cx - shape.topHalf} ${shoulderY - 18}`,
    `L ${cx - shape.bodyHalf} ${shoulderY}`,
    `L ${cx - shape.bodyHalf} ${bottomY}`,
    `L ${cx + shape.bodyHalf} ${bottomY}`,
    `L ${cx + shape.bodyHalf} ${shoulderY}`,
    `L ${cx + shape.topHalf} ${shoulderY - 18}`,
    `L ${cx + shape.topHalf} ${topY}`,
  ].join(" ");
}

function closedVesselPath(cx, shape, topY = 68, shoulderY = 142, bottomY = 270) {
  return `${vesselPath(cx, shape, topY, shoulderY, bottomY)} L ${cx - shape.topHalf} ${topY} Z`;
}

export function createSimulationView({ container, config }) {
  instanceCount += 1;
  const figureTitleId = `communicating-vessels-title-${instanceCount}`;
  const figureDescriptionId = `communicating-vessels-description-${instanceCount}`;
  const progressId = `communicating-vessels-progress-${instanceCount}`;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const branchCount = config.parameters.branch_count;
  const xStart = 105;
  const xEnd = 655;
  const xStep = branchCount === 1 ? 0 : (xEnd - xStart) / (branchCount - 1);
  const branchMarkup = [];

  for (let index = 0; index < branchCount; index += 1) {
    const cx = xStart + index * xStep;
    const shape = SHAPES[index % SHAPES.length];
    const clipId = `communicating-vessel-clip-${instanceCount}-${index}`;
    branchMarkup.push(`
      <defs>
        <clipPath id="${clipId}">
          <path d="${closedVesselPath(cx, shape)}"></path>
        </clipPath>
      </defs>
      <g data-branch="${index}">
        <rect class="communicating-vessels-liquid" x="${cx - 50}" y="170" width="100" height="100"
          clip-path="url(#${clipId})" data-liquid></rect>
        <path class="communicating-vessels-outline" d="${vesselPath(cx, shape)}"></path>
        <circle class="communicating-vessels-pressure-point" cx="${cx}" cy="255" r="7"></circle>
        <text class="communicating-vessels-pressure-label" x="${cx}" y="306" text-anchor="middle">p${index + 1}</text>
      </g>
    `);
  }

  container.innerHTML = `
    <p class="simulation-instruction">
      <strong>Esplora:</strong> <span data-learning-action></span>
    </p>

    <figure class="fluid-statics-figure communicating-vessels-figure">
      <svg class="fluid-statics-svg communicating-vessels-svg" viewBox="0 0 760 350" role="img"
        aria-labelledby="${figureTitleId} ${figureDescriptionId}">
        <title id="${figureTitleId}">Quattro vasi comunicanti di forma diversa</title>
        <desc id="${figureDescriptionId}">Con livelli diversi le pressioni idrostatiche alla base differiscono; nello stato di equilibrio i livelli e le pressioni alla stessa quota coincidono.</desc>
        <line class="communicating-vessels-reference" x1="62" y1="170" x2="698" y2="170"></line>
        ${branchMarkup.join("")}
        <rect class="communicating-vessels-channel" x="70" y="252" width="620" height="34" rx="12"></rect>
        <text class="communicating-vessels-fluid-label" x="380" y="335" text-anchor="middle" data-fluid-label></text>
      </svg>
      <figcaption>
        Le forme sono schematiche. Gli scarti verticali servono solo a confrontare stati idrostatici:
        non sono quote metriche e l'animazione non ricostruisce il travaso reale.
      </figcaption>
    </figure>

    <div class="fluid-statics-panel">
      <div class="fluid-statics-scrubber">
        <label for="${progressId}">
          <span>Avvicinamento all'equilibrio — coordinata didattica</span>
          <output data-progress-output for="${progressId}">0%</output>
        </label>
        <input id="${progressId}" type="range" min="0" max="1000" step="1" value="0"
          data-simulation-action="set_progress" data-simulation-event="input">
        <div class="fluid-statics-slider-scale" aria-hidden="true">
          <span>livelli diversi</span><span>livelli uguali</span>
        </div>
      </div>

      <div class="simulation-controls" aria-label="Controlli simulazione">
        <button type="button" data-simulation-action="play">Play</button>
        <button type="button" data-simulation-action="pause">Pausa</button>
        <button type="button" data-simulation-action="reset">Reset</button>
      </div>

      <dl class="simulation-values fluid-statics-values" aria-label="Stato del confronto idrostatico">
        <div><dt>Rami comunicanti</dt><dd><span data-value="branch-count">--</span></dd></div>
        <div><dt>Dislivello schematico</dt><dd><span data-value="imbalance">--</span>%</dd></div>
        <div data-display="pressure-comparison"><dt>Pressioni alla base</dt><dd><span data-value="pressure-state">--</span></dd></div>
      </dl>

      <div class="simulation-equations" data-display="equations" aria-label="Relazioni del modello">
        <p><var>p</var><sub>i</sub> = <var>p</var><sub>0</sub> + ρg<var>h</var><sub>i</sub></p>
        <p>stesso <var>p</var><sub>0</sub>, stessa ρ e stesso g ⇒ <var>p</var><sub>i</sub> = <var>p</var><sub>j</sub> ⇔ <var>h</var><sub>i</sub> = <var>h</var><sub>j</sub></p>
      </div>

      <p class="fluid-statics-width-note" data-display="shape-note">
        <strong>Forma dei recipienti:</strong> modifica il volume contenuto a una data quota, ma non la condizione di equilibrio dello stesso liquido aperto alla stessa pressione esterna.
      </p>
      <p class="simulation-status" data-simulation-status aria-live="polite"></p>
      <p class="simulation-model-note"><strong>Limiti del modello:</strong> <span data-model-note></span></p>
      <p class="simulation-model-note"><span data-exploration-note></span></p>
      <p class="simulation-error" data-simulation-error role="alert" hidden></p>
    </div>
  `;

  const progressSlider = container.querySelector('[data-simulation-action="set_progress"]');
  const status = container.querySelector("[data-simulation-status]");
  const figureDescription = container.querySelector(`#${figureDescriptionId}`);
  const branchGroups = [...container.querySelectorAll("[data-branch]")];

  container.querySelector("[data-learning-action]").textContent = config.didactics.learning_action_it;
  container.querySelector("[data-model-note]").textContent = config.didactics.model_note_it;
  container.querySelector("[data-exploration-note]").textContent = config.didactics.exploration_note_it;
  container.querySelector("[data-fluid-label]").textContent = config.didactics.fluid_label_it;
  container.querySelector('[data-display="equations"]').hidden = !config.display.show_equations;
  container.querySelector('[data-display="pressure-comparison"]').hidden = !config.display.show_pressure_comparison;
  container.querySelector('[data-display="shape-note"]').hidden = !config.display.show_shape_independence_note;

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
            ? "Confronta progressivamente lo stato a livelli diversi con l'equilibrio"
            : reducedMotionTitle,
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
          ariaValueText: state.equilibrium_reached
            ? "equilibrio: livelli e pressioni alla base uguali"
            : `confronto didattico ${formatPercent(state.progress)} per cento verso l'equilibrio`,
        },
      };
    },

    render(state) {
      branchGroups.forEach((group, index) => {
        const offset = state.level_offsets_relative[index];
        const liquid = group.querySelector("[data-liquid]");
        const levelY = 170 - offset * 54;
        liquid.setAttribute("y", String(levelY));
        liquid.setAttribute("height", String(270 - levelY));
        group.dataset.levelOffset = String(offset);
      });

      container.querySelector("[data-progress-output]").textContent =
        `${formatPercent(state.progress)}%`;
      container.querySelector('[data-value="branch-count"]').textContent = String(state.branch_count);
      container.querySelector('[data-value="imbalance"]').textContent =
        formatPercent(state.imbalance_fraction);
      container.querySelector('[data-value="pressure-state"]').textContent =
        state.equilibrium_reached ? "uguali" : "diverse";

      status.textContent = state.equilibrium_reached
        ? "Equilibrio idrostatico: p₁ = p₂ = … alla quota di collegamento e tutti i livelli coincidono."
        : "Se i livelli sono diversi, le colonne hanno altezze diverse e quindi alla base le pressioni non coincidono: questo non può essere uno stato di equilibrio statico.";

      figureDescription.textContent = state.equilibrium_reached
        ? `${state.branch_count} vasi comunicanti di forma diversa con lo stesso livello e pressioni uguali alla base.`
        : `${state.branch_count} vasi comunicanti con livelli schematicamente diversi e pressioni idrostatiche diverse alla base.`;

      container.dataset.branchCount = String(state.branch_count);
      container.dataset.imbalanceFraction = String(state.imbalance_fraction);
      container.dataset.pressureSpreadRelative = String(state.pressure_spread_relative);
      container.dataset.equilibriumReached = String(state.equilibrium_reached);
      container.dataset.levelOffsets = state.level_offsets_relative.join(",");
    },
  });
}

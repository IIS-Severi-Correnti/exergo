let instanceCount = 0;

const SVG = Object.freeze({
  surfaceY: 72,
  tankLeft: 72,
  tankRight: 528,
  tankBottom: 322,
  pointAX: 150,
  pointBX: 275,
  pointCX: 150,
  pointDX: 300,
  pointEX: 450,
});

function formatNumber(value, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value);
}

function depthY(depth, maximumDepth) {
  const usableHeight = SVG.tankBottom - SVG.surfaceY - 30;
  return SVG.surfaceY + (depth / maximumDepth) * usableHeight;
}

function relationText(state, labels) {
  const { upper, moving, lowerLeft, lowerCenter, lowerRight } = labels;
  if (state.moving_matches_upper) {
    return `p${upper} = p${moving} < p${lowerLeft} = p${lowerCenter} = p${lowerRight}`;
  }
  if (state.moving_matches_lower) {
    return `p${upper} < p${moving} = p${lowerLeft} = p${lowerCenter} = p${lowerRight}`;
  }
  return `p${upper} < p${moving} < p${lowerLeft} = p${lowerCenter} = p${lowerRight}`;
}

export function createSimulationView({ container, config }) {
  instanceCount += 1;
  const figureTitleId = `fluid-pressure-points-title-${instanceCount}`;
  const figureDescriptionId = `fluid-pressure-points-description-${instanceCount}`;
  const progressId = `fluid-pressure-points-progress-${instanceCount}`;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const labels = Object.freeze({
    upper: config.didactics.upper_fixed_label_it,
    moving: config.didactics.moving_point_label_it,
    lowerLeft: config.didactics.lower_left_label_it,
    lowerCenter: config.didactics.lower_center_label_it,
    lowerRight: config.didactics.lower_right_label_it,
  });

  container.innerHTML = `
    <p class="simulation-instruction">
      <strong>Esplora:</strong> <span data-learning-action></span>
      Il cursore sposta verticalmente il punto ${labels.moving}: non rappresenta il tempo.
    </p>

    <figure class="fluid-statics-figure fluid-pressure-points-figure">
      <svg class="fluid-statics-svg fluid-pressure-points-svg" viewBox="0 0 600 380" role="img"
        aria-labelledby="${figureTitleId} ${figureDescriptionId}">
        <title id="${figureTitleId}">Confronto della pressione in cinque punti di un liquido fermo</title>
        <desc id="${figureDescriptionId}">Cinque punti sono disposti a due profondità in un recipiente d'acqua; il punto B può essere spostato verticalmente.</desc>

        <path class="fluid-floating-tank" d="M ${SVG.tankLeft} 48 V ${SVG.tankBottom} H ${SVG.tankRight} V 48"></path>
        <rect class="fluid-floating-water" x="${SVG.tankLeft + 4}" y="${SVG.surfaceY}" width="${SVG.tankRight - SVG.tankLeft - 8}" height="${SVG.tankBottom - SVG.surfaceY - 4}"></rect>
        <line class="fluid-surface-guide" x1="${SVG.tankLeft + 4}" y1="${SVG.surfaceY}" x2="${SVG.tankRight - 4}" y2="${SVG.surfaceY}"></line>
        <text class="fluid-surface-label" x="${SVG.tankLeft + 12}" y="${SVG.surfaceY - 10}">superficie libera</text>
        <text class="fluid-column-label" x="${SVG.tankRight - 12}" y="${SVG.surfaceY - 10}" text-anchor="end" data-fluid-label></text>

        <line class="fluid-pressure-guide" data-upper-guide x1="104" x2="496"></line>
        <line class="fluid-pressure-guide" data-lower-guide x1="104" x2="496"></line>

        <g data-point="upper-fixed">
          <circle class="fluid-pressure-point" r="10" cx="${SVG.pointAX}"></circle>
          <text class="fluid-pressure-point-label" x="${SVG.pointAX - 18}" text-anchor="end" data-point-label="upper"></text>
        </g>

        <g data-point="moving">
          <circle class="fluid-pressure-point fluid-pressure-point-moving" r="11" cx="${SVG.pointBX}"></circle>
          <text class="fluid-pressure-point-label" x="${SVG.pointBX + 18}" data-point-label="moving"></text>
          <line class="fluid-depth-line" x1="${SVG.pointBX}" y1="${SVG.surfaceY}" x2="${SVG.pointBX}" data-moving-depth-line></line>
        </g>

        <g data-point="lower-left">
          <circle class="fluid-pressure-point" r="10" cx="${SVG.pointCX}"></circle>
          <text class="fluid-pressure-point-label" x="${SVG.pointCX - 18}" text-anchor="end" data-point-label="lower-left"></text>
        </g>
        <g data-point="lower-center">
          <circle class="fluid-pressure-point" r="10" cx="${SVG.pointDX}"></circle>
          <text class="fluid-pressure-point-label" x="${SVG.pointDX + 18}" data-point-label="lower-center"></text>
        </g>
        <g data-point="lower-right">
          <circle class="fluid-pressure-point" r="10" cx="${SVG.pointEX}"></circle>
          <text class="fluid-pressure-point-label" x="${SVG.pointEX + 18}" data-point-label="lower-right"></text>
        </g>

        <text class="fluid-depth-label" x="${SVG.pointBX + 14}" y="${SVG.surfaceY + 24}" data-moving-depth-label></text>
        <text class="fluid-pressure-relation" x="300" y="360" text-anchor="middle" data-relation></text>
      </svg>
      <figcaption>
        Le linee tratteggiate evidenziano i livelli di uguale profondità. In un liquido fermo
        la pressione non dipende dalla coordinata orizzontale, ma solo da <var>h</var>.
      </figcaption>
    </figure>

    <div class="fluid-statics-panel">
      <div class="fluid-statics-scrubber">
        <label for="${progressId}">
          <span>Profondità del punto ${labels.moving}</span>
          <output data-progress-output for="${progressId}">--</output>
        </label>
        <input id="${progressId}" type="range" min="0" max="1000" step="1" value="0"
          data-simulation-action="set_progress" data-simulation-event="input">
        <div class="fluid-statics-slider-scale" aria-hidden="true">
          <span data-depth-upper></span>
          <span data-depth-lower></span>
        </div>
      </div>

      <div class="simulation-controls" aria-label="Controlli simulazione">
        <button type="button" data-simulation-action="play">Play</button>
        <button type="button" data-simulation-action="pause">Pausa</button>
        <button type="button" data-simulation-action="reset">Reset</button>
      </div>

      <dl class="simulation-values fluid-statics-values" data-pressure-values aria-label="Pressioni relative nella scala didattica">
        <div><dt>${labels.upper}</dt><dd><span data-value="pressure-upper">--</span> Pa</dd></div>
        <div><dt>${labels.moving}</dt><dd><span data-value="pressure-moving">--</span> Pa</dd></div>
        <div><dt>${labels.lowerLeft}, ${labels.lowerCenter}, ${labels.lowerRight}</dt><dd><span data-value="pressure-lower">--</span> Pa</dd></div>
      </dl>

      <div class="simulation-equations" data-display="equations" aria-label="Relazioni del modello">
        <p><var>p</var> = <var>p</var><sub>0</sub> + <var>ρgh</var></p>
        <p><var>Δp</var> = <var>ρgh</var></p>
        <p>A parità di <var>ρ</var> e <var>g</var>, due punti alla stessa profondità hanno la stessa pressione.</p>
      </div>

      <p class="fluid-statics-width-note" data-horizontal-note>
        <strong>Posizione orizzontale:</strong> ${labels.lowerLeft}, ${labels.lowerCenter} e ${labels.lowerRight} hanno la stessa pressione pur trovandosi in punti orizzontali diversi.
      </p>
      <p class="fluid-statics-exploration-note" data-exploration-note></p>
      <p class="simulation-status" data-simulation-status aria-live="polite"></p>
      <p class="simulation-model-note"><strong>Limiti del modello:</strong> <span data-model-note></span></p>
      <p class="simulation-error" data-simulation-error role="alert" hidden></p>
    </div>
  `;

  const progressSlider = container.querySelector('[data-simulation-action="set_progress"]');
  const status = container.querySelector("[data-simulation-status]");
  const figureDescription = container.querySelector(`#${figureDescriptionId}`);
  const movingGroup = container.querySelector('[data-point="moving"]');
  const upperGroup = container.querySelector('[data-point="upper-fixed"]');
  const lowerGroups = [
    container.querySelector('[data-point="lower-left"]'),
    container.querySelector('[data-point="lower-center"]'),
    container.querySelector('[data-point="lower-right"]'),
  ];

  container.querySelector("[data-learning-action]").textContent = config.didactics.learning_action_it;
  container.querySelector("[data-model-note]").textContent = config.didactics.model_note_it;
  container.querySelector("[data-fluid-label]").textContent = config.didactics.fluid_label_it;
  container.querySelector('[data-point-label="upper"]').textContent = labels.upper;
  container.querySelector('[data-point-label="moving"]').textContent = labels.moving;
  container.querySelector('[data-point-label="lower-left"]').textContent = labels.lowerLeft;
  container.querySelector('[data-point-label="lower-center"]').textContent = labels.lowerCenter;
  container.querySelector('[data-point-label="lower-right"]').textContent = labels.lowerRight;
  container.querySelector("[data-exploration-note]").textContent = config.didactics.exploration_note_it;
  container.querySelector("[data-depth-upper]").textContent = `${formatNumber(config.parameters.upper_depth_m, 2)} m`;
  container.querySelector("[data-depth-lower]").textContent = `${formatNumber(config.parameters.lower_depth_m, 2)} m`;
  container.querySelector('[data-display="equations"]').hidden = !config.display.show_equations;
  container.querySelector("[data-pressure-values]").hidden = !config.display.show_pressure_values;
  container.querySelector("[data-horizontal-note]").hidden = !config.display.show_horizontal_independence_note;

  const maximumDepth = config.parameters.lower_depth_m * 1.12;
  const upperY = depthY(config.parameters.upper_depth_m, maximumDepth);
  const lowerY = depthY(config.parameters.lower_depth_m, maximumDepth);

  function setGroupY(group, y) {
    group.querySelector("circle").setAttribute("cy", String(y));
    const label = group.querySelector("text");
    label.setAttribute("y", String(y + 5));
  }

  setGroupY(upperGroup, upperY);
  for (const group of lowerGroups) setGroupY(group, lowerY);
  container.querySelector("[data-upper-guide]").setAttribute("y1", String(upperY));
  container.querySelector("[data-upper-guide]").setAttribute("y2", String(upperY));
  container.querySelector("[data-lower-guide]").setAttribute("y1", String(lowerY));
  container.querySelector("[data-lower-guide]").setAttribute("y2", String(lowerY));

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
          title: motionAllowed ? `Fai scendere automaticamente il punto ${labels.moving}` : reducedMotionTitle,
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
          ariaValueText: `punto ${labels.moving} a ${formatNumber(state.moving_depth_m, 3)} metri, pressione relativa ${formatNumber(state.gauge_pressure_moving_Pa, 0)} pascal`,
        },
      };
    },

    render(state) {
      const movingY = depthY(state.moving_depth_m, maximumDepth);
      setGroupY(movingGroup, movingY);
      container.querySelector("[data-moving-depth-line]").setAttribute("y2", String(movingY));
      container.querySelector("[data-moving-depth-label]").textContent =
        `h${labels.moving} = ${formatNumber(state.moving_depth_m, 3)} m`;
      container.querySelector("[data-progress-output]").textContent =
        `${formatNumber(state.moving_depth_m, 3)} m`;
      container.querySelector('[data-value="pressure-upper"]').textContent =
        formatNumber(state.gauge_pressure_upper_Pa, 0);
      container.querySelector('[data-value="pressure-moving"]').textContent =
        formatNumber(state.gauge_pressure_moving_Pa, 0);
      container.querySelector('[data-value="pressure-lower"]').textContent =
        formatNumber(state.gauge_pressure_lower_Pa, 0);

      const relation = relationText(state, labels);
      container.querySelector("[data-relation]").textContent = relation;

      if (state.moving_matches_upper) {
        status.textContent =
          `Configurazione del quesito: ${relation}. ${labels.upper} e ${labels.moving} hanno uguale pressione perché sono alla stessa profondità.`;
      } else if (state.moving_matches_lower) {
        status.textContent =
          `${labels.moving} ha raggiunto il livello di ${labels.lowerLeft}, ${labels.lowerCenter} e ${labels.lowerRight}: ${relation}.`;
      } else {
        status.textContent =
          `${labels.moving} è tra i due livelli: ${relation}. La pressione cresce mentre aumenta la profondità.`;
      }

      figureDescription.textContent =
        `Il punto ${labels.upper} è a ${formatNumber(state.upper_depth_m, 3)} metri, ` +
        `${labels.moving} a ${formatNumber(state.moving_depth_m, 3)} metri e ` +
        `${labels.lowerLeft}, ${labels.lowerCenter}, ${labels.lowerRight} a ${formatNumber(state.lower_depth_m, 3)} metri. ` +
        `La relazione tra le pressioni è ${relation}.`;

      container.dataset.upperDepthM = String(state.upper_depth_m);
      container.dataset.movingDepthM = String(state.moving_depth_m);
      container.dataset.lowerDepthM = String(state.lower_depth_m);
      container.dataset.pressureUpperPa = String(state.gauge_pressure_upper_Pa);
      container.dataset.pressureMovingPa = String(state.gauge_pressure_moving_Pa);
      container.dataset.pressureLowerPa = String(state.gauge_pressure_lower_Pa);
      container.dataset.movingMatchesUpper = String(state.moving_matches_upper);
      container.dataset.movingMatchesLower = String(state.moving_matches_lower);
      container.dataset.pressureRelation = relation;
    },
  });
}

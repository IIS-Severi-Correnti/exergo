let instanceCount = 0;

function formatNumber(value, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value);
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function sceneGeometry(state) {
  const velocities = [
    state.velocity_1_initial_m_s,
    state.velocity_2_initial_m_s,
    state.velocity_1_final_m_s,
    state.velocity_2_final_m_s,
  ];
  const maxAbsVelocity = Math.max(0.5, ...velocities.map((value) => Math.abs(value)));
  const pixelsPerVelocityUnit = 120 / maxAbsVelocity;
  const collisionX1 = 285;
  const collisionX2 = 315;

  if (state.progress <= state.collision_progress) {
    const localProgress = state.progress / state.collision_progress;
    const remaining = 1 - localProgress;
    return Object.freeze({
      object1X:
        collisionX1 - state.velocity_1_initial_m_s * pixelsPerVelocityUnit * remaining,
      object2X:
        collisionX2 - state.velocity_2_initial_m_s * pixelsPerVelocityUnit * remaining,
    });
  }

  const localProgress =
    (state.progress - state.collision_progress) / (1 - state.collision_progress);
  return Object.freeze({
    object1X:
      collisionX1 + state.velocity_1_final_m_s * pixelsPerVelocityUnit * localProgress,
    object2X:
      collisionX2 + state.velocity_2_final_m_s * pixelsPerVelocityUnit * localProgress,
  });
}

function arrowEndpoint(originX, velocity, maxAbsVelocity) {
  const length = clamp((velocity / maxAbsVelocity) * 95, -95, 95);
  return originX + length;
}

function updateVelocityArrow(arrow, velocity, maxAbsVelocity, enabled) {
  const visible = enabled && Math.abs(velocity) > 1e-9;
  arrow.setAttribute("visibility", visible ? "visible" : "hidden");
  arrow.setAttribute("x1", "0");
  arrow.setAttribute("x2", String(arrowEndpoint(0, velocity, maxAbsVelocity)));
}

export function createSimulationView({ container, config }) {
  instanceCount += 1;
  const titleId = `collision-title-${instanceCount}`;
  const descriptionId = `collision-description-${instanceCount}`;
  const markerId = `collision-arrow-${instanceCount}`;
  const sliderId = `collision-progress-${instanceCount}`;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  container.innerHTML = `
    <p class="simulation-instruction">
      <strong>Esplora:</strong> <span data-learning-action></span>
      Il cursore ordina schematicamente prima, urto e dopo: non rappresenta il tempo fisico.
    </p>

    <div class="collision-frame-controls" data-display="frame-controls" aria-label="Sistema di riferimento">
      <span class="collision-frame-label">Osserva dal sistema:</span>
      <button type="button" data-simulation-action="frame_table">Tavolo</button>
      <button type="button" data-simulation-action="frame_center_of_mass">Centro di massa</button>
    </div>

    <figure class="collision-figure">
      <svg class="collision-svg" viewBox="0 0 600 260" role="img"
        aria-labelledby="${titleId} ${descriptionId}">
        <title id="${titleId}">Urto elastico frontale tra due corpi</title>
        <desc id="${descriptionId}">Due corpi si avvicinano, urtano frontalmente e si separano. Le frecce rappresentano le velocita nel sistema di riferimento scelto.</desc>
        <defs>
          <marker id="${markerId}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
            <path d="M 0 0 L 8 4 L 0 8 z"></path>
          </marker>
        </defs>
        <line class="collision-track" x1="38" y1="178" x2="562" y2="178"></line>
        <line class="collision-center-mark" x1="300" y1="145" x2="300" y2="198"></line>
        <text class="collision-center-label" x="300" y="218" text-anchor="middle">zona dell'urto</text>

        <g data-object="1">
          <line class="collision-velocity-arrow" data-arrow="1" y1="102" y2="102" marker-end="url(#${markerId})"></line>
          <circle class="collision-ball collision-ball-1" cx="0" cy="160" r="15"></circle>
          <text class="collision-ball-label" x="0" y="165" text-anchor="middle">1</text>
          <text class="collision-object-caption" x="0" y="238" text-anchor="middle" data-object-label="1"></text>
        </g>
        <g data-object="2">
          <line class="collision-velocity-arrow" data-arrow="2" y1="102" y2="102" marker-end="url(#${markerId})"></line>
          <circle class="collision-ball collision-ball-2" cx="0" cy="160" r="15"></circle>
          <text class="collision-ball-label" x="0" y="165" text-anchor="middle">2</text>
          <text class="collision-object-caption" x="0" y="238" text-anchor="middle" data-object-label="2"></text>
        </g>
      </svg>
      <figcaption>Le distanze sono schematiche; direzione e modulo relativo delle frecce seguono le velocita del modello.</figcaption>
    </figure>

    <div class="collision-panel">
      <div class="collision-scrubber">
        <label for="${sliderId}">
          <span>Avanzamento didattico dell'urto</span>
          <output data-progress-output for="${sliderId}">0%</output>
        </label>
        <input id="${sliderId}" type="range" min="0" max="1000" step="1" value="0"
          data-simulation-action="set_progress" data-simulation-event="input">
        <div class="collision-slider-scale" aria-hidden="true">
          <span>prima</span><span>urto</span><span>dopo</span>
        </div>
      </div>

      <div class="simulation-controls" aria-label="Controlli simulazione">
        <button type="button" data-simulation-action="play">Play</button>
        <button type="button" data-simulation-action="pause">Pausa</button>
        <button type="button" data-simulation-action="reset">Reset</button>
      </div>

      <div class="collision-current-state" aria-live="polite">
        <strong data-phase-label>Prima dell'urto</strong>
        <span data-frame-label></span>
      </div>

      <dl class="simulation-values collision-values" aria-label="Velocita correnti">
        <div><dt data-current-label="1"></dt><dd><span data-value="velocity-1-current">--</span> m/s</dd></div>
        <div><dt data-current-label="2"></dt><dd><span data-value="velocity-2-current">--</span> m/s</dd></div>
        <div><dt>Velocita del centro di massa</dt><dd><span data-value="velocity-cm">--</span> m/s</dd></div>
      </dl>

      <div class="collision-before-after" aria-label="Confronto delle velocita prima e dopo">
        <table>
          <thead>
            <tr><th>Corpo</th><th>Prima</th><th>Dopo</th></tr>
          </thead>
          <tbody>
            <tr><th data-table-label="1"></th><td><span data-value="velocity-1-before">--</span> m/s</td><td><span data-value="velocity-1-after">--</span> m/s</td></tr>
            <tr><th data-table-label="2"></th><td><span data-value="velocity-2-before">--</span> m/s</td><td><span data-value="velocity-2-after">--</span> m/s</td></tr>
          </tbody>
        </table>
      </div>

      <div class="collision-invariants" data-display="invariants">
        <p><strong>Controllo del modello elastico</strong></p>
        <p>Quantita di moto normalizzata: <span data-value="momentum-before"></span> → <span data-value="momentum-after"></span></p>
        <p>Energia cinetica normalizzata: <span data-value="energy-before"></span> → <span data-value="energy-after"></span></p>
      </div>

      <div class="simulation-equations" data-display="equations" aria-label="Relazioni del modello">
        <p><var>v</var><sub>CM</sub> = (μ<sub>1</sub><var>u</var><sub>1</sub> + μ<sub>2</sub><var>u</var><sub>2</sub>) / (μ<sub>1</sub> + μ<sub>2</sub>)</p>
        <p><var>v</var><sub>1</sub> = [(μ<sub>1</sub> − μ<sub>2</sub>)<var>u</var><sub>1</sub> + 2μ<sub>2</sub><var>u</var><sub>2</sub>] / (μ<sub>1</sub> + μ<sub>2</sub>)</p>
        <p><var>v</var><sub>2</sub> = [2μ<sub>1</sub><var>u</var><sub>1</sub> + (μ<sub>2</sub> − μ<sub>1</sub>)<var>u</var><sub>2</sub>] / (μ<sub>1</sub> + μ<sub>2</sub>)</p>
      </div>

      <p class="simulation-status" data-simulation-status aria-live="polite"></p>
      <p class="simulation-model-note"><strong>Limiti del modello:</strong> <span data-model-note></span></p>
      <p class="simulation-error" data-simulation-error role="alert" hidden></p>
    </div>
  `;

  const object1 = container.querySelector('[data-object="1"]');
  const object2 = container.querySelector('[data-object="2"]');
  const arrow1 = container.querySelector('[data-arrow="1"]');
  const arrow2 = container.querySelector('[data-arrow="2"]');
  const slider = container.querySelector('[data-simulation-action="set_progress"]');
  const progressOutput = container.querySelector("[data-progress-output]");
  const status = container.querySelector("[data-simulation-status]");
  const svgDescription = container.querySelector(`#${descriptionId}`);

  container.querySelector("[data-learning-action]").textContent =
    config.didactics.learning_action_it;
  container.querySelector("[data-model-note]").textContent = config.didactics.model_note_it;
  for (const node of container.querySelectorAll('[data-object-label="1"], [data-current-label="1"], [data-table-label="1"]')) {
    node.textContent = config.didactics.object_1_label_it;
  }
  for (const node of container.querySelectorAll('[data-object-label="2"], [data-current-label="2"], [data-table-label="2"]')) {
    node.textContent = config.didactics.object_2_label_it;
  }

  container.querySelector('[data-display="frame-controls"]').hidden =
    !config.interaction.allow_reference_frame_change;
  container.querySelector('[data-display="invariants"]').hidden = !config.display.show_invariants;
  container.querySelector('[data-display="equations"]').hidden = !config.display.show_equations;

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
          ariaValueText: `${Math.round(state.progress * 100)}%, ${state.phase}`,
        },
        frame_table: {
          disabled: state.reference_frame === "table",
          hidden: !config.interaction.allow_reference_frame_change,
          title: "Osserva l'urto dal sistema del tavolo",
        },
        frame_center_of_mass: {
          disabled: state.reference_frame === "center_of_mass",
          hidden: !config.interaction.allow_reference_frame_change,
          title: "Osserva l'urto dal sistema del centro di massa",
        },
      };
    },

    render(state) {
      const geometry = sceneGeometry(state);
      object1.setAttribute("transform", `translate(${geometry.object1X} 0)`);
      object2.setAttribute("transform", `translate(${geometry.object2X} 0)`);

      const maxAbsCurrent = Math.max(
        0.5,
        Math.abs(state.velocity_1_current_m_s),
        Math.abs(state.velocity_2_current_m_s),
      );
      updateVelocityArrow(
        arrow1,
        state.velocity_1_current_m_s,
        maxAbsCurrent,
        config.display.show_velocity_vectors,
      );
      updateVelocityArrow(
        arrow2,
        state.velocity_2_current_m_s,
        maxAbsCurrent,
        config.display.show_velocity_vectors,
      );

      container.querySelector('[data-value="velocity-1-current"]').textContent =
        formatNumber(state.velocity_1_current_m_s, 2);
      container.querySelector('[data-value="velocity-2-current"]').textContent =
        formatNumber(state.velocity_2_current_m_s, 2);
      container.querySelector('[data-value="velocity-cm"]').textContent = formatNumber(
        state.velocity_center_of_mass_m_s,
        2,
      );
      container.querySelector('[data-value="velocity-1-before"]').textContent =
        formatNumber(state.velocity_1_initial_m_s, 2);
      container.querySelector('[data-value="velocity-2-before"]').textContent =
        formatNumber(state.velocity_2_initial_m_s, 2);
      container.querySelector('[data-value="velocity-1-after"]').textContent =
        formatNumber(state.velocity_1_final_m_s, 2);
      container.querySelector('[data-value="velocity-2-after"]').textContent =
        formatNumber(state.velocity_2_final_m_s, 2);
      container.querySelector('[data-value="momentum-before"]').textContent =
        formatNumber(state.normalized_momentum_before, 3);
      container.querySelector('[data-value="momentum-after"]').textContent =
        formatNumber(state.normalized_momentum_after, 3);
      container.querySelector('[data-value="energy-before"]').textContent =
        formatNumber(state.normalized_kinetic_energy_before, 3);
      container.querySelector('[data-value="energy-after"]').textContent =
        formatNumber(state.normalized_kinetic_energy_after, 3);

      progressOutput.textContent = `${Math.round(state.progress * 100)}%`;
      const phaseLabel =
        state.phase === "before"
          ? "Prima dell'urto"
          : state.phase === "after"
            ? "Dopo l'urto"
            : "Istante idealizzato dell'urto";
      container.querySelector("[data-phase-label]").textContent = phaseLabel;
      const frameLabel =
        state.reference_frame === "center_of_mass"
          ? "Sistema del centro di massa"
          : "Sistema del tavolo";
      container.querySelector("[data-frame-label]").textContent = frameLabel;

      const motionText = this.motionAllowed
        ? (state.is_running ? "Playback didattico in corso" : "Playback didattico in pausa")
        : "Playback disattivato dalla preferenza di riduzione del movimento";
      status.textContent = `${phaseLabel}. ${frameLabel}. ${motionText}.`;
      svgDescription.textContent = `${phaseLabel}; ${frameLabel}. Velocita correnti: ${config.didactics.object_1_label_it} ${formatNumber(state.velocity_1_current_m_s, 2)} metri al secondo, ${config.didactics.object_2_label_it} ${formatNumber(state.velocity_2_current_m_s, 2)} metri al secondo.`;

      container.dataset.referenceFrame = state.reference_frame;
      container.dataset.phase = state.phase;
      container.dataset.progress = String(state.progress);
      container.dataset.velocity1Ms = String(state.velocity_1_current_m_s);
      container.dataset.velocity2Ms = String(state.velocity_2_current_m_s);
      container.dataset.momentumConserved = String(
        Math.abs(state.momentum_conservation_error) < 1e-10,
      );
      container.dataset.energyConserved = String(
        Math.abs(state.energy_conservation_error) < 1e-10,
      );
      container.dataset.complete = String(state.is_complete);
      container.classList.toggle("collision-at-impact", state.phase === "collision");
    },
  });
}

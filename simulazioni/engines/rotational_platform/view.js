const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const VIEWBOX_CENTER = 200;
const PLATFORM_DRAW_RADIUS = 150;
const DEPARTURE_DRAW_RADIUS = 196;
let instanceCount = 0;

function createSvgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NAMESPACE, name);
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, String(value));
  }
  return element;
}

function polarPosition(angleRad, radius) {
  return {
    x: VIEWBOX_CENTER + Math.cos(angleRad) * radius,
    y: VIEWBOX_CENTER + Math.sin(angleRad) * radius,
  };
}

function formatNumber(value, maximumFractionDigits = 3) {
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value);
}

function participantGlyph(className = "simulation-participant") {
  const group = createSvgElement("g", { class: className, "aria-hidden": "true" });
  group.append(
    createSvgElement("circle", { class: "participant-body", cx: 0, cy: 0, r: 12 }),
    createSvgElement("circle", { class: "participant-head", cx: 0, cy: -8, r: 5 }),
  );
  return group;
}

export function createSimulationView({ container, config }) {
  instanceCount += 1;
  const titleId = `rotational-platform-title-${instanceCount}`;
  const descriptionId = `rotational-platform-description-${instanceCount}`;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  container.innerHTML = `
    <div class="simulation-layout">
      <div class="simulation-stage">
        <svg class="rotational-platform-svg" viewBox="0 0 400 400" role="img"
          aria-labelledby="${titleId} ${descriptionId}">
          <title id="${titleId}">Piattaforma circolare rotante vista dall'alto</title>
          <desc id="${descriptionId}">Le persone rimaste sono distribuite uniformemente sulla piattaforma.</desc>
          <circle class="platform-shadow" cx="200" cy="204" r="150"></circle>
          <circle class="platform-disk" cx="200" cy="200" r="150"></circle>
          <g data-platform-rotor>
            <path class="platform-marker" d="M 200 50 L 200 350 M 50 200 L 350 200"></path>
            <g data-platform-participants></g>
          </g>
          <g data-departure-layer></g>
          <circle class="platform-axis" cx="200" cy="200" r="8"></circle>
          <path class="rotation-arrow" d="M 310 92 A 145 145 0 0 1 348 184"></path>
        </svg>
      </div>

      <div class="simulation-panel">
        <div class="simulation-controls" aria-label="Controlli simulazione">
          <button type="button" data-simulation-action="play">Play</button>
          <button type="button" data-simulation-action="pause">Pausa</button>
          <button type="button" data-simulation-action="reset">Reset</button>
          <button type="button" data-simulation-action="remove" class="simulation-remove-button">Una ragazza salta</button>
        </div>

        <dl class="simulation-values" aria-label="Grandezze fisiche">
          <div><dt>Persone, N</dt><dd data-value="participant-count">--</dd></div>
          <div data-display="moment"><dt>Momento d'inerzia, I</dt><dd><span data-value="moment">--</span> kg m<sup>2</sup></dd></div>
          <div data-display="omega"><dt>Velocita angolare, ω</dt><dd><span data-value="omega">--</span> rad/s</dd></div>
          <div data-display="angular-momentum"><dt>Momento angolare, L</dt><dd><span data-value="angular-momentum">--</span> kg m<sup>2</sup>/s</dd></div>
          <div data-display="target"><dt>ω target e tolleranza</dt><dd><span data-value="target">--</span> ± <span data-value="target-tolerance">--</span> rad/s</dd></div>
        </dl>

        <div class="simulation-equations" data-display="equations" aria-label="Equazioni del modello">
          <p><var>L</var> = <var>I</var>ω</p>
          <p>
            <var>I</var><sub>i</sub>ω<sub>i</sub> = <var>I</var><sub>f</sub>ω<sub>f</sub>:
            <span data-equation-value="reference">--</span> =
            <span data-equation-value="moment">--</span> ·
            <span data-equation-value="omega">--</span>
          </p>
        </div>

        <p class="simulation-status" data-simulation-status aria-live="polite"></p>
        <p class="simulation-model-note"><strong>Ipotesi del modello:</strong> <span data-model-note></span></p>
        <p class="simulation-error" data-simulation-error role="alert" hidden></p>
      </div>
    </div>
  `;

  const rotor = container.querySelector("[data-platform-rotor]");
  const participantsLayer = container.querySelector("[data-platform-participants]");
  const departureLayer = container.querySelector("[data-departure-layer]");
  const status = container.querySelector("[data-simulation-status]");
  const description = container.querySelector(`#${descriptionId}`);
  container.querySelector("[data-model-note]").textContent = config.didactics.model_note_it;
  let renderedParticipantCount = null;
  let renderedEquationCount = null;

  container.querySelector('[data-display="moment"]').hidden = !config.display.show_moment_of_inertia;
  container.querySelector('[data-display="omega"]').hidden = !config.display.show_angular_velocity;
  container.querySelector('[data-display="angular-momentum"]').hidden = !config.display.show_angular_momentum;
  container.querySelector('[data-display="equations"]').hidden = !config.display.show_equations;
  container.querySelector('[data-display="target"]').hidden = !config.interaction.show_target;

  const participantDrawRadius =
    PLATFORM_DRAW_RADIUS * (config.parameters.participant_radius_m / config.parameters.platform_radius_m);

  function renderParticipants(count) {
    participantsLayer.replaceChildren();
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * 2 * Math.PI - Math.PI / 2;
      const position = polarPosition(angle, participantDrawRadius);
      const glyph = participantGlyph();
      glyph.setAttribute("transform", `translate(${position.x} ${position.y})`);
      participantsLayer.append(glyph);
    }
  }

  return Object.freeze({
    get motionAllowed() {
      return !reducedMotion.matches;
    },

    render(state) {
      const angleDegrees = (state.angle_rad * 180) / Math.PI;
      rotor.setAttribute("transform", `rotate(${angleDegrees} 200 200)`);

      if (renderedParticipantCount !== state.participant_count_current) {
        renderedParticipantCount = state.participant_count_current;
        renderParticipants(renderedParticipantCount);
        description.textContent = `${renderedParticipantCount} persone sono distribuite uniformemente sulla piattaforma.`;
      }

      container.querySelector('[data-value="participant-count"]').textContent = String(
        state.participant_count_current,
      );
      container.querySelector('[data-value="moment"]').textContent = formatNumber(
        state.total_moment_of_inertia_kg_m2,
      );
      container.querySelector('[data-value="omega"]').textContent = formatNumber(
        state.omega_rad_s,
        4,
      );
      container.querySelector('[data-value="angular-momentum"]').textContent = formatNumber(
        state.reference_angular_momentum_kg_m2_s,
      );
      container.querySelector('[data-value="target"]').textContent = formatNumber(
        state.omega_target_rad_s,
        3,
      );
      container.querySelector('[data-value="target-tolerance"]').textContent = formatNumber(
        state.omega_target_tolerance_rad_s,
        3,
      );

      if (renderedEquationCount !== state.participant_count_current) {
        renderedEquationCount = state.participant_count_current;
        container.querySelector('[data-equation-value="reference"]').textContent =
          formatNumber(state.reference_angular_momentum_kg_m2_s);
        container.querySelector('[data-equation-value="moment"]').textContent =
          formatNumber(state.total_moment_of_inertia_kg_m2);
        container.querySelector('[data-equation-value="omega"]').textContent =
          formatNumber(state.omega_rad_s, 4);
      }

      const motionText = state.is_running ? "Rotazione in corso" : "Simulazione in pausa";
      status.textContent = state.target_reached
        ? `Obiettivo raggiunto. ${motionText}. Restano ${state.participant_count_current} persone.`
        : `${motionText}. Restano ${state.participant_count_current} persone.`;
      status.classList.toggle("target-reached", state.target_reached);
      container.dataset.participantCount = String(state.participant_count_current);
      container.dataset.targetReached = String(state.target_reached);
    },

    animateParticipantDeparture(removedIndex, previousState) {
      const count = previousState.participant_count_current;
      if (count <= 0) {
        return;
      }
      const baseAngle = (removedIndex / count) * 2 * Math.PI - Math.PI / 2;
      const absoluteAngle = baseAngle + previousState.angle_rad;
      const start = polarPosition(absoluteAngle, participantDrawRadius);
      const end = polarPosition(absoluteAngle, DEPARTURE_DRAW_RADIUS);
      const ghost = participantGlyph("simulation-participant participant-departing");
      ghost.setAttribute("transform", `translate(${start.x} ${start.y})`);
      departureLayer.append(ghost);

      if (reducedMotion.matches) {
        ghost.setAttribute("transform", `translate(${end.x} ${end.y})`);
        window.setTimeout(() => ghost.remove(), 160);
        return;
      }

      const motion = createSvgElement("animateTransform", {
        attributeName: "transform",
        type: "translate",
        from: `${start.x} ${start.y}`,
        to: `${end.x} ${end.y}`,
        dur: "0.55s",
        fill: "freeze",
      });
      const fade = createSvgElement("animate", {
        attributeName: "opacity",
        from: 1,
        to: 0,
        dur: "0.55s",
        fill: "freeze",
      });
      ghost.append(motion, fade);
      motion.beginElement();
      fade.beginElement();
      window.setTimeout(() => ghost.remove(), 600);
    },

    resetMotion() {
      departureLayer.replaceChildren();
    },
  });
}

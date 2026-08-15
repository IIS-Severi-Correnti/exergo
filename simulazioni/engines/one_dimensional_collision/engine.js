/**
 * Urti elastici frontali in una dimensione. Nessuna dipendenza DOM.
 *
 * Il progresso e un parametro didattico: non rappresenta il tempo fisico.
 * Le masse sono rapporti relativi, sufficienti a determinare le velocita
 * dell'urto elastico senza inventare una scala assoluta non presente nel testo.
 */

export const SUPPORTED_SCHEMA_VERSION = 1;
export const ENGINE_NAME = "one_dimensional_collision";
export const SUPPORTED_MODEL = "elastic_1d";

function requireFiniteNumber(value, name, { positive = false } = {}) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${name} deve essere un numero finito`);
  }
  if (positive && value <= 0) {
    throw new RangeError(`${name} deve essere maggiore di zero`);
  }
  return value;
}

function validateParameters(parameters) {
  if (!parameters || typeof parameters !== "object" || Array.isArray(parameters)) {
    throw new TypeError("parameters deve essere un oggetto");
  }
  requireFiniteNumber(parameters.mass_1_ratio, "mass_1_ratio", { positive: true });
  requireFiniteNumber(parameters.mass_2_ratio, "mass_2_ratio", { positive: true });
  requireFiniteNumber(parameters.velocity_1_initial_m_s, "velocity_1_initial_m_s");
  requireFiniteNumber(parameters.velocity_2_initial_m_s, "velocity_2_initial_m_s");
  if (parameters.velocity_1_initial_m_s <= parameters.velocity_2_initial_m_s) {
    throw new RangeError(
      "velocity_1_initial_m_s deve essere maggiore di velocity_2_initial_m_s per un urto di avvicinamento",
    );
  }
}

function validateInteraction(interaction) {
  if (!interaction || typeof interaction !== "object" || Array.isArray(interaction)) {
    throw new TypeError("interaction deve essere un oggetto");
  }
  requireFiniteNumber(interaction.playback_duration_s, "playback_duration_s", {
    positive: true,
  });
}

function clampProgress(progress) {
  requireFiniteNumber(progress, "progress");
  return Math.min(1, Math.max(0, progress));
}

function elasticFinalVelocities({
  mass_1_ratio: m1,
  mass_2_ratio: m2,
  velocity_1_initial_m_s: u1,
  velocity_2_initial_m_s: u2,
}) {
  const totalMass = m1 + m2;
  return Object.freeze({
    velocity_1_final_m_s: ((m1 - m2) * u1 + 2 * m2 * u2) / totalMass,
    velocity_2_final_m_s: (2 * m1 * u1 + (m2 - m1) * u2) / totalMass,
  });
}

function centerOfMassVelocity(parameters) {
  const m1 = parameters.mass_1_ratio;
  const m2 = parameters.mass_2_ratio;
  return (
    (m1 * parameters.velocity_1_initial_m_s +
      m2 * parameters.velocity_2_initial_m_s) /
    (m1 + m2)
  );
}

function normalizedMomentum(m1, v1, m2, v2) {
  return m1 * v1 + m2 * v2;
}

function normalizedKineticEnergy(m1, v1, m2, v2) {
  return 0.5 * m1 * v1 ** 2 + 0.5 * m2 * v2 ** 2;
}

function shiftVelocity(value, frame, vCenterOfMass) {
  return frame === "center_of_mass" ? value - vCenterOfMass : value;
}

function validateReferenceFrame(frame) {
  if (frame !== "table" && frame !== "center_of_mass") {
    throw new RangeError(`sistema di riferimento non supportato: ${String(frame)}`);
  }
  return frame;
}

export function createSimulationEngine(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new TypeError("config deve essere un oggetto");
  }
  if (config.schema_version !== SUPPORTED_SCHEMA_VERSION) {
    throw new RangeError(`schema_version non supportata: ${String(config.schema_version)}`);
  }
  if (config.engine !== ENGINE_NAME) {
    throw new RangeError(`configurazione destinata a un altro motore: ${String(config.engine)}`);
  }
  if (config.model !== SUPPORTED_MODEL) {
    throw new RangeError(`modello non supportato: ${String(config.model)}`);
  }

  validateParameters(config.parameters);
  validateInteraction(config.interaction);
  const parameters = Object.freeze({ ...config.parameters });
  const finalVelocities = elasticFinalVelocities(parameters);
  const vCenterOfMass = centerOfMassVelocity(parameters);
  const playbackDurationSeconds = config.interaction.playback_duration_s;
  const defaultReferenceFrame = validateReferenceFrame(config.display.reference_frame_default);

  const m1 = parameters.mass_1_ratio;
  const m2 = parameters.mass_2_ratio;
  const u1 = parameters.velocity_1_initial_m_s;
  const u2 = parameters.velocity_2_initial_m_s;
  const v1 = finalVelocities.velocity_1_final_m_s;
  const v2 = finalVelocities.velocity_2_final_m_s;
  const momentumBefore = normalizedMomentum(m1, u1, m2, u2);
  const momentumAfter = normalizedMomentum(m1, v1, m2, v2);
  const energyBefore = normalizedKineticEnergy(m1, u1, m2, u2);
  const energyAfter = normalizedKineticEnergy(m1, v1, m2, v2);

  let progress = 0;
  let running = false;
  let referenceFrame = defaultReferenceFrame;

  function getState() {
    const phase = progress < 0.5 ? "before" : progress > 0.5 ? "after" : "collision";
    const afterCollision = progress >= 0.5;
    const currentTableV1 = afterCollision ? v1 : u1;
    const currentTableV2 = afterCollision ? v2 : u2;

    return Object.freeze({
      model: config.model,
      progress,
      collision_progress: 0.5,
      phase,
      is_running: running,
      is_complete: progress >= 1,
      reference_frame: referenceFrame,
      mass_1_ratio: m1,
      mass_2_ratio: m2,
      velocity_center_of_mass_m_s: vCenterOfMass,
      velocity_1_initial_table_m_s: u1,
      velocity_2_initial_table_m_s: u2,
      velocity_1_final_table_m_s: v1,
      velocity_2_final_table_m_s: v2,
      velocity_1_initial_m_s: shiftVelocity(u1, referenceFrame, vCenterOfMass),
      velocity_2_initial_m_s: shiftVelocity(u2, referenceFrame, vCenterOfMass),
      velocity_1_final_m_s: shiftVelocity(v1, referenceFrame, vCenterOfMass),
      velocity_2_final_m_s: shiftVelocity(v2, referenceFrame, vCenterOfMass),
      velocity_1_current_m_s: shiftVelocity(
        currentTableV1,
        referenceFrame,
        vCenterOfMass,
      ),
      velocity_2_current_m_s: shiftVelocity(
        currentTableV2,
        referenceFrame,
        vCenterOfMass,
      ),
      normalized_momentum_before: momentumBefore,
      normalized_momentum_after: momentumAfter,
      normalized_kinetic_energy_before: energyBefore,
      normalized_kinetic_energy_after: energyAfter,
      momentum_conservation_error: momentumAfter - momentumBefore,
      energy_conservation_error: energyAfter - energyBefore,
    });
  }

  function play() {
    running = progress < 1;
    return getState();
  }

  function pause() {
    running = false;
    return getState();
  }

  function setProgress(nextProgress) {
    progress = clampProgress(nextProgress);
    if (progress >= 1) {
      running = false;
    }
    return getState();
  }

  function setReferenceFrame(frame) {
    referenceFrame = validateReferenceFrame(frame);
    return getState();
  }

  function advance(deltaSeconds) {
    requireFiniteNumber(deltaSeconds, "deltaSeconds");
    if (deltaSeconds < 0) {
      throw new RangeError("deltaSeconds non puo essere negativo");
    }
    if (running) {
      setProgress(progress + deltaSeconds / playbackDurationSeconds);
    }
    return getState();
  }

  function reset() {
    progress = 0;
    running = false;
    referenceFrame = defaultReferenceFrame;
    return getState();
  }

  function dispatch(action, payload) {
    if (action === "play") return play();
    if (action === "pause") return pause();
    if (action === "reset") return reset();
    if (action === "set_progress") {
      if (!payload || typeof payload !== "object") {
        throw new TypeError("set_progress richiede un payload");
      }
      return setProgress(payload.progress);
    }
    if (action === "frame_table") return setReferenceFrame("table");
    if (action === "frame_center_of_mass") return setReferenceFrame("center_of_mass");
    throw new RangeError(`azione non supportata: ${String(action)}`);
  }

  return Object.freeze({
    getState,
    play,
    pause,
    setProgress,
    setReferenceFrame,
    advance,
    reset,
    dispatch,
  });
}

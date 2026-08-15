/**
 * Modello e stato della piattaforma rotante. Il modulo non dipende dal DOM.
 *
 * API pubblica principale: createSimulationEngine(config).
 */

const FULL_TURN_RAD = 2 * Math.PI;
export const SUPPORTED_SCHEMA_VERSION = 1;
export const ENGINE_NAME = "rotational_platform";

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

  requireFiniteNumber(parameters.platform_mass_kg, "platform_mass_kg", { positive: true });
  requireFiniteNumber(parameters.platform_radius_m, "platform_radius_m", { positive: true });
  requireFiniteNumber(parameters.participant_mass_kg, "participant_mass_kg", { positive: true });
  requireFiniteNumber(parameters.participant_radius_m, "participant_radius_m", { positive: true });
  requireFiniteNumber(parameters.omega_initial_rad_s, "omega_initial_rad_s");
  requireFiniteNumber(parameters.omega_target_rad_s, "omega_target_rad_s");
  requireFiniteNumber(
    parameters.omega_target_tolerance_rad_s,
    "omega_target_tolerance_rad_s",
    { positive: true },
  );

  if (!Number.isInteger(parameters.participant_count) || parameters.participant_count <= 0) {
    throw new RangeError("participant_count deve essere un intero positivo");
  }
  if (parameters.participant_radius_m > parameters.platform_radius_m) {
    throw new RangeError("participant_radius_m non puo superare platform_radius_m");
  }
}

export function calculatePlatformMomentOfInertia(parameters) {
  return 0.5 * parameters.platform_mass_kg * parameters.platform_radius_m ** 2;
}

export function calculateParticipantMomentOfInertia(parameters) {
  return parameters.participant_mass_kg * parameters.participant_radius_m ** 2;
}

function createTextbookReducedSystem(parameters) {
  const platformMoment = calculatePlatformMomentOfInertia(parameters);
  const participantMoment = calculateParticipantMomentOfInertia(parameters);
  const initialMoment = platformMoment + parameters.participant_count * participantMoment;
  const referenceAngularMomentum = initialMoment * parameters.omega_initial_rad_s;

  return {
    derive(participantCount) {
      const participantsMoment = participantCount * participantMoment;
      const totalMoment = platformMoment + participantsMoment;
      return {
        platform_moment_of_inertia_kg_m2: platformMoment,
        participant_moment_of_inertia_kg_m2: participantMoment,
        participants_moment_of_inertia_kg_m2: participantsMoment,
        total_moment_of_inertia_kg_m2: totalMoment,
        reference_angular_momentum_kg_m2_s: referenceAngularMomentum,
        omega_rad_s: referenceAngularMomentum / totalMoment,
      };
    },
  };
}

const MODEL_FACTORIES = Object.freeze({
  textbook_reduced_system: createTextbookReducedSystem,
});

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

  const modelFactory = MODEL_FACTORIES[config.model];
  if (!modelFactory) {
    throw new RangeError(`modello non supportato: ${String(config.model)}`);
  }

  validateParameters(config.parameters);
  const parameters = Object.freeze({ ...config.parameters });
  const initialParticipantCount = parameters.participant_count;
  const model = modelFactory(parameters);

  let participantCountCurrent = initialParticipantCount;
  let angleRad = 0;
  let running = false;
  let removalSerial = 0;

  function getState() {
    const derived = model.derive(participantCountCurrent);
    const targetDifference = Math.abs(
      derived.omega_rad_s - parameters.omega_target_rad_s,
    );

    return Object.freeze({
      model: config.model,
      participant_count_initial: initialParticipantCount,
      participant_count_current: participantCountCurrent,
      participant_count_removed: initialParticipantCount - participantCountCurrent,
      angle_rad: angleRad,
      is_running: running,
      removal_serial: removalSerial,
      omega_target_rad_s: parameters.omega_target_rad_s,
      omega_target_tolerance_rad_s: parameters.omega_target_tolerance_rad_s,
      target_reached: targetDifference <= parameters.omega_target_tolerance_rad_s,
      ...derived,
    });
  }

  function play() {
    running = true;
    return getState();
  }

  function pause() {
    running = false;
    return getState();
  }

  function advance(deltaSeconds) {
    requireFiniteNumber(deltaSeconds, "deltaSeconds");
    if (deltaSeconds < 0) {
      throw new RangeError("deltaSeconds non puo essere negativo");
    }
    if (running) {
      angleRad = (angleRad + getState().omega_rad_s * deltaSeconds) % FULL_TURN_RAD;
    }
    return getState();
  }

  function removeParticipant() {
    if (participantCountCurrent === 0) {
      return Object.freeze({ removed: false, removed_index: null, state: getState() });
    }

    const removedIndex = participantCountCurrent - 1;
    participantCountCurrent -= 1;
    removalSerial += 1;
    return Object.freeze({ removed: true, removed_index: removedIndex, state: getState() });
  }

  function reset() {
    participantCountCurrent = initialParticipantCount;
    angleRad = 0;
    running = false;
    removalSerial = 0;
    return getState();
  }

  function dispatch(action) {
    const actions = {
      play,
      pause,
      reset,
      remove_participant: removeParticipant,
    };
    const handler = actions[action];
    if (!handler) {
      throw new RangeError(`azione non supportata: ${String(action)}`);
    }
    return handler();
  }

  return Object.freeze({
    getState,
    play,
    pause,
    advance,
    removeParticipant,
    reset,
    dispatch,
  });
}

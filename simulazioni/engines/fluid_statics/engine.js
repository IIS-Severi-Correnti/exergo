/**
 * Fluidostatica: confronto tra colonne idrostatiche. Nessuna dipendenza DOM.
 *
 * Il progresso interpola una profondita di esplorazione: non rappresenta tempo
 * fisico. Il raggio dei recipienti e solo contesto geometrico e non entra in
 * Delta p = rho g h.
 */

export const SUPPORTED_SCHEMA_VERSION = 1;
export const ENGINE_NAME = "fluid_statics";

function requireFiniteNumber(value, name, { positive = false } = {}) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${name} deve essere un numero finito`);
  }
  if (positive && value <= 0) {
    throw new RangeError(`${name} deve essere maggiore di zero`);
  }
  return value;
}

function requireBoolean(value, name) {
  if (typeof value !== "boolean") {
    throw new TypeError(`${name} deve essere booleano`);
  }
  return value;
}

function validateParameters(parameters) {
  if (!parameters || typeof parameters !== "object" || Array.isArray(parameters)) {
    throw new TypeError("parameters deve essere un oggetto");
  }

  requireFiniteNumber(parameters.fluid_density_initial_kg_m3, "fluid_density_initial_kg_m3", {
    positive: true,
  });
  requireFiniteNumber(parameters.gravity_m_s2, "gravity_m_s2", { positive: true });
  requireFiniteNumber(parameters.depth_reference_m, "depth_reference_m", { positive: true });
  requireFiniteNumber(parameters.depth_moving_initial_m, "depth_moving_initial_m", {
    positive: true,
  });
  requireFiniteNumber(parameters.depth_moving_final_m, "depth_moving_final_m", {
    positive: true,
  });
  if (parameters.depth_moving_final_m <= parameters.depth_moving_initial_m) {
    throw new RangeError(
      "depth_moving_final_m deve essere maggiore di depth_moving_initial_m",
    );
  }

  for (const key of ["vessel_radius_1_m", "vessel_radius_2_m"]) {
    if (parameters[key] !== undefined) {
      requireFiniteNumber(parameters[key], key, { positive: true });
    }
  }
}

function validateInteraction(interaction, initialDensity) {
  if (!interaction || typeof interaction !== "object" || Array.isArray(interaction)) {
    throw new TypeError("interaction deve essere un oggetto");
  }
  requireFiniteNumber(interaction.playback_duration_s, "playback_duration_s", {
    positive: true,
  });
  requireFiniteNumber(interaction.density_min_kg_m3, "density_min_kg_m3", {
    positive: true,
  });
  requireFiniteNumber(interaction.density_max_kg_m3, "density_max_kg_m3", {
    positive: true,
  });
  if (interaction.density_max_kg_m3 <= interaction.density_min_kg_m3) {
    throw new RangeError("density_max_kg_m3 deve essere maggiore di density_min_kg_m3");
  }
  if (
    initialDensity < interaction.density_min_kg_m3 ||
    initialDensity > interaction.density_max_kg_m3
  ) {
    throw new RangeError(
      "fluid_density_initial_kg_m3 deve essere compresa tra density_min_kg_m3 e density_max_kg_m3",
    );
  }
  requireBoolean(interaction.allow_density_change, "allow_density_change");
  if (interaction.target_pressure_ratio !== undefined) {
    requireFiniteNumber(interaction.target_pressure_ratio, "target_pressure_ratio", {
      positive: true,
    });
  }
}

function clampProgress(progress) {
  requireFiniteNumber(progress, "progress");
  return Math.min(1, Math.max(0, progress));
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function createHydrostaticColumnModel(parameters) {
  const movingSpan = parameters.depth_moving_final_m - parameters.depth_moving_initial_m;

  return Object.freeze({
    derive(progress, density) {
      const depthMoving = parameters.depth_moving_initial_m + progress * movingSpan;
      const pressureReference = density * parameters.gravity_m_s2 * parameters.depth_reference_m;
      const pressureMoving = density * parameters.gravity_m_s2 * depthMoving;

      return Object.freeze({
        fluid_density_kg_m3: density,
        gravity_m_s2: parameters.gravity_m_s2,
        depth_reference_m: parameters.depth_reference_m,
        depth_moving_m: depthMoving,
        depth_moving_initial_m: parameters.depth_moving_initial_m,
        depth_moving_final_m: parameters.depth_moving_final_m,
        gauge_pressure_reference_Pa: pressureReference,
        gauge_pressure_moving_Pa: pressureMoving,
        pressure_ratio: pressureMoving / pressureReference,
        vessel_radius_1_m: parameters.vessel_radius_1_m,
        vessel_radius_2_m: parameters.vessel_radius_2_m,
      });
    },
  });
}

const MODEL_FACTORIES = Object.freeze({
  hydrostatic_column: createHydrostaticColumnModel,
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
  validateInteraction(config.interaction, config.parameters.fluid_density_initial_kg_m3);

  const parameters = Object.freeze({ ...config.parameters });
  const interaction = Object.freeze({ ...config.interaction });
  const model = modelFactory(parameters);
  let progress = 0;
  let density = parameters.fluid_density_initial_kg_m3;
  let running = false;

  function getState() {
    return Object.freeze({
      model: config.model,
      progress,
      is_running: running,
      is_complete: progress >= 1,
      ...model.derive(progress, density),
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

  function setDensity(nextDensity) {
    if (!interaction.allow_density_change) {
      throw new RangeError("la configurazione non consente di modificare la densita");
    }
    requireFiniteNumber(nextDensity, "density_kg_m3", { positive: true });
    density = clamp(
      nextDensity,
      interaction.density_min_kg_m3,
      interaction.density_max_kg_m3,
    );
    return getState();
  }

  function advance(deltaSeconds) {
    requireFiniteNumber(deltaSeconds, "deltaSeconds");
    if (deltaSeconds < 0) {
      throw new RangeError("deltaSeconds non puo essere negativo");
    }
    if (running) {
      setProgress(progress + deltaSeconds / interaction.playback_duration_s);
    }
    return getState();
  }

  function reset() {
    progress = 0;
    density = parameters.fluid_density_initial_kg_m3;
    running = false;
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
    if (action === "set_density") {
      if (!payload || typeof payload !== "object") {
        throw new TypeError("set_density richiede un payload");
      }
      return setDensity(payload.density_kg_m3);
    }
    throw new RangeError(`azione non supportata: ${String(action)}`);
  }

  return Object.freeze({
    getState,
    play,
    pause,
    setProgress,
    setDensity,
    advance,
    reset,
    dispatch,
  });
}

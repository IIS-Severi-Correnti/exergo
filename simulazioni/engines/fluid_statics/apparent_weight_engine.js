import { createSimulationEngine as createBaseFluidStaticsEngine } from "./engine.js";

function requireFiniteNumber(value, name, { positive = false, minimum, maximum } = {}) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${name} deve essere un numero finito`);
  }
  if (positive && value <= 0) {
    throw new RangeError(`${name} deve essere maggiore di zero`);
  }
  if (minimum !== undefined && value < minimum) {
    throw new RangeError(`${name} deve essere >= ${minimum}`);
  }
  if (maximum !== undefined && value > maximum) {
    throw new RangeError(`${name} deve essere <= ${maximum}`);
  }
  return value;
}

function requireBoolean(value, name) {
  if (typeof value !== "boolean") {
    throw new TypeError(`${name} deve essere booleano`);
  }
  return value;
}

function validate(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new TypeError("config deve essere un oggetto");
  }
  if (config.schema_version !== 1) {
    throw new RangeError(`schema_version non supportata: ${String(config.schema_version)}`);
  }
  if (config.engine !== "fluid_statics") {
    throw new RangeError(`configurazione destinata a un altro motore: ${String(config.engine)}`);
  }
  if (config.model !== "buoyancy_apparent_weight") {
    throw new RangeError(`modello non supportato: ${String(config.model)}`);
  }

  const parameters = config.parameters;
  const interaction = config.interaction;
  if (!parameters || typeof parameters !== "object" || Array.isArray(parameters)) {
    throw new TypeError("parameters deve essere un oggetto");
  }
  if (!interaction || typeof interaction !== "object" || Array.isArray(interaction)) {
    throw new TypeError("interaction deve essere un oggetto");
  }

  requireFiniteNumber(parameters.weight_air_N, "weight_air_N", { positive: true });
  requireFiniteNumber(
    parameters.apparent_weight_fully_submerged_N,
    "apparent_weight_fully_submerged_N",
    { minimum: 0 },
  );
  if (parameters.apparent_weight_fully_submerged_N >= parameters.weight_air_N) {
    throw new RangeError(
      "apparent_weight_fully_submerged_N deve essere minore di weight_air_N",
    );
  }
  requireFiniteNumber(parameters.fluid_density_kg_m3, "fluid_density_kg_m3", {
    positive: true,
  });
  requireFiniteNumber(parameters.gravity_m_s2, "gravity_m_s2", { positive: true });
  requireFiniteNumber(parameters.submerged_fraction_initial, "submerged_fraction_initial", {
    minimum: 0,
    maximum: 1,
  });
  requireFiniteNumber(parameters.submerged_fraction_final, "submerged_fraction_final", {
    minimum: 0,
    maximum: 1,
  });
  if (parameters.submerged_fraction_final <= parameters.submerged_fraction_initial) {
    throw new RangeError(
      "submerged_fraction_final deve essere maggiore di submerged_fraction_initial",
    );
  }

  for (const key of ["allow_play", "allow_pause", "allow_reset", "allow_scrub"]) {
    requireBoolean(interaction[key], key);
  }
  requireFiniteNumber(interaction.playback_duration_s, "playback_duration_s", {
    positive: true,
  });
}

function deriveConstants(parameters) {
  const fullBuoyancy = parameters.weight_air_N - parameters.apparent_weight_fully_submerged_N;
  const volume = fullBuoyancy / (parameters.fluid_density_kg_m3 * parameters.gravity_m_s2);
  const mass = parameters.weight_air_N / parameters.gravity_m_s2;
  const bodyDensity = mass / volume;
  return Object.freeze({
    full_buoyancy_N: fullBuoyancy,
    volume_m3: volume,
    mass_kg: mass,
    body_density_kg_m3: bodyDensity,
  });
}

function createUnderlyingFloatingEngine(config, constants) {
  const parameters = config.parameters;
  return createBaseFluidStaticsEngine({
    schema_version: 1,
    engine: "fluid_statics",
    model: "floating_body",
    parameters: {
      fluid_density_kg_m3: parameters.fluid_density_kg_m3,
      body_density_initial_kg_m3: constants.body_density_kg_m3,
      submerged_fraction_initial: parameters.submerged_fraction_initial,
      submerged_fraction_final: parameters.submerged_fraction_final,
    },
    interaction: {
      allow_play: config.interaction.allow_play,
      allow_pause: config.interaction.allow_pause,
      allow_reset: config.interaction.allow_reset,
      allow_scrub: config.interaction.allow_scrub,
      playback_duration_s: config.interaction.playback_duration_s,
      allow_body_density_change: false,
      body_density_min_kg_m3: Math.max(1e-12, constants.body_density_kg_m3 * 0.5),
      body_density_max_kg_m3: constants.body_density_kg_m3 * 1.5,
      force_balance_tolerance: 0.01,
    },
  });
}

export function createApparentWeightEngine(config) {
  validate(config);
  const constants = deriveConstants(config.parameters);
  const base = createUnderlyingFloatingEngine(config, constants);

  function getState() {
    const baseState = base.getState();
    const buoyancy = constants.full_buoyancy_N * baseState.submerged_fraction;
    const apparentWeight = config.parameters.weight_air_N - buoyancy;
    return Object.freeze({
      model: config.model,
      progress: baseState.progress,
      is_running: baseState.is_running,
      is_complete: baseState.is_complete,
      submerged_fraction: baseState.submerged_fraction,
      submerged_fraction_initial: baseState.submerged_fraction_initial,
      submerged_fraction_final: baseState.submerged_fraction_final,
      weight_air_N: config.parameters.weight_air_N,
      apparent_weight_N: apparentWeight,
      apparent_weight_fully_submerged_N: config.parameters.apparent_weight_fully_submerged_N,
      buoyancy_force_N: buoyancy,
      buoyancy_force_fully_submerged_N: constants.full_buoyancy_N,
      tension_force_N: apparentWeight,
      fluid_density_kg_m3: config.parameters.fluid_density_kg_m3,
      gravity_m_s2: config.parameters.gravity_m_s2,
      volume_m3: constants.volume_m3,
      mass_kg: constants.mass_kg,
      body_density_kg_m3: constants.body_density_kg_m3,
      force_balance_residual_N:
        config.parameters.weight_air_N - buoyancy - apparentWeight,
    });
  }

  function wrap(method) {
    return (...args) => {
      base[method](...args);
      return getState();
    };
  }

  return Object.freeze({
    getState,
    play: wrap("play"),
    pause: wrap("pause"),
    setProgress: wrap("setProgress"),
    advance: wrap("advance"),
    reset: wrap("reset"),
    dispatch(action, payload) {
      base.dispatch(action, payload);
      return getState();
    },
  });
}

/**
 * Fluidostatica: modelli riutilizzabili senza dipendenze DOM.
 *
 * I modelli disponibili usano `progress` come coordinata di esplorazione,
 * non come tempo fisico. Il runtime comune fornisce play/pausa/reset e scrub.
 */

export const SUPPORTED_SCHEMA_VERSION = 1;
export const ENGINE_NAME = "fluid_statics";

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

function requireObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${name} deve essere un oggetto`);
  }
  return value;
}

function clampProgress(progress) {
  requireFiniteNumber(progress, "progress");
  return Math.min(1, Math.max(0, progress));
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function hydrostaticGaugePressure(densityKgM3, gravityMS2, depthM) {
  return densityKgM3 * gravityMS2 * depthM;
}

function validateCommonInteraction(interaction) {
  requireObject(interaction, "interaction");
  requireBoolean(interaction.allow_play, "allow_play");
  requireBoolean(interaction.allow_pause, "allow_pause");
  requireBoolean(interaction.allow_reset, "allow_reset");
  requireBoolean(interaction.allow_scrub, "allow_scrub");
  requireFiniteNumber(interaction.playback_duration_s, "playback_duration_s", {
    positive: true,
  });
}

function validateHydrostaticColumn(parameters, interaction) {
  requireObject(parameters, "parameters");
  validateCommonInteraction(interaction);

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

  requireBoolean(interaction.allow_density_change, "allow_density_change");
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
    parameters.fluid_density_initial_kg_m3 < interaction.density_min_kg_m3 ||
    parameters.fluid_density_initial_kg_m3 > interaction.density_max_kg_m3
  ) {
    throw new RangeError(
      "fluid_density_initial_kg_m3 deve essere compresa tra density_min_kg_m3 e density_max_kg_m3",
    );
  }
  if (interaction.target_pressure_ratio !== undefined) {
    requireFiniteNumber(interaction.target_pressure_ratio, "target_pressure_ratio", {
      positive: true,
    });
  }
}

function validateFloatingBody(parameters, interaction) {
  requireObject(parameters, "parameters");
  validateCommonInteraction(interaction);

  requireFiniteNumber(parameters.fluid_density_kg_m3, "fluid_density_kg_m3", {
    positive: true,
  });
  requireFiniteNumber(parameters.body_density_initial_kg_m3, "body_density_initial_kg_m3", {
    positive: true,
  });
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

  requireBoolean(interaction.allow_body_density_change, "allow_body_density_change");
  requireFiniteNumber(interaction.body_density_min_kg_m3, "body_density_min_kg_m3", {
    positive: true,
  });
  requireFiniteNumber(interaction.body_density_max_kg_m3, "body_density_max_kg_m3", {
    positive: true,
  });
  if (interaction.body_density_max_kg_m3 <= interaction.body_density_min_kg_m3) {
    throw new RangeError(
      "body_density_max_kg_m3 deve essere maggiore di body_density_min_kg_m3",
    );
  }
  if (
    parameters.body_density_initial_kg_m3 < interaction.body_density_min_kg_m3 ||
    parameters.body_density_initial_kg_m3 > interaction.body_density_max_kg_m3
  ) {
    throw new RangeError(
      "body_density_initial_kg_m3 deve essere compresa tra body_density_min_kg_m3 e body_density_max_kg_m3",
    );
  }
  if (interaction.force_balance_tolerance !== undefined) {
    requireFiniteNumber(interaction.force_balance_tolerance, "force_balance_tolerance", {
      positive: true,
      maximum: 0.25,
    });
  }
}

function validateHydrostaticPressurePoints(parameters, interaction) {
  requireObject(parameters, "parameters");
  validateCommonInteraction(interaction);
  requireFiniteNumber(parameters.fluid_density_kg_m3, "fluid_density_kg_m3", {
    positive: true,
  });
  requireFiniteNumber(parameters.gravity_m_s2, "gravity_m_s2", { positive: true });
  requireFiniteNumber(parameters.upper_depth_m, "upper_depth_m", { positive: true });
  requireFiniteNumber(parameters.lower_depth_m, "lower_depth_m", { positive: true });
  if (parameters.lower_depth_m <= parameters.upper_depth_m) {
    throw new RangeError("lower_depth_m deve essere maggiore di upper_depth_m");
  }
}


function validateHydraulicPress(parameters, interaction) {
  requireObject(parameters, "parameters");
  validateCommonInteraction(interaction);
  requireFiniteNumber(parameters.small_piston_force_N, "small_piston_force_N", {
    positive: true,
  });
  requireFiniteNumber(parameters.load_mass_kg, "load_mass_kg", { positive: true });
  requireFiniteNumber(parameters.gravity_m_s2, "gravity_m_s2", { positive: true });

  const loadWeight = parameters.load_mass_kg * parameters.gravity_m_s2;
  if (loadWeight <= parameters.small_piston_force_N) {
    throw new RangeError(
      "load_mass_kg * gravity_m_s2 deve produrre un peso maggiore di small_piston_force_N",
    );
  }
}

function createHydrostaticColumnRuntime(parameters, interaction) {
  const movingSpan = parameters.depth_moving_final_m - parameters.depth_moving_initial_m;
  let density = parameters.fluid_density_initial_kg_m3;

  return Object.freeze({
    derive(progress) {
      const depthMoving = parameters.depth_moving_initial_m + progress * movingSpan;
      const pressureReference = hydrostaticGaugePressure(
        density,
        parameters.gravity_m_s2,
        parameters.depth_reference_m,
      );
      const pressureMoving = hydrostaticGaugePressure(
        density,
        parameters.gravity_m_s2,
        depthMoving,
      );
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
    dispatch(action, payload) {
      if (action !== "set_density") return false;
      if (!interaction.allow_density_change) {
        throw new RangeError("la configurazione non consente di modificare la densita");
      }
      if (!payload || typeof payload !== "object") {
        throw new TypeError("set_density richiede un payload");
      }
      requireFiniteNumber(payload.density_kg_m3, "density_kg_m3", { positive: true });
      density = clamp(
        payload.density_kg_m3,
        interaction.density_min_kg_m3,
        interaction.density_max_kg_m3,
      );
      return true;
    },
    reset() {
      density = parameters.fluid_density_initial_kg_m3;
    },
    methods(getState, dispatch) {
      return Object.freeze({
        setDensity(nextDensity) {
          dispatch("set_density", { density_kg_m3: nextDensity });
          return getState();
        },
      });
    },
  });
}

function createHydrostaticPressurePointsRuntime(parameters) {
  const depthSpan = parameters.lower_depth_m - parameters.upper_depth_m;

  return Object.freeze({
    derive(progress) {
      const movingDepth = parameters.upper_depth_m + progress * depthSpan;
      const pressureUpper = hydrostaticGaugePressure(
        parameters.fluid_density_kg_m3,
        parameters.gravity_m_s2,
        parameters.upper_depth_m,
      );
      const pressureMoving = hydrostaticGaugePressure(
        parameters.fluid_density_kg_m3,
        parameters.gravity_m_s2,
        movingDepth,
      );
      const pressureLower = hydrostaticGaugePressure(
        parameters.fluid_density_kg_m3,
        parameters.gravity_m_s2,
        parameters.lower_depth_m,
      );
      const depthTolerance = Math.max(1e-12, depthSpan * 1e-9);

      return Object.freeze({
        fluid_density_kg_m3: parameters.fluid_density_kg_m3,
        gravity_m_s2: parameters.gravity_m_s2,
        upper_depth_m: parameters.upper_depth_m,
        moving_depth_m: movingDepth,
        lower_depth_m: parameters.lower_depth_m,
        gauge_pressure_upper_Pa: pressureUpper,
        gauge_pressure_moving_Pa: pressureMoving,
        gauge_pressure_lower_Pa: pressureLower,
        moving_matches_upper:
          Math.abs(movingDepth - parameters.upper_depth_m) <= depthTolerance,
        moving_matches_lower:
          Math.abs(movingDepth - parameters.lower_depth_m) <= depthTolerance,
      });
    },
    dispatch() {
      return false;
    },
    reset() {},
  });
}


function createHydraulicPressRuntime(parameters) {
  const loadWeight = parameters.load_mass_kg * parameters.gravity_m_s2;
  const targetAreaRatio = loadWeight / parameters.small_piston_force_N;
  const ratioSpan = targetAreaRatio - 1;

  return Object.freeze({
    derive(progress) {
      const areaRatio = 1 + progress * ratioSpan;
      const largePistonForce = parameters.small_piston_force_N * areaRatio;
      const forceCoverage = largePistonForce / loadWeight;
      const tolerance = Math.max(1e-9, loadWeight * 1e-10);

      return Object.freeze({
        small_piston_force_N: parameters.small_piston_force_N,
        load_mass_kg: parameters.load_mass_kg,
        gravity_m_s2: parameters.gravity_m_s2,
        load_weight_N: loadWeight,
        area_ratio: areaRatio,
        target_area_ratio: targetAreaRatio,
        large_piston_force_N: largePistonForce,
        force_coverage: forceCoverage,
        force_deficit_N: Math.max(0, loadWeight - largePistonForce),
        balance_reached: Math.abs(largePistonForce - loadWeight) <= tolerance,
      });
    },
    dispatch() {
      return false;
    },
    reset() {},
  });
}

function floatingRegime(bodyDensity, fluidDensity) {
  const scale = Math.max(bodyDensity, fluidDensity, 1);
  const tolerance = scale * 1e-12;
  if (Math.abs(bodyDensity - fluidDensity) <= tolerance) return "neutral";
  return bodyDensity < fluidDensity ? "floating" : "sinking";
}

function createFloatingBodyRuntime(parameters, interaction) {
  const submergedSpan =
    parameters.submerged_fraction_final - parameters.submerged_fraction_initial;
  let bodyDensity = parameters.body_density_initial_kg_m3;

  return Object.freeze({
    derive(progress) {
      const submergedFraction =
        parameters.submerged_fraction_initial + progress * submergedSpan;
      const densityRatio = bodyDensity / parameters.fluid_density_kg_m3;
      const buoyancyWeightRatio =
        (parameters.fluid_density_kg_m3 * submergedFraction) / bodyDensity;
      const regime = floatingRegime(bodyDensity, parameters.fluid_density_kg_m3);
      const equilibriumFraction = densityRatio <= 1 ? densityRatio : null;
      const tolerance = interaction.force_balance_tolerance ?? 0.01;
      const forceBalanceReached =
        equilibriumFraction !== null && Math.abs(buoyancyWeightRatio - 1) <= tolerance;

      return Object.freeze({
        fluid_density_kg_m3: parameters.fluid_density_kg_m3,
        body_density_kg_m3: bodyDensity,
        submerged_fraction: submergedFraction,
        submerged_fraction_initial: parameters.submerged_fraction_initial,
        submerged_fraction_final: parameters.submerged_fraction_final,
        density_ratio_body_to_fluid: densityRatio,
        buoyancy_to_weight_ratio: buoyancyWeightRatio,
        equilibrium_submerged_fraction: equilibriumFraction,
        force_balance_reached: forceBalanceReached,
        floating_regime: regime,
      });
    },
    dispatch(action, payload) {
      if (action !== "set_body_density") return false;
      if (!interaction.allow_body_density_change) {
        throw new RangeError(
          "la configurazione non consente di modificare la densita del corpo",
        );
      }
      if (!payload || typeof payload !== "object") {
        throw new TypeError("set_body_density richiede un payload");
      }
      requireFiniteNumber(payload.body_density_kg_m3, "body_density_kg_m3", {
        positive: true,
      });
      bodyDensity = clamp(
        payload.body_density_kg_m3,
        interaction.body_density_min_kg_m3,
        interaction.body_density_max_kg_m3,
      );
      return true;
    },
    reset() {
      bodyDensity = parameters.body_density_initial_kg_m3;
    },
    methods(getState, dispatch) {
      return Object.freeze({
        setBodyDensity(nextDensity) {
          dispatch("set_body_density", { body_density_kg_m3: nextDensity });
          return getState();
        },
      });
    },
  });
}

const MODEL_DEFINITIONS = Object.freeze({
  hydrostatic_column: Object.freeze({
    validate: validateHydrostaticColumn,
    createRuntime: createHydrostaticColumnRuntime,
  }),
  floating_body: Object.freeze({
    validate: validateFloatingBody,
    createRuntime: createFloatingBodyRuntime,
  }),
  hydrostatic_pressure_points: Object.freeze({
    validate: validateHydrostaticPressurePoints,
    createRuntime: createHydrostaticPressurePointsRuntime,
  }),
  hydraulic_press: Object.freeze({
    validate: validateHydraulicPress,
    createRuntime: createHydraulicPressRuntime,
  }),
});

function createProgressEngine(config, modelRuntime) {
  const interaction = Object.freeze({ ...config.interaction });
  let progress = 0;
  let running = false;

  function getState() {
    return Object.freeze({
      model: config.model,
      progress,
      is_running: running,
      is_complete: progress >= 1,
      ...modelRuntime.derive(progress),
    });
  }

  function play() {
    running = interaction.allow_play && progress < 1;
    return getState();
  }

  function pause() {
    running = false;
    return getState();
  }

  function setProgress(nextProgress) {
    progress = clampProgress(nextProgress);
    if (progress >= 1) running = false;
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
    running = false;
    modelRuntime.reset();
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
    if (modelRuntime.dispatch(action, payload)) {
      return getState();
    }
    throw new RangeError(`azione non supportata: ${String(action)}`);
  }

  const modelMethods = modelRuntime.methods?.(getState, dispatch) ?? {};
  return Object.freeze({
    getState,
    play,
    pause,
    setProgress,
    advance,
    reset,
    dispatch,
    ...modelMethods,
  });
}

export function createSimulationEngine(config) {
  requireObject(config, "config");
  if (config.schema_version !== SUPPORTED_SCHEMA_VERSION) {
    throw new RangeError(`schema_version non supportata: ${String(config.schema_version)}`);
  }
  if (config.engine !== ENGINE_NAME) {
    throw new RangeError(`configurazione destinata a un altro motore: ${String(config.engine)}`);
  }

  const definition = MODEL_DEFINITIONS[config.model];
  if (!definition) {
    throw new RangeError(`modello non supportato: ${String(config.model)}`);
  }

  definition.validate(config.parameters, config.interaction);
  const parameters = Object.freeze({ ...config.parameters });
  const interaction = Object.freeze({ ...config.interaction });
  const modelRuntime = definition.createRuntime(parameters, interaction);
  return createProgressEngine(config, modelRuntime);
}

/**
 * Stati di equilibrio per trasformazioni di gas perfetto. Nessuna dipendenza DOM.
 *
 * Il progresso e un parametro didattico di playback, non un tempo fisico.
 */

export const IDEAL_GAS_CONSTANT_J_MOL_K = 8.31446261815324;
export const SUPPORTED_SCHEMA_VERSION = 1;
export const ENGINE_NAME = "ideal_gas_process";

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

  requireFiniteNumber(parameters.amount_mol, "amount_mol", { positive: true });
  requireFiniteNumber(parameters.temperature_K, "temperature_K", { positive: true });
  requireFiniteNumber(parameters.volume_initial_m3, "volume_initial_m3", { positive: true });
  requireFiniteNumber(parameters.volume_final_m3, "volume_final_m3", { positive: true });
  if (parameters.volume_final_m3 <= parameters.volume_initial_m3) {
    throw new RangeError("volume_final_m3 deve essere maggiore di volume_initial_m3");
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

function createReversibleIsothermalModel(parameters) {
  const thermalEnergyScale =
    parameters.amount_mol * IDEAL_GAS_CONSTANT_J_MOL_K * parameters.temperature_K;
  const volumeSpan = parameters.volume_final_m3 - parameters.volume_initial_m3;

  return Object.freeze({
    derive(progress) {
      const volume = parameters.volume_initial_m3 + progress * volumeSpan;
      const pressure = thermalEnergyScale / volume;
      const work = thermalEnergyScale * Math.log(volume / parameters.volume_initial_m3);
      return Object.freeze({
        amount_mol: parameters.amount_mol,
        temperature_K: parameters.temperature_K,
        volume_initial_m3: parameters.volume_initial_m3,
        volume_final_m3: parameters.volume_final_m3,
        volume_m3: volume,
        pressure_Pa: pressure,
        work_J: work,
        heat_J: work,
        delta_u_J: 0,
      });
    },
  });
}

const MODEL_FACTORIES = Object.freeze({
  reversible_isothermal: createReversibleIsothermalModel,
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
  validateInteraction(config.interaction);
  const parameters = Object.freeze({ ...config.parameters });
  const playbackDurationSeconds = config.interaction.playback_duration_s;
  const model = modelFactory(parameters);
  let progress = 0;
  let running = false;

  function getState() {
    return Object.freeze({
      model: config.model,
      progress,
      is_running: running,
      is_complete: progress >= 1,
      ...model.derive(progress),
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
    throw new RangeError(`azione non supportata: ${String(action)}`);
  }

  return Object.freeze({
    getState,
    play,
    pause,
    setProgress,
    advance,
    reset,
    dispatch,
  });
}

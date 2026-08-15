/** Circuiti in corrente continua: modelli didattici DOM-free. */
export const SUPPORTED_SCHEMA_VERSION = 1;
export const ENGINE_NAME = "dc_circuit";

function finite(value, name, { positive = false, nonnegative = false } = {}) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError(`${name} deve essere finito`);
  if (positive && value <= 0) throw new RangeError(`${name} deve essere > 0`);
  if (nonnegative && value < 0) throw new RangeError(`${name} deve essere >= 0`);
  return value;
}
function object(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${name} deve essere un oggetto`);
  return value;
}
function bool(value, name) { if (typeof value !== "boolean") throw new TypeError(`${name} deve essere booleano`); }
function clamp01(value) { finite(value, "progress"); return Math.min(1, Math.max(0, value)); }

function validateCommon(config) {
  object(config, "config");
  if (config.schema_version !== SUPPORTED_SCHEMA_VERSION) throw new RangeError("schema_version non supportata");
  if (config.engine !== ENGINE_NAME) throw new RangeError("configurazione destinata a un altro motore");
  object(config.parameters, "parameters");
  object(config.interaction, "interaction");
  for (const key of ["allow_play", "allow_pause", "allow_reset", "allow_scrub"]) bool(config.interaction[key], key);
  finite(config.interaction.playback_duration_s, "playback_duration_s", { positive: true });
}

function topologyModel(parameters) {
  if (Object.keys(parameters).length) throw new RangeError("single_loop_topology non accetta parametri numerici");
  return Object.freeze({
    derive(progress) {
      const closed = progress >= 0.5;
      return Object.freeze({
        path_closed: closed,
        current_possible: closed,
        switch_gap_fraction: closed ? 0 : 1,
        component_count: 3,
      });
    },
  });
}

function chargeFlowModel(parameters) {
  finite(parameters.charge_final_C, "charge_final_C", { positive: true });
  finite(parameters.time_interval_s, "time_interval_s", { positive: true });
  return Object.freeze({
    derive(progress) {
      const charge = parameters.charge_final_C * progress;
      return Object.freeze({
        charge_C: charge,
        charge_final_C: parameters.charge_final_C,
        time_interval_s: parameters.time_interval_s,
        current_A: charge / parameters.time_interval_s,
      });
    },
  });
}

function ohmicModel(parameters) {
  for (const key of ["voltage_initial_V", "voltage_final_V"]) finite(parameters[key], key, { nonnegative: true });
  for (const key of ["resistance_initial_ohm", "resistance_final_ohm"]) finite(parameters[key], key, { positive: true });
  const dv = parameters.voltage_final_V - parameters.voltage_initial_V;
  const dr = parameters.resistance_final_ohm - parameters.resistance_initial_ohm;
  return Object.freeze({
    derive(progress) {
      const voltage = parameters.voltage_initial_V + dv * progress;
      const resistance = parameters.resistance_initial_ohm + dr * progress;
      const current = voltage / resistance;
      return Object.freeze({
        voltage_V: voltage,
        resistance_ohm: resistance,
        current_A: current,
        power_W: voltage * current,
      });
    },
  });
}

const FACTORIES = Object.freeze({
  single_loop_topology: topologyModel,
  charge_flow: chargeFlowModel,
  ohmic_resistor: ohmicModel,
});

export function createSimulationEngine(config) {
  validateCommon(config);
  const factory = FACTORIES[config.model];
  if (!factory) throw new RangeError(`modello non supportato: ${String(config.model)}`);
  const model = factory(Object.freeze({ ...config.parameters }));
  const duration = config.interaction.playback_duration_s;
  let progress = 0;
  let running = false;
  function getState() { return Object.freeze({ model: config.model, progress, is_running: running, is_complete: progress >= 1, ...model.derive(progress) }); }
  function setProgress(value) { progress = clamp01(value); if (progress >= 1) running = false; return getState(); }
  function play() { running = progress < 1; return getState(); }
  function pause() { running = false; return getState(); }
  function reset() { progress = 0; running = false; return getState(); }
  function advance(deltaSeconds) { finite(deltaSeconds, "deltaSeconds", { nonnegative: true }); if (running) setProgress(progress + deltaSeconds / duration); return getState(); }
  function dispatch(action, payload) {
    if (action === "play") return play();
    if (action === "pause") return pause();
    if (action === "reset") return reset();
    if (action === "set_progress") { object(payload, "payload"); return setProgress(payload.progress); }
    throw new RangeError(`azione non supportata: ${String(action)}`);
  }
  return Object.freeze({ getState, setProgress, play, pause, reset, advance, dispatch });
}

/** Calorimetria: bilanci energetici e passaggi di stato, senza dipendenze DOM. */
export const SUPPORTED_SCHEMA_VERSION = 1;
export const ENGINE_NAME = "calorimetry";

function finite(value, name, { positive = false, nonnegative = false } = {}) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError(`${name} deve essere finito`);
  if (positive && value <= 0) throw new RangeError(`${name} deve essere > 0`);
  if (nonnegative && value < 0) throw new RangeError(`${name} deve essere >= 0`);
  return value;
}
function object(value, name) { if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${name} deve essere un oggetto`); return value; }
function bool(value, name) { if (typeof value !== "boolean") throw new TypeError(`${name} deve essere booleano`); }
function clamp01(value) { finite(value, "progress"); return Math.min(1, Math.max(0, value)); }

function validateCommon(config) {
  object(config, "config");
  if (config.schema_version !== 1) throw new RangeError("schema_version non supportata");
  if (config.engine !== ENGINE_NAME) throw new RangeError("configurazione destinata a un altro motore");
  object(config.parameters, "parameters"); object(config.interaction, "interaction");
  for (const key of ["allow_play", "allow_pause", "allow_reset", "allow_scrub"]) bool(config.interaction[key], key);
  finite(config.interaction.playback_duration_s, "playback_duration_s", { positive: true });
}

function sensibleCompare(p) {
  for (const key of ["mass_kg", "heat_final_J", "specific_heat_1_J_kgK", "specific_heat_2_J_kgK"]) finite(p[key], key, { positive: true });
  return Object.freeze({ derive(progress) { const q = p.heat_final_J * progress; return Object.freeze({ heat_J: q, delta_temperature_1_K: q / (p.mass_kg * p.specific_heat_1_J_kgK), delta_temperature_2_K: q / (p.mass_kg * p.specific_heat_2_J_kgK), ratio_delta_temperature: p.specific_heat_2_J_kgK / p.specific_heat_1_J_kgK }); } });
}
function heatingPower(p) {
  for (const key of ["received_power_W", "mass_kg", "specific_heat_J_kgK", "duration_s"]) finite(p[key], key, { positive: true });
  finite(p.efficiency, "efficiency", { positive: true }); if (p.efficiency > 1) throw new RangeError("efficiency deve essere <= 1"); finite(p.temperature_initial_C, "temperature_initial_C");
  const useful = p.received_power_W * p.efficiency;
  return Object.freeze({ derive(progress) { const t = p.duration_s * progress; const q = useful * t; const dT = q / (p.mass_kg * p.specific_heat_J_kgK); return Object.freeze({ elapsed_s: t, useful_power_W: useful, heat_J: q, temperature_C: p.temperature_initial_C + dT, delta_temperature_K: dT }); } });
}
function thermalMixing(p) {
  for (const key of ["mass_1_kg", "mass_2_kg", "specific_heat_J_kgK"]) finite(p[key], key, { positive: true }); finite(p.temperature_1_initial_C, "temperature_1_initial_C"); finite(p.temperature_2_initial_C, "temperature_2_initial_C");
  const tf = (p.mass_1_kg * p.temperature_1_initial_C + p.mass_2_kg * p.temperature_2_initial_C) / (p.mass_1_kg + p.mass_2_kg);
  return Object.freeze({ derive(progress) { const t1 = p.temperature_1_initial_C + progress * (tf - p.temperature_1_initial_C); const t2 = p.temperature_2_initial_C + progress * (tf - p.temperature_2_initial_C); const q1 = p.mass_1_kg * p.specific_heat_J_kgK * (t1 - p.temperature_1_initial_C); const q2 = p.mass_2_kg * p.specific_heat_J_kgK * (t2 - p.temperature_2_initial_C); return Object.freeze({ temperature_1_C: t1, temperature_2_C: t2, equilibrium_temperature_C: tf, heat_1_J: q1, heat_2_J: q2, energy_balance_error_J: q1 + q2 }); } });
}
function iceWaterBalance(p) {
  for (const key of ["water_mass_kg", "ice_mass_kg", "water_specific_heat_J_kgK", "ice_specific_heat_J_kgK", "latent_heat_fusion_J_kg"]) finite(p[key], key, { positive: true }); finite(p.water_temperature_initial_C, "water_temperature_initial_C"); finite(p.ice_temperature_initial_C, "ice_temperature_initial_C");
  if (p.water_temperature_initial_C <= 0 || p.ice_temperature_initial_C >= 0) throw new RangeError("il modello richiede acqua sopra 0 °C e ghiaccio sotto 0 °C");
  const qIceWarm = p.ice_mass_kg * p.ice_specific_heat_J_kgK * (0 - p.ice_temperature_initial_C); const qMelt = p.ice_mass_kg * p.latent_heat_fusion_J_kg; const availableToZero = p.water_mass_kg * p.water_specific_heat_J_kgK * p.water_temperature_initial_C;
  if (availableToZero <= qIceWarm + qMelt) throw new RangeError("questa variante richiede fusione completa del ghiaccio e Tf > 0");
  const tf = (availableToZero - qIceWarm - qMelt) / ((p.water_mass_kg + p.ice_mass_kg) * p.water_specific_heat_J_kgK); const qTotal = p.water_mass_kg * p.water_specific_heat_J_kgK * (p.water_temperature_initial_C - tf); const pre = qIceWarm + qMelt;
  return Object.freeze({ derive(progress) { const q = qTotal * progress; const warmT = p.water_temperature_initial_C - q / (p.water_mass_kg * p.water_specific_heat_J_kgK); let coldT = p.ice_temperature_initial_C; let melt = 0; let phase = "ghiaccio"; if (q <= qIceWarm) { coldT = p.ice_temperature_initial_C + q / (p.ice_mass_kg * p.ice_specific_heat_J_kgK); } else if (q <= pre) { coldT = 0; melt = (q - qIceWarm) / qMelt; phase = "fusione"; } else { coldT = (q - pre) / (p.ice_mass_kg * p.water_specific_heat_J_kgK); melt = 1; phase = "acqua"; } return Object.freeze({ energy_transferred_J: q, warm_water_temperature_C: warmT, cold_component_temperature_C: coldT, melt_fraction: melt, cold_phase: phase, equilibrium_temperature_C: tf, ice_warming_J: qIceWarm, melting_J: qMelt, total_energy_J: qTotal }); } });
}
function phaseChangeBalance(p) {
  for (const key of ["hot_mass_kg", "hot_latent_heat_J_kg", "water_specific_heat_J_kgK", "water_latent_vaporization_J_kg"]) finite(p[key], key, { positive: true }); finite(p.water_temperature_initial_C, "water_temperature_initial_C"); finite(p.water_boiling_temperature_C, "water_boiling_temperature_C"); if (p.water_boiling_temperature_C <= p.water_temperature_initial_C) throw new RangeError("temperatura di ebollizione non valida");
  const qHot = p.hot_mass_kg * p.hot_latent_heat_J_kg; const specificNeed = p.water_specific_heat_J_kgK * (p.water_boiling_temperature_C - p.water_temperature_initial_C) + p.water_latent_vaporization_J_kg; const waterMass = qHot / specificNeed; const qHeat = waterMass * p.water_specific_heat_J_kgK * (p.water_boiling_temperature_C - p.water_temperature_initial_C); const qVap = waterMass * p.water_latent_vaporization_J_kg;
  return Object.freeze({ derive(progress) { const q = qHot * progress; let temp = p.water_temperature_initial_C; let vap = 0; if (q <= qHeat) { temp = p.water_temperature_initial_C + q / (waterMass * p.water_specific_heat_J_kgK); } else { temp = p.water_boiling_temperature_C; vap = (q - qHeat) / qVap; } return Object.freeze({ energy_transferred_J: q, hot_solidified_fraction: progress, water_mass_kg: waterMass, water_temperature_C: temp, vaporized_fraction: Math.min(1, Math.max(0, vap)), heating_energy_J: qHeat, vaporization_energy_J: qVap, total_energy_J: qHot }); } });
}

const FACTORIES = Object.freeze({ sensible_heat_compare: sensibleCompare, heating_power: heatingPower, thermal_mixing: thermalMixing, ice_water_balance: iceWaterBalance, phase_change_balance: phaseChangeBalance });
export function createSimulationEngine(config) { validateCommon(config); const factory = FACTORIES[config.model]; if (!factory) throw new RangeError(`modello non supportato: ${String(config.model)}`); const model = factory(Object.freeze({ ...config.parameters })); let progress = 0, running = false; const duration = config.interaction.playback_duration_s; function getState() { return Object.freeze({ model: config.model, progress, is_running: running, is_complete: progress >= 1, ...model.derive(progress) }); } function setProgress(v) { progress = clamp01(v); if (progress >= 1) running = false; return getState(); } function play() { running = progress < 1; return getState(); } function pause() { running = false; return getState(); } function reset() { progress = 0; running = false; return getState(); } function advance(s) { finite(s, "deltaSeconds", { nonnegative: true }); if (running) setProgress(progress + s / duration); return getState(); } function dispatch(action, payload) { if (action === "play") return play(); if (action === "pause") return pause(); if (action === "reset") return reset(); if (action === "set_progress") { object(payload, "payload"); return setProgress(payload.progress); } throw new RangeError(`azione non supportata: ${String(action)}`); } return Object.freeze({ getState, setProgress, play, pause, reset, advance, dispatch }); }

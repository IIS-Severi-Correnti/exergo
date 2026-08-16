import assert from "node:assert/strict";
import test from "node:test";

import { createSimulationEngine } from "../../simulazioni/engines/wave_1d/engine.js";

function close(actual, expected, tolerance = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `atteso ${expected}, trovato ${actual}`);
}

function config(model, parameters = {}, duration = 5) {
  return { schema_version: 1, engine: "wave_1d", model, parameters, interaction: { playback_duration_s: duration } };
}

test("doppler_observer_moving riproduce 960 Hz -> 1055 Hz", () => {
  const engine = createSimulationEngine(config("doppler_observer_moving", {
    emitted_frequency_Hz: 960,
    frequency_increase_Hz: 95,
    wave_speed_m_s: 343,
  }));
  const final = engine.setProgress(1);
  close(final.observed_frequency_Hz, 1055, 1e-10);
  close(final.observer_speed_m_s, 343 * (1055 / 960 - 1), 1e-12);
  assert.ok(final.observer_speed_m_s > 0 && final.observer_speed_m_s < final.wave_speed_m_s);
});

test("doppler_observer_moving resta generico su dati indipendenti", () => {
  const engine = createSimulationEngine(config("doppler_observer_moving", {
    emitted_frequency_Hz: 500,
    frequency_increase_Hz: 50,
    wave_speed_m_s: 340,
  }));
  const final = engine.setProgress(1);
  close(final.observer_speed_m_s, 34, 1e-12);
  close(final.frequency_ratio, 1.1, 1e-12);
});

test("doppler_source_moving raddoppia la frequenza a beta=0.5", () => {
  const engine = createSimulationEngine(config("doppler_source_moving", { target_frequency_ratio: 2 }));
  const final = engine.setProgress(1);
  close(final.source_speed_over_wave_speed, 0.5, 1e-12);
  close(final.frequency_ratio, 2, 1e-12);
  close(final.wavelength_ahead_ratio, 0.5, 1e-12);
  close(final.wavelength_behind_ratio, 1.5, 1e-12);
});

test("doppler_source_moving non e hardcoded sul raddoppio", () => {
  const engine = createSimulationEngine(config("doppler_source_moving", { target_frequency_ratio: 1.5 }));
  const final = engine.setProgress(1);
  close(final.source_speed_over_wave_speed, 1 / 3, 1e-12);
  close(final.frequency_ratio, 1.5, 1e-12);
});

test("string_mode applica f/f0=1/sqrt(mu/mu0)", () => {
  const engine = createSimulationEngine(config("string_mode", { linear_density_ratio_final: 4 }));
  const final = engine.setProgress(1);
  close(final.linear_density_ratio, 4, 1e-12);
  close(final.frequency_ratio, 0.5, 1e-12);
  close(final.wave_speed_ratio, 0.5, 1e-12);
});

test("string_mode resta generico su un rapporto nove", () => {
  const engine = createSimulationEngine(config("string_mode", { linear_density_ratio_final: 9 }));
  close(engine.setProgress(1).frequency_ratio, 1 / 3, 1e-12);
});

test("mechanical_wave_energy usa soltanto coordinate normalizzate quadratiche", () => {
  const engine = createSimulationEngine(config("mechanical_wave_energy"));
  const half = engine.setProgress(0.5);
  close(half.amplitude_ratio, 0.5);
  close(half.elastic_energy_ratio, 0.25);
  close(half.normalized_force_peak_ratio, 0.5);
  close(engine.setProgress(1).elastic_energy_ratio, 1);
});

test("echo_time_of_flight percorre andata e ritorno in tempo normalizzato", () => {
  const engine = createSimulationEngine(config("echo_time_of_flight"));
  let state = engine.setProgress(0.25);
  close(state.pulse_position_ratio, 0.5);
  assert.equal(state.phase, "andata");
  state = engine.setProgress(0.5);
  close(state.pulse_position_ratio, 1);
  assert.equal(state.phase, "riflessione sull'ostacolo");
  state = engine.setProgress(0.75);
  close(state.pulse_position_ratio, 0.5);
  assert.equal(state.phase, "eco di ritorno");
  state = engine.setProgress(1);
  close(state.pulse_position_ratio, 0);
  close(state.path_length_ratio, 2);
  assert.equal(state.phase, "eco ricevuto");
});

test("lifecycle comune funziona per i cinque modelli", () => {
  const engine = createSimulationEngine(config("doppler_source_moving", { target_frequency_ratio: 2 }, 4));
  assert.equal(engine.getState().progress, 0);
  assert.equal(engine.play().is_running, true);
  close(engine.advance(1).progress, 0.25);
  assert.equal(engine.pause().is_running, false);
  engine.play();
  assert.equal(engine.advance(10).progress, 1);
  assert.equal(engine.getState().is_running, false);
  assert.equal(engine.reset().progress, 0);
});

test("configurazioni fisicamente incompatibili vengono rifiutate", () => {
  assert.throws(() => createSimulationEngine(config("doppler_source_moving", { target_frequency_ratio: 1 })), /target_frequency_ratio/);
  assert.throws(() => createSimulationEngine(config("string_mode", { linear_density_ratio_final: 1 })), /linear_density_ratio_final/);
  assert.throws(() => createSimulationEngine(config("mechanical_wave_energy", { fake: 1 })), /non richiede parametri/);
  assert.throws(() => createSimulationEngine(config("echo_time_of_flight", { distance_m: 10 })), /non richiede dati numerici/);
});

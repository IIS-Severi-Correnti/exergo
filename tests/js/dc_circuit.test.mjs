import test from "node:test";
import assert from "node:assert/strict";
import { createSimulationEngine } from "../../simulazioni/engines/dc_circuit/engine.js";

const interaction = Object.freeze({
  allow_play: true,
  allow_pause: true,
  allow_reset: true,
  allow_scrub: true,
  playback_duration_s: 4,
});

function config(model, parameters) {
  return {
    schema_version: 1,
    engine: "dc_circuit",
    model,
    parameters,
    interaction: { ...interaction },
    display: { show_equations: true, show_values: true },
    didactics: { learning_action_it: "test", model_note_it: "test" },
  };
}

function close(actual, expected, tolerance = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

test("single-loop topology distinguishes open and closed circuit", () => {
  const engine = createSimulationEngine(config("single_loop_topology", {}));
  assert.equal(engine.getState().path_closed, false);
  assert.equal(engine.getState().current_possible, false);
  engine.setProgress(0.5);
  assert.equal(engine.getState().path_closed, true);
  assert.equal(engine.getState().current_possible, true);
  engine.reset();
  assert.equal(engine.getState().path_closed, false);
});

test("charge flow implements I = Delta Q / Delta t", () => {
  const engine = createSimulationEngine(config("charge_flow", {
    charge_final_C: 1,
    time_interval_s: 1,
  }));
  engine.setProgress(1);
  close(engine.getState().charge_C, 1);
  close(engine.getState().current_A, 1);

  const reuse = createSimulationEngine(config("charge_flow", {
    charge_final_C: 3.6,
    time_interval_s: 1.2,
  }));
  reuse.setProgress(1);
  close(reuse.getState().current_A, 3);
});

test("OHM-002 doubles current when resistance halves at fixed voltage", () => {
  const engine = createSimulationEngine(config("ohmic_resistor", {
    voltage_initial_V: 4,
    voltage_final_V: 4,
    resistance_initial_ohm: 8,
    resistance_final_ohm: 4,
  }));
  close(engine.getState().current_A, 0.5);
  engine.setProgress(1);
  const state = engine.getState();
  close(state.resistance_ohm, 4);
  close(state.current_A, 1);
  close(state.power_W, 4);
});

test("ohmic model is not hard-coded to the published numerical exercise", () => {
  const engine = createSimulationEngine(config("ohmic_resistor", {
    voltage_initial_V: 0,
    voltage_final_V: 12,
    resistance_initial_ohm: 6,
    resistance_final_ohm: 6,
  }));
  engine.setProgress(0.5);
  const state = engine.getState();
  close(state.voltage_V, 6);
  close(state.resistance_ohm, 6);
  close(state.current_A, 1);
});

test("generic playback lifecycle works for the new engine", () => {
  const engine = createSimulationEngine(config("ohmic_resistor", {
    voltage_initial_V: 2,
    voltage_final_V: 10,
    resistance_initial_ohm: 5,
    resistance_final_ohm: 5,
  }));
  engine.play();
  engine.advance(1);
  close(engine.getState().progress, 0.25);
  assert.equal(engine.getState().is_running, true);
  engine.pause();
  assert.equal(engine.getState().is_running, false);
  engine.reset();
  close(engine.getState().progress, 0);
});

test("invalid electrical parameters are rejected", () => {
  assert.throws(() => createSimulationEngine(config("ohmic_resistor", {
    voltage_initial_V: 4,
    voltage_final_V: 4,
    resistance_initial_ohm: 0,
    resistance_final_ohm: 4,
  })), /resistance_initial_ohm/);
});

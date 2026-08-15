import test from "node:test";
import assert from "node:assert/strict";

import { createSimulationEngine } from "../../simulazioni/engines/fluid_statics/engine.js";

function config(overrides = {}) {
  return {
    schema_version: 1,
    engine: "fluid_statics",
    model: "hydraulic_press",
    parameters: {
      small_piston_force_N: 140,
      load_mass_kg: 3800,
      gravity_m_s2: 9.8,
      ...(overrides.parameters ?? {}),
    },
    interaction: {
      allow_play: true,
      allow_pause: true,
      allow_reset: true,
      allow_scrub: true,
      playback_duration_s: 6,
      ...(overrides.interaction ?? {}),
    },
  };
}

function close(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

test("hydraulic press starts from equal areas without inventing absolute areas", () => {
  const engine = createSimulationEngine(config());
  const state = engine.getState();
  close(state.load_weight_N, 37240);
  close(state.target_area_ratio, 266);
  close(state.area_ratio, 1);
  close(state.large_piston_force_N, 140);
  close(state.force_coverage, 140 / 37240);
  assert.equal(state.balance_reached, false);
});

test("Pascal force amplification follows F2 = F1 * A2/A1 at every scrubbed state", () => {
  const engine = createSimulationEngine(config());
  for (const progress of [0, 0.1, 0.5, 0.9, 1]) {
    const state = engine.setProgress(progress);
    close(state.large_piston_force_N, state.small_piston_force_N * state.area_ratio);
    close(state.force_coverage, state.large_piston_force_N / state.load_weight_N);
  }
});

test("midpoint and final state recover the required area ratio", () => {
  const engine = createSimulationEngine(config());
  const midpoint = engine.setProgress(0.5);
  close(midpoint.area_ratio, 133.5);
  close(midpoint.large_piston_force_N, 18690);
  assert.equal(midpoint.balance_reached, false);

  const finalState = engine.setProgress(1);
  close(finalState.area_ratio, 266);
  close(finalState.large_piston_force_N, 37240);
  close(finalState.force_coverage, 1);
  close(finalState.force_deficit_N, 0);
  assert.equal(finalState.balance_reached, true);
});

test("playback is only a progress coordinate and reset restores the equal-area state", () => {
  const engine = createSimulationEngine(config());
  engine.play();
  const halfway = engine.advance(3);
  close(halfway.progress, 0.5);
  assert.equal(halfway.is_running, true);
  const finalState = engine.advance(3);
  close(finalState.progress, 1);
  assert.equal(finalState.is_running, false);
  assert.equal(finalState.is_complete, true);
  const reset = engine.reset();
  close(reset.progress, 0);
  close(reset.area_ratio, 1);
  assert.equal(reset.balance_reached, false);
});

test("same hydraulic press model reuses cleanly with another numerical dataset", () => {
  const engine = createSimulationEngine(config({
    parameters: {
      small_piston_force_N: 250,
      load_mass_kg: 1000,
      gravity_m_s2: 10,
    },
  }));
  const finalState = engine.setProgress(1);
  close(finalState.load_weight_N, 10000);
  close(finalState.target_area_ratio, 40);
  close(finalState.large_piston_force_N, 10000);
  assert.equal(finalState.balance_reached, true);
});

test("model rejects a load that does not require hydraulic amplification", () => {
  assert.throws(
    () => createSimulationEngine(config({
      parameters: {
        small_piston_force_N: 1000,
        load_mass_kg: 100,
        gravity_m_s2: 9.8,
      },
    })),
    /peso maggiore di small_piston_force_N/,
  );
});

import assert from "node:assert/strict";
import test from "node:test";

import { createSimulationEngine } from "../../simulazioni/engines/one_dimensional_collision/engine.js";

function config(overrides = {}) {
  const parameters = {
    mass_1_ratio: 1,
    mass_2_ratio: 1,
    velocity_1_initial_m_s: 5.2,
    velocity_2_initial_m_s: 0,
    ...(overrides.parameters ?? {}),
  };
  return {
    schema_version: 1,
    engine: "one_dimensional_collision",
    model: "elastic_1d",
    parameters,
    interaction: {
      allow_play: true,
      allow_pause: true,
      allow_reset: true,
      allow_scrub: true,
      allow_reference_frame_change: true,
      playback_duration_s: 4,
      ...(overrides.interaction ?? {}),
    },
    display: {
      reference_frame_default: "table",
      show_velocity_vectors: true,
      show_invariants: true,
      show_equations: true,
      ...(overrides.display ?? {}),
    },
    didactics: {
      model_note_it: "test",
      learning_action_it: "test",
      object_1_label_it: "A",
      object_2_label_it: "B",
    },
  };
}

function close(actual, expected, tolerance = 1e-12) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

test("equal masses exchange velocities in the table frame", () => {
  const engine = createSimulationEngine(config());
  const initial = engine.getState();
  close(initial.velocity_center_of_mass_table_m_s, 2.6);
  close(initial.velocity_center_of_mass_m_s, 2.6);
  close(initial.velocity_1_final_table_m_s, 0);
  close(initial.velocity_2_final_table_m_s, 5.2);
  close(initial.normalized_momentum_before, 5.2);
  close(initial.normalized_momentum_after, 5.2);
  close(initial.normalized_kinetic_energy_before, 13.52);
  close(initial.normalized_kinetic_energy_after, 13.52);
  close(initial.momentum_conservation_error, 0);
  close(initial.energy_conservation_error, 0);

  engine.setProgress(1);
  const final = engine.getState();
  close(final.velocity_1_current_m_s, 0);
  close(final.velocity_2_current_m_s, 5.2);
  assert.equal(final.phase, "after");
  assert.equal(final.is_complete, true);
});

test("center-of-mass frame gives symmetric reversal and frame-specific invariants", () => {
  const engine = createSimulationEngine(config());
  engine.setReferenceFrame("center_of_mass");
  let state = engine.getState();
  close(state.velocity_center_of_mass_table_m_s, 2.6);
  close(state.velocity_center_of_mass_m_s, 0);
  close(state.velocity_1_initial_m_s, 2.6);
  close(state.velocity_2_initial_m_s, -2.6);
  close(state.velocity_1_current_m_s, 2.6);
  close(state.velocity_2_current_m_s, -2.6);
  close(state.normalized_momentum_before, 0);
  close(state.normalized_momentum_after, 0);
  close(state.normalized_kinetic_energy_before, 6.76);
  close(state.normalized_kinetic_energy_after, 6.76);
  close(state.momentum_conservation_error, 0);
  close(state.energy_conservation_error, 0);

  engine.setProgress(1);
  state = engine.getState();
  close(state.velocity_1_final_m_s, -2.6);
  close(state.velocity_2_final_m_s, 2.6);
  close(state.velocity_1_current_m_s, -2.6);
  close(state.velocity_2_current_m_s, 2.6);
});

test("unequal mass ratios prove the engine is not hard-coded to the pilot", () => {
  const engine = createSimulationEngine(
    config({
      parameters: {
        mass_1_ratio: 2,
        mass_2_ratio: 1,
        velocity_1_initial_m_s: 3,
        velocity_2_initial_m_s: -1,
      },
    }),
  );
  const state = engine.getState();
  close(state.velocity_1_final_table_m_s, 1 / 3);
  close(state.velocity_2_final_table_m_s, 13 / 3);
  close(state.normalized_momentum_before, 5);
  close(state.normalized_momentum_after, 5);
  close(state.normalized_kinetic_energy_before, 9.5);
  close(state.normalized_kinetic_energy_after, 9.5);
});

test("playback, collision phase, reference frame and reset share the core contract", () => {
  const engine = createSimulationEngine(config({ interaction: { playback_duration_s: 2 } }));
  engine.play();
  engine.advance(1);
  let state = engine.getState();
  close(state.progress, 0.5);
  assert.equal(state.phase, "collision");
  assert.equal(state.is_running, true);

  engine.dispatch("frame_center_of_mass");
  assert.equal(engine.getState().reference_frame, "center_of_mass");
  engine.advance(1);
  state = engine.getState();
  assert.equal(state.is_complete, true);
  assert.equal(state.is_running, false);

  engine.reset();
  state = engine.getState();
  close(state.progress, 0);
  assert.equal(state.reference_frame, "table");
  assert.equal(state.phase, "before");
});

test("non-approaching initial velocities are rejected", () => {
  assert.throws(
    () =>
      createSimulationEngine(
        config({
          parameters: {
            velocity_1_initial_m_s: 0,
            velocity_2_initial_m_s: 1,
          },
        }),
      ),
    /urto di avvicinamento/,
  );
});

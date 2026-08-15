import assert from "node:assert/strict";
import test from "node:test";

import { createSimulationEngine } from "../../simulazioni/engines/fluid_statics/engine.js";

function makeConfig(parameters = {}) {
  return {
    schema_version: 1,
    engine: "fluid_statics",
    model: "hydrostatic_pressure_points",
    parameters: {
      fluid_density_kg_m3: 1000,
      gravity_m_s2: 9.8,
      upper_depth_m: 0.12,
      lower_depth_m: 0.28,
      ...parameters,
    },
    interaction: {
      allow_play: true,
      allow_pause: true,
      allow_reset: true,
      allow_scrub: true,
      playback_duration_s: 4
    },
    display: {},
    didactics: {}
  };
}

function close(actual, expected, tolerance = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

test("initial ordering matches the exercise", () => {
  const state = createSimulationEngine(makeConfig()).getState();
  close(state.moving_depth_m, state.upper_depth_m);
  close(state.gauge_pressure_moving_Pa, state.gauge_pressure_upper_Pa);
  assert.ok(state.gauge_pressure_upper_Pa < state.gauge_pressure_lower_Pa);
  assert.equal(state.moving_matches_upper, true);
  assert.equal(state.moving_matches_lower, false);
});

test("middle state follows rho g h", () => {
  const state = createSimulationEngine(makeConfig()).setProgress(0.5);
  close(state.moving_depth_m, 0.2);
  close(state.gauge_pressure_moving_Pa, 1000 * 9.8 * 0.2);
  assert.ok(state.gauge_pressure_upper_Pa < state.gauge_pressure_moving_Pa);
  assert.ok(state.gauge_pressure_moving_Pa < state.gauge_pressure_lower_Pa);
});

test("final state matches the lower pressure level", () => {
  const state = createSimulationEngine(makeConfig()).setProgress(1);
  close(state.moving_depth_m, state.lower_depth_m);
  close(state.gauge_pressure_moving_Pa, state.gauge_pressure_lower_Pa);
  assert.equal(state.moving_matches_lower, true);
  assert.equal(state.is_complete, true);
});

test("playback and reset preserve the generic lifecycle", () => {
  const engine = createSimulationEngine(makeConfig());
  assert.equal(engine.play().is_running, true);
  close(engine.advance(1).progress, 0.25);
  assert.equal(engine.pause().is_running, false);
  const reset = engine.reset();
  close(reset.progress, 0);
  close(reset.moving_depth_m, reset.upper_depth_m);
});

test("the model is reusable with a different numerical scale", () => {
  const state = createSimulationEngine(makeConfig({
    fluid_density_kg_m3: 850,
    gravity_m_s2: 10,
    upper_depth_m: 0.3,
    lower_depth_m: 0.9
  })).setProgress(0.25);
  close(state.moving_depth_m, 0.45);
  close(state.gauge_pressure_upper_Pa, 2550);
  close(state.gauge_pressure_moving_Pa, 3825);
  close(state.gauge_pressure_lower_Pa, 7650);
});

test("an inverted depth interval is rejected", () => {
  assert.throws(
    () => createSimulationEngine(makeConfig({ upper_depth_m: 0.4, lower_depth_m: 0.2 })),
    /lower_depth_m deve essere maggiore di upper_depth_m/
  );
});

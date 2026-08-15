import test from "node:test";
import assert from "node:assert/strict";

import { createSimulationEngine } from "../../simulazioni/engines/fluid_statics/engine.js";

function config(branchCount = 4) {
  return {
    schema_version: 1,
    engine: "fluid_statics",
    model: "communicating_vessels",
    parameters: { branch_count: branchCount },
    interaction: {
      allow_play: true,
      allow_pause: true,
      allow_reset: true,
      allow_scrub: true,
      playback_duration_s: 5,
    },
  };
}

test("communicating vessels converge from unequal normalized heads to one level", () => {
  const engine = createSimulationEngine(config());
  const initial = engine.getState();
  assert.equal(initial.branch_count, 4);
  assert.deepEqual(initial.level_offsets_relative, [-1, -1 / 3, 1 / 3, 1]);
  assert.equal(initial.pressure_spread_relative, 2);
  assert.equal(initial.equilibrium_reached, false);

  const middle = engine.setProgress(0.5);
  assert.deepEqual(middle.level_offsets_relative, [-0.5, -1 / 6, 1 / 6, 0.5]);
  assert.equal(middle.pressure_spread_relative, 1);
  assert.equal(middle.imbalance_fraction, 0.5);

  const final = engine.setProgress(1);
  assert.deepEqual(final.level_offsets_relative, [0, 0, 0, 0]);
  assert.equal(final.pressure_spread_relative, 0);
  assert.equal(final.equilibrium_reached, true);
});

test("communicating vessels generalize to a different branch count", () => {
  const engine = createSimulationEngine(config(2));
  assert.deepEqual(engine.getState().level_offsets_relative, [-1, 1]);
  assert.deepEqual(engine.setProgress(1).level_offsets_relative, [0, 0]);
});

test("communicating vessels lifecycle remains generic", () => {
  const engine = createSimulationEngine(config());
  assert.equal(engine.play().is_running, true);
  const advanced = engine.advance(2.5);
  assert.equal(advanced.progress, 0.5);
  assert.equal(engine.pause().is_running, false);
  const reset = engine.reset();
  assert.equal(reset.progress, 0);
  assert.equal(reset.pressure_spread_relative, 2);
});

test("communicating vessels reject non-integer or unsupported branch counts", () => {
  assert.throws(() => createSimulationEngine(config(1)), /branch_count/);
  assert.throws(() => createSimulationEngine(config(7)), /branch_count/);
  assert.throws(() => createSimulationEngine(config(3.5)), /branch_count deve essere un intero/);
});

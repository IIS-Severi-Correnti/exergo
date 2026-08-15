import assert from "node:assert/strict";
import test from "node:test";

import { createSimulationEngine } from "../../simulazioni/engines/fluid_statics/multi_engine.js";

function closeTo(actual, expected, tolerance = 1e-9) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `atteso ${expected}, trovato ${actual}`,
  );
}

function createConfig(overrides = {}) {
  return {
    schema_version: 1,
    engine: "fluid_statics",
    model: "buoyancy_apparent_weight",
    parameters: {
      weight_air_N: 820,
      apparent_weight_fully_submerged_N: 770,
      fluid_density_kg_m3: 1030,
      gravity_m_s2: 9.8,
      submerged_fraction_initial: 0,
      submerged_fraction_final: 1,
      ...overrides.parameters,
    },
    interaction: {
      allow_play: true,
      allow_pause: true,
      allow_reset: true,
      allow_scrub: true,
      playback_duration_s: 6,
      ...overrides.interaction,
    },
    display: {
      show_equations: true,
      show_force_balance: true,
      show_derived_volume: true,
      show_derived_density: true,
    },
    didactics: {
      model_note_it: "test",
      learning_action_it: "test",
      body_label_it: "corpo",
      fluid_label_it: "fluido",
      dynamometer_label_it: "dinamometro",
    },
  };
}

test("ARC-002: ricava spinta, volume, massa e densita dai due pesi", () => {
  const engine = createSimulationEngine(createConfig());
  const initial = engine.getState();
  const final = engine.setProgress(1);

  closeTo(initial.weight_air_N, 820);
  closeTo(initial.buoyancy_force_N, 0);
  closeTo(initial.apparent_weight_N, 820);
  closeTo(final.buoyancy_force_N, 50);
  closeTo(final.apparent_weight_N, 770);
  closeTo(final.tension_force_N, 770);
  closeTo(final.volume_m3, 50 / (1030 * 9.8));
  closeTo(final.mass_kg, 820 / 9.8);
  closeTo(final.body_density_kg_m3, 16892, 1e-8);
  closeTo(final.force_balance_residual_N, 0);
});

test("la spinta cresce linearmente con la frazione di volume immerso", () => {
  const engine = createSimulationEngine(createConfig());
  const half = engine.setProgress(0.5);
  closeTo(half.submerged_fraction, 0.5);
  closeTo(half.buoyancy_force_N, 25);
  closeTo(half.apparent_weight_N, 795);
  closeTo(half.tension_force_N + half.buoyancy_force_N, half.weight_air_N);
});

test("il modello e riusabile con dati fisici differenti", () => {
  const engine = createSimulationEngine(createConfig({
    parameters: {
      weight_air_N: 100,
      apparent_weight_fully_submerged_N: 60,
      fluid_density_kg_m3: 800,
      gravity_m_s2: 10,
    },
  }));
  const final = engine.setProgress(1);

  closeTo(final.buoyancy_force_N, 40);
  closeTo(final.volume_m3, 0.005);
  closeTo(final.mass_kg, 10);
  closeTo(final.body_density_kg_m3, 2000);
});

test("play, pausa, avanzamento e reset riusano il contratto dell'engine", () => {
  const engine = createSimulationEngine(createConfig({
    interaction: { playback_duration_s: 4 },
  }));

  assert.equal(engine.play().is_running, true);
  closeTo(engine.advance(1).progress, 0.25);
  assert.equal(engine.pause().is_running, false);
  closeTo(engine.setProgress(1).apparent_weight_N, 770);
  const reset = engine.reset();
  closeTo(reset.progress, 0);
  closeTo(reset.apparent_weight_N, 820);
  assert.equal(reset.is_running, false);
});

test("il facade continua a instradare i modelli fluid_statics esistenti", () => {
  const hydrostatic = createSimulationEngine({
    schema_version: 1,
    engine: "fluid_statics",
    model: "hydrostatic_column",
    parameters: {
      fluid_density_initial_kg_m3: 1000,
      gravity_m_s2: 9.8,
      depth_reference_m: 0.2,
      depth_moving_initial_m: 0.2,
      depth_moving_final_m: 0.4,
    },
    interaction: {
      allow_play: true,
      allow_pause: true,
      allow_reset: true,
      allow_scrub: true,
      allow_density_change: false,
      playback_duration_s: 5,
      density_min_kg_m3: 500,
      density_max_kg_m3: 1500,
    },
  });
  closeTo(hydrostatic.setProgress(1).gauge_pressure_moving_Pa, 3920);
});

test("rifiuta misure incompatibili con il modello del dinamometro", () => {
  assert.throws(
    () => createSimulationEngine(createConfig({
      parameters: { apparent_weight_fully_submerged_N: 820 },
    })),
    /minore di weight_air_N/,
  );
  assert.throws(
    () => createSimulationEngine(createConfig({
      parameters: { apparent_weight_fully_submerged_N: 900 },
    })),
    /minore di weight_air_N/,
  );
  assert.throws(
    () => createSimulationEngine(createConfig({
      parameters: { fluid_density_kg_m3: 0 },
    })),
    /fluid_density_kg_m3/,
  );
});

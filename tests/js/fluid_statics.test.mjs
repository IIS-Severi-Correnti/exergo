import assert from "node:assert/strict";
import test from "node:test";

import { createSimulationEngine } from "../../simulazioni/engines/fluid_statics/engine.js";

function closeTo(actual, expected, tolerance = 1e-9) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `atteso ${expected}, trovato ${actual}`,
  );
}

function createHydroConfig(overrides = {}) {
  const parameters = {
    fluid_density_initial_kg_m3: 1000,
    gravity_m_s2: 9.8,
    depth_reference_m: 0.2,
    depth_moving_initial_m: 0.2,
    depth_moving_final_m: 0.4,
    vessel_radius_1_m: 0.04,
    vessel_radius_2_m: 0.06,
    ...overrides.parameters,
  };
  const interaction = {
    allow_play: true,
    allow_pause: true,
    allow_reset: true,
    allow_scrub: true,
    allow_density_change: false,
    playback_duration_s: 5,
    density_min_kg_m3: 500,
    density_max_kg_m3: 1500,
    ...overrides.interaction,
  };
  return {
    schema_version: 1,
    engine: "fluid_statics",
    model: "hydrostatic_column",
    parameters,
    interaction,
  };
}

function createFloatingConfig(overrides = {}) {
  const parameters = {
    fluid_density_kg_m3: 1000,
    body_density_initial_kg_m3: 480,
    submerged_fraction_initial: 0,
    submerged_fraction_final: 1,
    ...overrides.parameters,
  };
  const interaction = {
    allow_play: true,
    allow_pause: true,
    allow_reset: true,
    allow_scrub: true,
    allow_body_density_change: false,
    playback_duration_s: 6,
    body_density_min_kg_m3: 100,
    body_density_max_kg_m3: 1500,
    force_balance_tolerance: 0.005,
    ...overrides.interaction,
  };
  return {
    schema_version: 1,
    engine: "fluid_statics",
    model: "floating_body",
    parameters,
    interaction,
  };
}

test("Stevino: pressione del primo recipiente e raddoppio finale", () => {
  const engine = createSimulationEngine(createHydroConfig());
  const initial = engine.getState();
  const final = engine.setProgress(1);

  closeTo(initial.gauge_pressure_reference_Pa, 1960);
  closeTo(initial.gauge_pressure_moving_Pa, 1960);
  closeTo(initial.pressure_ratio, 1);
  closeTo(final.depth_moving_m, 0.4);
  closeTo(final.gauge_pressure_moving_Pa, 3920);
  closeTo(final.pressure_ratio, 2);
});

test("Stevino: la pressione e indipendente dal raggio dei recipienti", () => {
  const narrowWide = createSimulationEngine(createHydroConfig());
  const swapped = createSimulationEngine(
    createHydroConfig({
      parameters: {
        vessel_radius_1_m: 0.4,
        vessel_radius_2_m: 0.006,
      },
    }),
  );

  const first = narrowWide.setProgress(0.73);
  const second = swapped.setProgress(0.73);
  closeTo(first.gauge_pressure_reference_Pa, second.gauge_pressure_reference_Pa);
  closeTo(first.gauge_pressure_moving_Pa, second.gauge_pressure_moving_Pa);
  closeTo(first.pressure_ratio, second.pressure_ratio);
});

test("Stevino: lo stesso modello riusa densita, gravita e profondita differenti", () => {
  const config = createHydroConfig({
    parameters: {
      fluid_density_initial_kg_m3: 800,
      gravity_m_s2: 9.81,
      depth_reference_m: 0.1,
      depth_moving_initial_m: 0.15,
      depth_moving_final_m: 0.3,
      vessel_radius_1_m: undefined,
      vessel_radius_2_m: undefined,
    },
    interaction: {
      allow_density_change: true,
      density_min_kg_m3: 600,
      density_max_kg_m3: 1200,
    },
  });
  delete config.parameters.vessel_radius_1_m;
  delete config.parameters.vessel_radius_2_m;
  const engine = createSimulationEngine(config);
  const final = engine.setProgress(1);

  closeTo(final.gauge_pressure_reference_Pa, 800 * 9.81 * 0.1);
  closeTo(final.gauge_pressure_moving_Pa, 800 * 9.81 * 0.3);
  closeTo(final.pressure_ratio, 3);

  const denser = engine.dispatch("set_density", { density_kg_m3: 1000 });
  closeTo(denser.gauge_pressure_reference_Pa, 1000 * 9.81 * 0.1);
  closeTo(denser.gauge_pressure_moving_Pa, 1000 * 9.81 * 0.3);
  closeTo(denser.pressure_ratio, 3);
});

test("Stevino: densita e profondita mostrano proporzionalita diretta", () => {
  const config = createHydroConfig({
    interaction: { allow_density_change: true },
  });
  const engine = createSimulationEngine(config);
  const initial = engine.getState();
  const doubleDepth = engine.setProgress(1);
  closeTo(doubleDepth.gauge_pressure_moving_Pa, 2 * initial.gauge_pressure_moving_Pa);

  const doubleDensity = engine.setDensity(1500);
  closeTo(
    doubleDensity.gauge_pressure_moving_Pa,
    1.5 * doubleDepth.gauge_pressure_moving_Pa,
  );
});

test("Archimede: la cassa da 480 kg/m3 e in equilibrio al 48% immerso", () => {
  const engine = createSimulationEngine(createFloatingConfig());
  const equilibrium = engine.setProgress(0.48);

  closeTo(equilibrium.density_ratio_body_to_fluid, 0.48);
  closeTo(equilibrium.equilibrium_submerged_fraction, 0.48);
  closeTo(equilibrium.buoyancy_to_weight_ratio, 1);
  assert.equal(equilibrium.force_balance_reached, true);
  assert.equal(equilibrium.floating_regime, "floating");
});

test("Archimede: il modello riusa densita diverse senza massa o volume assoluti", () => {
  const engine = createSimulationEngine(
    createFloatingConfig({
      parameters: {
        fluid_density_kg_m3: 800,
        body_density_initial_kg_m3: 600,
      },
      interaction: {
        body_density_min_kg_m3: 300,
        body_density_max_kg_m3: 1200,
      },
    }),
  );

  const equilibrium = engine.setProgress(0.75);
  closeTo(equilibrium.equilibrium_submerged_fraction, 0.75);
  closeTo(equilibrium.buoyancy_to_weight_ratio, 1);
  assert.equal(equilibrium.force_balance_reached, true);
});

test("Archimede: distingue galleggiamento, neutralita e affondamento", () => {
  const config = createFloatingConfig({
    parameters: { body_density_initial_kg_m3: 600 },
    interaction: {
      allow_body_density_change: true,
      body_density_min_kg_m3: 300,
      body_density_max_kg_m3: 1300,
      force_balance_tolerance: 0.01,
    },
  });
  const engine = createSimulationEngine(config);

  assert.equal(engine.getState().floating_regime, "floating");
  closeTo(engine.getState().equilibrium_submerged_fraction, 0.6);

  const neutral = engine.setBodyDensity(1000);
  assert.equal(neutral.floating_regime, "neutral");
  closeTo(neutral.equilibrium_submerged_fraction, 1);
  const neutralFull = engine.setProgress(1);
  closeTo(neutralFull.buoyancy_to_weight_ratio, 1);
  assert.equal(neutralFull.force_balance_reached, true);

  const sinking = engine.setBodyDensity(1200);
  assert.equal(sinking.floating_regime, "sinking");
  assert.equal(sinking.equilibrium_submerged_fraction, null);
  closeTo(sinking.buoyancy_to_weight_ratio, 1000 / 1200);
  assert.equal(sinking.force_balance_reached, false);
});

test("runtime comune: play, pausa, avanzamento e reset funzionano su entrambi i modelli", () => {
  for (const config of [
    createHydroConfig({ interaction: { allow_density_change: true, playback_duration_s: 4 } }),
    createFloatingConfig({
      parameters: { body_density_initial_kg_m3: 600 },
      interaction: {
        allow_body_density_change: true,
        body_density_min_kg_m3: 300,
        body_density_max_kg_m3: 1300,
        playback_duration_s: 4,
      },
    }),
  ]) {
    const engine = createSimulationEngine(config);
    assert.equal(engine.getState().is_running, false);
    assert.equal(engine.play().is_running, true);
    closeTo(engine.advance(1).progress, 0.25);
    assert.equal(engine.pause().is_running, false);
    const reset = engine.dispatch("reset");
    closeTo(reset.progress, 0);
    assert.equal(reset.is_running, false);
  }
});

test("rifiuta configurazioni fisicamente non valide e azioni incompatibili", () => {
  assert.throws(
    () => createSimulationEngine(createHydroConfig({
      parameters: { depth_moving_final_m: 0.1 },
    })),
    /depth_moving_final_m/,
  );
  assert.throws(
    () => createSimulationEngine(createHydroConfig({
      parameters: { fluid_density_initial_kg_m3: 2000 },
    })),
    /fluid_density_initial_kg_m3/,
  );
  assert.throws(
    () => createSimulationEngine(createFloatingConfig({
      parameters: { submerged_fraction_final: 1.2 },
    })),
    /submerged_fraction_final/,
  );
  assert.throws(
    () => createSimulationEngine(createFloatingConfig({
      parameters: { body_density_initial_kg_m3: 2000 },
    })),
    /body_density_initial_kg_m3/,
  );

  const fixedHydro = createSimulationEngine(createHydroConfig());
  assert.throws(
    () => fixedHydro.dispatch("set_density", { density_kg_m3: 900 }),
    /non consente/,
  );
  const fixedFloating = createSimulationEngine(createFloatingConfig());
  assert.throws(
    () => fixedFloating.dispatch("set_body_density", { body_density_kg_m3: 700 }),
    /non consente/,
  );
  assert.throws(() => fixedFloating.dispatch("unknown"), /azione non supportata/);
});

import assert from "node:assert/strict";
import test from "node:test";

import { createSimulationEngine } from "../../simulazioni/engines/fluid_statics/engine.js";

function closeTo(actual, expected, tolerance = 1e-9) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `atteso ${expected}, trovato ${actual}`,
  );
}

function createConfig(overrides = {}) {
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

test("pilot: pressione del primo recipiente e raddoppio finale", () => {
  const engine = createSimulationEngine(createConfig());
  const initial = engine.getState();
  const final = engine.setProgress(1);

  closeTo(initial.gauge_pressure_reference_Pa, 1960);
  closeTo(initial.gauge_pressure_moving_Pa, 1960);
  closeTo(initial.pressure_ratio, 1);
  closeTo(final.depth_moving_m, 0.4);
  closeTo(final.gauge_pressure_moving_Pa, 3920);
  closeTo(final.pressure_ratio, 2);
});

test("la pressione e indipendente dal raggio dei recipienti", () => {
  const narrowWide = createSimulationEngine(createConfig());
  const swapped = createSimulationEngine(
    createConfig({
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

test("lo stesso modello riusa densita, gravita e profondita differenti", () => {
  const config = createConfig({
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

test("densita e profondita mostrano proporzionalita diretta", () => {
  const config = createConfig({
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

test("play, pausa, avanzamento e reset mantengono il contratto runtime", () => {
  const engine = createSimulationEngine(createConfig({
    interaction: { allow_density_change: true, playback_duration_s: 4 },
  }));

  assert.equal(engine.getState().is_running, false);
  assert.equal(engine.play().is_running, true);
  closeTo(engine.advance(1).progress, 0.25);
  assert.equal(engine.pause().is_running, false);
  engine.dispatch("set_density", { density_kg_m3: 1200 });
  closeTo(engine.getState().fluid_density_kg_m3, 1200);

  const reset = engine.dispatch("reset");
  closeTo(reset.progress, 0);
  closeTo(reset.fluid_density_kg_m3, 1000);
  assert.equal(reset.is_running, false);
});

test("rifiuta configurazioni fisicamente non valide", () => {
  assert.throws(
    () => createSimulationEngine(createConfig({
      parameters: { depth_moving_final_m: 0.1 },
    })),
    /depth_moving_final_m/,
  );
  assert.throws(
    () => createSimulationEngine(createConfig({
      parameters: { fluid_density_initial_kg_m3: 2000 },
    })),
    /fluid_density_initial_kg_m3/,
  );

  const fixedDensity = createSimulationEngine(createConfig());
  assert.throws(
    () => fixedDensity.dispatch("set_density", { density_kg_m3: 900 }),
    /non consente/,
  );
  assert.throws(() => fixedDensity.dispatch("unknown"), /azione non supportata/);
});

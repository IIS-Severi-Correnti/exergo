import test from "node:test";
import assert from "node:assert/strict";
import { createSimulationEngine } from "../../simulazioni/engines/calorimetry/engine.js";

const interaction = Object.freeze({
  allow_play: true,
  allow_pause: true,
  allow_reset: true,
  allow_scrub: true,
  playback_duration_s: 5,
});

function config(model, parameters) {
  return {
    schema_version: 1,
    engine: "calorimetry",
    model,
    parameters,
    interaction: { ...interaction },
    display: { show_equations: true, show_values: true },
    didactics: {
      learning_action_it: "test",
      model_note_it: "test",
      slider_label_it: "test",
      figure_note_it: "test",
      left_label_it: "test",
      right_label_it: "test",
      equation_html: "<p>test</p>",
    },
  };
}

function close(actual, expected, tolerance = 1e-8) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

test("CAL-001 reproduces the specific-heat comparison", () => {
  const engine = createSimulationEngine(config("sensible_heat_compare", {
    mass_kg: 0.5,
    heat_final_J: 4500,
    specific_heat_1_J_kgK: 390,
    specific_heat_2_J_kgK: 900,
  }));
  engine.setProgress(1);
  const state = engine.getState();
  close(state.delta_temperature_1_K, 4500 / (0.5 * 390));
  close(state.delta_temperature_2_K, 10);
  close(state.ratio_delta_temperature, 900 / 390);
});

test("CAL-002 converts solar power into the expected water temperature", () => {
  const engine = createSimulationEngine(config("heating_power", {
    received_power_W: 18000,
    efficiency: 0.8,
    mass_kg: 495,
    specific_heat_J_kgK: 4186,
    duration_s: 3600,
    temperature_initial_C: 12,
  }));
  engine.setProgress(1);
  const state = engine.getState();
  close(state.useful_power_W, 14400);
  close(state.temperature_C, 37.018459801068495, 1e-9);
});

test("EQ-001 reaches 44 degrees with zero energy-balance error", () => {
  const engine = createSimulationEngine(config("thermal_mixing", {
    mass_1_kg: 0.2,
    mass_2_kg: 0.3,
    specific_heat_J_kgK: 4186,
    temperature_1_initial_C: 20,
    temperature_2_initial_C: 60,
  }));
  engine.setProgress(1);
  const state = engine.getState();
  close(state.temperature_1_C, 44);
  close(state.temperature_2_C, 44);
  close(state.equilibrium_temperature_C, 44);
  close(state.energy_balance_error_J, 0, 1e-9);
});

test("EQ-002 warms ice, melts it completely and reaches the correct final temperature", () => {
  const engine = createSimulationEngine(config("ice_water_balance", {
    water_mass_kg: 1,
    ice_mass_kg: 0.1,
    water_specific_heat_J_kgK: 4186,
    ice_specific_heat_J_kgK: 2100,
    latent_heat_fusion_J_kg: 334000,
    water_temperature_initial_C: 28,
    ice_temperature_initial_C: -20,
  }));
  engine.setProgress(1);
  const state = engine.getState();
  close(state.equilibrium_temperature_C, 17.288798158363374, 1e-9);
  close(state.warm_water_temperature_C, state.equilibrium_temperature_C, 1e-9);
  close(state.cold_component_temperature_C, state.equilibrium_temperature_C, 1e-9);
  close(state.melt_fraction, 1);
  assert.equal(state.cold_phase, "acqua");
});

test("PAS-001 derives about 4.496 g of water and completes vaporization", () => {
  const engine = createSimulationEngine(config("phase_change_balance", {
    hot_mass_kg: 0.18,
    hot_latent_heat_J_kg: 64500,
    water_specific_heat_J_kgK: 4186,
    water_latent_vaporization_J_kg: 2260000,
    water_temperature_initial_C: 23,
    water_boiling_temperature_C: 100,
  }));
  engine.setProgress(1);
  const state = engine.getState();
  close(state.water_mass_kg, 0.00449595364172245, 1e-12);
  close(state.water_temperature_C, 100);
  close(state.vaporized_fraction, 1);
  close(state.hot_solidified_fraction, 1);
});

test("calorimetry models remain reusable with independent data", () => {
  const engine = createSimulationEngine(config("thermal_mixing", {
    mass_1_kg: 1,
    mass_2_kg: 1,
    specific_heat_J_kgK: 1000,
    temperature_1_initial_C: 0,
    temperature_2_initial_C: 100,
  }));
  engine.setProgress(1);
  close(engine.getState().equilibrium_temperature_C, 50);
});

test("ice-water model rejects a regime where complete melting is impossible", () => {
  assert.throws(() => createSimulationEngine(config("ice_water_balance", {
    water_mass_kg: 0.05,
    ice_mass_kg: 1,
    water_specific_heat_J_kgK: 4186,
    ice_specific_heat_J_kgK: 2100,
    latent_heat_fusion_J_kg: 334000,
    water_temperature_initial_C: 5,
    ice_temperature_initial_C: -20,
  })), /fusione completa/);
});

test("generic playback lifecycle works for calorimetry", () => {
  const engine = createSimulationEngine(config("heating_power", {
    received_power_W: 1000,
    efficiency: 1,
    mass_kg: 1,
    specific_heat_J_kgK: 1000,
    duration_s: 10,
    temperature_initial_C: 20,
  }));
  engine.play();
  engine.advance(2.5);
  close(engine.getState().progress, 0.5);
  engine.pause();
  assert.equal(engine.getState().is_running, false);
  engine.reset();
  close(engine.getState().progress, 0);
});

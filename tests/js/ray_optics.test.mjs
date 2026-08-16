import assert from "node:assert/strict";
import test from "node:test";

import { createSimulationEngine } from "../../simulazioni/engines/ray_optics/engine.js";

function close(actual, expected, tolerance = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `atteso ${expected}, trovato ${actual}`);
}

function config(model, parameters, duration = 5) {
  return { schema_version: 1, engine: "ray_optics", model, parameters, interaction: { playback_duration_s: duration } };
}

test("single_interface_refraction ricava n dalla riduzione del 33%", () => {
  const engine = createSimulationEngine(config("single_interface_refraction", {
    vacuum_speed_m_s: 3e8,
    speed_reduction_fraction_final: 0.33,
  }));
  const final = engine.setProgress(1);
  close(final.medium_speed_m_s, 2.01e8, 1e-3);
  close(final.refractive_index, 1 / 0.67, 1e-12);
});

test("snell_refraction ricava indice e velocita dai due angoli reali", () => {
  const engine = createSimulationEngine(config("snell_refraction", {
    refractive_index_1: 1,
    incidence_angle_final_deg: 63,
    refraction_angle_final_deg: 47,
    vacuum_speed_m_s: 3e8,
  }));
  const final = engine.setProgress(1);
  const expectedN2 = Math.sin(63 * Math.PI / 180) / Math.sin(47 * Math.PI / 180);
  close(final.refractive_index_2, expectedN2, 1e-12);
  close(final.refraction_angle_deg, 47, 1e-10);
  close(final.medium_speed_m_s, 3e8 / expectedN2, 1e-5);
});

test("snell_refraction resta generico con indici e angoli indipendenti dal pilot", () => {
  const n1 = 1.33;
  const i = 40;
  const rFinal = 25;
  const engine = createSimulationEngine(config("snell_refraction", {
    refractive_index_1: n1,
    incidence_angle_final_deg: i,
    refraction_angle_final_deg: rFinal,
    vacuum_speed_m_s: 299792458,
  }));
  const state = engine.setProgress(0.6);
  const n2 = n1 * Math.sin(i * Math.PI / 180) / Math.sin(rFinal * Math.PI / 180);
  close(n1 * Math.sin(state.incidence_angle_deg * Math.PI / 180), n2 * Math.sin(state.refraction_angle_deg * Math.PI / 180), 1e-12);
});

test("parallel_slab produce 1.190 mm e raggio emergente governato dallo stesso i", () => {
  const engine = createSimulationEngine(config("parallel_slab", {
    refractive_index_outside: 1,
    refractive_index_slab: 1.52,
    incidence_angle_final_deg: 30,
    slab_thickness_m: 0.006,
  }));
  const final = engine.setProgress(1);
  close(final.refraction_angle_deg, 19.2048974971294, 1e-11);
  close(final.lateral_displacement_m, 0.0011900102485351782, 1e-14);
});

test("total_internal_reflection calcola correttamente il massimo n2 come caso limite", () => {
  const engine = createSimulationEngine(config("total_internal_reflection", {
    refractive_index_1: 1.333,
    incidence_angle_deg: 75,
  }));
  const final = engine.setProgress(1);
  close(final.refractive_index_2_max, 1.333 * Math.sin(75 * Math.PI / 180), 1e-12);
  close(final.critical_angle_deg, 75, 1e-10);
  assert.equal(final.limiting_refraction_angle_deg, 90);
});

test("concave_mirror ricava p e q da f e ingrandimento positivo", () => {
  const engine = createSimulationEngine(config("concave_mirror", {
    focal_length_m: 0.12,
    magnification: 3,
  }));
  const final = engine.setProgress(1);
  close(final.object_distance_m, 0.08, 1e-12);
  close(final.image_distance_m, -0.24, 1e-12);
  assert.equal(final.image_virtual, true);
  assert.equal(final.image_upright, true);
});

test("concave_mirror non e hardcoded sul caso 12 cm e M=3", () => {
  const engine = createSimulationEngine(config("concave_mirror", {
    focal_length_m: 0.20,
    magnification: 2,
  }));
  const state = engine.getState();
  close(state.object_distance_m, 0.10, 1e-12);
  close(state.image_distance_m, -0.20, 1e-12);
  close(1 / state.focal_length_m, 1 / state.object_distance_m + 1 / state.image_distance_m, 1e-12);
});

test("lifecycle comune funziona anche per costruzioni geometriche", () => {
  const engine = createSimulationEngine(config("total_internal_reflection", {
    refractive_index_1: 1.5,
    incidence_angle_deg: 50,
  }, 4));
  assert.equal(engine.getState().progress, 0);
  assert.equal(engine.play().is_running, true);
  close(engine.advance(1).progress, 0.25);
  assert.equal(engine.pause().is_running, false);
  engine.play();
  assert.equal(engine.advance(10).progress, 1);
  assert.equal(engine.getState().is_running, false);
  assert.equal(engine.reset().progress, 0);
});

test("configurazioni non fisiche vengono rifiutate", () => {
  assert.throws(() => createSimulationEngine(config("single_interface_refraction", {
    vacuum_speed_m_s: 3e8,
    speed_reduction_fraction_final: 1,
  })), /speed_reduction_fraction_final/);
  assert.throws(() => createSimulationEngine(config("parallel_slab", {
    refractive_index_outside: 1,
    refractive_index_slab: 1.5,
    incidence_angle_final_deg: 90,
    slab_thickness_m: 0.006,
  })), /incidence_angle_final_deg/);
  assert.throws(() => createSimulationEngine(config("concave_mirror", {
    focal_length_m: 0.12,
    magnification: 1,
  })), /magnification/);
});

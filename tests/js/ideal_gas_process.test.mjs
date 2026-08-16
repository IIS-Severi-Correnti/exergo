import assert from "node:assert/strict";
import test from "node:test";

import {
  IDEAL_GAS_CONSTANT_J_MOL_K,
  createSimulationEngine,
} from "../../simulazioni/engines/ideal_gas_process/engine.js";

function closeTo(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `atteso ${expected}, trovato ${actual}`);
}

function createConfig(model, parameters, playbackDurationSeconds = 5) {
  return {
    schema_version: 1,
    engine: "ideal_gas_process",
    model,
    parameters,
    interaction: { playback_duration_s: playbackDurationSeconds },
  };
}

const pilotParameters = {
  amount_mol: 0.30,
  temperature_K: 300,
  volume_initial_m3: 0.20,
  volume_final_m3: 0.35,
};

function isothermalConfig(parameters = pilotParameters, duration = 5) {
  return createConfig("reversible_isothermal", parameters, duration);
}

function assertThermodynamicInvariants(state, parameters = pilotParameters) {
  closeTo(
    state.pressure_Pa * state.volume_m3,
    parameters.amount_mol * IDEAL_GAS_CONSTANT_J_MOL_K * parameters.temperature_K,
    1e-8,
  );
  closeTo(state.heat_J, state.work_J);
  assert.equal(state.delta_u_J, 0);
}

test("reversible_isothermal conserva il comportamento dei due esercizi esistenti", () => {
  const engine = createSimulationEngine(isothermalConfig());
  const initial = engine.getState();
  closeTo(initial.pressure_Pa, 3741.5081781689573);
  assert.equal(initial.volume_m3, 0.20);
  assert.equal(initial.work_J, 0);
  assertThermodynamicInvariants(initial);

  const middle = engine.setProgress(0.5);
  closeTo(middle.volume_m3, 0.275);
  closeTo(middle.pressure_Pa, 2721.0968568501507);
  closeTo(middle.work_J, 238.2994478696831);
  assertThermodynamicInvariants(middle);

  const final = engine.setProgress(1);
  closeTo(final.pressure_Pa, 2138.0046732394044);
  closeTo(final.work_J, 418.76140943856973);
  assert.equal(final.is_complete, true);
  assertThermodynamicInvariants(final);
});

test("reversible_isothermal resta generico su dati indipendenti dai pilot", () => {
  const parameters = {
    amount_mol: 1.2,
    temperature_K: 425,
    volume_initial_m3: 0.04,
    volume_final_m3: 0.11,
  };
  const engine = createSimulationEngine(isothermalConfig(parameters, 8));
  const final = engine.setProgress(1);
  closeTo(final.work_J, 1.2 * IDEAL_GAS_CONSTANT_J_MOL_K * 425 * Math.log(0.11 / 0.04));
  assertThermodynamicInvariants(final, parameters);
});

test("process_comparison confronta isocora, isobara e isoterma dallo stesso stato", () => {
  const config = createConfig("process_comparison", {
    amount_mol: 1,
    temperature_initial_K: 300,
    volume_initial_m3: 0.01,
    expansion_ratio: 1.8,
    default_process: "isochoric",
  });
  const engine = createSimulationEngine(config);
  const p0 = IDEAL_GAS_CONSTANT_J_MOL_K * 300 / 0.01;

  const isochoric = engine.setProgress(1);
  assert.equal(isochoric.selected_process, "isochoric");
  closeTo(isochoric.volume_m3, 0.01);
  closeTo(isochoric.temperature_K, 540);
  closeTo(isochoric.pressure_Pa, p0 * 1.8);
  assert.equal(isochoric.work_J, 0);

  engine.dispatch("select_process", { process: "isobaric" });
  const isobaric = engine.getState();
  closeTo(isobaric.volume_m3, 0.018);
  closeTo(isobaric.temperature_K, 540);
  closeTo(isobaric.pressure_Pa, p0);

  engine.dispatch("select_process", { process: "isothermal" });
  const isothermal = engine.getState();
  closeTo(isothermal.volume_m3, 0.018);
  closeTo(isothermal.temperature_K, 300);
  closeTo(isothermal.pressure_Pa, p0 / 1.8);
  closeTo(isothermal.heat_J, isothermal.work_J);
  assert.equal(isothermal.delta_u_J, 0);

  const reset = engine.reset();
  assert.equal(reset.progress, 0);
  assert.equal(reset.selected_process, "isochoric");
});

test("piecewise_isobaric_isothermal riproduce A-B-C senza inventare la pressione assoluta", () => {
  const engine = createSimulationEngine(createConfig("piecewise_isobaric_isothermal", {
    volume_A_m3: 0.002,
    volume_compression_m3: 0.0007,
    temperature_A_K: 288,
    pressure_C_over_B_ratio: 0.5,
  }));

  const B = engine.setProgress(0.5);
  closeTo(B.volume_m3, 0.0013);
  closeTo(B.temperature_K, 187.2);
  closeTo(B.pressure_ratio, 1);
  assert.equal(B.pressure_Pa, null);

  const C = engine.setProgress(1);
  closeTo(C.volume_m3, 0.0026);
  closeTo(C.temperature_K, 187.2);
  closeTo(C.pressure_ratio, 0.5);
  assert.equal(C.phase, "C");
});

test("thermodynamic_cycle chiude il percorso e rende Qnet=Lnet in coordinate normalizzate", () => {
  const engine = createSimulationEngine(createConfig("thermodynamic_cycle", {
    volume_low_ratio: 1,
    volume_high_ratio: 2,
    pressure_low_ratio: 1,
    pressure_high_ratio: 2,
    orientation: "clockwise",
  }));

  const quarter = engine.setProgress(0.25);
  closeTo(quarter.volume_ratio, 1);
  closeTo(quarter.pressure_ratio, 2);
  assert.equal(quarter.phase, "B→C");

  const fourthSide = engine.setProgress(0.875);
  assert.equal(fourthSide.phase, "D→A");

  const final = engine.setProgress(1);
  closeTo(final.volume_ratio, 1);
  closeTo(final.pressure_ratio, 1);
  assert.equal(final.cycle_delta_u_normalized, 0);
  assert.equal(final.cycle_net_work_normalized, 1);
  assert.equal(final.cycle_net_heat_normalized, 1);
});

test("thermodynamic_cycle cambia segno del lavoro e le etichette invertendo l'orientazione", () => {
  const engine = createSimulationEngine(createConfig("thermodynamic_cycle", {
    volume_low_ratio: 2,
    volume_high_ratio: 5,
    pressure_low_ratio: 1.5,
    pressure_high_ratio: 4,
    orientation: "counterclockwise",
  }));
  closeTo(engine.getState().cycle_net_work_normalized, -7.5);
  assert.equal(engine.setProgress(0.125).phase, "A→D");
  assert.equal(engine.setProgress(0.875).phase, "B→A");
});

test("isochoric_monoatomic usa solo V e Delta p e arriva a 252 J", () => {
  const engine = createSimulationEngine(createConfig("isochoric_monoatomic", {
    volume_m3: 0.06,
    pressure_increase_final_Pa: 2800,
  }));
  const middle = engine.setProgress(0.5);
  closeTo(middle.pressure_change_Pa, 1400);
  closeTo(middle.delta_u_J, 126);
  assert.equal(middle.work_J, 0);
  closeTo(middle.heat_J, 126);

  const final = engine.setProgress(1);
  closeTo(final.delta_u_J, 252);
  closeTo(final.heat_J, 252);
  assert.equal(final.pressure_Pa, null);
  assert.equal(final.temperature_K, null);
});

test("lifecycle comune resta condiviso tra tutti i modelli", () => {
  const engine = createSimulationEngine(isothermalConfig(pilotParameters, 4));
  engine.advance(1);
  assert.equal(engine.getState().progress, 0);
  assert.equal(engine.play().is_running, true);
  closeTo(engine.advance(1).progress, 0.25);
  assert.equal(engine.pause().is_running, false);
  engine.play();
  assert.equal(engine.advance(10).progress, 1);
  assert.equal(engine.getState().is_running, false);
  assert.equal(engine.dispatch("reset").progress, 0);
});

test("rifiuta configurazioni fisicamente incompatibili con il modello selezionato", () => {
  assert.throws(
    () => createSimulationEngine(isothermalConfig({ ...pilotParameters, volume_final_m3: 0.1 })),
    /volume_final_m3/,
  );
  assert.throws(
    () => createSimulationEngine(createConfig("piecewise_isobaric_isothermal", {
      volume_A_m3: 0.002,
      volume_compression_m3: 0.002,
      temperature_A_K: 288,
      pressure_C_over_B_ratio: 0.5,
    })),
    /volume_compression_m3/,
  );
  assert.throws(
    () => createSimulationEngine(createConfig("thermodynamic_cycle", {
      volume_low_ratio: 2,
      volume_high_ratio: 1,
      pressure_low_ratio: 1,
      pressure_high_ratio: 2,
      orientation: "clockwise",
    })),
    /volume_high_ratio/,
  );
  assert.throws(
    () => createSimulationEngine(createConfig("isochoric_monoatomic", {
      volume_m3: 0.06,
      pressure_increase_final_Pa: -1,
    })),
    /pressure_increase_final_Pa/,
  );
  const engine = createSimulationEngine(isothermalConfig());
  assert.throws(() => engine.dispatch("unknown"), /azione non supportata/);
  assert.throws(() => engine.dispatch("set_progress"), /payload/);
});

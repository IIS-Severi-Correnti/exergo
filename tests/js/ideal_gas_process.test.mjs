import assert from "node:assert/strict";
import test from "node:test";

import {
  IDEAL_GAS_CONSTANT_J_MOL_K,
  createSimulationEngine,
} from "../../simulazioni/engines/ideal_gas_process/engine.js";

function closeTo(actual, expected, tolerance = 1e-9) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `atteso ${expected}, trovato ${actual}`,
  );
}

function createConfig(parameters, playbackDurationSeconds = 5) {
  return {
    schema_version: 1,
    engine: "ideal_gas_process",
    model: "reversible_isothermal",
    parameters,
    interaction: {
      playback_duration_s: playbackDurationSeconds,
    },
  };
}

const pilotParameters = {
  amount_mol: 0.30,
  temperature_K: 300,
  volume_initial_m3: 0.20,
  volume_final_m3: 0.35,
};

function assertThermodynamicInvariants(state, parameters = pilotParameters) {
  closeTo(
    state.pressure_Pa * state.volume_m3,
    parameters.amount_mol * IDEAL_GAS_CONSTANT_J_MOL_K * parameters.temperature_K,
    1e-8,
  );
  closeTo(state.heat_J, state.work_J);
  assert.equal(state.delta_u_J, 0);
}

test("stato iniziale del pilot", () => {
  const engine = createSimulationEngine(createConfig(pilotParameters));
  const state = engine.getState();

  assert.equal(state.progress, 0);
  assert.equal(state.volume_m3, 0.20);
  closeTo(state.pressure_Pa, 3741.5081781689573);
  assert.equal(state.work_J, 0);
  assert.equal(state.heat_J, 0);
  assert.equal(state.is_running, false);
  assert.equal(state.is_complete, false);
  assertThermodynamicInvariants(state);
});

test("stato intermedio ottenuto tramite scrubbing", () => {
  const engine = createSimulationEngine(createConfig(pilotParameters));
  const state = engine.dispatch("set_progress", { progress: 0.5 });

  assert.equal(state.progress, 0.5);
  closeTo(state.volume_m3, 0.275);
  closeTo(state.pressure_Pa, 2721.0968568501507);
  closeTo(state.work_J, 238.2994478696831);
  assertThermodynamicInvariants(state);
});

test("stato finale e valori di riferimento", () => {
  const engine = createSimulationEngine(createConfig(pilotParameters));
  const state = engine.setProgress(1);

  assert.equal(state.volume_m3, 0.35);
  closeTo(state.pressure_Pa, 2138.0046732394044);
  closeTo(state.work_J, 418.76140943856973);
  closeTo(state.heat_J, 418.76140943856973);
  assert.equal(state.delta_u_J, 0);
  assert.equal(state.is_complete, true);
  assert.equal(state.is_running, false);
  assertThermodynamicInvariants(state);
});

test("volume, pressione, lavoro e calore sono monotoni lungo l'espansione", () => {
  const engine = createSimulationEngine(createConfig(pilotParameters));
  let previous = engine.getState();

  for (let step = 1; step <= 20; step += 1) {
    const state = engine.setProgress(step / 20);
    assert.ok(state.volume_m3 > previous.volume_m3);
    assert.ok(state.pressure_Pa < previous.pressure_Pa);
    assert.ok(state.work_J > previous.work_J);
    assert.ok(state.heat_J > previous.heat_J);
    assertThermodynamicInvariants(state);
    previous = state;
  }
});

test("play, pausa, avanzamento, completamento e reset", () => {
  const engine = createSimulationEngine(createConfig(pilotParameters, 4));

  engine.advance(1);
  assert.equal(engine.getState().progress, 0);
  assert.equal(engine.play().is_running, true);
  closeTo(engine.advance(1).progress, 0.25);
  assert.equal(engine.pause().is_running, false);
  engine.advance(1);
  closeTo(engine.getState().progress, 0.25);

  engine.play();
  const final = engine.advance(10);
  assert.equal(final.progress, 1);
  assert.equal(final.is_running, false);
  assert.equal(final.is_complete, true);

  const reset = engine.dispatch("reset");
  assert.equal(reset.progress, 0);
  assert.equal(reset.volume_m3, pilotParameters.volume_initial_m3);
  assert.equal(reset.is_running, false);
  assert.equal(reset.is_complete, false);
});

test("lo stesso engine riusa una configurazione numerica alternativa", () => {
  const alternative = {
    amount_mol: 1.2,
    temperature_K: 425,
    volume_initial_m3: 0.04,
    volume_final_m3: 0.11,
  };
  const engine = createSimulationEngine(createConfig(alternative, 8));
  const initial = engine.getState();
  const final = engine.setProgress(1);

  closeTo(initial.pressure_Pa, 1.2 * IDEAL_GAS_CONSTANT_J_MOL_K * 425 / 0.04);
  closeTo(
    final.work_J,
    1.2 * IDEAL_GAS_CONSTANT_J_MOL_K * 425 * Math.log(0.11 / 0.04),
  );
  assertThermodynamicInvariants(initial, alternative);
  assertThermodynamicInvariants(final, alternative);
});

test("rifiuta configurazioni fisicamente non valide e azioni sconosciute", () => {
  assert.throws(
    () => createSimulationEngine(createConfig({ ...pilotParameters, volume_final_m3: 0.1 })),
    /volume_final_m3/,
  );
  const engine = createSimulationEngine(createConfig(pilotParameters));
  assert.throws(() => engine.dispatch("unknown"), /azione non supportata/);
  assert.throws(() => engine.dispatch("set_progress"), /payload/);
});

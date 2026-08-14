import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateParticipantMomentOfInertia,
  calculatePlatformMomentOfInertia,
  createSimulationEngine,
} from "../../simulazioni/engines/rotational_platform/engine.js";
import {
  participantSlotAngle,
  resolveParticipantDidactics,
} from "../../simulazioni/engines/rotational_platform/view.js";


function closeTo(actual, expected, tolerance = 1e-10) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    "atteso " + expected + ", trovato " + actual,
  );
}

function configWith(parameters) {
  return {
    schema_version: 1,
    engine: "rotational_platform",
    model: "textbook_reduced_system",
    parameters,
  };
}

const pilotParameters = {
  platform_mass_kg: 200,
  platform_radius_m: 1.0,
  participant_count: 6,
  participant_mass_kg: 50,
  participant_radius_m: 0.85,
  omega_initial_rad_s: 1.8,
  omega_target_rad_s: 2.34,
  omega_target_tolerance_rad_s: 0.02,
};

const secondExerciseParameters = {
  platform_mass_kg: 240,
  platform_radius_m: 1.5,
  participant_count: 8,
  participant_mass_kg: 50,
  participant_radius_m: 1.2,
  omega_initial_rad_s: 1.0,
  omega_target_rad_s: 1.2,
  omega_target_tolerance_rad_s: 0.01,
};

test("calcola i valori del caso pilota", () => {
  closeTo(calculatePlatformMomentOfInertia(pilotParameters), 100);
  closeTo(calculateParticipantMomentOfInertia(pilotParameters), 36.125);

  const engine = createSimulationEngine(configWith(pilotParameters));
  const initial = engine.getState();
  closeTo(initial.total_moment_of_inertia_kg_m2, 316.75);
  closeTo(initial.reference_angular_momentum_kg_m2_s, 570.15);

  engine.removeParticipant();
  engine.removeParticipant();
  const afterTwoLeave = engine.getState();
  closeTo(afterTwoLeave.total_moment_of_inertia_kg_m2, 244.5);
  closeTo(afterTwoLeave.omega_rad_s, 2.3319018404907974);
  assert.equal(afterTwoLeave.target_reached, true);
});

test("riusa lo stesso motore per il secondo esercizio pubblicato", () => {
  closeTo(calculatePlatformMomentOfInertia(secondExerciseParameters), 270);
  closeTo(calculateParticipantMomentOfInertia(secondExerciseParameters), 72);

  const engine = createSimulationEngine(configWith(secondExerciseParameters));
  const initial = engine.getState();
  closeTo(initial.total_moment_of_inertia_kg_m2, 846);
  closeTo(initial.reference_angular_momentum_kg_m2_s, 846);
  closeTo(initial.omega_rad_s, 1.0);

  engine.removeParticipant();
  engine.removeParticipant();
  const afterTwoLeave = engine.getState();
  assert.equal(afterTwoLeave.participant_count_current, 6);
  closeTo(afterTwoLeave.total_moment_of_inertia_kg_m2, 702);
  closeTo(afterTwoLeave.omega_rad_s, 846 / 702);
  assert.equal(afterTwoLeave.target_reached, true);
});

test("riusa il motore con parametri completamente diversi", () => {
  const parameters = {
    platform_mass_kg: 500,
    platform_radius_m: 2,
    participant_count: 10,
    participant_mass_kg: 65,
    participant_radius_m: 1.6,
    omega_initial_rad_s: 0.8,
    omega_target_rad_s: 0.98,
    omega_target_tolerance_rad_s: 0.01,
  };
  const engine = createSimulationEngine(configWith(parameters));
  const initial = engine.getState();
  closeTo(initial.platform_moment_of_inertia_kg_m2, 1000);
  closeTo(initial.participant_moment_of_inertia_kg_m2, 166.4);
  closeTo(initial.total_moment_of_inertia_kg_m2, 2664);
  closeTo(initial.reference_angular_momentum_kg_m2_s, 2131.2);
  closeTo(initial.omega_rad_s, 0.8);

  engine.removeParticipant();
  engine.removeParticipant();
  engine.removeParticipant();
  const changed = engine.getState();
  assert.equal(changed.participant_count_current, 7);
  closeTo(changed.total_moment_of_inertia_kg_m2, 2164.8);
  closeTo(changed.omega_rad_s, 2131.2 / 2164.8);
});

test("gestisce rimozioni, limite a zero e reset esatto", () => {
  const engine = createSimulationEngine(configWith(pilotParameters));

  const firstRemoval = engine.removeParticipant();
  assert.equal(firstRemoval.removed, true);
  assert.equal(firstRemoval.removed_index, 5);
  assert.equal(engine.getState().participant_count_current, 5);

  for (let index = 0; index < 5; index += 1) {
    engine.removeParticipant();
  }
  assert.equal(engine.getState().participant_count_current, 0);
  const extraRemoval = engine.removeParticipant();
  assert.equal(extraRemoval.removed, false);
  assert.equal(engine.getState().participant_count_current, 0);

  engine.play();
  engine.advance(0.5);
  assert.notEqual(engine.getState().angle_rad, 0);
  const resetState = engine.reset();
  assert.equal(resetState.participant_count_current, 6);
  assert.equal(resetState.participant_count_removed, 0);
  assert.equal(resetState.angle_rad, 0);
  assert.equal(resetState.is_running, false);
  closeTo(resetState.omega_rad_s, 1.8);
});

test("gli slot angolari restano ancorati alla configurazione iniziale", () => {
  const initialCount = 6;
  const initialAngles = Array.from(
    { length: initialCount },
    (_, index) => participantSlotAngle(index, initialCount),
  );

  closeTo(initialAngles[0], -Math.PI / 2);
  closeTo(initialAngles[1] - initialAngles[0], Math.PI / 3);
  closeTo(initialAngles[4], participantSlotAngle(4, 6));
  assert.notEqual(participantSlotAngle(4, 6), (4 / 5) * 2 * Math.PI - Math.PI / 2);
});

test("la copia didattica e configurabile senza cambiare il motore", () => {
  const students = resolveParticipantDidactics({
    participant_singular_it: "studente",
    participant_plural_it: "studenti",
    participant_count_label_it: "Studenti rimasti",
    remove_action_label_it: "Uno studente scende",
    learning_action_it: "fai scendere uno studente alla volta",
  });
  assert.equal(students.singular, "studente");
  assert.equal(students.plural, "studenti");
  assert.equal(students.countLabel, "Studenti rimasti");
  assert.equal(students.removeAction, "Uno studente scende");

  const defaults = resolveParticipantDidactics();
  assert.equal(defaults.singular, "persona");
  assert.equal(defaults.plural, "persone");
});

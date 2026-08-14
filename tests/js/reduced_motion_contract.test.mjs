import assert from "node:assert/strict";
import test from "node:test";

import { bindSimulationControls } from "../../simulazioni/core/controls.js";

function fakeButton() {
  const listeners = new Map();
  return {
    disabled: false,
    hidden: false,
    title: "",
    attributes: new Map(),
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    removeEventListener(type) {
      listeners.delete(type);
    },
    setAttribute(name, value) {
      this.attributes.set(name, value);
      if (name === "hidden") this.hidden = true;
    },
  };
}

function fakeRoot(buttons) {
  return {
    querySelector(selector) {
      const match = selector.match(/data-simulation-action="([^"]+)"/);
      return match ? buttons[match[1]] ?? null : null;
    },
  };
}

test("riduzione movimento disabilita play e pausa senza bloccare le altre azioni", () => {
  const buttons = {
    play: fakeButton(),
    pause: fakeButton(),
    reset: fakeButton(),
    remove: fakeButton(),
  };
  const controls = bindSimulationControls(
    fakeRoot(buttons),
    {
      play() {},
      pause() {},
      reset() {},
      removeParticipant() {},
    },
    {
      allow_pause: true,
      allow_reset: true,
      allow_remove_participant: true,
    },
  );

  controls.update(
    { is_running: false, participant_count_current: 4 },
    { motionAllowed: false },
  );

  assert.equal(buttons.play.disabled, true);
  assert.equal(buttons.pause.disabled, true);
  assert.equal(buttons.reset.disabled, false);
  assert.equal(buttons.remove.disabled, false);
  assert.match(buttons.play.title, /riduzione del movimento/);
});

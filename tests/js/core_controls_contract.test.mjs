import assert from "node:assert/strict";
import test from "node:test";

import { bindSimulationControls } from "../../simulazioni/core/controls.js";

function fakeControl(action, eventName = "click") {
  const listeners = new Map();
  return {
    dataset: {
      simulationAction: action,
      simulationEvent: eventName,
    },
    disabled: false,
    hidden: false,
    title: "",
    value: "0",
    attributes: new Map(),
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    removeEventListener(type) {
      listeners.delete(type);
    },
    emit(type) {
      listeners.get(type)?.({ type });
    },
    toggleAttribute(name, enabled) {
      if (enabled) this.attributes.set(name, "");
      else this.attributes.delete(name);
      if (name === "hidden") this.hidden = enabled;
    },
    setAttribute(name, value) {
      this.attributes.set(name, String(value));
    },
    removeAttribute(name) {
      this.attributes.delete(name);
    },
  };
}

test("il core inoltra azioni opache e applica descrittori generici", () => {
  const play = fakeControl("play");
  const scrubber = fakeControl("seek_to_state", "input");
  scrubber.value = "375";
  const dispatched = [];
  const controls = bindSimulationControls(
    { querySelectorAll: () => [play, scrubber] },
    {
      dispatch(action, payload) {
        dispatched.push({ action, payload });
      },
      resolvePayload({ action, control }) {
        return action === "seek_to_state" ? { position: Number(control.value) } : undefined;
      },
    },
  );

  controls.update({
    play: {
      disabled: true,
      title: "Movimento ridotto",
    },
    seek_to_state: {
      disabled: false,
      value: 625,
      ariaValueText: "62,5 per cento",
    },
  });

  assert.equal(play.disabled, true);
  assert.equal(play.title, "Movimento ridotto");
  assert.equal(scrubber.disabled, false);
  assert.equal(scrubber.value, "625");
  assert.equal(scrubber.attributes.get("aria-valuetext"), "62,5 per cento");

  play.emit("click");
  scrubber.emit("input");
  assert.deepEqual(dispatched, [
    { action: "play", payload: undefined },
    { action: "seek_to_state", payload: { position: 625 } },
  ]);

  controls.destroy();
});

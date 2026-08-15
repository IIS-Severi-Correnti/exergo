/** Collega controlli dichiarativi ad azioni opache per il core. */

function controlsWithActions(root) {
  return Array.from(root.querySelectorAll("[data-simulation-action]"));
}

function applyDescriptor(control, descriptor) {
  if (!descriptor || typeof descriptor !== "object") {
    return;
  }

  if (Object.hasOwn(descriptor, "disabled")) {
    control.disabled = Boolean(descriptor.disabled);
  }
  if (Object.hasOwn(descriptor, "hidden")) {
    control.toggleAttribute("hidden", Boolean(descriptor.hidden));
  }
  if (Object.hasOwn(descriptor, "title")) {
    control.title = descriptor.title ?? "";
  }
  if (Object.hasOwn(descriptor, "value") && control.value !== String(descriptor.value)) {
    control.value = String(descriptor.value);
  }
  if (Object.hasOwn(descriptor, "ariaValueText")) {
    if (descriptor.ariaValueText) {
      control.setAttribute("aria-valuetext", descriptor.ariaValueText);
    } else {
      control.removeAttribute("aria-valuetext");
    }
  }
}

export function bindSimulationControls(
  root,
  { dispatch, resolvePayload = () => undefined } = {},
) {
  if (typeof dispatch !== "function") {
    throw new TypeError("dispatch deve essere una funzione");
  }

  const controls = controlsWithActions(root);
  const listeners = [];

  for (const control of controls) {
    const action = control.dataset.simulationAction;
    const eventName = control.dataset.simulationEvent || "click";
    const listener = (event) => {
      const payload = resolvePayload({ action, control, event });
      dispatch(action, payload);
    };
    control.addEventListener(eventName, listener);
    listeners.push(() => control.removeEventListener(eventName, listener));
  }

  return Object.freeze({
    update(descriptors = {}) {
      for (const control of controls) {
        applyDescriptor(control, descriptors[control.dataset.simulationAction]);
      }
    },

    destroy() {
      for (const removeListener of listeners) {
        removeListener();
      }
    },
  });
}

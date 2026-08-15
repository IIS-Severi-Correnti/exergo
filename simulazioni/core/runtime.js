import { bindSimulationControls } from "./controls.js";
import { loadSimulationEngine } from "./registry.js";

async function readConfiguration(url) {
  const response = await fetch(url, { credentials: "same-origin" });
  if (!response.ok) {
    throw new Error(`configurazione non caricata (${response.status})`);
  }
  return response.json();
}

function showInitializationError(container, error) {
  container.classList.add("simulation-failed");
  const message = container.querySelector("[data-simulation-error]");
  if (message) {
    message.hidden = false;
    message.textContent = `Simulazione non disponibile: ${error.message}`;
  }
  console.error("Exergo simulation initialization failed", error);
}

function validateEngineContract(engine) {
  for (const method of ["getState", "advance", "pause", "dispatch"]) {
    if (typeof engine?.[method] !== "function") {
      throw new TypeError(`contratto engine incompleto: manca ${method}()`);
    }
  }
}

export async function initializeSimulation(container) {
  const engineName = container.dataset.simulationEngine;
  const configUrl = container.dataset.simulationConfig;
  if (!engineName || !configUrl) {
    throw new Error("attributi data-simulation-engine/config mancanti");
  }

  const [config, modules] = await Promise.all([
    readConfiguration(configUrl),
    loadSimulationEngine(engineName),
  ]);
  if (config.engine !== engineName) {
    throw new Error(
      `il motore della configurazione (${String(config.engine)}) non corrisponde a ${engineName}`,
    );
  }

  const engine = modules.engineModule.createSimulationEngine(config);
  validateEngineContract(engine);
  const view = modules.viewModule.createSimulationView({ container, config });
  let frameId = null;
  let previousTimestamp = null;
  let controls;

  function stopAnimationFrame() {
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
    previousTimestamp = null;
  }

  function render() {
    const state = engine.getState();
    view.render(state);
    const descriptors = view.describeControls?.(state, {
      motionAllowed: view.motionAllowed,
    });
    controls?.update(descriptors);
    return state;
  }

  function animationFrame(timestamp) {
    frameId = null;
    if (!view.motionAllowed) {
      engine.pause();
      stopAnimationFrame();
      render();
      return;
    }
    if (previousTimestamp === null) {
      previousTimestamp = timestamp;
    } else {
      engine.advance((timestamp - previousTimestamp) / 1000);
      previousTimestamp = timestamp;
    }
    const state = render();
    if (state.is_running) {
      frameId = requestAnimationFrame(animationFrame);
    }
  }

  function synchronizeAnimation(state) {
    if (!view.motionAllowed || !state.is_running) {
      if (!view.motionAllowed && state.is_running) {
        engine.pause();
        state = render();
      }
      stopAnimationFrame();
      return state;
    }
    if (frameId === null) {
      frameId = requestAnimationFrame(animationFrame);
    }
    return state;
  }

  function dispatch(action, payload) {
    const previousState = engine.getState();
    const result = engine.dispatch(action, payload);
    view.handleActionResult?.({ action, payload, previousState, result });
    return synchronizeAnimation(render());
  }

  controls = bindSimulationControls(container, {
    dispatch,
    resolvePayload: (context) => view.resolveActionPayload?.(context),
  });

  view.onMotionPreferenceChange?.(() => {
    if (!view.motionAllowed) {
      engine.pause();
      stopAnimationFrame();
    }
    render();
  });

  render();
  container.dataset.simulationReady = "true";
  return Object.freeze({ engine, view, controls, dispatch });
}

export async function initializeSimulations(root = document) {
  const containers = Array.from(root.querySelectorAll("[data-exergo-simulation]"));
  await Promise.all(
    containers.map(async (container) => {
      try {
        await initializeSimulation(container);
      } catch (error) {
        showInitializationError(container, error);
      }
    }),
  );
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => initializeSimulations(), { once: true });
} else {
  initializeSimulations();
}

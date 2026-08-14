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
    controls?.update(state);
    return state;
  }

  function animationFrame(timestamp) {
    frameId = null;
    if (previousTimestamp === null) {
      previousTimestamp = timestamp;
    } else {
      engine.advance((timestamp - previousTimestamp) / 1000);
      previousTimestamp = timestamp;
    }
    const state = render();
    if (state.is_running && view.motionAllowed) {
      frameId = requestAnimationFrame(animationFrame);
    }
  }

  function startAnimationFrame() {
    if (view.motionAllowed && frameId === null) {
      frameId = requestAnimationFrame(animationFrame);
    }
  }

  controls = bindSimulationControls(
    container,
    {
      play() {
        engine.play();
        render();
        startAnimationFrame();
      },
      pause() {
        engine.pause();
        stopAnimationFrame();
        render();
      },
      reset() {
        stopAnimationFrame();
        engine.reset();
        view.resetMotion();
        render();
      },
      removeParticipant() {
        const previousState = engine.getState();
        const result = engine.removeParticipant();
        if (result.removed) {
          view.animateParticipantDeparture(result.removed_index, previousState);
        }
        render();
      },
    },
    config.interaction,
  );

  render();
  container.dataset.simulationReady = "true";
  return Object.freeze({ engine, view, controls });
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

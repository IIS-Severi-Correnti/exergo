/** Registro esplicito dei motori disponibili nel runtime statico. */

const registry = new Map();

export function registerSimulationEngine(name, loaders) {
  if (registry.has(name)) {
    throw new Error(`motore gia registrato: ${name}`);
  }
  registry.set(name, Object.freeze({ ...loaders }));
}

registerSimulationEngine("rotational_platform", {
  loadEngine: () => import("../engines/rotational_platform/engine.js"),
  loadView: () => import("../engines/rotational_platform/view.js"),
});

registerSimulationEngine("ideal_gas_process", {
  loadEngine: () => import("../engines/ideal_gas_process/engine.js"),
  loadView: () => import("../engines/ideal_gas_process/view.js"),
});

export async function loadSimulationEngine(name) {
  const loaders = registry.get(name);
  if (!loaders) {
    throw new Error(`motore non registrato: ${name}`);
  }

  const [engineModule, viewModule] = await Promise.all([
    loaders.loadEngine(),
    loaders.loadView(),
  ]);
  if (typeof engineModule.createSimulationEngine !== "function") {
    throw new Error(`il motore ${name} non esporta createSimulationEngine`);
  }
  if (typeof viewModule.createSimulationView !== "function") {
    throw new Error(`la view ${name} non esporta createSimulationView`);
  }
  return Object.freeze({ engineModule, viewModule });
}

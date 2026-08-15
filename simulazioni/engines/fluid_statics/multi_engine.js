import { createSimulationEngine as createBaseFluidStaticsEngine } from "./engine.js";
import { createApparentWeightEngine } from "./apparent_weight_engine.js";

export function createSimulationEngine(config) {
  if (config?.model === "buoyancy_apparent_weight") {
    return createApparentWeightEngine(config);
  }
  return createBaseFluidStaticsEngine(config);
}

import { createSimulationView as createHydrostaticColumnView } from "./view.js";
import { createSimulationView as createFloatingBodyView } from "./floating_view.js";
import { createSimulationView as createApparentWeightView } from "./apparent_weight_view.js";
import { createSimulationView as createPressurePointsView } from "./pressure_points_view.js";

export function createSimulationView(context) {
  if (context.config.model === "hydrostatic_column") {
    return createHydrostaticColumnView(context);
  }
  if (context.config.model === "floating_body") {
    return createFloatingBodyView(context);
  }
  if (context.config.model === "buoyancy_apparent_weight") {
    return createApparentWeightView(context);
  }
  if (context.config.model === "hydrostatic_pressure_points") {
    return createPressurePointsView(context);
  }
  throw new RangeError(
    `view non disponibile per il modello: ${String(context.config.model)}`,
  );
}

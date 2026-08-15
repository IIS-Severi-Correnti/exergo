import { createSimulationView as createHydrostaticColumnView } from "./view.js";
import { createSimulationView as createFloatingBodyView } from "./floating_view.js";

export function createSimulationView(context) {
  if (context.config.model === "hydrostatic_column") {
    return createHydrostaticColumnView(context);
  }
  if (context.config.model === "floating_body") {
    return createFloatingBodyView(context);
  }
  throw new RangeError(
    `view non disponibile per il modello: ${String(context.config.model)}`,
  );
}

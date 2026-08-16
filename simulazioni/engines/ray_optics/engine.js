export const ENGINE_NAME = "ray_optics";
export const SUPPORTED_SCHEMA_VERSION = 1;

function number(value, name, { positive = false, nonNegative = false } = {}) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError(`${name} deve essere finito`);
  if (positive && value <= 0) throw new RangeError(`${name} deve essere > 0`);
  if (nonNegative && value < 0) throw new RangeError(`${name} deve essere >= 0`);
  return value;
}

function object(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${name} deve essere un oggetto`);
  return value;
}

function clamp01(value) {
  number(value, "progress");
  return Math.min(1, Math.max(0, value));
}

function degToRad(degrees) { return degrees * Math.PI / 180; }
function radToDeg(radians) { return radians * 180 / Math.PI; }
function sinDeg(degrees) { return Math.sin(degToRad(degrees)); }
function asinDeg(value) { return radToDeg(Math.asin(Math.min(1, Math.max(-1, value)))); }

function validateAngle(value, name, { allowZero = true } = {}) {
  number(value, name);
  if ((allowZero ? value < 0 : value <= 0) || value >= 90) throw new RangeError(`${name} deve essere tra ${allowZero ? 0 : 0} e 90 gradi`);
}

function speedIndex(parameters) {
  number(parameters.vacuum_speed_m_s, "vacuum_speed_m_s", { positive: true });
  number(parameters.speed_reduction_fraction_final, "speed_reduction_fraction_final", { positive: true });
  if (parameters.speed_reduction_fraction_final >= 1) throw new RangeError("speed_reduction_fraction_final deve essere < 1");
  return {
    derive(progress) {
      const reduction = parameters.speed_reduction_fraction_final * progress;
      const speed = parameters.vacuum_speed_m_s * (1 - reduction);
      return Object.freeze({
        reduction_fraction: reduction,
        vacuum_speed_m_s: parameters.vacuum_speed_m_s,
        medium_speed_m_s: speed,
        refractive_index: parameters.vacuum_speed_m_s / speed,
        phase: "definizione indice",
      });
    },
  };
}

function snellRefraction(parameters) {
  number(parameters.refractive_index_1, "refractive_index_1", { positive: true });
  validateAngle(parameters.incidence_angle_final_deg, "incidence_angle_final_deg", { allowZero: false });
  validateAngle(parameters.refraction_angle_final_deg, "refraction_angle_final_deg", { allowZero: false });
  number(parameters.vacuum_speed_m_s, "vacuum_speed_m_s", { positive: true });
  const n2 = parameters.refractive_index_1 * sinDeg(parameters.incidence_angle_final_deg) / sinDeg(parameters.refraction_angle_final_deg);
  if (n2 <= 0) throw new RangeError("indice rifratto non fisico");
  return {
    derive(progress) {
      const incidence = parameters.incidence_angle_final_deg * progress;
      const sineR = parameters.refractive_index_1 * sinDeg(incidence) / n2;
      const refraction = asinDeg(sineR);
      return Object.freeze({
        refractive_index_1: parameters.refractive_index_1,
        refractive_index_2: n2,
        incidence_angle_deg: incidence,
        refraction_angle_deg: refraction,
        medium_speed_m_s: parameters.vacuum_speed_m_s / n2,
        vacuum_speed_m_s: parameters.vacuum_speed_m_s,
        phase: "rifrazione",
      });
    },
  };
}

function parallelSlab(parameters) {
  number(parameters.refractive_index_outside, "refractive_index_outside", { positive: true });
  number(parameters.refractive_index_slab, "refractive_index_slab", { positive: true });
  validateAngle(parameters.incidence_angle_final_deg, "incidence_angle_final_deg");
  number(parameters.slab_thickness_m, "slab_thickness_m", { positive: true });
  return {
    derive(progress) {
      const incidence = parameters.incidence_angle_final_deg * progress;
      const refraction = asinDeg(parameters.refractive_index_outside * sinDeg(incidence) / parameters.refractive_index_slab);
      const displacement = parameters.slab_thickness_m * sinDeg(incidence - refraction) / Math.cos(degToRad(refraction));
      return Object.freeze({
        refractive_index_outside: parameters.refractive_index_outside,
        refractive_index_slab: parameters.refractive_index_slab,
        incidence_angle_deg: incidence,
        refraction_angle_deg: refraction,
        slab_thickness_m: parameters.slab_thickness_m,
        lateral_displacement_m: displacement,
        phase: "lastra parallela",
      });
    },
  };
}

function totalInternalReflection(parameters) {
  number(parameters.refractive_index_1, "refractive_index_1", { positive: true });
  validateAngle(parameters.incidence_angle_deg, "incidence_angle_deg", { allowZero: false });
  const n2max = parameters.refractive_index_1 * sinDeg(parameters.incidence_angle_deg);
  const criticalAtLimit = asinDeg(n2max / parameters.refractive_index_1);
  return {
    derive(progress) {
      return Object.freeze({
        refractive_index_1: parameters.refractive_index_1,
        incidence_angle_deg: parameters.incidence_angle_deg,
        refractive_index_2_max: n2max,
        critical_angle_deg: criticalAtLimit,
        construction_progress: progress,
        limiting_refraction_angle_deg: 90,
        phase: progress < 0.5 ? "condizione limite" : "riflessione totale",
      });
    },
  };
}

function concaveMirror(parameters) {
  number(parameters.focal_length_m, "focal_length_m", { positive: true });
  number(parameters.magnification, "magnification", { positive: true });
  if (parameters.magnification <= 1) throw new RangeError("magnification deve essere > 1 per l'immagine diritta ingrandita");
  const objectDistance = parameters.focal_length_m * (parameters.magnification - 1) / parameters.magnification;
  const imageDistance = -parameters.magnification * objectDistance;
  return {
    derive(progress) {
      return Object.freeze({
        focal_length_m: parameters.focal_length_m,
        magnification: parameters.magnification,
        object_distance_m: objectDistance,
        image_distance_m: imageDistance,
        image_virtual: imageDistance < 0,
        image_upright: parameters.magnification > 0,
        construction_progress: progress,
        phase: progress < 1 / 3 ? "oggetto e fuoco" : progress < 2 / 3 ? "raggi principali" : "immagine virtuale",
      });
    },
  };
}

const FACTORIES = Object.freeze({
  single_interface_refraction: speedIndex,
  snell_refraction: snellRefraction,
  parallel_slab: parallelSlab,
  total_internal_reflection: totalInternalReflection,
  concave_mirror: concaveMirror,
});

export function createSimulationEngine(config) {
  object(config, "config");
  if (config.schema_version !== SUPPORTED_SCHEMA_VERSION) throw new RangeError(`schema_version non supportata: ${config.schema_version}`);
  if (config.engine !== ENGINE_NAME) throw new RangeError(`configurazione destinata a un altro motore: ${config.engine}`);
  object(config.parameters, "parameters");
  object(config.interaction, "interaction");
  number(config.interaction.playback_duration_s, "playback_duration_s", { positive: true });
  const factory = FACTORIES[config.model];
  if (!factory) throw new RangeError(`modello non supportato: ${config.model}`);
  const model = factory(Object.freeze({ ...config.parameters }));
  let progress = 0;
  let running = false;

  function getState() {
    return Object.freeze({ model: config.model, progress, is_running: running, is_complete: progress >= 1, ...model.derive(progress) });
  }
  function setProgress(next) {
    progress = clamp01(next);
    if (progress >= 1) running = false;
    return getState();
  }
  function play() { running = progress < 1; return getState(); }
  function pause() { running = false; return getState(); }
  function reset() { progress = 0; running = false; return getState(); }
  function advance(deltaSeconds) {
    number(deltaSeconds, "deltaSeconds", { nonNegative: true });
    if (running) setProgress(progress + deltaSeconds / config.interaction.playback_duration_s);
    return getState();
  }
  function dispatch(action, payload) {
    if (action === "play") return play();
    if (action === "pause") return pause();
    if (action === "reset") return reset();
    if (action === "set_progress") {
      object(payload, "payload set_progress");
      return setProgress(payload.progress);
    }
    throw new RangeError(`azione non supportata: ${String(action)}`);
  }
  return Object.freeze({ getState, setProgress, play, pause, reset, advance, dispatch });
}

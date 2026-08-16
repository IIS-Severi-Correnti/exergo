/**
 * Stati di equilibrio per trasformazioni di gas perfetto. Nessuna dipendenza DOM.
 *
 * Il progresso e un parametro didattico di playback, non un tempo fisico.
 */

export const IDEAL_GAS_CONSTANT_J_MOL_K = 8.31446261815324;
export const SUPPORTED_SCHEMA_VERSION = 1;
export const ENGINE_NAME = "ideal_gas_process";

const ELEMENTARY_PROCESSES = Object.freeze(["isochoric", "isobaric", "isothermal"]);

function requireFiniteNumber(value, name, { positive = false } = {}) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${name} deve essere un numero finito`);
  }
  if (positive && value <= 0) {
    throw new RangeError(`${name} deve essere maggiore di zero`);
  }
  return value;
}

function requireObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${name} deve essere un oggetto`);
  }
  return value;
}

function requireEnum(value, name, allowed) {
  if (!allowed.includes(value)) {
    throw new RangeError(`${name} non supportato: ${String(value)}`);
  }
  return value;
}

function requireBetween(value, name, minimum, maximum) {
  requireFiniteNumber(value, name);
  if (value <= minimum || value >= maximum) {
    throw new RangeError(`${name} deve essere compreso tra ${minimum} e ${maximum}`);
  }
  return value;
}

function validateInteraction(interaction) {
  requireObject(interaction, "interaction");
  requireFiniteNumber(interaction.playback_duration_s, "playback_duration_s", { positive: true });
}

function clampProgress(progress) {
  requireFiniteNumber(progress, "progress");
  return Math.min(1, Math.max(0, progress));
}

function freezePoints(points) {
  return Object.freeze(points.map((point) => Object.freeze([...point])));
}

function sample(count, callback) {
  return freezePoints(Array.from({ length: count + 1 }, (_, index) => callback(index / count)));
}

function createChart({ xLabel, yLabel, xValue, yValue, pathPoints, areaPoints = [], note = "" }) {
  return Object.freeze({
    x_label: xLabel,
    y_label: yLabel,
    x_value: xValue,
    y_value: yValue,
    path_points: freezePoints(pathPoints),
    area_points: freezePoints(areaPoints),
    note,
  });
}

function validateReversibleIsothermal(parameters) {
  requireFiniteNumber(parameters.amount_mol, "amount_mol", { positive: true });
  requireFiniteNumber(parameters.temperature_K, "temperature_K", { positive: true });
  requireFiniteNumber(parameters.volume_initial_m3, "volume_initial_m3", { positive: true });
  requireFiniteNumber(parameters.volume_final_m3, "volume_final_m3", { positive: true });
  if (parameters.volume_final_m3 <= parameters.volume_initial_m3) {
    throw new RangeError("volume_final_m3 deve essere maggiore di volume_initial_m3");
  }
}

function createReversibleIsothermalModel(parameters) {
  validateReversibleIsothermal(parameters);
  const thermalEnergyScale = parameters.amount_mol * IDEAL_GAS_CONSTANT_J_MOL_K * parameters.temperature_K;
  const volumeSpan = parameters.volume_final_m3 - parameters.volume_initial_m3;

  function pointAt(progress) {
    const volume = parameters.volume_initial_m3 + progress * volumeSpan;
    return [volume, thermalEnergyScale / volume];
  }

  return Object.freeze({
    derive(progress) {
      const [volume, pressure] = pointAt(progress);
      const work = thermalEnergyScale * Math.log(volume / parameters.volume_initial_m3);
      const pathPoints = sample(72, pointAt);
      const areaCurve = sample(48, (fraction) => pointAt(progress * fraction));
      return Object.freeze({
        amount_mol: parameters.amount_mol,
        temperature_K: parameters.temperature_K,
        volume_initial_m3: parameters.volume_initial_m3,
        volume_final_m3: parameters.volume_final_m3,
        volume_m3: volume,
        pressure_Pa: pressure,
        work_J: work,
        heat_J: work,
        delta_u_J: 0,
        phase: "isothermal",
        chart: createChart({
          xLabel: "V (m³)",
          yLabel: "p (Pa)",
          xValue: volume,
          yValue: pressure,
          pathPoints,
          areaPoints: areaCurve,
          note: "Isoterma reversibile: l'area sotto p(V) rappresenta il lavoro del gas.",
        }),
      });
    },
  });
}

function validateProcessComparison(parameters) {
  requireFiniteNumber(parameters.amount_mol, "amount_mol", { positive: true });
  requireFiniteNumber(parameters.temperature_initial_K, "temperature_initial_K", { positive: true });
  requireFiniteNumber(parameters.volume_initial_m3, "volume_initial_m3", { positive: true });
  requireFiniteNumber(parameters.expansion_ratio, "expansion_ratio", { positive: true });
  if (parameters.expansion_ratio <= 1) {
    throw new RangeError("expansion_ratio deve essere maggiore di 1");
  }
  requireEnum(parameters.default_process, "default_process", ELEMENTARY_PROCESSES);
}

function createProcessComparisonModel(parameters) {
  validateProcessComparison(parameters);
  const initialPressure = parameters.amount_mol * IDEAL_GAS_CONSTANT_J_MOL_K * parameters.temperature_initial_K /
    parameters.volume_initial_m3;
  let selectedProcess = parameters.default_process;

  function valuesAt(progress, process = selectedProcess) {
    const scale = 1 + progress * (parameters.expansion_ratio - 1);
    if (process === "isochoric") {
      return {
        volume_m3: parameters.volume_initial_m3,
        pressure_Pa: initialPressure * scale,
        temperature_K: parameters.temperature_initial_K * scale,
        work_J: 0,
        heat_J: null,
        delta_u_J: null,
      };
    }
    if (process === "isobaric") {
      const volume = parameters.volume_initial_m3 * scale;
      return {
        volume_m3: volume,
        pressure_Pa: initialPressure,
        temperature_K: parameters.temperature_initial_K * scale,
        work_J: initialPressure * (volume - parameters.volume_initial_m3),
        heat_J: null,
        delta_u_J: null,
      };
    }
    const volume = parameters.volume_initial_m3 * scale;
    const work = parameters.amount_mol * IDEAL_GAS_CONSTANT_J_MOL_K * parameters.temperature_initial_K *
      Math.log(volume / parameters.volume_initial_m3);
    return {
      volume_m3: volume,
      pressure_Pa: initialPressure / scale,
      temperature_K: parameters.temperature_initial_K,
      work_J: work,
      heat_J: work,
      delta_u_J: 0,
    };
  }

  return Object.freeze({
    derive(progress) {
      const values = valuesAt(progress);
      const pathPoints = sample(48, (fraction) => {
        const point = valuesAt(fraction);
        return [point.volume_m3, point.pressure_Pa];
      });
      return Object.freeze({
        ...values,
        selected_process: selectedProcess,
        phase: selectedProcess,
        chart: createChart({
          xLabel: "V (m³)",
          yLabel: "p (Pa)",
          xValue: values.volume_m3,
          yValue: values.pressure_Pa,
          pathPoints,
          note: "Tre trasformazioni elementari partono dallo stesso stato didattico A.",
        }),
      });
    },
    dispatch(action, payload) {
      if (action !== "select_process") return false;
      requireObject(payload, "payload select_process");
      selectedProcess = requireEnum(payload.process, "process", ELEMENTARY_PROCESSES);
      return true;
    },
    reset() {
      selectedProcess = parameters.default_process;
    },
  });
}

function validatePiecewise(parameters) {
  requireFiniteNumber(parameters.volume_A_m3, "volume_A_m3", { positive: true });
  requireFiniteNumber(parameters.volume_compression_m3, "volume_compression_m3", { positive: true });
  if (parameters.volume_compression_m3 >= parameters.volume_A_m3) {
    throw new RangeError("volume_compression_m3 deve essere minore di volume_A_m3");
  }
  requireFiniteNumber(parameters.temperature_A_K, "temperature_A_K", { positive: true });
  requireBetween(parameters.pressure_C_over_B_ratio, "pressure_C_over_B_ratio", 0, 1);
}

function createPiecewiseIsobaricIsothermalModel(parameters) {
  validatePiecewise(parameters);
  const volumeA = parameters.volume_A_m3;
  const volumeB = volumeA - parameters.volume_compression_m3;
  const temperatureB = parameters.temperature_A_K * volumeB / volumeA;
  const pressureRatioC = parameters.pressure_C_over_B_ratio;
  const volumeC = volumeB / pressureRatioC;

  function pointAt(progress) {
    if (progress <= 0.5) {
      const local = progress / 0.5;
      const volume = volumeA + (volumeB - volumeA) * local;
      return {
        volume_m3: volume,
        pressure_ratio: 1,
        temperature_K: parameters.temperature_A_K * volume / volumeA,
        phase: progress === 0 ? "A" : (progress >= 0.5 ? "B" : "A→B isobara"),
      };
    }
    const local = (progress - 0.5) / 0.5;
    const pressureRatio = 1 + (pressureRatioC - 1) * local;
    return {
      volume_m3: volumeB / pressureRatio,
      pressure_ratio: pressureRatio,
      temperature_K: temperatureB,
      phase: progress >= 1 ? "C" : "B→C isoterma",
    };
  }

  const pathPoints = Object.freeze([
    ...Array.from({ length: 25 }, (_, index) => {
      const point = pointAt((index / 24) * 0.5);
      return Object.freeze([point.volume_m3, point.pressure_ratio]);
    }),
    ...Array.from({ length: 49 }, (_, index) => {
      const point = pointAt(0.5 + (index / 48) * 0.5);
      return Object.freeze([point.volume_m3, point.pressure_ratio]);
    }).slice(1),
  ]);

  return Object.freeze({
    derive(progress) {
      const point = pointAt(progress);
      return Object.freeze({
        ...point,
        pressure_Pa: null,
        work_J: null,
        heat_J: null,
        delta_u_J: null,
        volume_A_m3: volumeA,
        volume_B_m3: volumeB,
        volume_C_m3: volumeC,
        temperature_A_K: parameters.temperature_A_K,
        temperature_B_K: temperatureB,
        pressure_C_over_B_ratio: pressureRatioC,
        chart: createChart({
          xLabel: "V (m³)",
          yLabel: "p / p_A",
          xValue: point.volume_m3,
          yValue: point.pressure_ratio,
          pathPoints,
          note: "La pressione assoluta non è fornita: il grafico usa p/p_A.",
        }),
      });
    },
  });
}

function validateCycle(parameters) {
  requireFiniteNumber(parameters.volume_low_ratio, "volume_low_ratio", { positive: true });
  requireFiniteNumber(parameters.volume_high_ratio, "volume_high_ratio", { positive: true });
  requireFiniteNumber(parameters.pressure_low_ratio, "pressure_low_ratio", { positive: true });
  requireFiniteNumber(parameters.pressure_high_ratio, "pressure_high_ratio", { positive: true });
  if (parameters.volume_high_ratio <= parameters.volume_low_ratio) {
    throw new RangeError("volume_high_ratio deve essere maggiore di volume_low_ratio");
  }
  if (parameters.pressure_high_ratio <= parameters.pressure_low_ratio) {
    throw new RangeError("pressure_high_ratio deve essere maggiore di pressure_low_ratio");
  }
  requireEnum(parameters.orientation, "orientation", ["clockwise", "counterclockwise"]);
}

function createThermodynamicCycleModel(parameters) {
  validateCycle(parameters);
  const A = [parameters.volume_low_ratio, parameters.pressure_low_ratio];
  const B = [parameters.volume_low_ratio, parameters.pressure_high_ratio];
  const C = [parameters.volume_high_ratio, parameters.pressure_high_ratio];
  const D = [parameters.volume_high_ratio, parameters.pressure_low_ratio];
  const path = parameters.orientation === "clockwise" ? [A, B, C, D, A] : [A, D, C, B, A];
  const netWork = (parameters.volume_high_ratio - parameters.volume_low_ratio) *
    (parameters.pressure_high_ratio - parameters.pressure_low_ratio) *
    (parameters.orientation === "clockwise" ? 1 : -1);

  function pointAt(progress) {
    if (progress >= 1) return { point: A, phase: "A (ciclo completo)" };
    const scaled = progress * 4;
    const segment = Math.min(3, Math.floor(scaled));
    const local = scaled - segment;
    const start = path[segment];
    const end = path[segment + 1];
    return {
      point: [
        start[0] + (end[0] - start[0]) * local,
        start[1] + (end[1] - start[1]) * local,
      ],
      phase: `${String.fromCharCode(65 + segment)}→${String.fromCharCode(66 + segment)}`,
    };
  }

  return Object.freeze({
    derive(progress) {
      const current = pointAt(progress);
      return Object.freeze({
        volume_m3: null,
        pressure_Pa: null,
        temperature_K: null,
        work_J: null,
        heat_J: null,
        delta_u_J: null,
        volume_ratio: current.point[0],
        pressure_ratio: current.point[1],
        phase: current.phase,
        cycle_net_work_normalized: netWork,
        cycle_net_heat_normalized: netWork,
        cycle_delta_u_normalized: 0,
        chart: createChart({
          xLabel: "V / V₀",
          yLabel: "p / p₀",
          xValue: current.point[0],
          yValue: current.point[1],
          pathPoints: path,
          areaPoints: path,
          note: "Ciclo rettangolare normalizzato: l'area orientata rappresenta il lavoro netto.",
        }),
      });
    },
  });
}

function validateIsochoricMonoatomic(parameters) {
  requireFiniteNumber(parameters.volume_m3, "volume_m3", { positive: true });
  requireFiniteNumber(parameters.pressure_increase_final_Pa, "pressure_increase_final_Pa", { positive: true });
}

function createIsochoricMonoatomicModel(parameters) {
  validateIsochoricMonoatomic(parameters);
  return Object.freeze({
    derive(progress) {
      const pressureChange = parameters.pressure_increase_final_Pa * progress;
      const deltaU = 1.5 * parameters.volume_m3 * pressureChange;
      const pathPoints = freezePoints([
        [parameters.volume_m3, 0],
        [parameters.volume_m3, parameters.pressure_increase_final_Pa],
      ]);
      return Object.freeze({
        volume_m3: parameters.volume_m3,
        pressure_Pa: null,
        pressure_change_Pa: pressureChange,
        temperature_K: null,
        work_J: 0,
        heat_J: deltaU,
        delta_u_J: deltaU,
        phase: "isocora",
        chart: createChart({
          xLabel: "V (m³)",
          yLabel: "Δp (Pa)",
          xValue: parameters.volume_m3,
          yValue: pressureChange,
          pathPoints,
          note: "La pressione assoluta non è nota: il grafico mostra soltanto l'aumento Δp.",
        }),
      });
    },
  });
}

const MODEL_FACTORIES = Object.freeze({
  reversible_isothermal: createReversibleIsothermalModel,
  process_comparison: createProcessComparisonModel,
  piecewise_isobaric_isothermal: createPiecewiseIsobaricIsothermalModel,
  thermodynamic_cycle: createThermodynamicCycleModel,
  isochoric_monoatomic: createIsochoricMonoatomicModel,
});

export function createSimulationEngine(config) {
  requireObject(config, "config");
  if (config.schema_version !== SUPPORTED_SCHEMA_VERSION) {
    throw new RangeError(`schema_version non supportata: ${String(config.schema_version)}`);
  }
  if (config.engine !== ENGINE_NAME) {
    throw new RangeError(`configurazione destinata a un altro motore: ${String(config.engine)}`);
  }

  const modelFactory = MODEL_FACTORIES[config.model];
  if (!modelFactory) {
    throw new RangeError(`modello non supportato: ${String(config.model)}`);
  }

  requireObject(config.parameters, "parameters");
  validateInteraction(config.interaction);
  const parameters = Object.freeze({ ...config.parameters });
  const playbackDurationSeconds = config.interaction.playback_duration_s;
  const model = modelFactory(parameters);
  let progress = 0;
  let running = false;

  function getState() {
    return Object.freeze({
      model: config.model,
      progress,
      is_running: running,
      is_complete: progress >= 1,
      ...model.derive(progress),
    });
  }

  function play() {
    running = progress < 1;
    return getState();
  }

  function pause() {
    running = false;
    return getState();
  }

  function setProgress(nextProgress) {
    progress = clampProgress(nextProgress);
    if (progress >= 1) running = false;
    return getState();
  }

  function advance(deltaSeconds) {
    requireFiniteNumber(deltaSeconds, "deltaSeconds");
    if (deltaSeconds < 0) throw new RangeError("deltaSeconds non puo essere negativo");
    if (running) setProgress(progress + deltaSeconds / playbackDurationSeconds);
    return getState();
  }

  function reset() {
    progress = 0;
    running = false;
    if (typeof model.reset === "function") model.reset();
    return getState();
  }

  function dispatch(action, payload) {
    if (action === "play") return play();
    if (action === "pause") return pause();
    if (action === "reset") return reset();
    if (action === "set_progress") {
      if (!payload || typeof payload !== "object") {
        throw new TypeError("set_progress richiede un payload");
      }
      return setProgress(payload.progress);
    }
    if (typeof model.dispatch === "function" && model.dispatch(action, payload)) {
      return getState();
    }
    throw new RangeError(`azione non supportata: ${String(action)}`);
  }

  return Object.freeze({ getState, play, pause, setProgress, advance, reset, dispatch });
}

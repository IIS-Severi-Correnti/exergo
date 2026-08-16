export const ENGINE_NAME = "wave_1d";
export const SUPPORTED_SCHEMA_VERSION = 1;

function requireObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${name} deve essere un oggetto`);
  }
  return value;
}

function requireNumber(value, name, { positive = false, nonNegative = false } = {}) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${name} deve essere un numero finito`);
  }
  if (positive && value <= 0) throw new RangeError(`${name} deve essere maggiore di zero`);
  if (nonNegative && value < 0) throw new RangeError(`${name} non puo essere negativo`);
  return value;
}

function clamp01(value) {
  requireNumber(value, "progress");
  return Math.max(0, Math.min(1, value));
}

function createDopplerObserverModel(parameters) {
  requireNumber(parameters.emitted_frequency_Hz, "emitted_frequency_Hz", { positive: true });
  requireNumber(parameters.frequency_increase_Hz, "frequency_increase_Hz", { positive: true });
  requireNumber(parameters.wave_speed_m_s, "wave_speed_m_s", { positive: true });

  const targetObservedFrequency = parameters.emitted_frequency_Hz + parameters.frequency_increase_Hz;
  const targetObserverSpeed = parameters.wave_speed_m_s *
    (targetObservedFrequency / parameters.emitted_frequency_Hz - 1);
  if (targetObserverSpeed >= parameters.wave_speed_m_s) {
    throw new RangeError("la configurazione richiede un osservatore subsonico nel modello v1");
  }

  return Object.freeze({
    derive(progress) {
      const observerSpeed = targetObserverSpeed * progress;
      const observedFrequency = parameters.emitted_frequency_Hz *
        (parameters.wave_speed_m_s + observerSpeed) / parameters.wave_speed_m_s;
      return Object.freeze({
        emitted_frequency_Hz: parameters.emitted_frequency_Hz,
        observed_frequency_Hz: observedFrequency,
        frequency_increase_Hz: observedFrequency - parameters.emitted_frequency_Hz,
        wave_speed_m_s: parameters.wave_speed_m_s,
        observer_speed_m_s: observerSpeed,
        observer_speed_target_m_s: targetObserverSpeed,
        frequency_ratio: observedFrequency / parameters.emitted_frequency_Hz,
        phase: "osservatore in avvicinamento",
      });
    },
  });
}

function createDopplerSourceModel(parameters) {
  requireNumber(parameters.target_frequency_ratio, "target_frequency_ratio", { positive: true });
  if (parameters.target_frequency_ratio <= 1) {
    throw new RangeError("target_frequency_ratio deve essere maggiore di 1");
  }
  const targetBeta = 1 - 1 / parameters.target_frequency_ratio;
  if (!(targetBeta > 0 && targetBeta < 1)) {
    throw new RangeError("il rapporto richiesto deve corrispondere a una sorgente subsonica");
  }

  return Object.freeze({
    derive(progress) {
      const beta = targetBeta * progress;
      return Object.freeze({
        source_speed_over_wave_speed: beta,
        source_speed_target_over_wave_speed: targetBeta,
        frequency_ratio: 1 / (1 - beta),
        wavelength_ahead_ratio: 1 - beta,
        wavelength_behind_ratio: 1 + beta,
        phase: "sorgente in avvicinamento",
      });
    },
  });
}

function createStringModeModel(parameters) {
  requireNumber(parameters.linear_density_ratio_final, "linear_density_ratio_final", { positive: true });
  if (parameters.linear_density_ratio_final <= 1) {
    throw new RangeError("linear_density_ratio_final deve essere maggiore di 1");
  }

  return Object.freeze({
    derive(progress) {
      const densityRatio = 1 + progress * (parameters.linear_density_ratio_final - 1);
      const frequencyRatio = 1 / Math.sqrt(densityRatio);
      return Object.freeze({
        linear_density_ratio: densityRatio,
        frequency_ratio: frequencyRatio,
        wave_speed_ratio: frequencyRatio,
        string_thickness_ratio_visual: Math.sqrt(densityRatio),
        phase: "confronto a lunghezza e tensione costanti",
      });
    },
  });
}

function createMechanicalWaveEnergyModel(parameters) {
  if (Object.keys(parameters).length !== 0) {
    throw new RangeError("mechanical_wave_energy non richiede parametri dimensionali nel modello normalizzato");
  }
  return Object.freeze({
    derive(progress) {
      return Object.freeze({
        amplitude_ratio: progress,
        elastic_energy_ratio: progress * progress,
        normalized_force_peak_ratio: progress,
        phase: progress === 0 ? "galleggiante in quiete" : "misura normalizzata dell'ampiezza",
      });
    },
  });
}

function createEchoTimeOfFlightModel(parameters) {
  if (Object.keys(parameters).length !== 0) {
    throw new RangeError("echo_time_of_flight non richiede dati numerici nel modello normalizzato");
  }
  return Object.freeze({
    derive(progress) {
      const outbound = progress <= 0.5;
      const pulsePosition = outbound ? progress * 2 : (1 - progress) * 2;
      return Object.freeze({
        normalized_time: progress,
        pulse_position_ratio: pulsePosition,
        path_length_ratio: progress * 2,
        one_way_distance_ratio: 1,
        phase: progress === 0
          ? "emissione"
          : progress < 0.5
            ? "andata"
            : progress === 0.5
              ? "riflessione sull'ostacolo"
              : progress < 1
                ? "eco di ritorno"
                : "eco ricevuto",
      });
    },
  });
}

const MODEL_FACTORIES = Object.freeze({
  doppler_observer_moving: createDopplerObserverModel,
  doppler_source_moving: createDopplerSourceModel,
  string_mode: createStringModeModel,
  mechanical_wave_energy: createMechanicalWaveEnergyModel,
  echo_time_of_flight: createEchoTimeOfFlightModel,
});

export function createSimulationEngine(config) {
  requireObject(config, "config");
  if (config.schema_version !== SUPPORTED_SCHEMA_VERSION) {
    throw new RangeError(`schema_version non supportata: ${String(config.schema_version)}`);
  }
  if (config.engine !== ENGINE_NAME) {
    throw new RangeError(`configurazione destinata a un altro motore: ${String(config.engine)}`);
  }
  requireObject(config.parameters, "parameters");
  requireObject(config.interaction, "interaction");
  requireNumber(config.interaction.playback_duration_s, "playback_duration_s", { positive: true });
  const factory = MODEL_FACTORIES[config.model];
  if (!factory) throw new RangeError(`modello non supportato: ${String(config.model)}`);

  const model = factory(Object.freeze({ ...config.parameters }));
  const playbackDuration = config.interaction.playback_duration_s;
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

  function setProgress(nextProgress) {
    progress = clamp01(nextProgress);
    if (progress >= 1) running = false;
    return getState();
  }
  function play() {
    running = progress < 1;
    return getState();
  }
  function pause() {
    running = false;
    return getState();
  }
  function reset() {
    progress = 0;
    running = false;
    return getState();
  }
  function advance(deltaSeconds) {
    requireNumber(deltaSeconds, "deltaSeconds", { nonNegative: true });
    if (running) setProgress(progress + deltaSeconds / playbackDuration);
    return getState();
  }
  function dispatch(action, payload) {
    if (action === "play") return play();
    if (action === "pause") return pause();
    if (action === "reset") return reset();
    if (action === "set_progress") {
      requireObject(payload, "payload set_progress");
      return setProgress(payload.progress);
    }
    throw new RangeError(`azione non supportata: ${String(action)}`);
  }

  return Object.freeze({ getState, setProgress, play, pause, reset, advance, dispatch });
}

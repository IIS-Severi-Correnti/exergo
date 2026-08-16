let instanceCount = 0;

function fmt(value, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: digits }).format(value);
}

function pointFromNormal(cx, cy, length, angleDeg, sideX, sideY) {
  const angle = angleDeg * Math.PI / 180;
  return [cx + sideX * length * Math.sin(angle), cy + sideY * length * Math.cos(angle)];
}

function line(x1, y1, x2, y2, cls, extra = "") {
  return `<line class="${cls}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${extra}></line>`;
}

function arrow(x, axisY, height, cls, label) {
  const tipY = axisY - height;
  return `<g class="${cls}">${line(x, axisY, x, tipY, "ray-arrow-line")}<path class="ray-arrow-head" d="M ${x} ${tipY} l -7 12 h 14 z"></path><text x="${x + 9}" y="${tipY + 5}">${label}</text></g>`;
}

function sceneSpeedIndex(state) {
  const ratio = Math.max(0.35, state.medium_speed_m_s / state.vacuum_speed_m_s);
  const rightSpacing = 42 * ratio;
  const fronts = [];
  for (let x = 80; x <= 290; x += 42) fronts.push(line(x, 120, x, 240, "ray-wavefront"));
  for (let x = 355; x <= 575; x += rightSpacing) fronts.push(line(x, 120, x, 240, "ray-wavefront ray-wavefront-medium"));
  return `
    <rect class="ray-medium ray-medium-a" x="30" y="70" width="290" height="220"></rect>
    <rect class="ray-medium ray-medium-b" x="320" y="70" width="290" height="220"></rect>
    <text class="ray-medium-label" x="55" y="102">vuoto: c = ${fmt(state.vacuum_speed_m_s / 1e8, 2)}×10⁸ m/s</text>
    <text class="ray-medium-label" x="345" y="102">mezzo: v = ${fmt(state.medium_speed_m_s / 1e8, 3)}×10⁸ m/s</text>
    ${line(65, 180, 580, 180, "ray-light")}
    ${fronts.join("")}
    <text class="ray-scene-note" x="320" y="326" text-anchor="middle">La minore spaziatura è una rappresentazione qualitativa della minore velocità nel mezzo.</text>`;
}

function sceneSnell(state) {
  const cx = 320, cy = 180, length = 185;
  const [ix, iy] = pointFromNormal(cx, cy, length, state.incidence_angle_deg, -1, -1);
  const [rx, ry] = pointFromNormal(cx, cy, length, state.refraction_angle_deg, 1, 1);
  return `
    <rect class="ray-medium ray-medium-a" x="30" y="45" width="580" height="135"></rect>
    <rect class="ray-medium ray-medium-b" x="30" y="180" width="580" height="135"></rect>
    <text class="ray-medium-label" x="50" y="75">aria, n₁ = ${fmt(state.refractive_index_1, 3)}</text>
    <text class="ray-medium-label" x="50" y="210">mezzo, n₂ = ${fmt(state.refractive_index_2, 3)}</text>
    ${line(30, cy, 610, cy, "ray-interface")}
    ${line(cx, 45, cx, 315, "ray-normal")}
    ${line(ix, iy, cx, cy, "ray-light")}
    ${line(cx, cy, rx, ry, "ray-light ray-refracted")}
    <circle class="ray-hit" cx="${cx}" cy="${cy}" r="6"></circle>
    <text class="ray-angle-label" x="${cx - 72}" y="${cy - 56}">i = ${fmt(state.incidence_angle_deg, 1)}°</text>
    <text class="ray-angle-label" x="${cx + 32}" y="${cy + 58}">r = ${fmt(state.refraction_angle_deg, 1)}°</text>`;
}

function sceneSlab(state) {
  const x1 = 235, x2 = 405, yEntry = 150;
  const i = state.incidence_angle_deg * Math.PI / 180;
  const r = state.refraction_angle_deg * Math.PI / 180;
  const startX = 55;
  const startY = yEntry - (x1 - startX) * Math.tan(i);
  const yExit = yEntry + (x2 - x1) * Math.tan(r);
  const endX = 585;
  const endY = yExit + (endX - x2) * Math.tan(i);
  const straightExitY = yEntry + (x2 - x1) * Math.tan(i);
  const straightEndY = yEntry + (endX - x1) * Math.tan(i);
  return `
    <rect class="ray-slab" x="${x1}" y="45" width="${x2 - x1}" height="270"></rect>
    <text class="ray-medium-label" x="255" y="75">vetro n = ${fmt(state.refractive_index_slab, 2)}</text>
    <text class="ray-medium-label" x="55" y="75">aria</text>
    ${line(startX, startY, x1, yEntry, "ray-light")}
    ${line(x1, yEntry, x2, yExit, "ray-light ray-refracted")}
    ${line(x2, yExit, endX, endY, "ray-light")}
    ${line(x1, yEntry, endX, straightEndY, "ray-construction")}
    ${line(x1 - 45, yEntry, x1 + 45, yEntry, "ray-normal")}
    ${line(x2 - 45, yExit, x2 + 45, yExit, "ray-normal")}
    ${line(x2, straightExitY, x2, yExit, "ray-displacement-guide")}
    <text class="ray-angle-label" x="${x1 - 88}" y="${yEntry - 18}">i = ${fmt(state.incidence_angle_deg, 1)}°</text>
    <text class="ray-angle-label" x="${x1 + 28}" y="${yEntry + 38}">r = ${fmt(state.refraction_angle_deg, 1)}°</text>
    <text class="ray-scene-note" x="320" y="338" text-anchor="middle">Raggio emergente parallelo all'incidente; d = ${fmt(state.lateral_displacement_m * 1000, 3)} mm.</text>`;
}

function sceneTir(state) {
  const cx = 320, cy = 175, length = 170;
  const [sx, sy] = pointFromNormal(cx, cy, length, state.incidence_angle_deg, -1, 1);
  const [ex, ey] = pointFromNormal(cx, cy, length, state.incidence_angle_deg, 1, 1);
  const revealLimit = state.construction_progress >= 0.35;
  const revealReflection = state.construction_progress >= 0.65;
  return `
    <rect class="ray-medium ray-medium-b" x="30" y="45" width="580" height="130"></rect>
    <rect class="ray-medium ray-medium-a" x="30" y="175" width="580" height="140"></rect>
    <text class="ray-medium-label" x="48" y="205">acqua n₁ = ${fmt(state.refractive_index_1, 3)}</text>
    <text class="ray-medium-label" x="48" y="75">secondo mezzo: n₂ ≤ ${fmt(state.refractive_index_2_max, 3)}</text>
    ${line(30, cy, 610, cy, "ray-interface")}
    ${line(cx, 50, cx, 310, "ray-normal")}
    ${line(sx, sy, cx, cy, "ray-light")}
    ${revealLimit ? line(cx, cy, 570, cy, "ray-limit") : ""}
    ${revealReflection ? line(cx, cy, ex, ey, "ray-reflected") : ""}
    <text class="ray-angle-label" x="${cx - 82}" y="${cy + 68}">i = ${fmt(state.incidence_angle_deg, 1)}°</text>
    ${revealLimit ? `<text class="ray-angle-label" x="405" y="158">caso limite: r = 90°</text>` : ""}
    ${revealReflection ? `<text class="ray-scene-note" x="320" y="338" text-anchor="middle">Per n₂ inferiore al limite, θL &lt; 75° e il raggio è totalmente riflesso.</text>` : ""}`;
}

function sceneMirror(state) {
  const mirrorX = 400, axisY = 190, scale = 1050;
  const fPx = state.focal_length_m * scale;
  const pPx = state.object_distance_m * scale;
  const qPx = Math.abs(state.image_distance_m) * scale;
  const objectX = mirrorX - pPx;
  const focusX = mirrorX - fPx;
  const centerX = mirrorX - 2 * fPx;
  const imageX = mirrorX + qPx;
  const objectH = 48;
  const imageH = objectH * state.magnification;
  const topY = axisY - objectH;
  const imageTopY = axisY - imageH;
  const revealRays = state.construction_progress >= 1 / 3;
  const revealImage = state.construction_progress >= 2 / 3;
  const vertexY = axisY;
  return `
    ${line(35, axisY, 610, axisY, "ray-axis")}
    <path class="ray-mirror" d="M ${mirrorX} 55 Q ${mirrorX - 42} ${axisY} ${mirrorX} 325"></path>
    <text class="ray-medium-label" x="${mirrorX + 18}" y="72">specchio concavo</text>
    <circle class="ray-focus" cx="${focusX}" cy="${axisY}" r="5"></circle><text class="ray-point-label" x="${focusX - 6}" y="${axisY + 24}">F</text>
    <circle class="ray-focus" cx="${centerX}" cy="${axisY}" r="5"></circle><text class="ray-point-label" x="${centerX - 6}" y="${axisY + 24}">C</text>
    ${arrow(objectX, axisY, objectH, "ray-object", "oggetto")}
    ${revealRays ? `
      ${line(objectX, topY, mirrorX, topY, "ray-light")}
      ${line(mirrorX, topY, focusX - 92, axisY + 92 * objectH / fPx, "ray-reflected")}
      ${line(mirrorX, topY, imageX, imageTopY, "ray-construction")}
      ${line(objectX, topY, mirrorX, vertexY, "ray-light ray-light-secondary")}
      ${line(mirrorX, vertexY, objectX - 78, vertexY + (pPx + 78) * objectH / pPx, "ray-reflected ray-light-secondary")}
      ${line(mirrorX, vertexY, imageX, imageTopY, "ray-construction")}
    ` : ""}
    ${revealImage ? arrow(imageX, axisY, imageH, "ray-image", "immagine virtuale") : ""}
    <text class="ray-scene-note" x="320" y="345" text-anchor="middle">p = ${fmt(state.object_distance_m * 100, 1)} cm; q = ${fmt(state.image_distance_m * 100, 1)} cm; M = +${fmt(state.magnification, 1)}.</text>`;
}

function sceneForState(state) {
  if (state.model === "single_interface_refraction") return sceneSpeedIndex(state);
  if (state.model === "snell_refraction") return sceneSnell(state);
  if (state.model === "parallel_slab") return sceneSlab(state);
  if (state.model === "total_internal_reflection") return sceneTir(state);
  return sceneMirror(state);
}

function valuesForState(state) {
  if (state.model === "single_interface_refraction") return [
    ["Riduzione velocità", `${fmt(state.reduction_fraction * 100, 1)} %`],
    ["Velocità nel mezzo", `${fmt(state.medium_speed_m_s / 1e8, 3)} × 10⁸ m/s`],
    ["Indice n", fmt(state.refractive_index, 4)],
  ];
  if (state.model === "snell_refraction") return [
    ["Angolo i", `${fmt(state.incidence_angle_deg, 1)}°`],
    ["Angolo r", `${fmt(state.refraction_angle_deg, 1)}°`],
    ["Indice n₂", fmt(state.refractive_index_2, 4)],
    ["Velocità nel mezzo", `${fmt(state.medium_speed_m_s / 1e8, 3)} × 10⁸ m/s`],
  ];
  if (state.model === "parallel_slab") return [
    ["Angolo i", `${fmt(state.incidence_angle_deg, 1)}°`],
    ["Angolo r", `${fmt(state.refraction_angle_deg, 1)}°`],
    ["Spostamento d", `${fmt(state.lateral_displacement_m * 1000, 3)} mm`],
    ["Spessore", `${fmt(state.slab_thickness_m * 1000, 2)} mm`],
  ];
  if (state.model === "total_internal_reflection") return [
    ["Angolo di incidenza", `${fmt(state.incidence_angle_deg, 1)}°`],
    ["n₁", fmt(state.refractive_index_1, 3)],
    ["n₂ massimo", fmt(state.refractive_index_2_max, 4)],
    ["Angolo limite al caso estremo", `${fmt(state.critical_angle_deg, 1)}°`],
  ];
  return [
    ["Distanza focale", `${fmt(state.focal_length_m * 100, 1)} cm`],
    ["Distanza oggetto p", `${fmt(state.object_distance_m * 100, 1)} cm`],
    ["Distanza immagine q", `${fmt(state.image_distance_m * 100, 1)} cm`],
    ["Ingrandimento", `+${fmt(state.magnification, 1)}`],
  ];
}

function equationsForState(state) {
  if (state.model === "single_interface_refraction") return `<p><var>n</var> = <var>c</var>/<var>v</var></p>`;
  if (state.model === "snell_refraction") return `<p><var>n₁</var> sin <var>i</var> = <var>n₂</var> sin <var>r</var></p><p><var>v</var> = <var>c</var>/<var>n₂</var></p>`;
  if (state.model === "parallel_slab") return `<p><var>n₁</var> sin <var>i</var> = <var>n₂</var> sin <var>r</var></p><p><var>d</var> = <var>s</var> sin(<var>i</var>−<var>r</var>)/cos <var>r</var></p>`;
  if (state.model === "total_internal_reflection") return `<p>sin θ<sub>L</sub> = <var>n₂</var>/<var>n₁</var></p><p><var>n₂,max</var> = <var>n₁</var> sin <var>i</var></p>`;
  return `<p>1/<var>f</var> = 1/<var>p</var> + 1/<var>q</var></p><p><var>M</var> = −<var>q</var>/<var>p</var></p>`;
}

export function createSimulationView({ container, config }) {
  instanceCount += 1;
  const sliderId = `ray-optics-progress-${instanceCount}`;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  container.innerHTML = `
    <p class="simulation-instruction"><strong>Esplora:</strong> <span data-learning-action></span></p>
    <figure class="ray-optics-figure">
      <svg class="ray-optics-svg" viewBox="0 0 640 370" role="img" aria-label="Schema di ottica geometrica" data-ray-scene></svg>
      <figcaption data-scene-caption></figcaption>
    </figure>
    <div class="ray-optics-panel">
      <div class="ray-optics-scrubber">
        <label for="${sliderId}"><span data-slider-label></span><output for="${sliderId}" data-progress-output>0%</output></label>
        <input id="${sliderId}" type="range" min="0" max="1000" step="1" value="0" data-simulation-action="set_progress" data-simulation-event="input">
        <div class="ray-optics-slider-scale" aria-hidden="true"><span>inizio</span><span>risultato</span></div>
      </div>
      <div class="simulation-controls" aria-label="Controlli simulazione">
        <button type="button" data-simulation-action="play">Play</button>
        <button type="button" data-simulation-action="pause">Pausa</button>
        <button type="button" data-simulation-action="reset">Reset</button>
      </div>
      <dl class="simulation-values ray-optics-values" data-values aria-label="Grandezze ottiche"></dl>
      <div class="simulation-equations" data-equations></div>
      <p class="simulation-status" data-simulation-status aria-live="polite"></p>
      <p class="simulation-model-note"><strong>Limiti del modello:</strong> <span data-model-note></span></p>
      <p class="simulation-error" data-simulation-error role="alert" hidden></p>
    </div>`;

  const slider = container.querySelector('[data-simulation-action="set_progress"]');
  const scene = container.querySelector("[data-ray-scene]");
  const values = container.querySelector("[data-values]");
  const equations = container.querySelector("[data-equations]");
  const status = container.querySelector("[data-simulation-status]");
  container.querySelector("[data-learning-action]").textContent = config.didactics.learning_action_it;
  container.querySelector("[data-model-note]").textContent = config.didactics.model_note_it;
  container.querySelector("[data-slider-label]").textContent = config.didactics.slider_label_it;
  equations.hidden = !config.display.show_equations;
  values.hidden = !config.display.show_values;

  return Object.freeze({
    get motionAllowed() { return !reducedMotion.matches; },
    onMotionPreferenceChange(callback) {
      reducedMotion.addEventListener("change", callback);
      return () => reducedMotion.removeEventListener("change", callback);
    },
    resolveActionPayload({ action, control }) {
      if (action === "set_progress") return { progress: Number(control.value) / Number(control.max) };
      return undefined;
    },
    describeControls(state, { motionAllowed = true } = {}) {
      const reducedTitle = "Playback disattivato dalla preferenza di riduzione del movimento; usa il cursore";
      return {
        play: { disabled: state.is_running || state.is_complete || !motionAllowed, hidden: !config.interaction.allow_play, title: motionAllowed ? "Avvia il percorso didattico" : reducedTitle },
        pause: { disabled: !state.is_running || !motionAllowed, hidden: !config.interaction.allow_pause, title: motionAllowed ? "Metti in pausa" : reducedTitle },
        reset: { hidden: !config.interaction.allow_reset },
        set_progress: { disabled: !config.interaction.allow_scrub, value: Math.round(state.progress * Number(slider.max)), ariaValueText: `${Math.round(state.progress * 100)}%, ${state.phase}` },
      };
    },
    render(state) {
      scene.innerHTML = sceneForState(state);
      values.innerHTML = valuesForState(state).map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join("");
      equations.innerHTML = equationsForState(state);
      container.querySelector("[data-progress-output]").textContent = `${Math.round(state.progress * 100)}%`;
      container.querySelector("[data-scene-caption]").textContent = state.phase;
      const motionText = this.motionAllowed ? (state.is_running ? "Playback in corso" : "Playback in pausa") : "Playback disattivato per ridurre il movimento";
      status.textContent = state.is_complete ? `Risultato raggiunto. ${motionText}.` : `${motionText}. Avanzamento ${Math.round(state.progress * 100)}%.`;
      status.classList.toggle("target-reached", state.is_complete);

      container.dataset.model = state.model;
      container.dataset.progress = String(state.progress);
      container.dataset.phase = state.phase;
      container.dataset.refractiveIndex = Number.isFinite(state.refractive_index) ? String(state.refractive_index) : "";
      container.dataset.refractiveIndex2 = Number.isFinite(state.refractive_index_2) ? String(state.refractive_index_2) : "";
      container.dataset.mediumSpeedMS = Number.isFinite(state.medium_speed_m_s) ? String(state.medium_speed_m_s) : "";
      container.dataset.incidenceAngleDeg = Number.isFinite(state.incidence_angle_deg) ? String(state.incidence_angle_deg) : "";
      container.dataset.refractionAngleDeg = Number.isFinite(state.refraction_angle_deg) ? String(state.refraction_angle_deg) : "";
      container.dataset.lateralDisplacementM = Number.isFinite(state.lateral_displacement_m) ? String(state.lateral_displacement_m) : "";
      container.dataset.refractiveIndex2Max = Number.isFinite(state.refractive_index_2_max) ? String(state.refractive_index_2_max) : "";
      container.dataset.objectDistanceM = Number.isFinite(state.object_distance_m) ? String(state.object_distance_m) : "";
      container.dataset.imageDistanceM = Number.isFinite(state.image_distance_m) ? String(state.image_distance_m) : "";
      container.dataset.magnification = Number.isFinite(state.magnification) ? String(state.magnification) : "";
      container.dataset.complete = String(state.is_complete);
      container.dataset.motionAllowed = String(this.motionAllowed);
    },
  });
}

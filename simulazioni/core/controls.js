/** Collega i controlli HTML comuni alle azioni del runtime. */

export function bindSimulationControls(root, handlers, interaction) {
  const actions = {
    play: handlers.play,
    pause: handlers.pause,
    reset: handlers.reset,
    remove: handlers.removeParticipant,
  };
  const buttons = new Map();
  const listeners = [];

  for (const [action, handler] of Object.entries(actions)) {
    const button = root.querySelector(`[data-simulation-action="${action}"]`);
    if (!button) {
      continue;
    }
    buttons.set(action, button);
    button.addEventListener("click", handler);
    listeners.push(() => button.removeEventListener("click", handler));
  }

  if (!interaction.allow_pause) {
    buttons.get("pause")?.setAttribute("hidden", "");
  }
  if (!interaction.allow_reset) {
    buttons.get("reset")?.setAttribute("hidden", "");
  }
  if (!interaction.allow_remove_participant) {
    buttons.get("remove")?.setAttribute("hidden", "");
  }

  return Object.freeze({
    update(state, { motionAllowed = true } = {}) {
      if (buttons.has("play")) {
        buttons.get("play").disabled = state.is_running || !motionAllowed;
        buttons.get("play").title = motionAllowed
          ? "Avvia la rotazione"
          : "Animazione disattivata dalla preferenza di riduzione del movimento";
      }
      if (buttons.has("pause")) {
        buttons.get("pause").disabled = !state.is_running || !motionAllowed;
        buttons.get("pause").title = motionAllowed
          ? "Metti in pausa la rotazione"
          : "Animazione disattivata dalla preferenza di riduzione del movimento";
      }
      if (buttons.has("remove")) {
        buttons.get("remove").disabled = state.participant_count_current === 0;
      }
    },

    destroy() {
      for (const removeListener of listeners) {
        removeListener();
      }
    },
  });
}

export const shellText = {
  gameTitle: "Far Hollow",
  startScreen: {
    slots: "Saved games",
    slot: (number: number) => `Slot ${number}`,
    empty: "Empty",
    broken: "This saved game cannot be loaded.",
    summary: (day: number, seed: number) => `Day ${day} · Seed ${seed}`,
    continueGame: "Continue",
    newGame: "New game",
    seed: "Seed",
    randomSeed: "Random",
    seedHint: "Leave blank for a random valley, or type a number or word.",
    start: "Start",
    replaceWarning: (slot: number) => `This replaces the saved game in slot ${slot}.`,
    replace: "Replace saved game",
    cancel: "Cancel",
    cannotSave: "This browser cannot save games, so your progress will be lost when you close the page.",
    exportGame: "Export",
    exportFileName: (slot: number, day: number) => `far-hollow-slot-${slot}-day-${day}.json`,
    brokenExportFileName: (slot: number) => `far-hollow-slot-${slot}-broken.json`,
    importGame: "Import",
    importWarning: (slot: number) => `Importing a file replaces the saved game in slot ${slot}.`,
    chooseFile: "Choose file",
    importRefusals: {
      notASave: "This file is not a Far Hollow saved game.",
      largeValley: "This saved game was made in the old 1 km valley, so it cannot be loaded.",
      newerVersion: "This saved game was made by a newer version of Far Hollow. Update the game to load it.",
      notStored: "The saved game could not be stored in this browser.",
    },
  },
  sound: {
    volume: "Volume",
    button: "Sound",
    buttonMuted: "Sound: muted",
    mute: "Mute",
    unmute: "Unmute",
    muteKey: "M",
  },
  /**
   * The wall mode button on the HUD. Its label names the wall mode the next click switches to.
   * Walls up shows every cabin whole. Cutaway hides the roofs and fades the cabin sides facing the camera. Walls down hides the roofs and fades every cabin side.
   */
  wallMode: {
    show: {
      wallsUp: "Show walls up",
      cutaway: "Show cutaway",
      wallsDown: "Show walls down",
    },
  },
  pause: "Pause",
  resume: "Resume",
  paused: "Paused",
} as const;

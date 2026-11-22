// Wires the sound to the browser: where the Volume is stored, when the browser lets sound start, the hidden tab, and the
// M key that mutes.
import { createSoundEngine, type SoundEngine } from "../sound/sound-engine";
import { createVolumeControl, type VolumeControl, type VolumeStorage } from "../sound/volume-control";

/** The game's Volume and the engine that plays its sound. */
export interface GameSound {
  readonly volumeControl: VolumeControl;
  readonly soundEngine: SoundEngine;
}

/** Makes the Volume and the sound engine, and wires them to the page. Call it once. */
export function wireSound(): GameSound {
  const volumeControl = createVolumeControl(browserStorage());
  const soundEngine = createSoundEngine(volumeControl);
  // Browsers let a page play sound only after the player clicks or presses a key, such as Continue on the start screen.
  for (const type of ["pointerdown", "keydown"] as const) {
    window.addEventListener(type, () => {
      soundEngine.start();
    });
  }
  // All sound stops while the tab is hidden, and fades back in when it is shown.
  document.addEventListener("visibilitychange", () => {
    soundEngine.setHidden(document.visibilityState === "hidden");
  });
  soundEngine.setHidden(document.visibilityState === "hidden");
  window.addEventListener("keydown", (event) => {
    if (event.code === "KeyM" && !event.repeat && !isTyping(event) && !event.metaKey && !event.ctrlKey && !event.altKey) volumeControl.toggleMute();
  });
  return { volumeControl, soundEngine };
}

/** The browser's local storage, or a stand-in that forgets everything when the page closes if the browser refuses it. */
function browserStorage(): VolumeStorage {
  try {
    return window.localStorage;
  } catch {
    const items = new Map<string, string>();
    return {
      getItem: (key) => items.get(key) ?? null,
      setItem: (key, value) => {
        items.set(key, value);
      },
    };
  }
}

/** Whether a key press goes to a field the player types in, so it should not act as a game key. */
function isTyping(event: KeyboardEvent): boolean {
  const target = event.target instanceof HTMLElement ? event.target : null;
  const field = target?.closest("input, textarea, select");
  // A slider takes arrow keys, not letters, so M still mutes while the Volume slider has focus.
  return field != null && !(field instanceof HTMLInputElement && field.type === "range");
}

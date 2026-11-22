// The player's Volume and mute. They are stored in the browser, not in the saved game, so they apply to every save slot.

/** Where the browser stores the Volume and mute. */
export const VOLUME_STORAGE_KEY = "far-hollow-volume";
/** The Volume a player starts with, from 0 (silent) to 1 (full). */
export const DEFAULT_VOLUME = 0.8;

/** The player's Volume, from 0 to 1, and whether they muted all sound. Muting keeps the Volume for when they unmute. */
export interface VolumeSetting {
  readonly volume: number;
  readonly muted: boolean;
}

/** The part of the browser's local storage the Volume uses. */
export type VolumeStorage = Pick<Storage, "getItem" | "setItem">;

/** Holds the Volume and mute, stores every change, and tells listeners about it. */
export interface VolumeControl {
  setting(): VolumeSetting;
  setVolume(volume: number): void;
  toggleMute(): void;
  /** Calls the listener after each change. Returns a function that stops it. */
  subscribe(listener: () => void): () => void;
}

/** How loud sound plays: the Volume, or 0 while muted. */
export function audibleVolume(setting: VolumeSetting): number {
  return setting.muted ? 0 : setting.volume;
}

/** Reads the stored Volume and mute. If the browser will not store anything, changes last until the page closes. */
export function createVolumeControl(storage: VolumeStorage): VolumeControl {
  let current = readSetting(storage);
  const listeners = new Set<() => void>();
  function change(next: VolumeSetting): void {
    current = next;
    try {
      storage.setItem(VOLUME_STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
      console.warn("The Volume could not be stored in this browser.", error);
    }
    for (const listener of listeners) listener();
  }
  return {
    setting: () => current,
    setVolume(volume) {
      change({ ...current, volume: clampVolume(volume) });
    },
    toggleMute() {
      change({ ...current, muted: !current.muted });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

function readSetting(storage: VolumeStorage): VolumeSetting {
  const fallback = { volume: DEFAULT_VOLUME, muted: false };
  try {
    const stored: unknown = JSON.parse(storage.getItem(VOLUME_STORAGE_KEY) ?? "null");
    if (typeof stored !== "object" || stored === null || !("volume" in stored) || !("muted" in stored)) return fallback;
    const { volume, muted } = stored;
    if (typeof volume !== "number" || !Number.isFinite(volume) || typeof muted !== "boolean") return fallback;
    return { volume: clampVolume(volume), muted };
  } catch {
    return fallback;
  }
}

function clampVolume(volume: number): number {
  return Math.min(1, Math.max(0, volume));
}

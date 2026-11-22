import { describe, expect, it } from "bun:test";
import { audibleVolume, createVolumeControl, DEFAULT_VOLUME, VOLUME_STORAGE_KEY, type VolumeStorage } from "./volume-control";

/** Stands in for the browser's local storage. */
function memoryStorage(start: Record<string, string> = {}): VolumeStorage & { items: Record<string, string> } {
  const items = { ...start };
  return {
    items,
    getItem: (key) => items[key] ?? null,
    setItem: (key, value) => {
      items[key] = value;
    },
  };
}

describe("the Volume", () => {
  it("starts at the default and not muted", () => {
    const control = createVolumeControl(memoryStorage());
    expect(control.setting()).toEqual({ volume: DEFAULT_VOLUME, muted: false });
  });

  it("is stored in the browser and comes back after a reload", () => {
    const storage = memoryStorage();
    createVolumeControl(storage).setVolume(0.3);
    expect(createVolumeControl(storage).setting()).toEqual({ volume: 0.3, muted: false });
  });

  it("stays between 0 and 1", () => {
    const control = createVolumeControl(memoryStorage());
    control.setVolume(4);
    expect(control.setting().volume).toBe(1);
    control.setVolume(-1);
    expect(control.setting().volume).toBe(0);
  });

  it("mutes and unmutes, keeping the Volume, and the mute survives a reload", () => {
    const storage = memoryStorage();
    const control = createVolumeControl(storage);
    control.setVolume(0.6);
    control.toggleMute();
    expect(control.setting()).toEqual({ volume: 0.6, muted: true });
    expect(audibleVolume(control.setting())).toBe(0);
    expect(createVolumeControl(storage).setting().muted).toBe(true);
    control.toggleMute();
    expect(audibleVolume(control.setting())).toBe(0.6);
  });

  it("falls back to the default when the stored value is broken", () => {
    const control = createVolumeControl(memoryStorage({ [VOLUME_STORAGE_KEY]: "not json" }));
    expect(control.setting()).toEqual({ volume: DEFAULT_VOLUME, muted: false });
    const wrongShape = createVolumeControl(memoryStorage({ [VOLUME_STORAGE_KEY]: JSON.stringify({ volume: "loud" }) }));
    expect(wrongShape.setting()).toEqual({ volume: DEFAULT_VOLUME, muted: false });
  });

  it("still works for this visit when the browser will not store anything", () => {
    const refusing: VolumeStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    const control = createVolumeControl(refusing);
    control.setVolume(0.2);
    expect(control.setting().volume).toBe(0.2);
  });

  it("tells listeners when it changes", () => {
    const control = createVolumeControl(memoryStorage());
    const seen: boolean[] = [];
    const stop = control.subscribe(() => seen.push(control.setting().muted));
    control.toggleMute();
    stop();
    control.toggleMute();
    expect(seen).toEqual([true]);
  });
});

// Draws the sound assets' review tools over the asset showcase at /?asset=sound-river, or any other sound showcase in
// SOUND_SHOWCASE_IDS. Development builds only. A loop showcase gets buttons that play each loop, so the owner can listen to it.
// The sound-button showcase draws the Volume slider and the sound button in each of its four views.
import { render } from "preact";
import { useState } from "preact/hooks";
import { createSoundEngine } from "../sound/sound-engine";
import type { SoundId } from "../sound/sound-mix";
import { createVolumeControl, type VolumeStorage } from "../sound/volume-control";
import { SoundButton, VolumeSlider } from "./sound-button";

/** The sound showcases. */
export const SOUND_SHOWCASE_IDS = [
  "sound-river",
  "sound-forest",
  "sound-fire",
  "sound-rain",
  "sound-rain-roof",
  "sound-birds",
  "sound-crickets",
  "sound-button",
] as const;

/** Storage that forgets everything when the page closes, so the showcase never changes the player's stored Volume. */
function forgetfulStorage(muted = false): VolumeStorage {
  const items = new Map<string, string>([["far-hollow-volume", JSON.stringify({ volume: 0.8, muted })]]);
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
  };
}

const LOOPS: readonly { sound: SoundId; name: string }[] = [
  { sound: "sound-river", name: "River" },
  { sound: "sound-forest", name: "Forest" },
  { sound: "sound-fire", name: "Fire" },
  { sound: "sound-rain", name: "Rain" },
  { sound: "sound-rain-roof", name: "Rain on a roof" },
  { sound: "sound-birds", name: "Birds" },
  { sound: "sound-crickets", name: "Crickets" },
];

/** Buttons that play one loop at a time at full loudness, and a Volume slider. The shown asset's button comes first. */
function LoopPlayer({ first }: { first: SoundId }) {
  const [control] = useState(() => createVolumeControl(forgetfulStorage()));
  const [engine] = useState(() => createSoundEngine(control));
  const [playing, setPlaying] = useState<SoundId | null>(null);
  const loops = [...LOOPS].sort((a, b) => Number(b.sound === first) - Number(a.sound === first));
  function play(sound: SoundId | null): void {
    engine.start();
    engine.play(sound === null ? [] : [{ key: sound, sound, loudness: 1, pan: 0 }], 0);
    setPlaying(sound);
  }
  return (
    <div class="hud hud-panel showcase-sound-player">
      {loops.map(({ sound, name }) => (
        <button
          key={sound}
          type="button"
          class="hud-button"
          aria-pressed={playing === sound}
          onClick={() => {
            play(playing === sound ? null : sound);
          }}
        >
          {playing === sound ? `Stop ${name}` : `Play ${name}`}
        </button>
      ))}
      <VolumeSlider control={control} />
    </div>
  );
}

/** Draws the sound review tools for one sound showcase over the views. */
export function renderSoundShowcase(ui: HTMLElement, asset: (typeof SOUND_SHOWCASE_IDS)[number]): void {
  if (asset !== "sound-button") {
    const holder = document.createElement("div");
    ui.append(holder);
    render(<LoopPlayer first={asset} />, holder);
    return;
  }
  const views = [
    <div class="start-screen-volume showcase-start-volume">
      <VolumeSlider control={createVolumeControl(forgetfulStorage())} />
    </div>,
    <SoundButton control={createVolumeControl(forgetfulStorage())} />,
    <SoundButton control={createVolumeControl(forgetfulStorage())} startsOpen />,
    <SoundButton control={createVolumeControl(forgetfulStorage(true))} startsOpen />,
  ];
  views.forEach((view, index) => {
    const quarter = document.createElement("div");
    quarter.className = `showcase-hud showcase-hud-${index}`;
    ui.append(quarter);
    render(view, quarter);
  });
}

// Draws the sound assets' review tools over the asset showcase at /?asset=sound-river, or any other sound showcase in
// SOUND_SHOWCASE_IDS. Development builds only. A sound showcase gets buttons that play each sound of its group, ambience
// or action sounds, so the owner can listen to it. A footstep or click repeats while it plays.
// The sound-button showcase draws the Volume slider and the sound button in each of its four views.
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import { createSoundEngine } from "../sound/sound-engine";
import type { SoundId, SoundWish } from "../sound/sound-mix";
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
  "sound-chop",
  "sound-saw",
  "sound-debark",
  "sound-dig",
  "sound-build",
  "sound-place",
  "sound-footstep",
  "sound-button",
] as const;

type SoundShowcaseId = (typeof SOUND_SHOWCASE_IDS)[number];

/** Whether a showcase id is one of the sound showcases. */
export function isSoundShowcase(id: string): id is SoundShowcaseId {
  return (SOUND_SHOWCASE_IDS as readonly string[]).includes(id);
}

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

/** One sound a showcase can play, with its name and, for a footstep or click, how often it repeats while it plays, in seconds. */
interface ShowcaseSound {
  readonly sound: SoundId;
  readonly name: string;
  readonly repeatSeconds?: number;
}

const AMBIENCE: readonly ShowcaseSound[] = [
  { sound: "sound-river", name: "River" },
  { sound: "sound-forest", name: "Forest" },
  { sound: "sound-fire", name: "Fire" },
  { sound: "sound-rain", name: "Rain" },
  { sound: "sound-rain-roof", name: "Rain on a roof" },
  { sound: "sound-birds", name: "Birds" },
  { sound: "sound-crickets", name: "Crickets" },
];

const ACTIONS: readonly ShowcaseSound[] = [
  { sound: "sound-chop", name: "Chop" },
  { sound: "sound-saw", name: "Saw" },
  { sound: "sound-debark", name: "Debark" },
  { sound: "sound-dig", name: "Dig" },
  { sound: "sound-build", name: "Build" },
  { sound: "sound-place", name: "Place", repeatSeconds: 1 },
  { sound: "sound-footstep", name: "Footsteps", repeatSeconds: 0.36 },
];

/** How often the player tells the engine what to play, in milliseconds, so a repeating footstep or click keeps time. */
const PLAY_EVERY_MS = 20;

/** What the engine plays for one showcase sound `seconds` after it began. */
function wishOf({ sound, repeatSeconds }: ShowcaseSound, seconds: number): SoundWish {
  if (repeatSeconds === undefined) return { key: sound, sound, loudness: 1, pan: 0, startAt: 0 };
  const count = Math.floor(seconds / repeatSeconds);
  return { key: `${sound}-${count}`, sound, loudness: 1, pan: 0, startAt: seconds - count * repeatSeconds };
}

/** Buttons that play one sound of the shown asset's group at a time, at full loudness, and a Volume slider. The shown asset's button comes first. */
function LoopPlayer({ first }: { first: SoundId }) {
  const [control] = useState(() => createVolumeControl(forgetfulStorage()));
  const [engine] = useState(() => createSoundEngine(control));
  const [playing, setPlaying] = useState<SoundId | null>(null);
  const group = AMBIENCE.some(({ sound }) => sound === first) ? AMBIENCE : ACTIONS;
  const loops = [...group].sort((a, b) => Number(b.sound === first) - Number(a.sound === first));
  useEffect(() => {
    const shown = group.find(({ sound }) => sound === playing);
    if (shown === undefined) {
      engine.play([], 0);
      return undefined;
    }
    const began = performance.now();
    const send = () => {
      engine.play([wishOf(shown, (performance.now() - began) / 1000)], 0);
    };
    send();
    const timer = setInterval(send, PLAY_EVERY_MS);
    return () => {
      clearInterval(timer);
    };
  }, [playing]);
  function play(sound: SoundId | null): void {
    engine.start();
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
export function renderSoundShowcase(ui: HTMLElement, asset: SoundShowcaseId): void {
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

// Which sounds play at once. The browser mixes at most MAX_SOUNDS, so the quietest ones stop when more want to play.
import type { DrawnWork } from "../render/drawn-work";

/** The most sounds that play at once. */
export const MAX_SOUNDS = 16;

/** Every ambience sound asset from asset-manifest.json. Each is a loop that plays as long as it is wished for. */
export const AMBIENCE_SOUND_IDS = ["sound-river", "sound-forest", "sound-fire", "sound-rain", "sound-rain-roof", "sound-birds", "sound-crickets"] as const;

/** An ambience sound asset from asset-manifest.json. */
export type AmbienceSoundId = (typeof AMBIENCE_SOUND_IDS)[number];

/**
 * Every action sound asset from asset-manifest.json, and whether it plays once and ends. The others loop while the work
 * goes on. Each starts where the player's motion is, so it plays in time with it.
 */
const ACTION_SOUNDS = {
  "sound-chop": { playsOnce: false },
  "sound-saw": { playsOnce: false },
  "sound-debark": { playsOnce: false },
  "sound-dig": { playsOnce: false },
  "sound-build": { playsOnce: false },
  "sound-place": { playsOnce: true },
  "sound-footstep": { playsOnce: true },
} as const satisfies Record<string, { readonly playsOnce: boolean }>;

/** An action sound asset from asset-manifest.json. */
export type ActionSoundId = keyof typeof ACTION_SOUNDS;

/** A sound asset from asset-manifest.json. */
export type SoundId = AmbienceSoundId | ActionSoundId;

/** Whether a sound is ambience, rather than an action sound. */
export function isAmbienceSound(sound: SoundId): sound is AmbienceSoundId {
  return (AMBIENCE_SOUND_IDS as readonly SoundId[]).includes(sound);
}

/** Whether a sound plays once and ends, rather than loops while it is wished for. */
export function playsOnce(sound: SoundId): boolean {
  return !isAmbienceSound(sound) && ACTION_SOUNDS[sound].playsOnce;
}

/**
 * The key of each sound that can play more than once at a time, or again as a new sound. docs/agents/game-testing.md
 * documents the fire key for tests.
 */
export const soundKeys = {
  /** A campfire or fireplace, by its entity id, such as "fire-12". */
  fire: (entityId: number): string => `fire-${entityId}`,
  /** Work drawn now, by its kind and when its motion began on the performance clock, in seconds. */
  work: (kind: DrawnWork, sinceSeconds: number): string => `work-${kind}-${Math.round(sinceSeconds * 1000)}`,
  /** A footstep, by its number in the walk. */
  footstep: (index: number): string => `footstep-${index}`,
  /** A place click, by its number since sound began. */
  place: (count: number): string => `place-${count}`,
};

/** One sound that wants to play this frame. */
export interface SoundWish {
  /** Names this sound among all that play, such as "fire-12", so it keeps playing smoothly from frame to frame. */
  readonly key: string;
  readonly sound: SoundId;
  /** How loud it plays before the Volume, from 0 (silent) to 1. */
  readonly loudness: number;
  /** Which side it comes from: -1 fully left, 0 in the middle, 1 fully right. */
  readonly pan: number;
  /**
   * Where in the sound it starts, in seconds, when it starts this frame. An action sound gives it, so it keeps in time
   * with the motion. Without it, a loop starts at a random place, so two fires never crackle in step.
   */
  readonly startAt?: number;
}

/** The sounds that play: the loudest MAX_SOUNDS that are not silent, loudest first. */
export function soundsToPlay(wishes: readonly SoundWish[]): SoundWish[] {
  return wishes
    .filter((wish) => wish.loudness > 0)
    .sort((a, b) => b.loudness - a.loudness)
    .slice(0, MAX_SOUNDS);
}

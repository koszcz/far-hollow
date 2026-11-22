// Which sounds play at once. The browser mixes at most MAX_SOUNDS, so the quietest ones stop when more want to play.

/** The most sounds that play at once. */
export const MAX_SOUNDS = 16;

/** Every ambience sound asset from asset-manifest.json. Each is a loop that plays as long as it is wished for. */
export const AMBIENCE_SOUND_IDS = ["sound-river", "sound-forest", "sound-fire", "sound-rain", "sound-rain-roof", "sound-birds", "sound-crickets"] as const;

/** An ambience sound asset from asset-manifest.json. */
export type AmbienceSoundId = (typeof AMBIENCE_SOUND_IDS)[number];

/** An action sound asset from asset-manifest.json. Each plays from the start of its rhythm, in time with what the player does. */
export type ActionSoundId = "sound-chop" | "sound-saw" | "sound-debark" | "sound-dig" | "sound-build" | "sound-place" | "sound-footstep";

/** A sound asset from asset-manifest.json. */
export type SoundId = AmbienceSoundId | ActionSoundId;

/** Whether a sound is ambience, rather than an action sound. */
export function isAmbienceSound(sound: SoundId): sound is AmbienceSoundId {
  return (AMBIENCE_SOUND_IDS as readonly SoundId[]).includes(sound);
}

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

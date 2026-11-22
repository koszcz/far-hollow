// Which sounds play at once. The browser mixes at most MAX_SOUNDS, so the quietest ones stop when more want to play.

/** The most sounds that play at once. */
export const MAX_SOUNDS = 16;

/** Every sound asset from asset-manifest.json. */
export const SOUND_IDS = ["sound-river", "sound-forest", "sound-fire", "sound-rain", "sound-rain-roof", "sound-birds", "sound-crickets"] as const;

/** A sound asset from asset-manifest.json. */
export type SoundId = (typeof SOUND_IDS)[number];

/** One sound that wants to play this frame. */
export interface SoundWish {
  /** Names this sound among all that play, such as "fire-12", so it keeps playing smoothly from frame to frame. */
  readonly key: string;
  readonly sound: SoundId;
  /** How loud it plays before the Volume, from 0 (silent) to 1. */
  readonly loudness: number;
  /** Which side it comes from: -1 fully left, 0 in the middle, 1 fully right. */
  readonly pan: number;
}

/** The sounds that play: the loudest MAX_SOUNDS that are not silent, loudest first. */
export function soundsToPlay(wishes: readonly SoundWish[]): SoundWish[] {
  return wishes
    .filter((wish) => wish.loudness > 0)
    .sort((a, b) => b.loudness - a.loudness)
    .slice(0, MAX_SOUNDS);
}

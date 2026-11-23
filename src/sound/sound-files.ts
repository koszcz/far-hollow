// The approved sound assets in asset-manifest.json that play from a recorded file rather than from code, and where each is.
// - sound-forest: forest.ogg, 26 s of leaves rustling in the wind, cut from "Soft Wind in the Trees - Leaves rustle" by
//   Borgory on Freesound (CC0). Its end blends into its start, so it loops without a seam.
import type { AmbienceSoundId, SoundId } from "./sound-mix";

/** Each sound that plays from a file, and the file's path under the site's base URL. */
const SOUND_FILES = {
  "sound-forest": "assets/sound-forest/forest.ogg",
} as const satisfies Partial<Record<SoundId, string>>;

/** A sound that plays from a recorded file. */
export type FileSoundId = keyof typeof SOUND_FILES;

/** An ambience sound built in code, sample by sample. */
export type CodeAmbienceSoundId = Exclude<AmbienceSoundId, FileSoundId>;

/** Whether a sound plays from a recorded file, rather than from code. */
export function isFileSound(sound: SoundId): sound is FileSoundId {
  return sound in SOUND_FILES;
}

/** Where a sound's file is, under the site's base URL. */
export function soundFilePath(sound: FileSoundId): string {
  return SOUND_FILES[sound];
}

/** Every sound that plays from a file. */
export const FILE_SOUND_IDS = Object.keys(SOUND_FILES) as FileSoundId[];

// The action sounds of ticket 02: chopping, sawing, debarking, digging up, building, footsteps, and the click of placing a
// blueprint or taking a piece down. It reads what the drawn player does each frame and says which sounds want to play,
// in time with the motions. It never changes game state.
import type { GroundPoint } from "../sim/ground-point";
import { CROUCH_CYCLE_SECONDS } from "../render/player-build-pose";
import { DEBARK_STROKE_SECONDS } from "../render/player-debark-pose";
import { CHOP_SWINGS_PER_SECOND, STRIDE_METRES } from "../render/player-mesh";
import { SAW_STROKE_SECONDS } from "../render/player-saw-pose";
import type { DrawnWork } from "../render/drawn-work";
import { distanceFade, panToward, type Listener } from "./listener";
import { soundKeys, type ActionSoundId, type SoundWish } from "./sound-mix";

/** How one kind of work sounds: its sound, how long one beat of its motion lasts, and how loud it plays beside the player. */
interface WorkRhythm {
  readonly sound: ActionSoundId;
  readonly beatSeconds: number;
  /** Whether the motion keeps time by the clock, as the chop clip does, rather than from when the work began. */
  readonly byClock: boolean;
  readonly loudness: number;
}

/** Seconds one stroke of the spade takes while digging up. Digging up has no motion of its own, so the sound sets the pace. */
export const DIG_STROKE_SECONDS = 1.2;

/** Each kind of work's rhythm. Each work sound is a loop exactly one beat long, so it stays in time with the motion. */
export const WORK_RHYTHMS: Readonly<Record<DrawnWork, WorkRhythm>> = {
  chop: { sound: "sound-chop", beatSeconds: 1 / CHOP_SWINGS_PER_SECOND, byClock: true, loudness: 0.8 },
  saw: { sound: "sound-saw", beatSeconds: SAW_STROKE_SECONDS, byClock: false, loudness: 0.55 },
  debark: { sound: "sound-debark", beatSeconds: DEBARK_STROKE_SECONDS, byClock: false, loudness: 0.5 },
  digUp: { sound: "sound-dig", beatSeconds: DIG_STROKE_SECONDS, byClock: false, loudness: 0.6 },
  build: { sound: "sound-build", beatSeconds: CROUCH_CYCLE_SECONDS, byClock: false, loudness: 0.6 },
};

/**
 * Where each foot comes down in one loop of the walk clip, as a share of the loop: the left foot at this share, and the
 * right foot half a loop later. Measured from the clip's foot bones.
 */
export const FOOT_DOWN_SHARE = 0.18;
/** How long one footstep sounds, in seconds. */
export const FOOTSTEP_SECONDS = 0.25;
const FOOTSTEP_LOUDNESS = 0.35;
/** How long the click of placing a blueprint or taking a piece down sounds, in seconds. */
export const PLACE_SECONDS = 0.12;
const PLACE_LOUDNESS = 0.3;

/** What the drawn player does this frame, as the sound layer hears it. */
export interface PlayerSoundsNow {
  /** Where the player is. Every action sound comes from here. */
  readonly spot: GroundPoint;
  /** The timed work drawn now, with when its motion began on the performance clock, in seconds. */
  readonly work?: { readonly kind: DrawnWork; readonly since: number };
  /** The total metres walked so far as drawn, or undefined while the drawn player does not walk. */
  readonly walkedMetres?: number;
  /** How many blueprints were placed or pieces taken down since the last frame. */
  readonly clicks: number;
  /** Whether the sleep animation plays. No action sound plays then. */
  readonly asleep: boolean;
}

export interface ActionSounds {
  /** The action sounds the listener hears now. `nowSeconds` is the performance clock, as the drawing uses. */
  wishes(listener: Listener, player: PlayerSoundsNow, nowSeconds: number): SoundWish[];
}

/** Which footstep the walk is on at this many metres walked: one more for each foot that comes down. */
function stepIndex(walkedMetres: number): number {
  return Math.floor((walkedMetres / STRIDE_METRES - FOOT_DOWN_SHARE) * 2);
}

/** How far into a beat of `beatSeconds` the clock is, `seconds` after the beats began, in seconds. */
function intoBeat(seconds: number, beatSeconds: number): number {
  return ((seconds % beatSeconds) + beatSeconds) % beatSeconds;
}

/** A sound that plays once: its number among the sounds of its kind, which names it, and when it began, in seconds. */
interface OneShot {
  readonly number: number;
  readonly startedAt: number;
}

/** How one kind of one-shot sound plays: its sound, how long it lasts, how loud it plays beside the player, and its key. */
interface OneShotSound {
  readonly sound: ActionSoundId;
  readonly seconds: number;
  readonly loudness: number;
  readonly key: (number: number) => string;
}

const FOOTSTEP: OneShotSound = { sound: "sound-footstep", seconds: FOOTSTEP_SECONDS, loudness: FOOTSTEP_LOUDNESS, key: soundKeys.footstep };
const PLACE_CLICK: OneShotSound = { sound: "sound-place", seconds: PLACE_SECONDS, loudness: PLACE_LOUDNESS, key: soundKeys.place };

/** The one-shot sound while it still rings at `nowSeconds`, starting as far in as it has played, or undefined once it ends. */
function ringing(kind: OneShotSound, shot: OneShot | undefined, nowSeconds: number, loudnessHere: number, pan: number): SoundWish | undefined {
  if (shot === undefined || nowSeconds - shot.startedAt >= kind.seconds) return undefined;
  return { key: kind.key(shot.number), sound: kind.sound, loudness: kind.loudness * loudnessHere, pan, startAt: nowSeconds - shot.startedAt };
}

export function createActionSounds(): ActionSounds {
  /** The footstep last heard, by its number in the walk, and when its foot came down. */
  let lastStep: OneShot | undefined;
  /** The click last heard, counted from the first, and when it happened. */
  let lastClick: OneShot | undefined;

  return {
    wishes(listener, player, nowSeconds) {
      if (player.asleep) {
        lastStep = undefined;
        lastClick = undefined;
        return [];
      }
      const loudnessHere = distanceFade(listener, player.spot);
      const pan = panToward(listener, player.spot);
      const wishes: SoundWish[] = [];
      const { work } = player;
      if (work !== undefined) {
        const rhythm = WORK_RHYTHMS[work.kind];
        const origin = rhythm.byClock ? 0 : work.since;
        wishes.push({
          key: soundKeys.work(work.kind, work.since),
          sound: rhythm.sound,
          loudness: rhythm.loudness * loudnessHere,
          pan,
          startAt: intoBeat(nowSeconds - origin, rhythm.beatSeconds),
        });
      }
      if (player.walkedMetres === undefined) lastStep = undefined;
      else {
        const index = stepIndex(player.walkedMetres);
        // Where the walk starts is no footstep, so it began long ago.
        if (lastStep === undefined) lastStep = { number: index, startedAt: Number.NEGATIVE_INFINITY };
        else if (index !== lastStep.number) lastStep = { number: index, startedAt: nowSeconds };
      }
      if (player.clicks > 0) lastClick = { number: (lastClick?.number ?? 0) + player.clicks, startedAt: nowSeconds };
      for (const wish of [ringing(FOOTSTEP, lastStep, nowSeconds, loudnessHere, pan), ringing(PLACE_CLICK, lastClick, nowSeconds, loudnessHere, pan)]) {
        if (wish !== undefined) wishes.push(wish);
      }
      return wishes;
    },
  };
}

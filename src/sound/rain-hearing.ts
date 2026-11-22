// How the player hears rain: plain rain in the open, or a muffled drumming under a roof. See docs/adr/0009.
// "Under a roof" uses the same rule as the player's shelter from rain, so the drumming plays wherever rain would not fall on them.
import { easeRainShare } from "../render/wind";
import { easeToward, equalPowerCrossfade, smoothStep } from "../sim/share";

/** How loud the rain is in the open at full strength, before the Volume. */
const RAIN_LOUDNESS = 0.6;
/** How loud the drumming on a roof is at full strength, before the Volume. */
const ROOF_LOUDNESS = 0.5;
/** How long walking in or out from under a roof takes to crossfade between the two rain sounds, in seconds. */
const ROOF_CROSSFADE_SECONDS = 0.8;

/** What the player hears of the rain, as two shares that each ease between 0 and 1. */
export interface RainHearing {
  /** How far the rain has eased in: 0 dry, 1 full rain. It eases in and out with the drawn rain. */
  readonly falling: number;
  /** How far the player has gone under a roof: 0 in the open, 1 under a roof. */
  readonly underRoof: number;
}

/** How loud each rain sound plays, before the Volume, from 0 to 1. */
export interface RainLoudness {
  /** The rain in the open. */
  readonly open: number;
  /** The muffled drumming on a roof. */
  readonly roof: number;
}

/** The rain as it is now, with no easing, such as on the first frame of a loaded game. */
export function rainHearingNow(raining: boolean, underRoof: boolean): RainHearing {
  return { falling: raining ? 1 : 0, underRoof: underRoof ? 1 : 0 };
}

/** Moves the hearing on by `elapsedSeconds` toward whether it rains and whether the player is under a roof. */
export function easeRainHearing(hearing: RainHearing, raining: boolean, underRoof: boolean, elapsedSeconds: number): RainHearing {
  return {
    falling: easeRainShare(hearing.falling, raining, elapsedSeconds),
    underRoof: easeToward(hearing.underRoof, underRoof ? 1 : 0, elapsedSeconds / ROOF_CROSSFADE_SECONDS),
  };
}

/** How loud the rain and the drumming on a roof play. They crossfade with equal power, so the rain never dips halfway. */
export function rainLoudness(hearing: RainHearing): RainLoudness {
  // The rain eases in with no sudden start or stop, as the drawn rain does.
  const falling = smoothStep(hearing.falling);
  const { from: open, to: roof } = equalPowerCrossfade(hearing.underRoof);
  return { open: RAIN_LOUDNESS * falling * open, roof: ROOF_LOUDNESS * falling * roof };
}

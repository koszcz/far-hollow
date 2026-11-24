// Decides where the fireflies are and how brightly each one glows. It draws nothing: firefly-effect.ts draws them.
// Fireflies are only for looks. Game logic never sees them, they are never saved, and they start in new random places
// each time the game loads. They ignore the camp and fire: nothing the player builds or lights keeps them away.
// - Each firefly has a home spot over a clearing or the river bank near the player. It drifts slowly around its home.
// - Each firefly flashes: about a second of light that rises fast and fades slower, then a few
//   seconds of dark. While lit it climbs in a short upward stroke, then sinks back slowly in the dark.
// - When the player walks away, a firefly left too far behind finds a new home near the player while it is dark.
// - Fireflies fade in at dusk and out at dawn, following daylight. They fade out when rain starts and back in after.
import { addGroundPoints, groundDistance, randomPointAround, type GroundPoint } from "../sim/ground-point";
import { groundTypeAt, type GroundMap } from "../sim/ground-types";
import { randomBetween, type Random } from "../sim/random";
import { isRiverWater } from "../sim/valley";
import { createEasedShare } from "./eased-share";
import { easeInOut, smoothstep } from "./easing";

export const FIREFLY_COUNT = 40;
/** Fireflies make their homes within this distance of the player, in metres. */
export const FIREFLY_RADIUS_METRES = 20;
/** A firefly drifts up to this far from its home each way along the ground, in metres. */
export const FIREFLY_DRIFT_METRES = 1.2;
/** A firefly's home is picked between these heights above the ground, in metres. */
const HOME_HEIGHT_METRES = { min: 0.3, max: 1.4 };
/** A firefly bobs up and down by up to this much, in metres. */
const BOB_METRES = 0.2;
/** How long a firefly's drift takes to come round, picked between these, in seconds. Slow, so it drifts lazily. */
const DRIFT_SECONDS = { min: 9, max: 18 };
/** How long one flash cycle takes, light and dark together, picked between these, in seconds. */
const BLINK_SECONDS = { min: 3, max: 5 };
/** How long a flash takes to brighten to full, in seconds. Fast, like a switch thrown. */
const FLASH_RISE_SECONDS = 0.2;
/** How long a flash takes to fade from full to dark, in seconds. Slower than the rise. */
const FLASH_FADE_SECONDS = 0.9;
/** How far a firefly climbs during one flash, in metres. It sinks back while dark. */
const FLASH_LIFT_METRES = 0.22;
/** How many spots a firefly with no home tries each frame. Deep in the forest, few spots are open. */
const HOME_TRIES_PER_FRAME = 4;
/** How long the fireflies take to fade out when rain starts, and back in when it stops, in seconds. */
const RAIN_FADE_SECONDS = 4;
/** The four corners of a firefly's drift, as steps from its home. Its whole drift stays inside them. */
const DRIFT_CORNERS: readonly GroundPoint[] = [-1, 1].flatMap((x) => [-1, 1].map((z) => ({ x: x * FIREFLY_DRIFT_METRES, z: z * FIREFLY_DRIFT_METRES })));

/** The ground fireflies fly over. */
export interface FireflyGround {
  /** Whether a firefly may fly over this spot: a clearing or the river bank, but not the water. */
  isOpen(spot: GroundPoint): boolean;
  heightAt(x: number, z: number): number;
}

/** One firefly where it is now. */
export interface FireflyGlow {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** How brightly it glows, from 0 (dark) to 1 (full). */
  readonly glow: number;
}

export interface FireflySwarm {
  /**
   * Moves every firefly to where it is at `nowSeconds`, near `player`, and returns the fireflies that have a home.
   * `daylight` runs from 0 (night) to 1 (full day).
   */
  update(nowSeconds: number, player: GroundPoint, daylight: number, raining: boolean): readonly FireflyGlow[];
}

/** Where a firefly drifts around: a spot on the ground, and how high above it the firefly flies, in metres. */
interface FireflyHome {
  readonly spot: GroundPoint;
  readonly height: number;
}

interface Firefly {
  home: FireflyHome | undefined;
  readonly driftSeconds: number;
  readonly driftPhase: number;
  readonly blinkSeconds: number;
  readonly blinkPhase: number;
}

/** Whether fireflies may fly over a spot of this valley: a clearing or the river bank, but not over the water. */
export function fireflyOpenGround(map: GroundMap): (spot: GroundPoint) => boolean {
  return (spot) => {
    const type = groundTypeAt(map, spot);
    if (type === "forestFloor") return false;
    return type === "clearing" || !isRiverWater(map.river, spot);
  };
}

/** Makes the fireflies. They pick their homes on the first night they are shown. */
export function createFireflySwarm(ground: FireflyGround, random: Random = Math.random): FireflySwarm {
  const fireflies: Firefly[] = Array.from({ length: FIREFLY_COUNT }, () => ({
    home: undefined,
    driftSeconds: randomBetween(random, DRIFT_SECONDS),
    driftPhase: random() * Math.PI * 2,
    blinkSeconds: randomBetween(random, BLINK_SECONDS),
    blinkPhase: random(),
  }));
  // How much the rain lets the fireflies show, from 0 (raining) to 1 (dry). It eases towards the weather.
  const dryWeather = createEasedShare({ riseSeconds: RAIN_FADE_SECONDS, fallSeconds: RAIN_FADE_SECONDS });
  let lastSeconds = 0;

  /** A home over open ground near the player, so the whole drift stays over open ground, or undefined if none was found. */
  function findHome(player: GroundPoint): FireflyHome | undefined {
    for (let attempt = 0; attempt < HOME_TRIES_PER_FRAME; attempt += 1) {
      const spot = randomPointAround(player, { max: FIREFLY_RADIUS_METRES }, random);
      const height = randomBetween(random, HOME_HEIGHT_METRES);
      if (driftStaysOpen(spot)) return { spot, height };
    }
    return undefined;
  }

  function driftStaysOpen(home: GroundPoint): boolean {
    return ground.isOpen(home) && DRIFT_CORNERS.every((corner) => ground.isOpen(addGroundPoints(home, corner)));
  }

  return {
    update(nowSeconds, player, daylight, raining) {
      // The first frame shows the weather as it is, so a game loaded in the rain does not fade.
      const dry = dryWeather.toward(raining ? 0 : 1, Math.abs(nowSeconds - lastSeconds));
      lastSeconds = nowSeconds;
      // How strongly the fireflies show, from 0 (none) to 1 (full): the dark of night, dimmed by the rain.
      const strength = (1 - daylight) * dry;
      if (strength <= 0) return [];

      const glows: FireflyGlow[] = [];
      for (const firefly of fireflies) {
        const blink = blinkAt(firefly, nowSeconds);
        const far = firefly.home !== undefined && groundDistance(firefly.home.spot, player) > FIREFLY_RADIUS_METRES;
        // A firefly moves home only while it is dark, so it never jumps while glowing.
        if (firefly.home === undefined || (far && blink === 0)) firefly.home = findHome(player);
        const home = firefly.home;
        if (home === undefined) continue;
        const turn = (nowSeconds / firefly.driftSeconds) * Math.PI * 2 + firefly.driftPhase;
        const x = home.spot.x + Math.sin(turn) * FIREFLY_DRIFT_METRES;
        const z = home.spot.z + Math.sin(turn * 0.7 + 1.3) * FIREFLY_DRIFT_METRES;
        const y = ground.heightAt(x, z) + home.height + Math.sin(turn * 1.9) * BOB_METRES + liftAt(firefly, nowSeconds);
        glows.push({ x, y, z, glow: blink * strength });
      }
      return glows;
    },
  };
}

/** How far into its flash cycle a firefly is at this moment, in seconds from the start of its flash. */
function cycleSecondsAt(firefly: Firefly, nowSeconds: number): number {
  return ((nowSeconds / firefly.blinkSeconds + firefly.blinkPhase) % 1) * firefly.blinkSeconds;
}

/** How brightly a firefly glows at this moment, from 0 to 1: a fast rise, a slower fade, then dark. */
function blinkAt(firefly: Firefly, nowSeconds: number): number {
  const seconds = cycleSecondsAt(firefly, nowSeconds);
  if (seconds < FLASH_RISE_SECONDS) return smoothstep(seconds / FLASH_RISE_SECONDS);
  const fading = (seconds - FLASH_RISE_SECONDS) / FLASH_FADE_SECONDS;
  return fading < 1 ? (1 - fading) ** 2 : 0;
}

/** How far above its drift a firefly is at this moment, in metres: it climbs while it flashes and sinks while dark. */
function liftAt(firefly: Firefly, nowSeconds: number): number {
  const seconds = cycleSecondsAt(firefly, nowSeconds);
  const flashSeconds = FLASH_RISE_SECONDS + FLASH_FADE_SECONDS;
  if (seconds < flashSeconds) return FLASH_LIFT_METRES * easeInOut(seconds / flashSeconds);
  return FLASH_LIFT_METRES * (1 - easeInOut((seconds - flashSeconds) / (firefly.blinkSeconds - flashSeconds)));
}

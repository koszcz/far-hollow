// Decides where the fireflies are and how brightly each one glows. It draws nothing: firefly-effect.ts draws them.
// Fireflies are only for looks. Game logic never sees them, they are never saved, and they start in new random places
// each time the game loads. They ignore the camp and fire: nothing the player builds or lights keeps them away.
// - Each firefly has a home spot over a clearing or the river bank near the player. It drifts slowly around its home.
// - Each firefly blinks: it glows briefly, then stays dark for a few seconds.
// - When the player walks away, a firefly left too far behind finds a new home near the player while it is dark.
// - Fireflies fade in at dusk and out at dawn, following daylight. They fade out when rain starts and back in after.
import { groundTypeAt, type GroundMap } from "../sim/ground-types";
import type { Random } from "../sim/random";
import { distanceToRiver } from "../sim/valley";

export const FIREFLY_COUNT = 40;
/** Fireflies make their homes within this distance of the player, in metres. */
export const FIREFLY_RADIUS_METRES = 20;
/** A firefly drifts up to this far from its home each way along the ground, in metres. */
export const FIREFLY_DRIFT_METRES = 1.2;
/** A firefly's home is picked between these heights above the ground, in metres. */
const HOME_HEIGHT_METRES = { min: 0.4, max: 1.8 };
/** A firefly bobs up and down by up to this much, in metres. */
const BOB_METRES = 0.3;
/** How long a firefly's drift takes to come round, picked between these, in seconds. Slow, so it drifts lazily. */
const DRIFT_SECONDS = { min: 9, max: 18 };
/** How long one blink cycle takes, picked between these, in seconds. */
const BLINK_SECONDS = { min: 2.5, max: 5 };
/** The share of each blink cycle that the firefly glows. It is dark for the rest. */
const GLOW_SHARE = 0.4;
/** How many spots a firefly with no home tries each frame. Deep in the forest, few spots are open. */
const HOME_TRIES_PER_FRAME = 4;
/** How long the fireflies take to fade out when rain starts, and back in when it stops, in seconds. */
const RAIN_FADE_SECONDS = 4;

/** The ground fireflies fly over. */
export interface FireflyGround {
  /** Whether a firefly may fly over this spot: a clearing or the river bank, but not the water. */
  isOpen(x: number, z: number): boolean;
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
  update(nowSeconds: number, player: { readonly x: number; readonly z: number }, daylight: number, raining: boolean): readonly FireflyGlow[];
}

interface Firefly {
  home: { x: number; z: number; height: number } | undefined;
  readonly driftSeconds: number;
  readonly driftPhase: number;
  readonly blinkSeconds: number;
  readonly blinkPhase: number;
}

/** Whether fireflies may fly over a spot of this valley: a clearing or the river bank, but not over the water. */
export function fireflyOpenGround(map: GroundMap): (x: number, z: number) => boolean {
  return (x, z) => {
    const type = groundTypeAt(map, { x, z });
    if (type === "forestFloor") return false;
    return type === "clearing" || distanceToRiver(map.river, { x, z }) >= map.river.width / 2;
  };
}

/** Makes the fireflies. They pick their homes on the first night they are shown. */
export function createFireflySwarm(ground: FireflyGround, random: Random = Math.random): FireflySwarm {
  const fireflies: Firefly[] = Array.from({ length: FIREFLY_COUNT }, () => ({
    home: undefined,
    driftSeconds: between(DRIFT_SECONDS, random()),
    driftPhase: random() * Math.PI * 2,
    blinkSeconds: between(BLINK_SECONDS, random()),
    blinkPhase: random(),
  }));
  // How much the rain lets the fireflies show, from 0 (raining) to 1 (dry). It eases towards the weather.
  let dryness: number | undefined;
  let lastSeconds = 0;

  /** A home over open ground near the player, so the whole drift stays over open ground, or undefined if none was found. */
  function findHome(player: { readonly x: number; readonly z: number }): Firefly["home"] {
    for (let attempt = 0; attempt < HOME_TRIES_PER_FRAME; attempt += 1) {
      const angle = random() * Math.PI * 2;
      const distance = Math.sqrt(random()) * FIREFLY_RADIUS_METRES;
      const x = player.x + Math.cos(angle) * distance;
      const z = player.z + Math.sin(angle) * distance;
      const height = between(HOME_HEIGHT_METRES, random());
      if (driftStaysOpen(x, z)) return { x, z, height };
    }
    return undefined;
  }

  function driftStaysOpen(x: number, z: number): boolean {
    const d = FIREFLY_DRIFT_METRES;
    return ground.isOpen(x, z) && ground.isOpen(x - d, z - d) && ground.isOpen(x + d, z - d) && ground.isOpen(x - d, z + d) && ground.isOpen(x + d, z + d);
  }

  return {
    update(nowSeconds, player, daylight, raining) {
      const target = raining ? 0 : 1;
      // The first frame shows the weather as it is, so a game loaded in the rain does not fade.
      const step = dryness === undefined ? 1 : Math.abs(nowSeconds - lastSeconds) / RAIN_FADE_SECONDS;
      dryness = moveTowards(dryness ?? target, target, step);
      lastSeconds = nowSeconds;
      const shown = (1 - daylight) * dryness;
      if (shown <= 0) return [];

      const glows: FireflyGlow[] = [];
      for (const firefly of fireflies) {
        const blink = blinkAt(firefly, nowSeconds);
        const far = firefly.home !== undefined && Math.hypot(firefly.home.x - player.x, firefly.home.z - player.z) > FIREFLY_RADIUS_METRES;
        // A firefly moves home only while it is dark, so it never jumps while glowing.
        if (firefly.home === undefined || (far && blink === 0)) firefly.home = findHome(player);
        const home = firefly.home;
        if (home === undefined) continue;
        const turn = (nowSeconds / firefly.driftSeconds) * Math.PI * 2 + firefly.driftPhase;
        const x = home.x + Math.sin(turn) * FIREFLY_DRIFT_METRES;
        const z = home.z + Math.sin(turn * 0.7 + 1.3) * FIREFLY_DRIFT_METRES;
        const y = ground.heightAt(x, z) + home.height + Math.sin(turn * 1.9) * BOB_METRES;
        glows.push({ x, y, z, glow: blink * shown });
      }
      return glows;
    },
  };
}

/** How brightly a firefly's blink glows at this moment, from 0 to 1: a quick swell and fade, then dark. */
function blinkAt(firefly: Firefly, nowSeconds: number): number {
  const cycle = (nowSeconds / firefly.blinkSeconds + firefly.blinkPhase) % 1;
  return cycle < GLOW_SHARE ? Math.sin((cycle / GLOW_SHARE) * Math.PI) : 0;
}

function between(range: { min: number; max: number }, share: number): number {
  return range.min + (range.max - range.min) * share;
}

function moveTowards(value: number, target: number, step: number): number {
  return value < target ? Math.min(value + step, target) : Math.max(value - step, target);
}

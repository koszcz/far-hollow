// The showcase of the approved "fishing-animation": the player casts the approved "fishing-rod" out over a stand-in pool, waits, and lands a raw fish.
import * as THREE from "three";
import { REAL_MS_PER_GAME_MINUTE } from "../../../sim/clock";
import { FISH_MIN_WAIT_MINUTES } from "../../../sim/fishing";
import {
  FISH_CAST_SECONDS,
  FISH_HOLD_SHARE,
  FISH_LIFTED_SHARE,
  FISH_REEL_SECONDS,
  FISH_STRUCK_SHARE,
  FISH_SWUNG_BACK_SHARE,
  FISH_WHIPPED_SHARE,
} from "../../player-fish-pose";
import type { Showcase } from "../types";

/**
 * How long each wait for a fish lasts in the "fishing-animation" showcase, in seconds: the shortest wait in the game.
 * The player casts this many times, then lowers the rod and rests before it plays again.
 */
const FISH_PLAY_WAIT_SECONDS = (FISH_MIN_WAIT_MINUTES * REAL_MS_PER_GAME_MINUTE) / 1000;
const FISH_PLAY_CASTS = 2;
const FISH_PLAY_REST_SECONDS = 1.5;
/** Where the line lands in the "fishing-animation" showcase, in front of the player's feet, in metres. */
const FISH_SHOWCASE_FLOAT_METRES = 3.5;
/** A flat stand-in for the water in the "fishing-animation" showcase, which stands on flat ground away from the river. */
const FISH_SHOWCASE_POOL = { from: 2.2, to: 6.5, width: 5, lift: 0.01, colour: 0x3f8f9c };

/** Fishing as the "fishing-animation" showcase shows it, `sinceCast` seconds into a cast that waits FISH_PLAY_WAIT_SECONDS. */
function fishingAt(nowSeconds: number, sinceCast: number) {
  return {
    nowSeconds,
    sinceCast,
    toBite: Math.max(0, FISH_PLAY_WAIT_SECONDS - sinceCast),
    floatForward: FISH_SHOWCASE_FLOAT_METRES,
    floatHeight: FISH_SHOWCASE_POOL.lift,
  };
}

export const FISHING_ANIMATION_SHOWCASE: Showcase = {
  radius: 2.6,
  focus: { x: 0, y: 1, z: 1.4 },
  shots: [
    { label: "rod swung back", seconds: ((FISH_SWUNG_BACK_SHARE + FISH_HOLD_SHARE) / 2) * FISH_CAST_SECONDS },
    { label: "line rolling out", seconds: ((FISH_WHIPPED_SHARE + 1) / 2) * FISH_CAST_SECONDS },
    { label: "hook set, rod bent", seconds: FISH_PLAY_WAIT_SECONDS - FISH_REEL_SECONDS * (1 - FISH_STRUCK_SHARE) },
    { label: "fish swinging in", seconds: FISH_PLAY_WAIT_SECONDS - FISH_REEL_SECONDS * (1 - (FISH_LIFTED_SHARE + 0.1)) },
  ].map(({ label, seconds }) => ({ label, yaw: -55, pitch: 12, seconds })),
  build({ addProp, movePlayer }) {
    const pool = FISH_SHOWCASE_POOL;
    const water = new THREE.PlaneGeometry(pool.width, pool.to - pool.from).rotateX(-Math.PI / 2);
    addProp(water, new THREE.MeshStandardMaterial({ color: pool.colour, roughness: 0.3 }), 0, (pool.from + pool.to) / 2, pool.lift);
    movePlayer(0, 0, 0);
  },
  pose({ player }, shot) {
    // Start fishing afresh for each view, with the rod already lifted, so the view shows the cast `shot.seconds` in.
    const seconds = shot.seconds ?? 0;
    player.setFishing(undefined);
    player.setFishing(fishingAt(0, seconds));
    player.setFishing(fishingAt(10, seconds));
  },
  // The player casts and catches a fish twice, at the shortest wait the game has, lowers the rod, rests, then starts again.
  play: {
    shot: { label: "casting, waiting, and reeling in", yaw: -55, pitch: 12 },
    pose({ player }, seconds) {
      const fishing = FISH_PLAY_WAIT_SECONDS * FISH_PLAY_CASTS;
      const cycle = seconds % (fishing + FISH_PLAY_REST_SECONDS);
      player.setFishing(cycle < fishing ? fishingAt(cycle, cycle % FISH_PLAY_WAIT_SECONDS) : undefined);
      return undefined;
    },
  },
};

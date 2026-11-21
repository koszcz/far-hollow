// The showcase of the approved "forage-eat-drink-animation": the player reaches into a berry bush, eats, fills the approved "pot" at a
// stand-in river, drinks from the pot, and drinks from the river with cupped hands. Foraging mushrooms reuses the
// approved "pick-up-animation", so it is not shown here.
import * as THREE from "three";
import { HAND_AT_SECONDS } from "../../../sim/hand-reach";
import { eatDrinkSecondsOf, type EatDrinkKind } from "../../player-eat-drink-pose";
import type { Showcase, Stage } from "../types";

/** How far in front of the player the berry bush stands in the "forage-eat-drink-animation" showcase, in metres. */
const FORAGE_SHOWCASE_BUSH_METRES = 0.75;
/** A flat stand-in for the river behind the player in the "forage-eat-drink-animation" showcase: from and to are metres behind the feet. */
const DRINK_SHOWCASE_POOL = { from: 0.35, to: 2.5, width: 3, lift: 0.01, colour: 0x3f8f9c };
/** How long the player stands between motions in the "forage-eat-drink-animation" live loop, in seconds. */
const EAT_DRINK_PLAY_REST_SECONDS = 0.6;
/** The stills of the "forage-eat-drink-animation" showcase: which motion each shows, and how far into it, in seconds. */
const EAT_DRINK_SHOTS: readonly { label: string; kind: EatDrinkKind; seconds: number }[] = [
  { label: "hand in the berry bush", kind: "forageBush", seconds: HAND_AT_SECONDS },
  { label: "biting, eating", kind: "eat", seconds: 0.28 },
  { label: "kneeling, dipping the pot", kind: "fillPot", seconds: HAND_AT_SECONDS },
  { label: "pot at the mouth", kind: "drinkFromPot", seconds: 0.5 },
];
/** Which motions face the stand-in river, behind the player's start. */
const FACES_WATER: readonly EatDrinkKind[] = ["drinkFromRiver", "fillPot"];

/** Turns the player to face the berry bush, or the stand-in river behind them, and plays `kind` `seconds` in. */
function poseEatDrink({ player, movePlayer }: Stage, kind: EatDrinkKind | undefined, seconds: number): void {
  movePlayer(0, 0, kind !== undefined && FACES_WATER.includes(kind) ? Math.PI : 0);
  player.setMotion("forage-eat-drink-animation", kind === undefined ? undefined : { kind, seconds });
}

export const FORAGE_EAT_DRINK_ANIMATION_SHOWCASE: Showcase = {
  radius: 1.7,
  focus: { x: 0, y: 0.8, z: 0 },
  shots: EAT_DRINK_SHOTS.map(({ label, seconds }) => ({ label, yaw: -90, pitch: 10, seconds })),
  build({ addProp, place, movePlayer }) {
    place(0, FORAGE_SHOWCASE_BUSH_METRES, { forageSpot: { food: "berries" } });
    const pool = DRINK_SHOWCASE_POOL;
    const water = new THREE.PlaneGeometry(pool.width, pool.to - pool.from).rotateX(-Math.PI / 2);
    addProp(water, new THREE.MeshStandardMaterial({ color: pool.colour, roughness: 0.3 }), 0, -(pool.from + pool.to) / 2, pool.lift);
    movePlayer(0, 0, 0);
  },
  pose(stage, shot) {
    poseEatDrink(stage, EAT_DRINK_SHOTS.find(({ label }) => label === shot.label)?.kind, shot.seconds ?? 0);
  },
  // Each motion once, with a rest between: the bush, eating, filling the pot, drinking from it, drinking from the river.
  play: {
    shot: { label: "bush, eat, fill the pot, drink from it, drink from the river", yaw: -90, pitch: 10 },
    pose(stage, seconds) {
      const order: readonly EatDrinkKind[] = ["forageBush", "eat", "fillPot", "drinkFromPot", "drinkFromRiver"];
      let into = seconds % order.reduce((sum, kind) => sum + eatDrinkSecondsOf(kind) + EAT_DRINK_PLAY_REST_SECONDS, 0);
      for (const kind of order) {
        if (into < eatDrinkSecondsOf(kind)) {
          poseEatDrink(stage, kind, into);
          return undefined;
        }
        into -= eatDrinkSecondsOf(kind) + EAT_DRINK_PLAY_REST_SECONDS;
        if (into < 0) {
          poseEatDrink(stage, undefined, 0);
          return undefined;
        }
      }
      return undefined;
    },
  },
};

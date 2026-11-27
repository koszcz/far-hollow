// Showcases for fire and shelter: the campfire, the lean-to, the woodpile, fish and jugs on a fire, the fire effect, pots, and bark. The registry is src/render/showcases/index.ts.
import { CAMPFIRE_FUEL_LIMIT_MINUTES } from "../../sim/campfires";
import { COOK_MINUTES } from "../../sim/fish-on-fire";
import { FIRE_JUG_MINUTES } from "../../sim/jug-on-fire";
import { LEAN_TO_BARK_COST, LEAN_TO_BUILD_SECONDS, LEAN_TO_STICK_COST } from "../../sim/structure-camp";
import { type PotLook, type PotMesh } from "../pot-shape";
import { FOUR_ANGLES, NIGHT, BUILD_PLAY_REST_SECONDS, type Showcase } from "./types";

/** How many stages a lean-to takes to build: one for each stick and each piece of bark. */
const LEAN_TO_STAGES = LEAN_TO_STICK_COST + LEAN_TO_BARK_COST;
/** How far a lean-to's build has gone once its two posts and ridge pole are up. */
const LEAN_TO_FRAME_UP = 3 / LEAN_TO_STAGES;
/** The pots standing on the ground in the "pot" showcase, with how each one looks. */
const showcasePots: { pot: PotMesh; look: PotLook }[] = [];

/** Shows each standing pot in the "pot" showcase as it should look `seconds` into its steam loop. */
function showPots(seconds: number): void {
  for (const { pot, look } of showcasePots) pot.show(look, seconds);
}

export const CAMP_FIRE_SHOWCASES: Readonly<Record<string, Showcase>> = {
  campfire: {
    radius: 1.3,
    focus: { x: 0, y: 0.3, z: 0 },
    shots: FOUR_ANGLES,
    build({ place }) {
      place(0, 0, { campfire: { lit: false, fuelMinutes: 0 } });
    },
  },
  "lean-to": {
    radius: 3.2,
    focus: { x: 0, y: 0.7, z: 0 },
    // Key stages of the build, then the finished lean-to from behind. The player stands beside it for scale.
    shots: [
      { label: "posts and ridge pole", yaw: 30, pitch: 20, seconds: LEAN_TO_FRAME_UP },
      { label: "frame built", yaw: 30, pitch: 20, seconds: LEAN_TO_STICK_COST / LEAN_TO_STAGES },
      { label: "half the bark on", yaw: 30, pitch: 20, seconds: (LEAN_TO_STICK_COST + LEAN_TO_BARK_COST / 2) / LEAN_TO_STAGES },
      { label: "built, from behind", yaw: 200, pitch: 25, seconds: 1 },
    ],
    build({ place, movePlayer }) {
      place(0, 0, { blueprint: { structure: "leanTo", progress: 0, materialsSpent: 0, delivered: {} }, facing: { turns: 0 } });
      movePlayer(-2.6, 1.2, Math.PI / 2);
    },
    pose({ store }, shot) {
      for (const entity of store.with("blueprint")) entity.blueprint.progress = shot.seconds ?? 0;
    },
    // The whole build plays at game speed, rests built, then starts again from an empty blueprint.
    play: {
      shot: { label: "building, then a rest", yaw: 30, pitch: 20 },
      pose({ store }, seconds) {
        const cycle = seconds % (LEAN_TO_BUILD_SECONDS + BUILD_PLAY_REST_SECONDS);
        for (const entity of store.with("blueprint")) entity.blueprint.progress = Math.min(1, cycle / LEAN_TO_BUILD_SECONDS);
        return undefined;
      },
    },
  },
  // From left to right: a blueprint, an empty woodpile, one half full of mixed wood, and a full one. The player stands behind for size.
  // One view shows all four. The others come close to the full one, the half-full one, and the empty one.
  woodpile: {
    radius: 2.6,
    focus: { x: 0, y: 0.4, z: 0 },
    shots: [
      { label: "all four: blueprint, empty, half full, full", yaw: 0, pitch: 14 },
      { label: "full, front three-quarter", yaw: 35, pitch: 18, radius: 1.4, focus: { x: 2.4, y: 0.5, z: 0 } },
      { label: "half full, back three-quarter", yaw: 215, pitch: 22, radius: 1.4, focus: { x: 0.8, y: 0.35, z: 0 } },
      { label: "blueprint and empty, from above", yaw: -20, pitch: 50, radius: 1.5, focus: { x: -1.6, y: 0.2, z: 0 } },
    ],
    build({ place, movePlayer }) {
      place(-2.4, 0, { blueprint: { structure: "woodpile", progress: 0, materialsSpent: 0, delivered: {} }, facing: { turns: 0 } });
      place(-0.8, 0, { woodpile: { log: 0, debarkedLog: 0, firewood: 0 } });
      place(0.8, 0, { woodpile: { log: 3, debarkedLog: 3, firewood: 4 } });
      place(2.4, 0, { woodpile: { log: 4, debarkedLog: 4, firewood: 12 } });
      movePlayer(0, -1.4, 0);
    },
  },
  // The approved "fish-on-fire": up to 3 fish on skewers leaning over a campfire. They darken and char from raw to cooked.
  // The middle fire holds the pot as well, to show they keep clear of it.
  "fish-on-fire": {
    radius: 1.3,
    focus: { x: 0, y: 0.4, z: 0 },
    shots: [
      { label: "raw, half, and cooked, beside the pot", yaw: 20, pitch: 20, radius: 0.85 },
      { label: "from above, clear of the pot", yaw: 0, pitch: 75, radius: 2.4 },
      { label: "one raw fish on an unlit fire", yaw: 30, pitch: 20, radius: 0.85, focus: { x: -2.2, y: 0.4, z: 0 } },
      { label: "three cooked fish at night, char marks showing", yaw: 34, pitch: 20, radius: 0.85, focus: { x: 2.2, y: 0.4, z: 0 }, hour: NIGHT },
    ],
    build({ place }) {
      place(0, 0, {
        campfire: { lit: true, fuelMinutes: CAMPFIRE_FUEL_LIMIT_MINUTES },
        potOnFire: { water: "river", minutesBoiling: 0 },
        fishOnFire: [{ minutesCooked: 0 }, { minutesCooked: COOK_MINUTES / 2 }, { minutesCooked: COOK_MINUTES }],
      });
      place(-2.2, 0, { campfire: { lit: false, fuelMinutes: 0 }, fishOnFire: [{ minutesCooked: 0 }] });
      place(2.2, 0, {
        campfire: { lit: true, fuelMinutes: CAMPFIRE_FUEL_LIMIT_MINUTES },
        fishOnFire: [{ minutesCooked: COOK_MINUTES }, { minutesCooked: COOK_MINUTES }, { minutesCooked: COOK_MINUTES }],
      });
    },
    // The flames move all the time, so the fire burns live with the fish on it.
    play: {
      shot: { label: "cooking on a lit campfire", yaw: 20, pitch: 18, radius: 1.8, focus: { x: 0, y: 0.4, z: 0 }, hour: 19 },
      pose: () => undefined,
    },
  },
  "fire-effect": {
    radius: 2,
    focus: { x: 0, y: 0.5, z: 0 },
    shots: [
      { label: "day", yaw: 0, pitch: 15 },
      { label: "day, from above", yaw: 40, pitch: 55 },
      { label: "night", yaw: 0, pitch: 15, hour: NIGHT },
      { label: "night, warmth pool", yaw: 40, pitch: 55, radius: 7, hour: NIGHT },
    ],
    build({ place }) {
      place(0, 0, { campfire: { lit: true, fuelMinutes: CAMPFIRE_FUEL_LIMIT_MINUTES } });
    },
    // The flames, sparks, and smoke move all the time, so the fire burns live at dusk, when both light and glow show.
    play: {
      shot: { label: "burning at dusk", yaw: 20, pitch: 14, radius: 2.4, focus: { y: 0.8 }, hour: 20 },
      pose: () => undefined,
    },
  },
  pot: {
    radius: 0.5,
    focus: { x: 0, y: 0.15, z: 0 },
    shots: [
      { label: "empty", yaw: 20, pitch: 35, focus: { x: -0.5 } },
      { label: "full of water", yaw: 20, pitch: 35, focus: { x: 0 } },
      { label: "steaming", yaw: 20, pitch: 20, focus: { x: 0.5, y: 0.3 }, seconds: 1 },
      { label: "on a lit campfire", yaw: 20, pitch: 15, radius: 1, focus: { x: 0, y: 0.8, z: -2 }, seconds: 1 },
    ],
    build({ place, placePot }) {
      showcasePots.length = 0;
      showcasePots.push({ pot: placePot(-0.5, 0), look: "empty" }, { pot: placePot(0, 0), look: "full" }, { pot: placePot(0.5, 0), look: "steaming" });
      place(0, -2, { campfire: { lit: true, fuelMinutes: CAMPFIRE_FUEL_LIMIT_MINUTES }, potOnFire: { water: "river", minutesBoiling: 0 } });
    },
    pose(_stage, shot) {
      showPots(shot.seconds ?? 0);
    },
    // The steam rises in a loop, so it plays live on the campfire at dusk.
    play: {
      shot: { label: "steaming on a lit campfire", yaw: 20, pitch: 12, radius: 1, focus: { x: 0, y: 0.85, z: -2 }, hour: 19 },
      pose(_stage, seconds) {
        showPots(seconds);
        return undefined;
      },
    },
  },
  // The HUD is drawn over these views by src/ui/hud-showcase.tsx, with bark in the backpack and on offer as fuel.
  // Pieces of bark lie on the ground beside the player, as taking down a building piece leaves them when the backpack is full.
  bark: {
    overlay: "hud",
    radius: 6,
    focus: { x: 0, y: 1, z: 0 },
    shots: [
      { label: "HUD: bark in the backpack", yaw: 20, pitch: 35 },
      { label: "HUD: debarking a log", yaw: -20, pitch: 35 },
      { label: "HUD: bark at a campfire", yaw: 40, pitch: 35, hour: 18 },
      { label: "HUD: carrying a debarked log", yaw: 20, pitch: 35 },
    ],
    build({ place, movePlayer }) {
      place(1.5, -1, { campfire: { lit: true, fuelMinutes: CAMPFIRE_FUEL_LIMIT_MINUTES } });
      place(-1.5, 0.5, { log: { heading: 0.4 } });
      for (const [x, z] of [
        [2.6, 0.3],
        [3, 0.7],
        [2.4, 0.9],
      ] as const)
        place(x, z, { bark: true });
      movePlayer(0, 0, 0);
    },
  },
  // The approved "jug": an unfired jug and an empty jug beside a knife for size, piles of 3 of each, and jugs on campfires.
  // The middle campfire holds a half-fired jug beside the pot and fish. The right one holds a fired jug on a fire that is out.
  // src/render/showcases/building-hearth.ts shows a jug on a fireplace, in the fireplace's cooking shot.
  // src/ui/hud-showcase.tsx draws the HUD over the last view only, with the campfire panel showing how far the jug has fired.
  jug: {
    overlay: "hud",
    radius: 2.2,
    focus: { x: 0, y: 0.2, z: 0 },
    shots: [
      { label: "an unfired jug and an empty jug beside a knife", yaw: 20, pitch: 25, radius: 0.8, focus: { x: -1.6, y: 0.1, z: 1.5 } },
      { label: "piles of 3 unfired jugs and 3 empty jugs", yaw: -20, pitch: 30, radius: 1.4, focus: { x: 0.2, y: 0.1, z: 1.5 } },
      { label: "a half-fired jug beside the pot and fish, and a fired jug", yaw: 15, pitch: 22, radius: 2.4, focus: { x: 1.1, y: 0.3, z: 0 } },
      { label: "HUD: beside a campfire, firing a jug", yaw: 15, pitch: 30, radius: 1.4, focus: { x: 0, y: 0.3, z: 0 } },
    ],
    build({ place, movePlayer }) {
      place(-1.8, 1.5, { pile: { content: "unfiredJug", count: 1 } });
      place(-1.4, 1.5, { pile: { content: "jug", count: 1 } });
      place(-1.6, 1.75, { pile: { content: "knife", count: 1 } });
      place(-0.2, 1.5, { pile: { content: "unfiredJug", count: 3 } });
      place(0.6, 1.5, { pile: { content: "jug", count: 3 } });
      place(0, 0, {
        campfire: { lit: true, fuelMinutes: CAMPFIRE_FUEL_LIMIT_MINUTES },
        potOnFire: { water: "river", minutesBoiling: 0 },
        fishOnFire: [{ minutesCooked: 0 }, { minutesCooked: COOK_MINUTES / 2 }, { minutesCooked: COOK_MINUTES }],
        jugOnFire: { minutesFired: FIRE_JUG_MINUTES / 2 },
      });
      place(2.2, 0, { campfire: { lit: false, fuelMinutes: 0 }, jugOnFire: { minutesFired: FIRE_JUG_MINUTES } });
      movePlayer(0, -1.5, 0);
    },
  },
};

// Showcases for the fireplace and the chimney on it.
import { setComponent } from "../../sim/entities";
import { BUILD_FADE_SHARE } from "../structure-look";
import { CHIMNEY_STONE_COST, FIREPLACE_STONE_COST } from "../../sim/structure-cabin-fittings";
import { FUEL_LIMIT_MINUTES } from "../../sim/fire";
import { COOK_MINUTES } from "../../sim/fish-on-fire";
import { FIRE_JUG_MINUTES } from "../../sim/jug-on-fire";
import type { Showcase } from "./types";
import { onDeckOf } from "./cabin-stage";

/** The fireplace showcase marks its lit shot with this time, past the end of the build. */
const LIT_FIREPLACE_SHOT = 2;
/** The fireplace showcase marks its shot of a pot and fish on the lit fire with this time. */
const COOKING_FIREPLACE_SHOT = 3;
/** The chimney showcase marks its shots with a roof section over the chimney with this time, past the end of the build. */
const ROOFED_CHIMNEY_SHOT = 2;

export const HEARTH_SHOWCASES: Readonly<Record<string, Showcase>> = {
  fireplace: {
    radius: 2.2,
    focus: { x: 0, y: 0.8, z: 0 },
    // On a foundation with a log wall behind it: a blueprint with 4 of 12 stones, the 5th stone being set down,
    // the chimney going up, then the finished fireplace from the front and from behind, with the player beside it for size.
    // Last, the finished fireplace lit and full of fuel, from the front, then with a pot and three fish on its fire.
    shots: [
      { label: `blueprint, 4 of ${FIREPLACE_STONE_COST} stones`, yaw: 30, pitch: 25, seconds: 0 },
      { label: "5th stone above its place", yaw: 30, pitch: 25, seconds: (4 + BUILD_FADE_SHARE) / FIREPLACE_STONE_COST },
      { label: "chimney going up", yaw: 30, pitch: 25, seconds: (10 + BUILD_FADE_SHARE) / FIREPLACE_STONE_COST },
      { label: "built, front", yaw: 0, pitch: 12, seconds: 1 },
      { label: "built, back three-quarter", yaw: 215, pitch: 25, seconds: 1 },
      { label: "lit, front", yaw: 0, pitch: 12, seconds: LIT_FIREPLACE_SHOT },
      { label: "lit, with a pot and fish, front three-quarter", yaw: 25, pitch: 20, seconds: COOKING_FIREPLACE_SHOT },
    ],
    build(stage) {
      const onDeck = onDeckOf(stage);
      onDeck(0, 0, { foundation: true });
      onDeck(0, -0.5, { edgePiece: "logWall", facing: { turns: 2 } });
      onDeck(0, 0, { blueprint: { structure: "fireplace", progress: 0, materialsSpent: 0, delivered: { stone: 4 } }, facing: { turns: 0 } });
      stage.movePlayer(1.2, 0.6, -Math.PI / 2);
    },
    pose({ store }, shot) {
      const cooking = shot.seconds === COOKING_FIREPLACE_SHOT;
      const lit = cooking || shot.seconds === LIT_FIREPLACE_SHOT;
      const progress = lit ? 1 : (shot.seconds ?? 0);
      // The lit shots swap the blueprint for a finished fireplace, and the other shots swap it back.
      for (const entity of [...store.with("blueprint"), ...store.with("fireplace")]) {
        store.removeComponent(entity, "potOnFire");
        store.removeComponent(entity, "fishOnFire");
        store.removeComponent(entity, "jugOnFire");
        if (lit) {
          store.removeComponent(entity, "blueprint");
          setComponent(store, entity, "fireplace", { lit: true, fuelMinutes: FUEL_LIMIT_MINUTES.fireplace });
          if (cooking) {
            setComponent(store, entity, "potOnFire", { water: "river", minutesBoiling: 0 });
            setComponent(store, entity, "fishOnFire", [{ minutesCooked: 0 }, { minutesCooked: COOK_MINUTES / 2 }, { minutesCooked: COOK_MINUTES }]);
            // The draft "jug", half fired, stands beside the fish.
            setComponent(store, entity, "jugOnFire", { minutesFired: FIRE_JUG_MINUTES / 2 });
          }
          continue;
        }
        store.removeComponent(entity, "fireplace");
        setComponent(store, entity, "blueprint", { structure: "fireplace", progress, materialsSpent: 0, delivered: {} });
        if (entity.blueprint !== undefined) entity.blueprint.delivered.stone = Math.max(4, Math.ceil(progress * FIREPLACE_STONE_COST));
      }
    },
  },
  chimney: {
    radius: 3.6,
    focus: { x: 0, y: 1.7, z: 0 },
    // On a lit fireplace with log walls behind and beside it and a roof frame over it: a blueprint with 3 of 8 stones while
    // the smoke still rises at the hearth, the 4th course being set down, the finished chimney with its smoke rising from the
    // top, then a roof section laid on the frame, which the chimney passes through and stands 0.8 m above.
    shots: [
      { label: `blueprint, 3 of ${CHIMNEY_STONE_COST} stones, smoke at the hearth`, yaw: 30, pitch: 22, seconds: 0 },
      { label: "4th course above its place", yaw: 30, pitch: 22, seconds: (3 + BUILD_FADE_SHARE) / CHIMNEY_STONE_COST },
      { label: "built under the frame, smoke from the top", yaw: 30, pitch: 22, seconds: 1 },
      { label: "through a roof section, smoke from the top", yaw: 30, pitch: 22, seconds: ROOFED_CHIMNEY_SHOT },
      { label: "through a roof section, from behind", yaw: 200, pitch: 25, seconds: ROOFED_CHIMNEY_SHOT },
    ],
    build(stage) {
      const onDeck = onDeckOf(stage);
      onDeck(0, 0, { foundation: true });
      onDeck(0, -0.5, { edgePiece: "logWall", facing: { turns: 2 } });
      onDeck(-0.5, 0, { edgePiece: "logWall", facing: { turns: 1 } });
      onDeck(0.5, 0, { edgePiece: "logWall", facing: { turns: 3 } });
      onDeck(0, 0, { roofFrame: true, facing: { turns: 0 } });
      onDeck(0, 0, { fireplace: { lit: true, fuelMinutes: FUEL_LIMIT_MINUTES.fireplace }, facing: { turns: 0 } });
      onDeck(0, 0, { blueprint: { structure: "chimney", progress: 0, materialsSpent: 0, delivered: { stone: 3 } }, facing: { turns: 0 } });
      stage.movePlayer(1.3, 1, -Math.PI / 2);
    },
    pose({ store }, shot) {
      const seconds = shot.seconds ?? 0;
      const progress = Math.min(1, seconds);
      // The roofed shots lay a roof section on the frame, and the other shots take it off.
      for (const frame of store.with("roofFrame", "position")) {
        store.removeComponent(frame, "cabinRoof");
        store.removeComponent(frame, "roof");
        if (seconds !== ROOFED_CHIMNEY_SHOT) continue;
        const { x, z } = frame.position;
        setComponent(store, frame, "cabinRoof", true);
        setComponent(store, frame, "roof", { min: { x: x - 0.5, z: z - 0.5 }, max: { x: x + 0.5, z: z + 0.5 } });
      }
      // The built shots swap the blueprint for a finished chimney, and the other shots swap it back.
      for (const entity of [...store.with("blueprint"), ...store.with("chimney")]) {
        if (progress >= 1) {
          store.removeComponent(entity, "blueprint");
          setComponent(store, entity, "chimney", true);
          continue;
        }
        store.removeComponent(entity, "chimney");
        setComponent(store, entity, "blueprint", { structure: "chimney", progress, materialsSpent: 0, delivered: {} });
        if (entity.blueprint !== undefined) entity.blueprint.delivered.stone = Math.max(3, Math.ceil(progress * CHIMNEY_STONE_COST));
      }
    },
  },
};

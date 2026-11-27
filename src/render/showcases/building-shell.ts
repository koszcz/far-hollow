// Showcases for the deck and its walls: the foundation, the floor, and the log wall, door frame, and window on a deck edge.
import { type Entity } from "../../sim/entities";
import { BUILD_FADE_SHARE } from "../structure-look";
import { FOUNDATION_DECK_LIFT_METRES } from "../../sim/foundations";
import { DOOR_FRAME_LOG_COST, FLOOR_PLANK_COST, FOUNDATION_LOG_COST, LOG_WALL_LOG_COST, WINDOW_LOG_COST } from "../../sim/structure-cabin-shell";
import type { EdgePieceKind } from "../../sim/structure-kind";
import type { Showcase } from "./types";
import { onDeckOf, showLogBuild } from "./cabin-stage";

/**
 * Shows a log wall, door frame, or window on the back edge of a finished foundation, with the player beside it for size.
 * A blueprint with two logs delivered, the third log's part turning solid, then the finished piece from the front and from behind.
 */
function edgePieceShowcase(piece: EdgePieceKind, logCost: number): Showcase {
  return {
    radius: 1.6,
    focus: { x: 0, y: 1.1, z: 0 },
    shots: [
      { label: `blueprint, 2 of ${logCost} logs delivered`, yaw: 25, pitch: 20, seconds: 0 },
      { label: "3rd log turning solid", yaw: 25, pitch: 20, seconds: 2.4 / logCost },
      { label: "built, front", yaw: 0, pitch: 12, seconds: 1 },
      { label: "built, back three-quarter", yaw: 215, pitch: 25, seconds: 1 },
    ],
    build({ place, movePlayer }) {
      const deckTop = (entity: Entity) => {
        if (entity.position !== undefined) entity.position.y += FOUNDATION_DECK_LIFT_METRES;
      };
      deckTop(place(0, 0, { foundation: true }));
      deckTop(place(0, -0.5, { blueprint: { structure: piece, progress: 0, materialsSpent: 0, delivered: { debarkedLog: 2 } }, facing: { turns: 2 } }));
      movePlayer(1.3, 0.2, -0.4);
    },
    pose({ store }, shot) {
      showLogBuild(store, shot.seconds ?? 0, logCost);
    },
  };
}

export const SHELL_SHOWCASES: Readonly<Record<string, Showcase>> = {
  foundation: {
    radius: 1.4,
    focus: { x: 0, y: 0.2, z: 0 },
    // A blueprint with two logs delivered, the legs and beams fading in, the third log turning solid,
    // then the finished foundation from two sides.
    shots: [
      { label: "blueprint, 2 of 4 logs delivered", yaw: 30, pitch: 30, seconds: 0 },
      { label: "legs and beams fading in", yaw: 30, pitch: 30, seconds: 0.3 / FOUNDATION_LOG_COST },
      { label: "3rd log turning solid", yaw: 30, pitch: 30, seconds: 2.4 / FOUNDATION_LOG_COST },
      { label: "built, front", yaw: 0, pitch: 12, seconds: 1 },
      { label: "built, from above", yaw: 40, pitch: 60, seconds: 1 },
    ],
    build({ place }) {
      const blueprint = place(0, 0, { blueprint: { structure: "foundation", progress: 0, materialsSpent: 0, delivered: { debarkedLog: 2 } } });
      if (blueprint.position !== undefined) blueprint.position.y += FOUNDATION_DECK_LIFT_METRES;
    },
    pose({ store }, shot) {
      showLogBuild(store, shot.seconds ?? 0, FOUNDATION_LOG_COST);
    },
  },
  floor: {
    radius: 2.6,
    focus: { x: 0, y: 0.4, z: 0 },
    // Three foundation squares in a row: a finished floor with a stool on it, a floor blueprint in the middle, and a bare deck.
    // The blueprint has 1 of 2 planks, then its first boards are set down, then the rest, then it is finished.
    shots: [
      { label: `blueprint, 1 of ${FLOOR_PLANK_COST} planks`, yaw: 20, pitch: 35, seconds: 0 },
      { label: "first boards above their place", yaw: 20, pitch: 35, seconds: BUILD_FADE_SHARE / FLOOR_PLANK_COST },
      { label: "last boards going down", yaw: 20, pitch: 35, seconds: (1 + 0.5) / FLOOR_PLANK_COST },
      { label: "built, beside a bare deck", yaw: 20, pitch: 35, seconds: 1 },
      { label: "built, low from the side", yaw: 90, pitch: 10, seconds: 1 },
    ],
    build(stage) {
      const onDeck = onDeckOf(stage);
      for (const x of [-1, 0, 1]) onDeck(x, 0, { foundation: true });
      onDeck(-1, 0, { floor: true });
      onDeck(-1, 0, { furniture: "stool", facing: { turns: 0 } });
      onDeck(0, 0, { blueprint: { structure: "floor", progress: 0, materialsSpent: 0, delivered: { plank: 1 } }, facing: { turns: 0 } });
      stage.movePlayer(0, 1.3, Math.PI);
    },
    pose({ store }, shot) {
      for (const entity of store.with("blueprint")) {
        entity.blueprint.progress = shot.seconds ?? 0;
        entity.blueprint.delivered.plank = Math.max(1, Math.ceil((shot.seconds ?? 0) * FLOOR_PLANK_COST));
      }
    },
  },
  "log-wall": edgePieceShowcase("logWall", LOG_WALL_LOG_COST),
  "door-frame": edgePieceShowcase("doorFrame", DOOR_FRAME_LOG_COST),
  window: edgePieceShowcase("window", WINDOW_LOG_COST),
};

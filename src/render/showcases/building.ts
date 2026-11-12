// Showcases for structures built on a foundation: the deck, furniture, the sled, walls, and roofs. The registry is src/render/showcases/index.ts.
import { setComponent, type Entity, type EntityStore } from "../../sim/entities";
import { BUILD_FADE_SHARE } from "../structure-look";
import { FOUNDATION_DECK_LIFT_METRES } from "../../sim/foundations";
import {
  CHEST_LOG_COST,
  DOOR_FRAME_LOG_COST,
  FOUNDATION_LOG_COST,
  LOG_WALL_LOG_COST,
  ROOF_PLANK_COST,
  ROOF_FRAME_LOG_COST,
  SAWHORSE_LOG_COST,
  SLED_LOG_COST,
  SLED_STICK_COST,
} from "../../sim/structures";
import { turnOffset, type QuarterTurns } from "../../sim/structure-kind";
import { type Stage, type Showcase } from "./types";

/** A sled is built in one stage per log and one per stick. */
const SLED_STAGES = SLED_LOG_COST + SLED_STICK_COST;
/**
 * Builds a 3 by 2 square cabin with log walls all round and a door frame in the middle of the front. Every square but the
 * front right one gets a finished roof frame, and with `roofs`, a finished roof on it too. The front row slopes down to the
 * front and the back row to the back, so they meet at a ridge, with a gable end at each side.
 * Returns a placer that puts an entity on the deck of a square, for the showcase to add the front right square's pieces.
 */
function squareCabin({ place }: Stage, { roofs }: { roofs: boolean }): (x: number, z: number, entity: Entity) => Entity {
  const onDeck = (x: number, z: number, entity: Entity) => {
    const placed = place(x, z, entity);
    if (placed.position !== undefined) placed.position.y += FOUNDATION_DECK_LIFT_METRES;
    return placed;
  };
  const columns = [-1, 0, 1];
  const rows = [-1, 0];
  for (const x of columns) for (const z of rows) onDeck(x, z, { foundation: true });
  for (const x of columns) {
    onDeck(x, -1.5, { edgePiece: "logWall", facing: { turns: 2 } });
    onDeck(x, 0.5, { edgePiece: x === 0 ? "doorFrame" : "logWall", facing: { turns: 0 } });
  }
  for (const z of rows) {
    onDeck(-1.5, z, { edgePiece: "logWall", facing: { turns: 1 } });
    onDeck(1.5, z, { edgePiece: "logWall", facing: { turns: 3 } });
  }
  for (const x of columns) {
    for (const z of rows) {
      if (x === 1 && z === 0) continue;
      const turns = z === 0 ? 0 : 2;
      onDeck(x, z, { roofFrame: true, facing: { turns } });
      if (roofs) onDeck(x, z, { cabinRoof: true, facing: { turns }, roof: { min: { x: x - 0.5, z: z - 0.5 }, max: { x: x + 0.5, z: z + 0.5 } } });
    }
  }
  return onDeck;
}

/**
 * Sets every blueprint in `store` to `progress` of a build that costs `logCost` debarked logs.
 * Two logs wait delivered, and every log whose stage has started is delivered too, as in the game.
 */
function showLogBuild(store: EntityStore, progress: number, logCost: number): void {
  for (const entity of store.with("blueprint")) {
    entity.blueprint.progress = progress;
    entity.blueprint.delivered.debarkedLog = Math.max(2, Math.ceil(progress * logCost));
  }
}

/** Puts an entity on the deck of a foundation square at this offset from the stage's middle. */
function onDeckOf({ place }: Stage): (x: number, z: number, entity: Entity) => Entity {
  return (x, z, entity) => {
    const placed = place(x, z, entity);
    if (placed.position !== undefined) placed.position.y += FOUNDATION_DECK_LIFT_METRES;
    return placed;
  };
}

/** Builds foundations on these squares, and log walls on every edge with no foundation beyond it. */
function cabinWalls(stage: Stage, squares: readonly (readonly [number, number])[]): void {
  const onDeck = onDeckOf(stage);
  const taken = new Set(squares.map(([x, z]) => `${x},${z}`));
  for (const [x, z] of squares) {
    onDeck(x, z, { foundation: true });
    for (const turns of [0, 1, 2, 3] as const) {
      const out = turnOffset({ x: 0, z: 1 }, turns);
      if (taken.has(`${x + out.x},${z + out.z}`)) continue;
      onDeck(x + out.x / 2, z + out.z / 2, { edgePiece: "logWall", facing: { turns } });
    }
  }
}

/** Puts a finished roof frame facing `turns` on a square, and a finished roof on it. */
function roofOver(stage: Stage, x: number, z: number, turns: QuarterTurns): void {
  const onDeck = onDeckOf(stage);
  onDeck(x, z, { roofFrame: true, facing: { turns } });
  onDeck(x, z, { cabinRoof: true, facing: { turns }, roof: { min: { x: x - 0.5, z: z - 0.5 }, max: { x: x + 0.5, z: z + 0.5 } } });
}

/**
 * The squares of an L-shaped cabin whose left edge is column `left`: a wing along x over four columns and rows -1 and 0,
 * and a wing along z over its two right columns and rows 1 and 2.
 */
function lSquares(left: number): (readonly [number, number])[] {
  const alongX = [0, 1, 2, 3].flatMap((x) => [[left + x, -1] as const, [left + x, 0] as const]);
  const alongZ = [2, 3].flatMap((x) => [[left + x, 1] as const, [left + x, 2] as const]);
  return [...alongX, ...alongZ];
}

/**
 * Shows a log wall or door frame on the back edge of a finished foundation, with the player beside it for size.
 * A blueprint with two logs delivered, the third log's part turning solid, then the finished piece from the front and from behind.
 */
function edgePieceShowcase(piece: "logWall" | "doorFrame", logCost: number): Showcase {
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

export const BUILDING_SHOWCASES: Readonly<Record<string, Showcase>> = {
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
  chest: {
    radius: 1.3,
    focus: { x: 0, y: 0.25, z: 0 },
    // A blueprint with one log delivered, the lid being set down, then the finished chest from the front and above.
    shots: [
      { label: "blueprint, 1 of 2 logs delivered", yaw: 30, pitch: 30, seconds: 0 },
      { label: "lid above its place", yaw: 30, pitch: 30, seconds: (1 + BUILD_FADE_SHARE) / CHEST_LOG_COST },
      { label: "built, front", yaw: 0, pitch: 12, seconds: 1 },
      { label: "built, from above", yaw: 140, pitch: 55, seconds: 1 },
    ],
    build({ place, movePlayer }) {
      place(0, 0, { blueprint: { structure: "chest", progress: 0, materialsSpent: 0, delivered: { debarkedLog: 1 } }, facing: { turns: 0 } });
      movePlayer(1, 0.2, -Math.PI / 2);
    },
    pose({ store }, shot) {
      for (const entity of store.with("blueprint")) entity.blueprint.progress = shot.seconds ?? 0;
    },
  },
  sawhorse: {
    radius: 1.6,
    focus: { x: 0, y: 0.35, z: 0 },
    // A blueprint with one log delivered, the beam being set down, then the finished sawhorse from the side and from one end.
    shots: [
      { label: "blueprint, 1 of 2 logs delivered", yaw: 30, pitch: 30, seconds: 0 },
      { label: "beam above its place", yaw: 30, pitch: 30, seconds: (1 + BUILD_FADE_SHARE) / SAWHORSE_LOG_COST },
      { label: "built, side", yaw: 0, pitch: 12, seconds: 1 },
      { label: "built, end", yaw: 90, pitch: 20, seconds: 1 },
    ],
    build({ place, movePlayer }) {
      place(0, 0, { blueprint: { structure: "sawhorse", progress: 0, materialsSpent: 0, delivered: { debarkedLog: 1 } }, facing: { turns: 0 } });
      movePlayer(1.3, 0.3, -Math.PI / 2);
    },
    pose({ store }, shot) {
      for (const entity of store.with("blueprint")) entity.blueprint.progress = shot.seconds ?? 0;
    },
  },
  sled: {
    radius: 1.8,
    focus: { x: 0, y: 0.15, z: 0 },
    // A blueprint with one log delivered, the second runner being set down, a cross piece being laid,
    // then the finished sled from above, loaded with 4 logs and 2 debarked logs.
    shots: [
      { label: "blueprint, 1 of 2 logs delivered", yaw: 30, pitch: 30, seconds: 0 },
      { label: "second runner above its place", yaw: 30, pitch: 30, seconds: (1 + BUILD_FADE_SHARE) / SLED_STAGES },
      { label: "a cross piece above its place", yaw: 30, pitch: 30, seconds: (3 + BUILD_FADE_SHARE) / SLED_STAGES },
      { label: "built, with 4 logs and 2 debarked logs, from above", yaw: 140, pitch: 50, seconds: 1 },
    ],
    build({ place, movePlayer }) {
      place(0, 0, { blueprint: { structure: "sled", progress: 0, materialsSpent: 0, delivered: { log: 1 } }, facing: { turns: 0 } });
      movePlayer(0.3, 1, Math.PI);
    },
    pose({ store }, shot) {
      const progress = shot.seconds ?? 0;
      for (const entity of [...store.with("facing").entities]) {
        if (entity.blueprint?.structure !== "sled" && entity.sled === undefined) continue;
        // A finished sled shows its load. Before then it is a blueprint being built.
        if (progress >= 1) {
          store.removeComponent(entity, "blueprint");
          setComponent(store, entity, "sled", { log: 4, debarkedLog: 2 });
        } else {
          store.removeComponent(entity, "sled");
          setComponent(store, entity, "blueprint", { structure: "sled", progress, materialsSpent: 0, delivered: { log: 1 } });
        }
      }
    },
  },
  "log-wall": edgePieceShowcase("logWall", LOG_WALL_LOG_COST),
  "door-frame": edgePieceShowcase("doorFrame", DOOR_FRAME_LOG_COST),
  "roof-frame": {
    radius: 1.7,
    // The views look at the front right square of the cabin, where the frame blueprint is, unless a view says otherwise.
    focus: { x: 1, y: 1.9, z: 0 },
    // A 3 by 2 square cabin with no roof yet: a frame blueprint over its front right square with two logs delivered, then with
    // its beams laid and its rafters going up, then every frame finished, from the front and from the side.
    shots: [
      { label: `blueprint, 2 of ${ROOF_FRAME_LOG_COST} logs delivered`, yaw: 30, pitch: 35, seconds: 0 },
      { label: "beams laid, rafters going up", yaw: 30, pitch: 35, seconds: 3.5 / ROOF_FRAME_LOG_COST },
      { label: "3 by 2 cabin, front", yaw: 25, pitch: 25, seconds: 1, radius: 2.4, focus: { x: 0, y: 1.3, z: -0.5 } },
      { label: "3 by 2 cabin, side", yaw: 90, pitch: 12, seconds: 1, radius: 2.2, focus: { x: 0, y: 1.4, z: -0.5 } },
    ],
    build(stage) {
      const onDeck = squareCabin(stage, { roofs: false });
      onDeck(1, 0, { blueprint: { structure: "roofFrame", progress: 0, materialsSpent: 0, delivered: { debarkedLog: 2 } }, facing: { turns: 0 } });
      stage.movePlayer(0.6, 1.3, Math.PI);
    },
    pose({ store }, shot) {
      showLogBuild(store, shot.seconds ?? 0, ROOF_FRAME_LOG_COST);
    },
  },
  roof: {
    radius: 1.7,
    // The views look at the front right square of the cabin, where the roof blueprint is, unless a view says otherwise.
    focus: { x: 1, y: 1.9, z: 0 },
    // A 3 by 2 square cabin with a frame on every square: a roof blueprint over its front right square, then with half its
    // rows of planks laid, then the whole cabin finished, from the front and from the side to show the ridge and gable ends.
    shots: [
      { label: "blueprint on its frame", yaw: 30, pitch: 35, seconds: 0 },
      { label: `${ROOF_PLANK_COST / 2} of ${ROOF_PLANK_COST} rows of planks laid`, yaw: 30, pitch: 35, seconds: 0.5 },
      { label: "3 by 2 cabin, front", yaw: 25, pitch: 25, seconds: 1, radius: 2.6, focus: { x: 0, y: 1.5, z: -0.5 } },
      { label: "3 by 2 cabin, side", yaw: 90, pitch: 12, seconds: 1, radius: 2.4, focus: { x: 0, y: 1.6, z: -0.5 } },
    ],
    build(stage) {
      const onDeck = squareCabin(stage, { roofs: true });
      onDeck(1, 0, { roofFrame: true, facing: { turns: 0 } });
      onDeck(1, 0, { blueprint: { structure: "roof", progress: 0, materialsSpent: 0, delivered: {} }, facing: { turns: 0 } });
      stage.movePlayer(0.6, 1.3, Math.PI);
    },
    pose({ store }, shot) {
      for (const entity of store.with("blueprint")) entity.blueprint.progress = shot.seconds ?? 0;
    },
  },
  "roof-corners": {
    radius: 3.5,
    focus: { x: 0, y: 1.6, z: 0 },
    // Two L-shaped cabins, each wing two squares deep with a ridge along it. On the left, the corner frames slope like the
    // wing along x, so it runs through and the wing along z ends against its front slope in two valleys. On the right, they
    // slope like the wing along z, so it runs through instead. The left cabin's inner valley is a roof blueprint on its
    // frame, then with half its rows laid, then finished.
    shots: [
      { label: "valley frame, roof blueprint", yaw: 20, pitch: 45, seconds: 0, radius: 3, focus: { x: -3, y: 2.2, z: 0.5 } },
      { label: "valley, half its rows laid", yaw: 20, pitch: 45, seconds: 0.5, radius: 3, focus: { x: -3, y: 2.2, z: 0.5 } },
      { label: "wing along x runs through", yaw: 35, pitch: 30, seconds: 1, radius: 3, focus: { x: -3.5, y: 1.6, z: 0.5 } },
      { label: "wing along z runs through", yaw: 35, pitch: 30, seconds: 1, radius: 3, focus: { x: 3.5, y: 1.6, z: 0.5 } },
    ],
    build(stage) {
      // Turns 0 slopes down to +z, 1 to -x, 2 to -z, and 3 to +x.
      for (const [left, corner] of [
        [-5, "likeX"],
        [2, "likeZ"],
      ] as const) {
        const squares = lSquares(left);
        cabinWalls(stage, squares);
        for (const [x, z] of squares) {
          const inCorner = x >= left + 2 && z <= 0;
          const likeX = z === -1 ? 2 : 0;
          const likeZ = x === left + 2 ? 1 : 3;
          const turns: QuarterTurns = inCorner ? (corner === "likeX" ? likeX : likeZ) : z <= 0 ? likeX : likeZ;
          if (left === -5 && x === left + 2 && z === 0) {
            onDeckOf(stage)(x, z, { roofFrame: true, facing: { turns } });
            onDeckOf(stage)(x, z, { blueprint: { structure: "roof", progress: 0, materialsSpent: 0, delivered: {} }, facing: { turns } });
          } else {
            roofOver(stage, x, z, turns);
          }
        }
      }
    },
    pose({ store }, shot) {
      for (const entity of store.with("blueprint")) entity.blueprint.progress = shot.seconds ?? 0;
    },
  },
  "gable-end": {
    radius: 3.5,
    focus: { x: 0, y: 1.8, z: 0 },
    // On the left, a 2 by 2 cabin with a ridge across it: a plank gable end closes the triangle under each end of the ridge.
    // Beside it, a shed roof one square deep that slopes down to the front, closed by a plank triangle at each side.
    // On the right, a wing two squares deep runs through, and a wing four squares wide butts against its front, so the
    // butted wing's ridge stands above the through-roof's ridge, and a gable end fills the step above it.
    shots: [
      { label: "gable ends of a ridge", yaw: 270, pitch: 15, seconds: 1, radius: 3, focus: { x: -5.5, y: 2, z: -0.5 } },
      { label: "shed roof", yaw: 45, pitch: 15, seconds: 1, radius: 2.6, focus: { x: -2, y: 1.8, z: 0 } },
      { label: "step above a lower ridge", yaw: 200, pitch: 25, seconds: 1, radius: 2.6, focus: { x: 4, y: 2.3, z: 0 } },
      { label: "taller butted wing", yaw: 30, pitch: 30, seconds: 1, radius: 3.2, focus: { x: 4, y: 1.8, z: 1 } },
    ],
    build(stage) {
      const ridged: (readonly [number, number])[] = [
        [-6, -1],
        [-5, -1],
        [-6, 0],
        [-5, 0],
      ];
      cabinWalls(stage, ridged);
      for (const [x, z] of ridged) roofOver(stage, x, z, z === 0 ? 0 : 2);
      cabinWalls(stage, [[-2, 0]]);
      roofOver(stage, -2, 0, 0);
      const through = [2, 3, 4, 5].flatMap((x) => [[x, -1] as const, [x, 0] as const]);
      const butted = [2, 3, 4, 5].flatMap((x) => [[x, 1] as const, [x, 2] as const]);
      cabinWalls(stage, [...through, ...butted]);
      for (const [x, z] of through) roofOver(stage, x, z, z === 0 ? 0 : 2);
      for (const [x, z] of butted) roofOver(stage, x, z, x < 4 ? 1 : 3);
    },
  },
};

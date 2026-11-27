// Showcases for roofs: the roof frame, the roof, its corners, and the gable end.
import { ROOF_PLANK_COST, ROOF_FRAME_LOG_COST } from "../../sim/structure-cabin-shell";
import type { QuarterTurns } from "../../sim/quarter-turns";
import type { Showcase } from "./types";
import { cabinWalls, lSquares, oddWidthCabin, onDeckOf, roofOver, showLogBuild, squareCabin } from "./cabin-stage";

export const ROOF_SHOWCASES: Readonly<Record<string, Showcase>> = {
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
      { label: "3 deep: ridge in the middle row", yaw: 90, pitch: 12, seconds: 1, radius: 2.6, focus: { x: 0.5, y: 1.5, z: -9 } },
    ],
    build(stage) {
      oddWidthCabin(stage, { roofs: false });
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
      { label: "3 deep: ridge in the middle row", yaw: 40, pitch: 30, seconds: 1, radius: 3.6, focus: { x: 0, y: 1.6, z: -9 } },
    ],
    build(stage) {
      oddWidthCabin(stage, { roofs: true });
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
      { label: "valley frame, roof blueprint", yaw: 20, pitch: 50, seconds: 0, radius: 2, focus: { x: -3, y: 2.3, z: 0.1 } },
      { label: "valley, half its rows laid", yaw: 20, pitch: 50, seconds: 0.5, radius: 2, focus: { x: -3, y: 2.3, z: 0.1 } },
      { label: "wing along x runs through", yaw: 0, pitch: 40, seconds: 1, radius: 3, focus: { x: -2.5, y: 2.2, z: 0.2 } },
      { label: "wing along z runs through", yaw: -60, pitch: 40, seconds: 1, radius: 3, focus: { x: 3.6, y: 2.2, z: -0.4 } },
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
    // On the left, a 2 by 2 cabin with a ridge across it: a log gable end closes the triangle under each end of the ridge.
    // Beside it, a shed roof one square deep that slopes down to the front, closed by a log triangle at each side.
    // On the right, a wing two squares deep runs through, and a wing four squares wide butts against its front, so the
    // butted wing's ridge stands above the through-roof's ridge, and a gable end fills the step above it.
    shots: [
      { label: "gable ends of a ridge", yaw: 270, pitch: 15, seconds: 1, radius: 3, focus: { x: -5.5, y: 2, z: -0.5 } },
      { label: "shed roof", yaw: 315, pitch: 15, seconds: 1, radius: 2.6, focus: { x: -2, y: 1.8, z: 0 } },
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

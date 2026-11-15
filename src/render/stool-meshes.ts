// Draws stools and stool blueprints: the approved "stool" asset in asset-manifest.json, built in code.
// A stool is a rustic seat of two sawn boards on four square legs. The seat overhangs the legs a little,
// two battens under it hold the boards together, and dark pegs on top mark where the legs join it.
// Rails join the legs at two heights: low on the left and right, higher at the front and back.
// The player sits on it facing +z when it faces the default way. sit-animation.ts places them.
// The model is built in two stages, each taking half of construction: the legs with their rails, then the seat.
// plank-furniture-meshes.ts draws the stages.
import type { EntityStore } from "../sim/entities";
import { STOOL_SIZE_METRES } from "../sim/furniture/stool";
import { createFurnitureMeshes, type FurnitureMeshes, type FurniturePart } from "./plank-furniture-meshes";

/** How many stages the stool model is built in: the legs with their rails, then the seat. */
export const STOOL_MODEL_STAGES = 2;
/** How high the top of the seat is above the stool's base, in metres. The player sits on it. */
export const STOOL_SEAT_TOP_METRES = 0.27;

/** How wide each square leg is, in metres. */
const LEG_METRES = 0.055;
/** How far the seat reaches past the legs on every side, in metres. */
const SEAT_OVERHANG_METRES = 0.025;
/** How thick the seat boards are, and how wide the gap between them is, in metres. */
const SEAT_METRES = 0.035;
const SEAT_GAP_METRES = 0.008;
/** The battens under the seat, across both boards: how tall, how deep, and how far from the middle, in metres. */
const BATTEN_HEIGHT_METRES = 0.025;
const BATTEN_DEPTH_METRES = 0.045;
const BATTEN_AT_METRES = 0.09;
/** The rails between the legs: how thick, and how high above the ground their middle is, in metres. */
const RAIL_METRES = 0.03;
const SIDE_RAIL_HEIGHT_METRES = 0.07;
const END_RAIL_HEIGHT_METRES = 0.13;
/** The size of a peg, how far it stands proud of the seat, and its dark wood. */
const PEG_METRES = 0.018;
const PEG_PROUD_METRES = 0.003;
const PEG_COLOUR = 0x6b4f33;

export function createStoolMeshes(entities: EntityStore): FurnitureMeshes {
  const size = STOOL_SIZE_METRES;
  const seatBottom = STOOL_SEAT_TOP_METRES - SEAT_METRES;
  const legAt = size / 2 - SEAT_OVERHANG_METRES - LEG_METRES / 2;
  const between = 2 * legAt - LEG_METRES;
  const corners = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * legAt, sz * legAt] as const));
  const legs: FurniturePart[] = [
    ...corners.map(([x, z]): FurniturePart => ({ size: [LEG_METRES, seatBottom, LEG_METRES], at: [x, seatBottom / 2, z] })),
    // A low rail runs between the legs on the left and on the right, and a higher one across at the front and back.
    ...[-1, 1].map((sx): FurniturePart => ({ size: [RAIL_METRES, RAIL_METRES, between], at: [sx * legAt, SIDE_RAIL_HEIGHT_METRES, 0] })),
    ...[-1, 1].map((sz): FurniturePart => ({ size: [between, RAIL_METRES, RAIL_METRES], at: [0, END_RAIL_HEIGHT_METRES, sz * legAt] })),
  ];
  // The seat is two boards side by side, running front to back, held by two battens across them underneath.
  const boardWidth = (size - SEAT_GAP_METRES) / 2;
  const seat: FurniturePart[] = [
    ...[-1, 1].map((sx): FurniturePart => ({
      size: [boardWidth, SEAT_METRES, size],
      at: [sx * (boardWidth + SEAT_GAP_METRES) * 0.5, seatBottom + SEAT_METRES / 2, 0],
    })),
    ...[-1, 1].map((sz): FurniturePart => ({
      size: [between, BATTEN_HEIGHT_METRES, BATTEN_DEPTH_METRES],
      at: [0, seatBottom - BATTEN_HEIGHT_METRES / 2, sz * BATTEN_AT_METRES],
    })),
    ...corners.map(([x, z]): FurniturePart => ({
      size: [PEG_METRES, PEG_METRES, PEG_METRES],
      at: [x, STOOL_SEAT_TOP_METRES + PEG_PROUD_METRES - PEG_METRES / 2, z],
      colour: PEG_COLOUR,
    })),
  ];
  return createFurnitureMeshes(entities, {
    structure: "stool",
    stages: [legs, seat],
    pickBox: { size: [size, STOOL_SEAT_TOP_METRES, size], at: [0, STOOL_SEAT_TOP_METRES / 2, 0] },
  });
}

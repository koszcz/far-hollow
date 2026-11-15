// Draws stools and stool blueprints: the draft "stool" asset in asset-manifest.json, built in code. A rough draft.
// A stool is a small square seat of two sawn boards on four square legs, with a rail between each pair of legs.
// The player sits on it facing +z when it faces the default way. sit-animation.ts places them.
// The model is built in two stages, each taking half of construction: the legs with their rails, then the seat.
// plank-furniture-meshes.ts draws the stages.
import { stoolEntities, type EntityStore } from "../sim/entities";
import { STOOL_SIZE_METRES } from "../sim/structures";
import { createFurnitureMeshes, type FurnitureMeshes, type FurniturePart } from "./plank-furniture-meshes";

/** How many stages the stool model is built in: the legs with their rails, then the seat. */
export const STOOL_MODEL_STAGES = 2;
/** How high the top of the seat is above the stool's base, in metres. The player sits on it. */
export const STOOL_SEAT_TOP_METRES = 0.27;

/** The square legs: how wide each is. They stand just inside the seat's corners. */
const LEG_METRES = 0.05;
/** How far in from the seat's edge each leg stands, in metres. */
const LEG_INSET_METRES = 0.02;
/** How thick the seat boards are, and how wide the gap between them is, in metres. */
const SEAT_METRES = 0.035;
const SEAT_GAP_METRES = 0.008;
/** The rails between the legs: how thick, and how high above the ground their middle is, in metres. */
const RAIL_METRES = 0.03;
const RAIL_HEIGHT_METRES = 0.09;

export function createStoolMeshes(entities: EntityStore): FurnitureMeshes {
  const size = STOOL_SIZE_METRES;
  const legHeight = STOOL_SEAT_TOP_METRES - SEAT_METRES;
  const legAt = size / 2 - LEG_INSET_METRES - LEG_METRES / 2;
  const railLength = 2 * legAt - LEG_METRES;
  const legs: FurniturePart[] = [
    ...[-1, 1].flatMap((sx) =>
      [-1, 1].map((sz): FurniturePart => ({ size: [LEG_METRES, legHeight, LEG_METRES], at: [sx * legAt, legHeight / 2, sz * legAt] })),
    ),
    // A rail runs between the legs on the left and on the right, and one across at the front and back, a little higher.
    ...[-1, 1].map((sx): FurniturePart => ({ size: [RAIL_METRES, RAIL_METRES, railLength], at: [sx * legAt, RAIL_HEIGHT_METRES, 0] })),
    ...[-1, 1].map((sz): FurniturePart => ({ size: [railLength, RAIL_METRES, RAIL_METRES], at: [0, RAIL_HEIGHT_METRES + RAIL_METRES, sz * legAt] })),
  ];
  // The seat is two boards side by side, running front to back.
  const boardWidth = (size - SEAT_GAP_METRES) / 2;
  const seat = [-1, 1].map((sx): FurniturePart => ({
    size: [boardWidth, SEAT_METRES, size],
    at: [sx * (boardWidth + SEAT_GAP_METRES) * 0.5, STOOL_SEAT_TOP_METRES - SEAT_METRES / 2, 0],
  }));
  return createFurnitureMeshes(entities, {
    structure: "stool",
    stages: [legs, seat],
    pickBox: { size: [size, STOOL_SEAT_TOP_METRES, size], at: [0, STOOL_SEAT_TOP_METRES / 2, 0] },
    finished: stoolEntities,
  });
}

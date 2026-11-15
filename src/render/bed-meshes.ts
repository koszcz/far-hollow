// Draws beds and bed blueprints: the draft "bed" asset in asset-manifest.json, built in code. A rough draft.
// A bed is a plank frame on four short legs, with slats across it, a tall headboard, a low footboard,
// and a simple mattress with a pillow and a folded blanket.
// Its head faces -z when it faces the default way, as a bedroll's does, so the sleep animation lies the player along it.
// The model is built in four stages, each taking a quarter of construction: the frame, the slats, the head and foot boards,
// then the mattress. plank-furniture-meshes.ts draws the stages.
import { bedEntities, type EntityStore } from "../sim/entities";
import { BED_LENGTH_METRES, BED_WIDTH_METRES } from "../sim/structures";
import { createFurnitureMeshes, type FurnitureMeshes, type FurniturePart } from "./plank-furniture-meshes";

/** How many stages the bed model is built in: the frame, the slats, the head and foot boards, then the mattress. */
export const BED_MODEL_STAGES = 4;
/** How high the top of the mattress is above the bed's base, in metres. The player lies on it to sleep. */
export const BED_MATTRESS_TOP_METRES = 0.46;

/** The square legs: how wide, and how tall. The side rails rest on them. */
const LEG_METRES = 0.08;
const LEG_HEIGHT_METRES = 0.3;
/** The rails round the frame: how thick, and how tall. */
const RAIL_METRES = 0.05;
const RAIL_HEIGHT_METRES = 0.12;
/** How many slats lie across the frame, and how wide each is. */
const SLATS = 7;
const SLAT_WIDTH_METRES = 0.14;
const SLAT_THICKNESS_METRES = 0.025;
/** How tall the headboard and footboard reach above the base, in metres. */
const HEADBOARD_TOP_METRES = 0.8;
const FOOTBOARD_TOP_METRES = 0.52;
/** How thick the mattress is, and how far in from the rails it sits. */
const MATTRESS_INSET_METRES = 0.04;
/** The mattress and pillow are pale linen. The blanket is a muted blue wool. */
const MATTRESS_COLOUR = 0xe8dcc0;
const PILLOW_COLOUR = 0xf2ead8;
const BLANKET_COLOUR = 0x6f819c;

/** Draws every bed and bed blueprint, and the bed blueprint the player is placing. */
export function createBedMeshes(entities: EntityStore): FurnitureMeshes {
  const width = BED_WIDTH_METRES;
  const length = BED_LENGTH_METRES;
  const legX = width / 2 - LEG_METRES / 2;
  const legZ = length / 2 - LEG_METRES / 2;
  const railY = LEG_HEIGHT_METRES - RAIL_HEIGHT_METRES / 2;
  const frame: FurniturePart[] = [
    ...[-1, 1].flatMap((sx) =>
      [-1, 1].map((sz): FurniturePart => ({ size: [LEG_METRES, LEG_HEIGHT_METRES, LEG_METRES], at: [sx * legX, LEG_HEIGHT_METRES / 2, sz * legZ] })),
    ),
    ...[-1, 1].map((sx): FurniturePart => ({
      size: [RAIL_METRES, RAIL_HEIGHT_METRES, length - 2 * LEG_METRES],
      at: [sx * (width / 2 - RAIL_METRES / 2), railY, 0],
    })),
    ...[-1, 1].map((sz): FurniturePart => ({
      size: [width - 2 * LEG_METRES, RAIL_HEIGHT_METRES, RAIL_METRES],
      at: [0, railY, sz * (length / 2 - RAIL_METRES / 2)],
    })),
  ];
  const slatSpan = length - 2 * LEG_METRES - SLAT_WIDTH_METRES;
  const slats = Array.from({ length: SLATS }, (_, i): FurniturePart => ({
    size: [width - 2 * RAIL_METRES, SLAT_THICKNESS_METRES, SLAT_WIDTH_METRES],
    at: [0, LEG_HEIGHT_METRES + SLAT_THICKNESS_METRES / 2, -slatSpan / 2 + (slatSpan * i) / (SLATS - 1)],
  }));
  const boardHeight = (top: number) => top - LEG_HEIGHT_METRES;
  const boards: FurniturePart[] = [
    // Each board is two planks, one above the other, between the legs at its end.
    ...[0, 1].map((row): FurniturePart => ({
      size: [width, boardHeight(HEADBOARD_TOP_METRES) / 2 - 0.01, RAIL_METRES],
      at: [0, LEG_HEIGHT_METRES + (boardHeight(HEADBOARD_TOP_METRES) * (row + 0.5)) / 2, -length / 2 + RAIL_METRES / 2],
    })),
    ...[0, 1].map((row): FurniturePart => ({
      size: [width, boardHeight(FOOTBOARD_TOP_METRES) / 2 - 0.01, RAIL_METRES],
      at: [0, LEG_HEIGHT_METRES + (boardHeight(FOOTBOARD_TOP_METRES) * (row + 0.5)) / 2, length / 2 - RAIL_METRES / 2],
    })),
  ];
  const mattressBottom = LEG_HEIGHT_METRES + SLAT_THICKNESS_METRES;
  const mattressThickness = BED_MATTRESS_TOP_METRES - mattressBottom;
  const mattressLength = length - 2 * RAIL_METRES - 2 * MATTRESS_INSET_METRES;
  const mattressWidth = width - 2 * RAIL_METRES - 2 * MATTRESS_INSET_METRES;
  const bedding: FurniturePart[] = [
    { size: [mattressWidth, mattressThickness, mattressLength], at: [0, mattressBottom + mattressThickness / 2, 0], colour: MATTRESS_COLOUR },
    { size: [mattressWidth * 0.7, 0.08, 0.3], at: [0, BED_MATTRESS_TOP_METRES + 0.04, -mattressLength / 2 + 0.22], colour: PILLOW_COLOUR },
    { size: [mattressWidth + 0.02, 0.04, mattressLength * 0.45], at: [0, BED_MATTRESS_TOP_METRES + 0.02, mattressLength * 0.25], colour: BLANKET_COLOUR },
  ];
  return createFurnitureMeshes(entities, {
    structure: "bed",
    stages: [frame, slats, boards, bedding],
    pickBox: { size: [width, HEADBOARD_TOP_METRES, length], at: [0, HEADBOARD_TOP_METRES / 2, 0] },
    finished: bedEntities,
  });
}

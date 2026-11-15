// Draws beds and bed blueprints: the approved "bed" asset in asset-manifest.json, built in code.
// A bed is a cabin bed: four square corner posts with capped tops, tall at the head and low at the foot,
// joined by rails, with slats across them. The headboard and footboard are upright planks under a top rail.
// On the slats lies a linen mattress with a soft top edge, a plump pillow, and a blue wool blanket
// over the foot half that drapes down over the side rails, with its top edge turned back.
// Its head faces -z when it faces the default way, as a bedroll's does, so the sleep animation lies the player along it.
// The model is built in four stages, each taking a quarter of construction: the frame, the slats, the head and foot boards,
// then the bedding. plank-furniture-meshes.ts draws the stages.
import type { EntityStore } from "../sim/entities";
import { BED_LENGTH_METRES, BED_WIDTH_METRES } from "../sim/furniture/bed";
import { createFurnitureMeshes, type FurnitureMeshes, type FurniturePart } from "./plank-furniture-meshes";

/** How many stages the bed model is built in: the frame, the slats, the head and foot boards, then the bedding. */
export const BED_MODEL_STAGES = 4;
/** How high the top of the mattress is above the bed's base, in metres. The player lies on it to sleep. */
export const BED_MATTRESS_TOP_METRES = 0.46;

/** The square corner posts: how wide, how tall at the head and at the foot, and the cap on top of each. */
const POST_METRES = 0.09;
const HEAD_POST_METRES = 0.9;
const FOOT_POST_METRES = 0.6;
const CAP_METRES = 0.12;
const CAP_HEIGHT_METRES = 0.03;
/** The rails between the posts: how thick, how tall, and how high their tops are. */
const RAIL_METRES = 0.06;
const RAIL_HEIGHT_METRES = 0.14;
const RAIL_TOP_METRES = 0.34;
/** How many slats lie across the frame, how wide and thick each is, and how far below the rail tops they sit. */
const SLATS = 7;
const SLAT_WIDTH_METRES = 0.14;
const SLAT_THICKNESS_METRES = 0.025;
const SLAT_DROP_METRES = 0.04;
/** The top rail of the headboard and footboard: how tall it is, and how far below the post tops it sits. */
const TOP_RAIL_HEIGHT_METRES = 0.07;
const TOP_RAIL_DROP_METRES = 0.05;
/** The upright planks under each top rail: how many at the head and foot, and how wide. */
const HEAD_UPRIGHTS = 5;
const FOOT_UPRIGHTS = 4;
const UPRIGHT_WIDTH_METRES = 0.11;
const UPRIGHT_THICKNESS_METRES = 0.03;
/** How far in from the rails the mattress sits, and how far its soft top edge is drawn in. */
const MATTRESS_INSET_METRES = 0.02;
const MATTRESS_EDGE_METRES = 0.03;
/** How thick the blanket is, how far down over the side rails it hangs, and the size of its turned-back top edge. */
const BLANKET_METRES = 0.025;
const BLANKET_DRAPE_METRES = 0.2;
const FOLD_DEPTH_METRES = 0.14;
const FOLD_HEIGHT_METRES = 0.05;
/** The mattress and pillow are pale linen. The blanket is a muted blue wool, its turned-back edge a little lighter. */
const MATTRESS_COLOUR = 0xe8dcc0;
const MATTRESS_TOP_COLOUR = 0xefe5cc;
const PILLOW_COLOUR = 0xf4eddd;
const BLANKET_COLOUR = 0x6f819c;
const FOLD_COLOUR = 0x8798b2;

/** Upright planks spread evenly across `span`, from `bottom` to `top`, at `z`. */
function uprights(count: number, span: number, bottom: number, top: number, z: number): FurniturePart[] {
  const gap = (span - count * UPRIGHT_WIDTH_METRES) / (count + 1);
  return Array.from({ length: count }, (_, i): FurniturePart => ({
    size: [UPRIGHT_WIDTH_METRES, top - bottom, UPRIGHT_THICKNESS_METRES],
    at: [-span / 2 + gap * (i + 1) + UPRIGHT_WIDTH_METRES * (i + 0.5), (bottom + top) / 2, z],
  }));
}

/** Draws every bed and bed blueprint, and the bed blueprint the player is placing. */
export function createBedMeshes(entities: EntityStore): FurnitureMeshes {
  const width = BED_WIDTH_METRES;
  const length = BED_LENGTH_METRES;
  const postX = width / 2 - POST_METRES / 2;
  const postZ = length / 2 - POST_METRES / 2;
  const railY = RAIL_TOP_METRES - RAIL_HEIGHT_METRES / 2;
  const between = width - 2 * POST_METRES;
  // The head is at -z, the foot at +z.
  const ends = [
    { sz: -1, post: HEAD_POST_METRES },
    { sz: 1, post: FOOT_POST_METRES },
  ];
  const frame: FurniturePart[] = [
    ...ends.flatMap(({ sz, post }) =>
      [-1, 1].flatMap((sx): FurniturePart[] => [
        { size: [POST_METRES, post, POST_METRES], at: [sx * postX, post / 2, sz * postZ] },
        { size: [CAP_METRES, CAP_HEIGHT_METRES, CAP_METRES], at: [sx * postX, post + CAP_HEIGHT_METRES / 2, sz * postZ] },
      ]),
    ),
    ...[-1, 1].map((sx): FurniturePart => ({
      size: [RAIL_METRES, RAIL_HEIGHT_METRES, length - 2 * POST_METRES],
      at: [sx * (width / 2 - RAIL_METRES / 2), railY, 0],
    })),
    ...[-1, 1].map((sz): FurniturePart => ({
      size: [between, RAIL_HEIGHT_METRES, RAIL_METRES],
      at: [0, railY, sz * postZ],
    })),
  ];
  const slatTop = RAIL_TOP_METRES - SLAT_DROP_METRES;
  const slatSpan = length - 2 * POST_METRES - SLAT_WIDTH_METRES;
  const slats = Array.from({ length: SLATS }, (_, i): FurniturePart => ({
    size: [width - 2 * RAIL_METRES, SLAT_THICKNESS_METRES, SLAT_WIDTH_METRES],
    at: [0, slatTop - SLAT_THICKNESS_METRES / 2, -slatSpan / 2 + (slatSpan * i) / (SLATS - 1)],
  }));
  const boards: FurniturePart[] = ends.flatMap(({ sz, post }) => {
    const topRailTop = post - TOP_RAIL_DROP_METRES;
    const topRailBottom = topRailTop - TOP_RAIL_HEIGHT_METRES;
    return [
      { size: [between, TOP_RAIL_HEIGHT_METRES, RAIL_METRES], at: [0, topRailBottom + TOP_RAIL_HEIGHT_METRES / 2, sz * postZ] },
      ...uprights(sz < 0 ? HEAD_UPRIGHTS : FOOT_UPRIGHTS, between, RAIL_TOP_METRES, topRailBottom, sz * postZ),
    ];
  });
  const mattressBottom = slatTop;
  const mattressLength = length - 2 * POST_METRES - 2 * MATTRESS_INSET_METRES;
  const mattressWidth = width - 2 * RAIL_METRES - 2 * MATTRESS_INSET_METRES;
  const edgeBottom = BED_MATTRESS_TOP_METRES - MATTRESS_EDGE_METRES;
  const mattressThickness = edgeBottom - mattressBottom;
  const pillowZ = -mattressLength / 2 + 0.22;
  const blanketLength = mattressLength * 0.5;
  const blanketZ = mattressLength / 2 - blanketLength / 2;
  const blanketTop = BED_MATTRESS_TOP_METRES + BLANKET_METRES;
  const blanketWidth = width + 0.04;
  const bedding: FurniturePart[] = [
    // The mattress, and a slightly smaller layer on top of it, so its top edge reads as soft.
    { size: [mattressWidth, mattressThickness, mattressLength], at: [0, mattressBottom + mattressThickness / 2, 0], colour: MATTRESS_COLOUR },
    {
      size: [mattressWidth - 2 * MATTRESS_EDGE_METRES, MATTRESS_EDGE_METRES, mattressLength - 2 * MATTRESS_EDGE_METRES],
      at: [0, edgeBottom + MATTRESS_EDGE_METRES / 2, 0],
      colour: MATTRESS_TOP_COLOUR,
    },
    // The pillow: a wide base and a smaller crown, so it looks plump.
    { size: [mattressWidth * 0.72, 0.07, 0.32], at: [0, BED_MATTRESS_TOP_METRES + 0.035, pillowZ], colour: PILLOW_COLOUR },
    { size: [mattressWidth * 0.6, 0.04, 0.24], at: [0, BED_MATTRESS_TOP_METRES + 0.08, pillowZ], colour: PILLOW_COLOUR },
    // The blanket over the foot half, hanging down over both side rails, with its top edge turned back.
    { size: [blanketWidth, BLANKET_METRES, blanketLength], at: [0, blanketTop - BLANKET_METRES / 2, blanketZ], colour: BLANKET_COLOUR },
    ...[-1, 1].map((sx): FurniturePart => ({
      size: [BLANKET_METRES, BLANKET_DRAPE_METRES, blanketLength],
      at: [sx * (blanketWidth / 2 - BLANKET_METRES / 2), blanketTop - BLANKET_DRAPE_METRES / 2, blanketZ],
      colour: BLANKET_COLOUR,
    })),
    {
      size: [blanketWidth + 0.01, FOLD_HEIGHT_METRES, FOLD_DEPTH_METRES],
      at: [0, blanketTop - BLANKET_METRES + FOLD_HEIGHT_METRES / 2, blanketZ - blanketLength / 2 + FOLD_DEPTH_METRES / 2],
      colour: FOLD_COLOUR,
    },
  ];
  const top = HEAD_POST_METRES + CAP_HEIGHT_METRES;
  return createFurnitureMeshes(entities, {
    structure: "bed",
    stages: [frame, slats, boards, bedding],
    pickBox: { size: [width, top, length], at: [0, top / 2, 0] },
  });
}

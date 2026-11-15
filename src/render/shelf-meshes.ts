// Draws shelves and shelf blueprints: the approved "shelf" asset in asset-manifest.json, built in code.
// A shelf is a rustic frame of sawn planks: four square corner posts that stand on the ground as short feet,
// two shelf boards and an overhanging top, a rail under each board on both sides, a lip under each board's front edge,
// dark pegs where the boards meet the front posts, three back planks side by side, and a slanted brace across the back.
// It does not show what it holds. Its front faces +z when it faces the default way.
// The model is built in three stages, each taking a third of construction: the posts with the lowest board,
// then the middle board and the top, then the back. plank-furniture-meshes.ts draws the stages.
import type { EntityStore } from "../sim/entities";
import { SHELF_DEPTH_METRES, SHELF_WIDTH_METRES } from "../sim/furniture/shelf";
import { createFurnitureMeshes, type FurnitureMeshes, type FurniturePart } from "./plank-furniture-meshes";

/** How many stages the shelf model is built in: the posts with the lowest board, the middle board and the top, then the back. */
export const SHELF_MODEL_STAGES = 3;

/** How tall the shelf stands, to the top of its top board, in metres. */
const HEIGHT_METRES = 1.2;
/** How wide each square corner post is, in metres. */
const POST_METRES = 0.06;
/** How thick the shelf boards and the top are, in metres. */
const BOARD_METRES = 0.03;
/** How high the top of each shelf board below the top is above the ground, in metres. */
const BOARD_TOPS_METRES = [0.16, 0.66];
/** How far the top reaches past the posts at each side, and past the front. */
const TOP_OVERHANG_METRES = 0.02;
const TOP_FRONT_OVERHANG_METRES = 0.03;
/** The rail under each board on both sides, and the lip under each board's front edge: how thick, and how tall. */
const RAIL_METRES = 0.03;
const RAIL_HEIGHT_METRES = 0.05;
const LIP_METRES = 0.02;
/** How thick the back planks are, how many stand side by side, and the gap between two of them, in metres. */
const BACK_METRES = 0.02;
const BACK_PLANKS = 3;
const BACK_GAP_METRES = 0.004;
/** How wide and thick the brace across the back is, in metres. */
const BRACE_WIDTH_METRES = 0.07;
const BRACE_METRES = 0.025;
/** The size of a peg, and its dark wood. */
const PEG_METRES = 0.018;
const PEG_COLOUR = 0x6b4f33;

/** Draws every shelf and shelf blueprint, and the shelf blueprint the player is placing. */
export function createShelfMeshes(entities: EntityStore): FurnitureMeshes {
  const width = SHELF_WIDTH_METRES;
  const depth = SHELF_DEPTH_METRES;
  const postX = width / 2 - POST_METRES / 2;
  const postZ = depth / 2 - POST_METRES / 2;
  const innerWidth = width - 2 * POST_METRES;
  const postHeight = HEIGHT_METRES - BOARD_METRES;
  const railY = (top: number) => top - BOARD_METRES - RAIL_HEIGHT_METRES / 2;

  /** The parts that hold up a board whose top is at `top`: a rail on each side, and pegs on the front posts. */
  const supports = (top: number): FurniturePart[] => [
    ...[-1, 1].map((sx): FurniturePart => ({ size: [RAIL_METRES, RAIL_HEIGHT_METRES, depth - 2 * POST_METRES], at: [sx * postX, railY(top), 0] })),
    ...[-1, 1].map((sx): FurniturePart => ({
      size: [PEG_METRES, PEG_METRES, PEG_METRES],
      at: [sx * postX, railY(top), depth / 2 + PEG_METRES / 2 - 0.004],
      colour: PEG_COLOUR,
    })),
  ];
  /** A shelf board between the posts with its top at `top`, the lip under its front edge, and what holds it up. */
  const board = (top: number): FurniturePart[] => [
    { size: [innerWidth, BOARD_METRES, depth - BACK_METRES], at: [0, top - BOARD_METRES / 2, BACK_METRES / 2] },
    { size: [innerWidth, RAIL_HEIGHT_METRES, LIP_METRES], at: [0, railY(top), depth / 2 - LIP_METRES / 2] },
    ...supports(top),
  ];
  const [lowestTop = 0, middleTop = 0] = BOARD_TOPS_METRES;

  const posts = [-1, 1].flatMap((sx) =>
    [-1, 1].map((sz): FurniturePart => ({ size: [POST_METRES, postHeight, POST_METRES], at: [sx * postX, postHeight / 2, sz * postZ] })),
  );
  const top: FurniturePart = {
    size: [width + 2 * TOP_OVERHANG_METRES, BOARD_METRES, depth + TOP_FRONT_OVERHANG_METRES],
    at: [0, HEIGHT_METRES - BOARD_METRES / 2, TOP_FRONT_OVERHANG_METRES / 2],
  };

  const backBottom = lowestTop - BOARD_METRES;
  const backHeight = postHeight - backBottom;
  const backPlankWidth = (innerWidth - (BACK_PLANKS - 1) * BACK_GAP_METRES) / BACK_PLANKS;
  const backPlanks = Array.from({ length: BACK_PLANKS }, (_, i): FurniturePart => ({
    size: [backPlankWidth, backHeight, BACK_METRES],
    at: [-innerWidth / 2 + backPlankWidth / 2 + i * (backPlankWidth + BACK_GAP_METRES), backBottom + backHeight / 2, -depth / 2 + BACK_METRES / 2],
  }));
  // The brace runs on the outside of the back, from low at one side to high at the other.
  const braceRise = backHeight - 2 * BRACE_WIDTH_METRES;
  const braceRun = innerWidth - BRACE_WIDTH_METRES;
  const brace: FurniturePart = {
    size: [Math.hypot(braceRun, braceRise), BRACE_WIDTH_METRES, BRACE_METRES],
    at: [0, backBottom + backHeight / 2, -depth / 2 - BRACE_METRES / 2],
    tilt: Math.atan2(braceRise, braceRun),
  };

  return createFurnitureMeshes(entities, {
    structure: "shelf",
    stages: [
      [...posts, ...board(lowestTop)],
      [...board(middleTop), top, ...supports(HEIGHT_METRES)],
      [...backPlanks, brace],
    ],
    pickBox: { size: [width + 2 * TOP_OVERHANG_METRES, HEIGHT_METRES, depth + TOP_FRONT_OVERHANG_METRES], at: [0, HEIGHT_METRES / 2, 0] },
  });
}

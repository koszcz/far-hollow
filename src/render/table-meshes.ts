// Draws tables and table blueprints: the approved "table" asset in asset-manifest.json, built in code.
// A table is a farmhouse table: four thick square legs joined near the ground by an H-shaped stretcher,
// a frame of rails under the top with dark pegs where the long rails meet the legs,
// and a top of four planks laid along its length between two cleats across its ends, pegged into the cleats.
// The top overhangs the frame on every side.
// The model is built in three stages, each taking a third of construction: the legs with the stretcher, the rails, then the top.
// plank-furniture-meshes.ts draws the stages.
import type { EntityStore } from "../sim/entities";
import { TABLE_DEPTH_METRES, TABLE_WIDTH_METRES } from "../sim/furniture/table";
import { createFurnitureMeshes, type FurnitureMeshes, type FurniturePart } from "./plank-furniture-meshes";

/** How many stages the table model is built in: the legs with the stretcher, the rails, then the top. */
export const TABLE_MODEL_STAGES = 3;
/** How high the top of the table is above its base, in metres. */
export const TABLE_TOP_METRES = 0.75;

/** The square legs: how wide, and how far in from the edges of the top they stand. */
const LEG_METRES = 0.08;
const LEG_INSET_METRES = 0.11;
/** The H-shaped stretcher near the ground: how thick, how tall, and how high its middle is. */
const STRETCHER_METRES = 0.045;
const STRETCHER_HEIGHT_METRES = 0.06;
const STRETCHER_Y_METRES = 0.16;
/** The rails between the legs, just under the top: how thick, and how tall. */
const RAIL_METRES = 0.04;
const RAIL_HEIGHT_METRES = 0.11;
/** How many planks make the top, how thick they are, and the gap between two of them. */
const TOP_PLANKS = 4;
const TOP_THICKNESS_METRES = 0.04;
const TOP_GAP_METRES = 0.008;
/** How wide the cleat across each end of the top is. */
const CLEAT_METRES = 0.08;
/** The size of a peg, how far it stands proud of the wood, and its dark wood. */
const PEG_METRES = 0.02;
const PEG_PROUD_METRES = 0.004;
const PEG_COLOUR = 0x6b4f33;

/** Draws every table and table blueprint, and the table blueprint the player is placing. */
export function createTableMeshes(entities: EntityStore): FurnitureMeshes {
  const width = TABLE_WIDTH_METRES;
  const depth = TABLE_DEPTH_METRES;
  const legTop = TABLE_TOP_METRES - TOP_THICKNESS_METRES;
  const legX = width / 2 - LEG_INSET_METRES - LEG_METRES / 2;
  const legZ = depth / 2 - LEG_INSET_METRES - LEG_METRES / 2;
  const peg = (at: [number, number, number]): FurniturePart => ({ size: [PEG_METRES, PEG_METRES, PEG_METRES], at, colour: PEG_COLOUR });

  const legs = [-1, 1].flatMap((sx) =>
    [-1, 1].map((sz): FurniturePart => ({ size: [LEG_METRES, legTop, LEG_METRES], at: [sx * legX, legTop / 2, sz * legZ] })),
  );
  const stretcher: FurniturePart[] = [
    ...[-1, 1].map((sx): FurniturePart => ({
      size: [STRETCHER_METRES, STRETCHER_HEIGHT_METRES, 2 * legZ - LEG_METRES],
      at: [sx * legX, STRETCHER_Y_METRES, 0],
    })),
    { size: [2 * legX - STRETCHER_METRES, STRETCHER_HEIGHT_METRES, STRETCHER_METRES], at: [0, STRETCHER_Y_METRES, 0] },
  ];

  const railY = legTop - RAIL_HEIGHT_METRES / 2;
  const legFaceZ = legZ + LEG_METRES / 2;
  const rails: FurniturePart[] = [
    ...[-1, 1].map((sz): FurniturePart => ({ size: [2 * legX - LEG_METRES, RAIL_HEIGHT_METRES, RAIL_METRES], at: [0, railY, sz * legZ] })),
    ...[-1, 1].map((sx): FurniturePart => ({ size: [RAIL_METRES, RAIL_HEIGHT_METRES, 2 * legZ - LEG_METRES], at: [sx * legX, railY, 0] })),
  ];
  // A peg on the outside of each leg, where a long rail is fixed into it.
  const railPegs = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => peg([sx * legX, railY, sz * (legFaceZ + PEG_METRES / 2 - PEG_PROUD_METRES)])));

  const topY = TABLE_TOP_METRES - TOP_THICKNESS_METRES / 2;
  const plankLength = width - 2 * CLEAT_METRES;
  const plankWidth = (depth - (TOP_PLANKS - 1) * TOP_GAP_METRES) / TOP_PLANKS;
  const plankZ = (i: number) => -depth / 2 + plankWidth / 2 + i * (plankWidth + TOP_GAP_METRES);
  const planks = Array.from({ length: TOP_PLANKS }, (_, i): FurniturePart => ({
    size: [plankLength, TOP_THICKNESS_METRES, plankWidth],
    at: [0, topY, plankZ(i)],
  }));
  const cleatX = width / 2 - CLEAT_METRES / 2;
  const cleats = [-1, 1].map((sx): FurniturePart => ({ size: [CLEAT_METRES, TOP_THICKNESS_METRES, depth], at: [sx * cleatX, topY, 0] }));
  // A peg through each cleat into the end of each plank.
  const pegY = TABLE_TOP_METRES + PEG_PROUD_METRES - PEG_METRES / 2;
  const topPegs = [-1, 1].flatMap((sx) => Array.from({ length: TOP_PLANKS }, (_, i) => peg([sx * cleatX, pegY, plankZ(i)])));

  return createFurnitureMeshes(entities, {
    structure: "table",
    stages: [
      [...legs, ...stretcher],
      [...rails, ...railPegs],
      [...planks, ...cleats, ...topPegs],
    ],
    pickBox: { size: [width, TABLE_TOP_METRES, depth], at: [0, TABLE_TOP_METRES / 2, 0] },
  });
}

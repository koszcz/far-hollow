// Draws tables and table blueprints: the draft "table" asset in asset-manifest.json, built in code. A rough draft.
// A table is a top of four planks laid along its length, on a frame of rails, on four square legs.
// The model is built in three stages, each taking a third of construction: the legs, the rails, then the top.
// plank-furniture-meshes.ts draws the stages.
import { tableEntities, type EntityStore } from "../sim/entities";
import { TABLE_DEPTH_METRES, TABLE_WIDTH_METRES } from "../sim/structures";
import { createFurnitureMeshes, type FurnitureMeshes, type FurniturePart } from "./plank-furniture-meshes";

/** How many stages the table model is built in: the legs, the rails, then the top. */
export const TABLE_MODEL_STAGES = 3;
/** How high the top of the table is above its base, in metres. */
export const TABLE_TOP_METRES = 0.75;

/** The square legs: how wide, and how far in from the edges of the top they stand. */
const LEG_METRES = 0.07;
const LEG_INSET_METRES = 0.06;
/** The rails between the legs, just under the top: how thick, and how tall. */
const RAIL_METRES = 0.04;
const RAIL_HEIGHT_METRES = 0.1;
/** How many planks make the top, how thick they are, and the gap between two of them. */
const TOP_PLANKS = 4;
const TOP_THICKNESS_METRES = 0.035;
const TOP_GAP_METRES = 0.008;

/** Draws every table and table blueprint, and the table blueprint the player is placing. */
export function createTableMeshes(entities: EntityStore): FurnitureMeshes {
  const width = TABLE_WIDTH_METRES;
  const depth = TABLE_DEPTH_METRES;
  const legTop = TABLE_TOP_METRES - TOP_THICKNESS_METRES;
  const legX = width / 2 - LEG_INSET_METRES - LEG_METRES / 2;
  const legZ = depth / 2 - LEG_INSET_METRES - LEG_METRES / 2;
  const legs = [-1, 1].flatMap((sx) =>
    [-1, 1].map((sz): FurniturePart => ({ size: [LEG_METRES, legTop, LEG_METRES], at: [sx * legX, legTop / 2, sz * legZ] })),
  );
  const railY = legTop - RAIL_HEIGHT_METRES / 2;
  const rails: FurniturePart[] = [
    ...[-1, 1].map((sz): FurniturePart => ({ size: [2 * legX - LEG_METRES, RAIL_HEIGHT_METRES, RAIL_METRES], at: [0, railY, sz * legZ] })),
    ...[-1, 1].map((sx): FurniturePart => ({ size: [RAIL_METRES, RAIL_HEIGHT_METRES, 2 * legZ - LEG_METRES], at: [sx * legX, railY, 0] })),
  ];
  const plankWidth = (depth - (TOP_PLANKS - 1) * TOP_GAP_METRES) / TOP_PLANKS;
  const top = Array.from({ length: TOP_PLANKS }, (_, i): FurniturePart => ({
    size: [width, TOP_THICKNESS_METRES, plankWidth],
    at: [0, TABLE_TOP_METRES - TOP_THICKNESS_METRES / 2, -depth / 2 + plankWidth / 2 + i * (plankWidth + TOP_GAP_METRES)],
  }));
  return createFurnitureMeshes(entities, {
    structure: "table",
    stages: [legs, rails, top],
    pickBox: { size: [width, TABLE_TOP_METRES, depth], at: [0, TABLE_TOP_METRES / 2, 0] },
    finished: tableEntities,
  });
}

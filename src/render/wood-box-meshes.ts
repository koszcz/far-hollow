// Draws wood boxes and wood box blueprints: the draft "wood-box" asset in asset-manifest.json, built in code.
// A wood box is an open box of planks: a bottom of boards, a long plank side at the front and the back, a short end on the
// left and the right, and a square post in each corner. It is wider than it is deep, so firewood lies in it front to back.
// Inside, the firewood it holds shows, from none to 20, in rows of four laid on top of each other. The pieces reuse the
// approved "firewood" shape. A full box heaps a little above its rim.
// The model is built in two stages, each taking half of construction: the bottom with the corner posts, then the sides.
// plank-furniture-meshes.ts draws the stages. This file adds the firewood.
import * as THREE from "three";
import { type Entity, type EntityStore } from "../sim/entities";
import { furnitureEntities } from "../sim/entity-queries";
import { WOOD_BOX_DEPTH_METRES, WOOD_BOX_FIREWOOD_LIMIT, WOOD_BOX_WIDTH_METRES } from "../sim/furniture/wood-box";
import { quarterTurnsToRadians } from "../sim/quarter-turns";
import { createFirewoodGeometry, FIREWOOD_COLOUR } from "./firewood-shape";
import { createFurnitureMeshes, type FurnitureMeshes, type FurniturePart } from "./plank-furniture-meshes";

/** How many stages the wood box model is built in: the bottom with its posts, then the sides. */
export const WOOD_BOX_MODEL_STAGES = 2;
/** How tall a wood box's sides are, in metres. */
export const WOOD_BOX_HEIGHT_METRES = 0.42;

/** How thick the side planks and bottom boards are, in metres. */
const PLANK_METRES = 0.025;
/** How far the bottom's top is above the ground, in metres: the boards rest on low battens. */
const BOTTOM_TOP_METRES = 0.05;
/** How many boards the bottom is made of. */
const BOTTOM_BOARDS = 4;
/** The battens under the bottom: how tall and how wide, in metres. */
const BATTEN_METRES = 0.04;
/** How wide each square corner post is, in metres. */
const POST_METRES = 0.05;
/** How many planks each side is made of, one above the other, and the gap between them, in metres. */
const SIDE_PLANKS = 3;
const SIDE_GAP_METRES = 0.012;
/** The corner posts are darker than the planks, so the box's corners read. */
const POST_SHADE = 0.8;
/** How far apart the pieces of firewood in one row are, and how high each layer sits above the one below, in metres. */
const FIREWOOD_SPACING_METRES = 0.16;
const FIREWOOD_LAYER_METRES = 0.11;
/** How many pieces of firewood lie side by side in one row. */
const FIREWOOD_PER_ROW = 4;

/** Where the piece of firewood with this number lies in the box, in the box's own space, and whether it lies turned round. */
export function firewoodSpot(index: number): { x: number; y: number; z: number; flipped: boolean } {
  const layer = Math.floor(index / FIREWOOD_PER_ROW);
  const inRow = index % FIREWOOD_PER_ROW;
  // Each layer sits half a gap to one side of the one below, so the pieces nest in the gaps.
  const shift = layer % 2 === 0 ? -0.25 : 0.25;
  const x = (inRow - (FIREWOOD_PER_ROW - 1) / 2 + shift * 0.5) * FIREWOOD_SPACING_METRES;
  return { x, y: BOTTOM_TOP_METRES + layer * FIREWOOD_LAYER_METRES, z: ((index * 7) % 5) * 0.006 - 0.012, flipped: (index + layer) % 2 === 1 };
}

/** The bottom: boards laid front to back, on two battens across the box. */
function bottom(): FurniturePart[] {
  const width = WOOD_BOX_WIDTH_METRES - 2 * PLANK_METRES;
  const depth = WOOD_BOX_DEPTH_METRES - 2 * PLANK_METRES;
  const boardWidth = width / BOTTOM_BOARDS;
  return [
    ...Array.from({ length: BOTTOM_BOARDS }, (_, i): FurniturePart => ({
      size: [boardWidth * 0.97, PLANK_METRES, depth],
      at: [-width / 2 + boardWidth * (i + 0.5), BOTTOM_TOP_METRES - PLANK_METRES / 2, 0],
    })),
    ...[-1, 1].map((sz): FurniturePart => ({
      size: [width, BATTEN_METRES, BATTEN_METRES],
      at: [0, BATTEN_METRES / 2, (sz * depth) / 3],
      shade: POST_SHADE,
    })),
  ];
}

/** The four corner posts, from the ground to the top of the sides. */
function posts(): FurniturePart[] {
  const x = WOOD_BOX_WIDTH_METRES / 2 - POST_METRES / 2;
  const z = WOOD_BOX_DEPTH_METRES / 2 - POST_METRES / 2;
  return [-1, 1].flatMap((sx) =>
    [-1, 1].map((sz): FurniturePart => ({
      size: [POST_METRES, WOOD_BOX_HEIGHT_METRES, POST_METRES],
      at: [sx * x, WOOD_BOX_HEIGHT_METRES / 2, sz * z],
      shade: POST_SHADE,
    })),
  );
}

/** The sides: planks one above the other, the long ones at the front and back, the short ones at the left and right ends. */
function sides(): FurniturePart[] {
  const plankHeight = (WOOD_BOX_HEIGHT_METRES - BOTTOM_TOP_METRES - (SIDE_PLANKS - 1) * SIDE_GAP_METRES) / SIDE_PLANKS;
  const heights = Array.from({ length: SIDE_PLANKS }, (_, i) => BOTTOM_TOP_METRES + plankHeight / 2 + i * (plankHeight + SIDE_GAP_METRES));
  const longLength = WOOD_BOX_WIDTH_METRES - 2 * POST_METRES;
  const shortLength = WOOD_BOX_DEPTH_METRES - 2 * POST_METRES;
  return heights.flatMap((y) => [
    ...[-1, 1].map((sz): FurniturePart => ({
      size: [longLength, plankHeight, PLANK_METRES],
      at: [0, y, sz * (WOOD_BOX_DEPTH_METRES / 2 - PLANK_METRES / 2)],
    })),
    ...[-1, 1].map((sx): FurniturePart => ({
      size: [PLANK_METRES, plankHeight, shortLength],
      at: [sx * (WOOD_BOX_WIDTH_METRES / 2 - PLANK_METRES / 2), y, 0],
    })),
  ]);
}

export function createWoodBoxMeshes(entities: EntityStore): FurnitureMeshes {
  const boxes = createFurnitureMeshes(entities, {
    structure: "woodBox",
    stages: [[...bottom(), ...posts()], sides()],
    pickBox: { size: [WOOD_BOX_WIDTH_METRES, WOOD_BOX_HEIGHT_METRES, WOOD_BOX_DEPTH_METRES], at: [0, WOOD_BOX_HEIGHT_METRES / 2, 0] },
  });

  const firewoodGeometry = createFirewoodGeometry();
  const firewoodMaterial = new THREE.MeshStandardMaterial({ color: FIREWOOD_COLOUR, vertexColors: true, flatShading: true });
  const loads = new Map<Entity, { root: THREE.Group; pieces: THREE.Mesh[] }>();
  const finished = furnitureEntities(entities);

  /** The firewood of a wood box, made the first time it is needed. Every piece is made at once and shown as the box fills. */
  function loadOf(entity: Entity): { root: THREE.Group; pieces: THREE.Mesh[] } {
    let load = loads.get(entity);
    if (load === undefined) {
      const root = new THREE.Group();
      const pieces = Array.from({ length: WOOD_BOX_FIREWOOD_LIMIT }, (_, i) => {
        const piece = new THREE.Mesh(firewoodGeometry, firewoodMaterial);
        const spot = firewoodSpot(i);
        piece.position.set(spot.x, spot.y, spot.z);
        piece.rotation.y = spot.flipped ? Math.PI : 0;
        piece.castShadow = true;
        piece.receiveShadow = true;
        root.add(piece);
        return piece;
      });
      boxes.group.add(root);
      load = { root, pieces };
      loads.set(entity, load);
    }
    return load;
  }

  return {
    ...boxes,
    update() {
      boxes.update();
      const seen = new Set<Entity>();
      for (const entity of finished) {
        if (entity.furniture !== "woodBox") continue;
        const load = loadOf(entity);
        const held = entity.woodBox?.firewood ?? 0;
        load.pieces.forEach((piece, i) => {
          piece.visible = i < held;
        });
        load.root.position.set(entity.position.x, entity.position.y, entity.position.z);
        load.root.rotation.y = quarterTurnsToRadians(entity.facing?.turns ?? 0);
        seen.add(entity);
      }
      for (const [entity, load] of [...loads]) {
        if (seen.has(entity)) continue;
        boxes.group.remove(load.root);
        loads.delete(entity);
      }
    },
    dispose() {
      boxes.dispose();
      firewoodGeometry.dispose();
      firewoodMaterial.dispose();
    },
  };
}

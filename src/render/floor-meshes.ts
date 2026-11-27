// Draws floors and floor blueprints: the "floor" asset in asset-manifest.json, built in code and approved by the owner.
// A floor is six hand-laid plank boards side by side across the deck of one foundation square,
// flush on top of it, so the player and everything on the square stand at the same height as on the bare deck.
// The boards are a darker, warmer wood than the pale deck logs, so a floored square stands out from a bare one.
// Each board is a little wider or narrower than the next. Three boards are made of two pieces, with their joints staggered.
// The boards' long sides and cut ends are darker than their tops, so the seams between them show as dark lines.
// Construction has one stage per plank the floor costs. Each stage lays half the boards: they fade in above their place and are set down.
// A blueprint shows the boards see-through. The boards of a stage whose plank the blueprint already has show pale and half solid.
// While the player places a floor from the build menu, a see-through copy follows the mouse. It turns red where it is not allowed.
import * as THREE from "three";
import { blueprintEntities, floorEntities, type Entity, type EntityStore, type Vec3 } from "../sim/entities";
import { FLOOR_PLANK_COST } from "../sim/structure-cabin-shell";
import {
  BLUEPRINT_COLOUR,
  BLUEPRINT_OPACITY,
  buildLift,
  buildOpacity,
  DELIVERED_OPACITY,
  NOT_ALLOWED_COLOUR,
  pickBlueprint,
  pickFinished,
  seeThrough,
  type BuildingPieceMeshes,
} from "./structure-look";

/** The pale wood of a board waiting in its place. */
const DELIVERED_COLOUR = 0xecc995;
/** The floor's wood: a darker, warmer plank colour than the pale debarked deck logs under it. */
const FLOOR_WOOD_COLOUR = 0xb07c4c;
/** How much darker a board's long sides and its bottom are than its top, so the seams between boards show. */
const BOARD_SIDE_SHADE = 0.62;
/** The darker colour of a board's sawn ends. */
const BOARD_END_COLOUR = 0x7d5533;
/** How thick a board is, in metres. It lies on top of the deck, so it adds only this much to how the square looks. */
const BOARD_THICKNESS_METRES = 0.025;
/** How long a full board is, along z, in metres. */
const BOARD_LENGTH_METRES = 0.98;
/** The gap left between two boards side by side, and between the two pieces of a jointed board, in metres. */
const BOARD_GAP_METRES = 0.014;

/**
 * The boards, side by side across x. `width` is a share of the square, before the gaps come off.
 * `joints` lists where along z a board is cut into pieces, in metres from the square's middle.
 * `shades` gives each piece's shade of the wood colour, so neighbouring pieces differ a little.
 */
const BOARD_LAYOUT: readonly { readonly width: number; readonly joints: readonly number[]; readonly shades: readonly number[] }[] = [
  { width: 1.05, joints: [], shades: [1] },
  { width: 0.94, joints: [-0.18], shades: [0.9, 1.04] },
  { width: 1.1, joints: [], shades: [0.95] },
  { width: 0.9, joints: [0.24], shades: [1.06, 0.88] },
  { width: 1.02, joints: [-0.31], shades: [0.97, 1.02] },
  { width: 0.99, joints: [], shades: [0.91] },
];

/** A floor looks the same every way round, so its blueprint under the mouse ignores which way it faces. */
export type FloorMeshes = BuildingPieceMeshes;

/** Where one piece of a board lies, in metres from the square's middle, and its size and shade. */
interface PieceLayout {
  readonly x: number;
  readonly z: number;
  readonly width: number;
  readonly length: number;
  readonly shade: number;
  /** The stage of construction that lays it, from 0. */
  readonly stage: number;
}

/** Works out every board piece's place from BOARD_LAYOUT. Each stage of construction lays an equal share of the boards. */
function pieceLayouts(): PieceLayout[] {
  const widthShares = BOARD_LAYOUT.reduce((sum, board) => sum + board.width, 0);
  const coveredWidth = 1 - BOARD_LAYOUT.length * BOARD_GAP_METRES;
  const pieces: PieceLayout[] = [];
  let left = -0.5 + BOARD_GAP_METRES / 2;
  BOARD_LAYOUT.forEach((board, index) => {
    const width = (board.width / widthShares) * coveredWidth;
    const stage = Math.floor((index * FLOOR_PLANK_COST) / BOARD_LAYOUT.length);
    const ends = [-BOARD_LENGTH_METRES / 2, ...board.joints, BOARD_LENGTH_METRES / 2];
    for (let piece = 0; piece < ends.length - 1; piece++) {
      const start = (ends[piece] ?? 0) + (piece > 0 ? BOARD_GAP_METRES / 2 : 0);
      const end = (ends[piece + 1] ?? 0) - (piece < ends.length - 2 ? BOARD_GAP_METRES / 2 : 0);
      pieces.push({ x: left + width / 2, z: (start + end) / 2, width, length: end - start, shade: board.shades[piece] ?? 1, stage });
    }
    left += width + BOARD_GAP_METRES;
  });
  return pieces;
}

/** One board piece: its mesh, and its own see-through copy of its wood for fading in. */
interface Board {
  readonly mesh: THREE.Mesh;
  readonly solid: THREE.MeshStandardMaterial[];
  readonly fading: THREE.MeshStandardMaterial[];
  readonly layout: PieceLayout;
}

interface Drawn {
  readonly root: THREE.Group;
  readonly boards: Board[];
  readonly picker: THREE.Mesh;
}

const BOARD_MIDDLE_HEIGHT = BOARD_THICKNESS_METRES / 2;

/** A board piece's wood, one material per box face in three.js order: long sides, top, bottom, then the two sawn ends. */
function pieceWood(shade: number): THREE.MeshStandardMaterial[] {
  const wood = (color: THREE.Color) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9 });
  const top = new THREE.Color(FLOOR_WOOD_COLOUR).multiplyScalar(shade);
  const side = wood(top.clone().multiplyScalar(BOARD_SIDE_SHADE));
  const end = wood(new THREE.Color(BOARD_END_COLOUR).multiplyScalar(shade));
  return [side, side, wood(top), side, end, end];
}

export function createFloorMeshes(entities: EntityStore): FloorMeshes {
  const group = new THREE.Group();
  const layouts = pieceLayouts();
  const pieceGeometries = layouts.map((piece) => new THREE.BoxGeometry(piece.width, BOARD_THICKNESS_METRES, piece.length));
  const pickGeometry = new THREE.BoxGeometry(1, BOARD_THICKNESS_METRES, 1).translate(0, BOARD_MIDDLE_HEIGHT, 0);
  const woodMaterials = layouts.map((piece) => pieceWood(piece.shade));
  const blueprintMaterial = seeThrough(BLUEPRINT_COLOUR, BLUEPRINT_OPACITY);
  const deliveredMaterial = seeThrough(DELIVERED_COLOUR, DELIVERED_OPACITY);
  const notAllowedMaterial = seeThrough(NOT_ALLOWED_COLOUR, BLUEPRINT_OPACITY);
  const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });

  const drawn = new Map<Entity, Drawn>();
  const pickers: THREE.Mesh[] = [];
  const blueprints = blueprintEntities(entities);
  const floors = floorEntities(entities);

  /** Adds every board piece to `root`, all in the blueprint material. */
  function addBoards(root: THREE.Group): Board[] {
    return layouts.map((layout, index) => {
      const solid = woodMaterials[index] ?? [];
      const fading = solid.map((material) => {
        const copy = material.clone();
        copy.transparent = true;
        return copy;
      });
      const mesh = new THREE.Mesh(pieceGeometries[index], blueprintMaterial);
      mesh.position.set(layout.x, BOARD_MIDDLE_HEIGHT, layout.z);
      mesh.receiveShadow = true;
      root.add(mesh);
      return { mesh, solid, fading, layout };
    });
  }

  const placingBlueprint = new THREE.Group();
  placingBlueprint.visible = false;
  const placingBoards = addBoards(placingBlueprint);
  group.add(placingBlueprint);

  function draw(entity: Entity & { position: Vec3 }): Drawn {
    const existing = drawn.get(entity);
    if (existing !== undefined) return existing;
    const root = new THREE.Group();
    const boards = addBoards(root);
    const picker = new THREE.Mesh(pickGeometry, pickMaterial);
    picker.userData.entity = entity;
    root.add(picker);
    pickers.push(picker);
    group.add(root);
    const result = { root, boards, picker };
    drawn.set(entity, result);
    return result;
  }

  /**
   * Shows how far construction has gone. Laid boards are solid and in place, the boards being laid fade in and are set down,
   * boards whose plank the blueprint already has wait half solid, and the rest show see-through.
   */
  function showProgress(item: Drawn, entity: Entity & { position: Vec3 }, progress: number, delivered: number): void {
    item.root.position.set(entity.position.x, entity.position.y, entity.position.z);
    const stagesDone = progress * FLOOR_PLANK_COST;
    for (const board of item.boards) {
      const { stage, x, z } = board.layout;
      const share = Math.min(1, Math.max(0, stagesDone - stage));
      if (share <= 0) {
        board.mesh.material = stage < delivered ? deliveredMaterial : blueprintMaterial;
        board.mesh.position.set(x, BOARD_MIDDLE_HEIGHT, z);
        continue;
      }
      const opacity = buildOpacity(share);
      for (const material of board.fading) material.opacity = opacity;
      board.mesh.material = opacity < 1 ? board.fading : board.solid;
      board.mesh.position.set(x, BOARD_MIDDLE_HEIGHT + buildLift(share), z);
    }
  }

  function disposeFading(boards: readonly Board[]): void {
    for (const board of boards) for (const material of board.fading) material.dispose();
  }

  function forget(entity: Entity): void {
    const item = drawn.get(entity);
    if (item === undefined) return;
    group.remove(item.root);
    disposeFading(item.boards);
    pickers.splice(pickers.indexOf(item.picker), 1);
    drawn.delete(entity);
  }

  return {
    group,
    update() {
      const seen = new Set<Entity>();
      for (const entity of blueprints) {
        if (entity.blueprint.structure !== "floor") continue;
        showProgress(draw(entity), entity, entity.blueprint.progress, entity.blueprint.delivered.plank ?? 0);
        seen.add(entity);
      }
      for (const entity of floors) {
        showProgress(draw(entity), entity, 1, FLOOR_PLANK_COST);
        seen.add(entity);
      }
      for (const entity of [...drawn.keys()]) if (!seen.has(entity)) forget(entity);
    },
    pick(raycaster) {
      return pickBlueprint(raycaster, pickers);
    },
    pickFinished(raycaster) {
      return pickFinished(raycaster, pickers);
    },
    outlineOf(hit) {
      const item = drawn.get(hit.entity);
      if (item === undefined) return [];
      item.root.updateMatrixWorld(true);
      return item.boards.map(({ mesh }) => ({ geometry: mesh.geometry, matrix: mesh.matrixWorld }));
    },
    showPlacingBlueprint(shown) {
      placingBlueprint.visible = shown !== undefined;
      if (shown === undefined) return;
      const material = shown.allowed ? blueprintMaterial : notAllowedMaterial;
      for (const board of placingBoards) board.mesh.material = material;
      placingBlueprint.position.set(shown.spot.x, shown.spot.y, shown.spot.z);
    },
    dispose() {
      for (const item of [
        ...pieceGeometries,
        pickGeometry,
        ...new Set(woodMaterials.flat()),
        blueprintMaterial,
        deliveredMaterial,
        notAllowedMaterial,
        pickMaterial,
      ]) {
        item.dispose();
      }
      disposeFading(placingBoards);
      for (const item of drawn.values()) disposeFading(item.boards);
    },
  };
}

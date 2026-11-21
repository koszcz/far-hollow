// Draws floors and floor blueprints: the draft "floor" asset in asset-manifest.json, built in code.
// Added by floors-and-doors ticket 01. A floor is six planks laid side by side across the deck of one foundation square,
// flush on top of it, so the player and everything on the square stand at the same height as on the bare deck.
// Construction has one stage per plank the floor costs. Each stage lays half the boards: they fade in above their place and are set down.
// A blueprint shows the boards see-through. The boards of a stage whose plank the blueprint already has show pale and half solid.
// While the player places a floor from the build menu, a see-through copy follows the mouse. It turns red where it is not allowed.
import * as THREE from "three";
import { blueprintEntities, floorEntities, type Entity, type EntityStore, type Vec3 } from "../sim/entities";
import { FLOOR_PLANK_COST } from "../sim/structures";
import type { OutlinePart } from "./hover-outline";
import { PLANK_WOOD_COLOUR } from "./plank-furniture-meshes";
import { buildLift, buildOpacity, NOT_ALLOWED_COLOUR, pickFinished, seeThrough } from "./structure-look";

const BLUEPRINT_COLOUR = 0xbfe3ff;
/** How see-through the boards of a blueprint not yet built are, from 0 (invisible) to 1 (solid). */
const BLUEPRINT_OPACITY = 0.35;
/** A board whose plank the blueprint already has is this solid, so it stands out from the boards still needed. */
const DELIVERED_OPACITY = 0.7;
/** The pale wood of a board waiting in its place. */
const DELIVERED_COLOUR = 0xecc995;
/** How many boards cover the square, side by side across x. Each stage of construction lays an equal share of them. */
const BOARD_COUNT = 6;
/** How thick a board is, in metres. It lies on top of the deck, so it adds only this much to how the square looks. */
const BOARD_THICKNESS_METRES = 0.025;
/** How long a board is, along z, and the gap left between two boards, in metres. */
const BOARD_LENGTH_METRES = 0.98;
const BOARD_GAP_METRES = 0.008;
/** How much darker or lighter one board is than the next, as a share of the wood colour. */
const BOARD_SHADES = [1, 0.92, 1.04, 0.95, 0.88, 1.01];

/** What a click on a floor blueprint landed on. A finished floor is found with `pickFinished`. */
export type FloorHit = { kind: "blueprint"; entity: Entity };

export interface FloorMeshes {
  readonly group: THREE.Group;
  /** Brings every floor and floor blueprint up to date with game state. */
  update(): void;
  /** What a ray from the camera hits first among floor blueprints, and how far away. */
  pick(raycaster: THREE.Raycaster): { hit: FloorHit; distance: number } | undefined;
  /** The finished floor a ray hits first, and how far away. */
  pickFinished(raycaster: THREE.Raycaster): { entity: Entity; distance: number } | undefined;
  /** The boards of a floor or floor blueprint, placed in the world. Empty once it is gone. */
  outlineOf(hit: { readonly entity: Entity }): OutlinePart[];
  /** Shows a floor blueprint under the mouse at `spot`, red where it is not allowed. Undefined hides it. */
  showPlacingBlueprint(placingBlueprint: { spot: Vec3; allowed: boolean } | undefined): void;
  dispose(): void;
}

/** One board: its mesh, and its own see-through copy of its wood for fading in. */
interface Board {
  readonly mesh: THREE.Mesh;
  readonly solid: THREE.MeshStandardMaterial;
  readonly fading: THREE.MeshStandardMaterial;
  /** The stage of construction that lays it, from 0. */
  readonly stage: number;
  /** Where its middle sits across the square, in metres from the square's middle. */
  readonly x: number;
}

interface Drawn {
  readonly root: THREE.Group;
  readonly boards: Board[];
  readonly picker: THREE.Mesh;
}

const BOARD_WIDTH_METRES = 1 / BOARD_COUNT - BOARD_GAP_METRES;
const BOARD_MIDDLE_HEIGHT = BOARD_THICKNESS_METRES / 2;

export function createFloorMeshes(entities: EntityStore): FloorMeshes {
  const group = new THREE.Group();
  const boardGeometry = new THREE.BoxGeometry(BOARD_WIDTH_METRES, BOARD_THICKNESS_METRES, BOARD_LENGTH_METRES);
  const pickGeometry = new THREE.BoxGeometry(1, BOARD_THICKNESS_METRES, 1).translate(0, BOARD_MIDDLE_HEIGHT, 0);
  const woodMaterials = BOARD_SHADES.map(
    (shade) => new THREE.MeshStandardMaterial({ color: new THREE.Color(PLANK_WOOD_COLOUR).multiplyScalar(shade), flatShading: true, roughness: 0.9 }),
  );
  const blueprintMaterial = seeThrough(BLUEPRINT_COLOUR, BLUEPRINT_OPACITY);
  const deliveredMaterial = seeThrough(DELIVERED_COLOUR, DELIVERED_OPACITY);
  const notAllowedMaterial = seeThrough(NOT_ALLOWED_COLOUR, BLUEPRINT_OPACITY);
  const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });

  const drawn = new Map<Entity, Drawn>();
  const pickers: THREE.Mesh[] = [];
  const blueprints = blueprintEntities(entities);
  const floors = floorEntities(entities);

  /** Adds every board to `root`, all in the blueprint material. */
  function addBoards(root: THREE.Group): Board[] {
    return Array.from({ length: BOARD_COUNT }, (_, index) => {
      const solid = woodMaterials[index] ?? blueprintMaterial;
      const fading = solid.clone();
      fading.transparent = true;
      const mesh = new THREE.Mesh(boardGeometry, blueprintMaterial);
      const x = (index + 0.5) / BOARD_COUNT - 0.5;
      mesh.position.set(x, BOARD_MIDDLE_HEIGHT, 0);
      mesh.receiveShadow = true;
      root.add(mesh);
      return { mesh, solid, fading, stage: Math.floor((index * FLOOR_PLANK_COST) / BOARD_COUNT), x };
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
      const share = Math.min(1, Math.max(0, stagesDone - board.stage));
      if (share <= 0) {
        board.mesh.material = board.stage < delivered ? deliveredMaterial : blueprintMaterial;
        board.mesh.position.set(board.x, BOARD_MIDDLE_HEIGHT, 0);
        continue;
      }
      const opacity = buildOpacity(share);
      board.fading.opacity = opacity;
      board.mesh.material = opacity < 1 ? board.fading : board.solid;
      board.mesh.position.set(board.x, BOARD_MIDDLE_HEIGHT + buildLift(share), 0);
    }
  }

  function disposeFading(boards: readonly Board[]): void {
    for (const board of boards) board.fading.dispose();
  }

  function forget(entity: Entity): void {
    const item = drawn.get(entity);
    if (item === undefined) return;
    group.remove(item.root);
    disposeFading(item.boards);
    pickers.splice(pickers.indexOf(item.picker), 1);
    drawn.delete(entity);
  }

  const hits: THREE.Intersection[] = [];

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
      hits.length = 0;
      raycaster.intersectObjects(pickers, false, hits);
      hits.sort((a, b) => a.distance - b.distance);
      for (const hit of hits) {
        const entity = hit.object.userData.entity as Entity | undefined;
        if (entity?.blueprint !== undefined) return { hit: { kind: "blueprint", entity }, distance: hit.distance };
      }
      return undefined;
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
      for (const item of [boardGeometry, pickGeometry, ...woodMaterials, blueprintMaterial, deliveredMaterial, notAllowedMaterial, pickMaterial]) {
        item.dispose();
      }
      disposeFading(placingBoards);
      for (const item of drawn.values()) disposeFading(item.boards);
    },
  };
}

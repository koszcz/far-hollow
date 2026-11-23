// Draws shutters and shutters blueprints: the draft "shutters" asset in asset-manifest.json, built in code.
// Shutters are two plank leaves hung in a finished window's opening, on the face the window faces. Each leaf is hinged at
// its outer edge, so the two meet in the middle when closed. Each has a darker batten across it and an iron strap hinge.
// Construction has one stage per plank: the left leaf, then the right.
// A blueprint shows the leaves see-through. A plank the blueprint already has shows pale and half solid.
// Finished shutters swing open or closed when the player opens or closes them. shutter-swing.ts times the swing.
// Shutters between the camera and the player fade out with their window.
// While the player places shutters from the build menu, a see-through copy follows the mouse. It turns red where it is not allowed.
import * as THREE from "three";
import { blueprintEntities, shuttersEntities, type Entity, type EntityStore, type Vec3 } from "../sim/entities";
import { quarterTurnsToRadians, type QuarterTurns } from "../sim/quarter-turns";
import { SHUTTERS_PLANK_COST } from "../sim/structures";
import { isBetweenCameraAndPlayer } from "./edge-piece-meshes";
import { COURSE_RADIUS_METRES } from "./log-courses";
import { WINDOW_OPENING, WINDOW_OPENING_WIDTH_METRES } from "./window-shape";
import { PLANK_WOOD_COLOUR } from "./plank-furniture-meshes";
import { SHUTTER_OPEN_RADIANS, shutterSwingRadians } from "./shutter-swing";
import {
  BLUEPRINT_COLOUR,
  BLUEPRINT_OPACITY,
  buildLift,
  buildOpacity,
  DELIVERED_OPACITY,
  NOT_ALLOWED_COLOUR,
  pickBlueprint,
  pickFinished,
  fadedOut,
  seeThrough,
  type BuildingPieceMeshes,
  FADED_OPACITY,
} from "./structure-look";

/** The batten across each leaf is this much darker than the plank. */
const BATTEN_SHADE = 0.82;
/** The dark iron of the hinges. */
const IRON_COLOUR = 0x3a3633;
/** How far each leaf reaches past the opening at its outer edge, and over and under it, in metres, so no gap shows round it. */
const OVERLAP_METRES = 0.04;
/** How thick each leaf's plank is, in metres. */
const PLANK_THICKNESS_METRES = 0.035;
/** How thick the batten is and how tall, in metres. */
const BATTEN_THICKNESS_METRES = 0.025;
const BATTEN_HEIGHT_METRES = 0.08;
/** Each strap hinge's length across the leaf, height, and thickness, in metres. */
const STRAP_SIZE_METRES: readonly [number, number, number] = [0.16, 0.03, 0.006];
/** The hinges sit on the outside of the wall's logs, this far out from the middle of the edge, in metres. */
const HINGE_OUT_METRES = COURSE_RADIUS_METRES + PLANK_THICKNESS_METRES / 2;
/** How thick the invisible box that catches clicks is, in metres. Thicker than the window's, so a click on the opening finds the shutters. */
const PICK_THICKNESS_METRES = 0.6;

const OPENING_HEIGHT_METRES = WINDOW_OPENING.top - WINDOW_OPENING.bottom;
const LEAF_WIDTH_METRES = WINDOW_OPENING_WIDTH_METRES / 2 + OVERLAP_METRES;
const LEAF_HEIGHT_METRES = OPENING_HEIGHT_METRES + 2 * OVERLAP_METRES;
const LEAF_MIDDLE_Y = (WINDOW_OPENING.bottom + WINDOW_OPENING.top) / 2;

/** One part of a leaf: its size and middle, in metres, with the leaf closed. The origin is the leaf's hinge. `side` is -1 for the left leaf. */
interface LeafPart {
  readonly size: readonly [number, number, number];
  readonly at: readonly [number, number, number];
  readonly kind: "plank" | "batten" | "iron";
}

/** The parts of one leaf. Closed, it reaches from its hinge toward the middle of the opening: toward +x for the left leaf, -x for the right. */
function leafParts(side: -1 | 1): LeafPart[] {
  const toward = -side;
  return [
    { size: [LEAF_WIDTH_METRES, LEAF_HEIGHT_METRES, PLANK_THICKNESS_METRES], at: [(toward * LEAF_WIDTH_METRES) / 2, LEAF_MIDDLE_Y, 0], kind: "plank" },
    {
      size: [LEAF_WIDTH_METRES * 0.9, BATTEN_HEIGHT_METRES, BATTEN_THICKNESS_METRES],
      at: [(toward * LEAF_WIDTH_METRES) / 2, LEAF_MIDDLE_Y, (PLANK_THICKNESS_METRES + BATTEN_THICKNESS_METRES) / 2],
      kind: "batten",
    },
    ...[WINDOW_OPENING.bottom + 0.08, WINDOW_OPENING.top - 0.08].map((y): LeafPart => ({
      size: STRAP_SIZE_METRES,
      at: [(toward * STRAP_SIZE_METRES[0]) / 2, y, (PLANK_THICKNESS_METRES + STRAP_SIZE_METRES[2]) / 2],
      kind: "iron",
    })),
  ];
}

/** The two leaves, left then right. Each is one stage of construction, and one plank. */
const LEAVES: readonly { readonly side: -1 | 1; readonly parts: readonly LeafPart[] }[] = ([-1, 1] as const).map((side) => ({ side, parts: leafParts(side) }));

/** One part's mesh, its solid material, and its own see-through copy for fading in. */
interface Part {
  readonly mesh: THREE.Mesh;
  readonly plan: LeafPart;
  readonly solid: THREE.MeshStandardMaterial;
  readonly fading: THREE.MeshStandardMaterial;
}

/** How finished shutters last began to swing: toward open or closed, when, and from how far turned. */
interface Swing {
  open: boolean;
  startedAt: number;
  fromRadians: number;
}

interface Drawn {
  readonly root: THREE.Group;
  /** Each leaf turns on its hinge. Its parts hang from it. Left first. */
  readonly leaves: readonly { readonly group: THREE.Group; readonly side: -1 | 1 }[];
  /** The parts of each stage: the left leaf's, then the right leaf's. */
  readonly stages: Part[][];
  readonly picker: THREE.Mesh;
  swing?: Swing;
}

/** What one frame of drawing needs to know. Without `camera` and `player`, the shutters never fade. */
export interface ShuttersFrame {
  readonly nowSeconds: number;
  readonly camera?: Vec3 | undefined;
  readonly player?: Vec3 | undefined;
}

export type ShuttersMeshes = BuildingPieceMeshes<ShuttersFrame>;

export function createShuttersMeshes(entities: EntityStore): ShuttersMeshes {
  const group = new THREE.Group();
  const geometries = new Map<LeafPart, THREE.BufferGeometry>();
  const solids = new Map<LeafPart, THREE.MeshStandardMaterial>();
  for (const { parts } of LEAVES) {
    for (const plan of parts) {
      geometries.set(plan, new THREE.BoxGeometry(...plan.size));
      const iron = plan.kind === "iron";
      const color = iron ? new THREE.Color(IRON_COLOUR) : new THREE.Color(PLANK_WOOD_COLOUR).multiplyScalar(plan.kind === "batten" ? BATTEN_SHADE : 1);
      solids.set(plan, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: iron ? 0.55 : 0.9, metalness: iron ? 0.3 : 0 }));
    }
  }
  const pickGeometry = new THREE.BoxGeometry(WINDOW_OPENING_WIDTH_METRES, OPENING_HEIGHT_METRES, PICK_THICKNESS_METRES).translate(0, LEAF_MIDDLE_Y, 0);
  const blueprintMaterial = seeThrough(BLUEPRINT_COLOUR, BLUEPRINT_OPACITY);
  const deliveredMaterial = seeThrough(PLANK_WOOD_COLOUR, DELIVERED_OPACITY);
  const notAllowedMaterial = seeThrough(NOT_ALLOWED_COLOUR, BLUEPRINT_OPACITY);
  const fadedMaterial = fadedOut(PLANK_WOOD_COLOUR, FADED_OPACITY);
  const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });

  const drawn = new Map<Entity, Drawn>();
  const pickers: THREE.Mesh[] = [];
  const blueprints = blueprintEntities(entities);
  const finished = shuttersEntities(entities);

  /** Adds both leaves, each hinged at its outer edge of the opening, and every part on them, see-through, to `root`. */
  function addLeaves(root: THREE.Group): Pick<Drawn, "leaves" | "stages"> {
    const leaves: Drawn["leaves"][number][] = [];
    const stages = LEAVES.map(({ side, parts }) => {
      const leaf = new THREE.Group();
      leaf.position.set((side * WINDOW_OPENING_WIDTH_METRES) / 2, 0, HINGE_OUT_METRES);
      root.add(leaf);
      leaves.push({ group: leaf, side });
      return parts.map((plan) => {
        const mesh = new THREE.Mesh(geometries.get(plan), blueprintMaterial);
        mesh.position.set(...plan.at);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        leaf.add(mesh);
        const solid = solids.get(plan) ?? blueprintMaterial;
        const fading = solid.clone();
        fading.transparent = true;
        return { mesh, plan, solid, fading };
      });
    });
    return { leaves, stages };
  }

  const placing = new THREE.Group();
  placing.visible = false;
  const placingLeaves = addLeaves(placing);
  group.add(placing);

  function draw(entity: Entity & { position: Vec3 }): Drawn {
    const existing = drawn.get(entity);
    if (existing !== undefined) return existing;
    const root = new THREE.Group();
    const { leaves, stages } = addLeaves(root);
    const picker = new THREE.Mesh(pickGeometry, pickMaterial);
    picker.userData.entity = entity;
    root.add(picker);
    pickers.push(picker);
    group.add(root);
    const result: Drawn = { root, leaves, stages, picker };
    drawn.set(entity, result);
    return result;
  }

  function place(root: THREE.Group, spot: Vec3, turns: QuarterTurns): void {
    root.position.set(spot.x, spot.y, spot.z);
    root.rotation.y = quarterTurnsToRadians(turns);
  }

  /** Turns both leaves `radians` from closed. Each folds outward, away from the window, about its own hinge. */
  function turnLeaves(leaves: Drawn["leaves"], radians: number): void {
    for (const { group: leaf, side } of leaves) leaf.rotation.y = side * radians;
  }

  /** Shows how far construction has gone, as a door does: one leaf a stage, fading in and set down. */
  function showProgress(item: Pick<Drawn, "stages">, progress: number, delivered: number): void {
    const stagesDone = progress * SHUTTERS_PLANK_COST;
    item.stages.forEach((parts, index) => {
      const share = Math.min(1, Math.max(0, stagesDone - index));
      for (const { mesh, plan, solid, fading } of parts) {
        const [x, y, z] = plan.at;
        if (share <= 0) {
          mesh.material = index < delivered ? deliveredMaterial : blueprintMaterial;
          mesh.position.set(x, y, z);
          continue;
        }
        const opacity = buildOpacity(share);
        fading.opacity = opacity;
        mesh.material = opacity < 1 ? fading : solid;
        mesh.position.set(x, y + buildLift(share), z);
      }
    });
  }

  /**
   * Swings finished shutters toward open or closed at `nowSeconds`. Shutters seen for the first time count as having begun
   * to swing toward where they stand now at time 0, from the other end, so in the game they are already there. An asset
   * showcase, whose clock starts at 0, shows them part way.
   */
  function swing(item: Drawn, open: boolean, nowSeconds: number): void {
    item.swing ??= { open, startedAt: 0, fromRadians: open ? 0 : SHUTTER_OPEN_RADIANS };
    const state = item.swing;
    if (state.open !== open) {
      state.fromRadians = shutterSwingRadians(state.fromRadians, state.open, nowSeconds - state.startedAt);
      state.startedAt = nowSeconds;
      state.open = open;
    }
    turnLeaves(item.leaves, shutterSwingRadians(state.fromRadians, state.open, nowSeconds - state.startedAt));
  }

  function fade(item: Drawn, faded: boolean): void {
    for (const { mesh, solid } of item.stages.flat()) mesh.material = faded ? fadedMaterial : solid;
  }

  function disposeFading(stages: readonly Part[][]): void {
    for (const { fading } of stages.flat()) fading.dispose();
  }

  function forget(entity: Entity): void {
    const item = drawn.get(entity);
    if (item === undefined) return;
    group.remove(item.root);
    disposeFading(item.stages);
    pickers.splice(pickers.indexOf(item.picker), 1);
    drawn.delete(entity);
  }

  return {
    group,
    update({ nowSeconds, camera, player }) {
      const seen = new Set<Entity>();
      for (const entity of blueprints) {
        if (entity.blueprint.structure !== "shutters") continue;
        const item = draw(entity);
        place(item.root, entity.position, entity.facing?.turns ?? 0);
        turnLeaves(item.leaves, 0);
        showProgress(item, entity.blueprint.progress, entity.blueprint.delivered.plank ?? 0);
        seen.add(entity);
      }
      for (const entity of finished) {
        const item = draw(entity);
        const turns = entity.facing?.turns ?? 0;
        place(item.root, entity.position, turns);
        showProgress(item, 1, SHUTTERS_PLANK_COST);
        swing(item, entity.shutters.open, nowSeconds);
        fade(item, camera !== undefined && player !== undefined && isBetweenCameraAndPlayer(entity.position, turns, camera, player));
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
      return item.stages.flat().map(({ mesh }) => ({ geometry: mesh.geometry, matrix: mesh.matrixWorld }));
    },
    showPlacingBlueprint(shown) {
      placing.visible = shown !== undefined;
      if (shown === undefined) return;
      const material = shown.allowed ? blueprintMaterial : notAllowedMaterial;
      for (const { mesh, plan } of placingLeaves.stages.flat()) {
        mesh.material = material;
        mesh.position.set(...plan.at);
      }
      place(placing, shown.spot, shown.turns);
    },
    dispose() {
      for (const item of [
        ...geometries.values(),
        pickGeometry,
        ...solids.values(),
        blueprintMaterial,
        deliveredMaterial,
        notAllowedMaterial,
        fadedMaterial,
        pickMaterial,
      ]) {
        item.dispose();
      }
      disposeFading(placingLeaves.stages);
      for (const item of drawn.values()) disposeFading(item.stages);
    },
  };
}

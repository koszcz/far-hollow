// Draws shutters and shutters blueprints: the approved "shutters" asset in asset-manifest.json, built in code.
// Shutters are two plank leaves hung in a finished window's opening, on the face the window faces. Each leaf is hinged at
// its outer edge, so the two meet in the middle when closed. Each is three weathered boards with battens, a diagonal brace, and iron strap hinges.
// Construction has one stage per plank: the left leaf, then the right.
// A blueprint shows the leaves see-through. A plank the blueprint already has shows pale and half solid.
// Finished shutters swing open or closed when the player opens or closes them. shutter-swing.ts times the swing.
// Shutters fade out with their window (cabin-cutaway.ts).
// While the player places shutters from the build menu, a see-through copy follows the mouse. It turns red where it is not allowed.
import * as THREE from "three";
import { type Entity, type EntityStore, type Vec3 } from "../sim/entities";
import { blueprintEntities, shuttersEntities } from "../sim/entity-queries";
import { quarterTurnsToRadians, type QuarterTurns } from "../sim/quarter-turns";
import { NO_CUTAWAY, type CabinCutaway } from "./cabin-cutaway";
import { createCutawayFades, cutawayOpacity, showFading } from "./cutaway-fade";
import { SHUTTERS_PLANK_COST } from "../sim/structure-cabin-fittings";
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
  seeThrough,
  type BuildingPieceMeshes,
} from "./structure-look";

/** The shutters' boards are plank wood weathered darker by sun and rain, so they stand off the pale logs round them. Each board's own shade. */
const BOARD_SHADES = [0.74, 0.68, 0.71] as const;
/** The battens and the brace are this much darker than the boards. */
const BATTEN_SHADE = 0.6;
/** The dark iron of the hinges. */
const IRON_COLOUR = 0x2e2a27;
/** How far each leaf reaches past the opening at its outer edge, and over and under it, in metres, so no gap shows round it. */
const OVERLAP_METRES = 0.04;
/** The gap between the two leaves where they meet in the middle, in metres. */
const MEETING_GAP_METRES = 0.006;
/** The dark seam between two boards of a leaf, in metres. */
const SEAM_METRES = 0.007;
/** How thick each board is, in metres. */
const BOARD_THICKNESS_METRES = 0.035;
/** How thick the battens and the brace are, how tall the battens are, and how wide the brace is, in metres. */
const BATTEN_THICKNESS_METRES = 0.025;
const BATTEN_HEIGHT_METRES = 0.07;
const BRACE_WIDTH_METRES = 0.06;
/** How far the battens stand in from the leaf's top and bottom, to their middle, in metres. */
const BATTEN_INSET_METRES = 0.1;
/** Each strap hinge's height and thickness, in metres. It runs along its batten for most of the leaf's width. */
const STRAP_HEIGHT_METRES = 0.035;
const STRAP_THICKNESS_METRES = 0.006;
/** The knuckle each strap turns on, on the hinge line: its width and depth, in metres. */
const PINTLE_SIZE_METRES = 0.026;
/**
 * The hinge line stands this far out from the wall's logs, in metres. A leaf turned all the way open lies against the wall
 * with its battens toward the logs, so the line stands out by half the leaf's full thickness, battens and all, and a little more.
 */
const HINGE_STANDOFF_METRES = (BOARD_THICKNESS_METRES + BATTEN_THICKNESS_METRES) / 2 + 0.005;
/** The hinge line, out from the middle of the edge, in metres. */
const HINGE_OUT_METRES = COURSE_RADIUS_METRES + HINGE_STANDOFF_METRES;
/** How thick the invisible box that catches clicks is, in metres. Thicker than the window's, so a click on the opening finds the shutters. */
const PICK_THICKNESS_METRES = 0.6;

const OPENING_HEIGHT_METRES = WINDOW_OPENING.top - WINDOW_OPENING.bottom;
/** Each hinge line stands this far from the middle of the opening, in metres: past the opening's side by the overlap. */
const HINGE_ALONG_METRES = WINDOW_OPENING_WIDTH_METRES / 2 + OVERLAP_METRES;
const LEAF_WIDTH_METRES = HINGE_ALONG_METRES - MEETING_GAP_METRES / 2;
const LEAF_HEIGHT_METRES = OPENING_HEIGHT_METRES + 2 * OVERLAP_METRES;
const LEAF_MIDDLE_Y = (WINDOW_OPENING.bottom + WINDOW_OPENING.top) / 2;
const BOARD_WIDTH_METRES = (LEAF_WIDTH_METRES - (BOARD_SHADES.length - 1) * SEAM_METRES) / BOARD_SHADES.length;
const BATTEN_LENGTH_METRES = LEAF_WIDTH_METRES - 0.03;
const BATTEN_YS = [WINDOW_OPENING.bottom - OVERLAP_METRES + BATTEN_INSET_METRES, WINDOW_OPENING.top + OVERLAP_METRES - BATTEN_INSET_METRES] as const;

/** Depths across a leaf, in metres from the hinge line, outward positive: the middle of the boards, of the battens, and of the straps. */
const BOARD_Z = -HINGE_STANDOFF_METRES + BOARD_THICKNESS_METRES / 2;
const BATTEN_Z = BOARD_Z + (BOARD_THICKNESS_METRES + BATTEN_THICKNESS_METRES) / 2;
const STRAP_Z = BATTEN_Z + (BATTEN_THICKNESS_METRES + STRAP_THICKNESS_METRES) / 2;

/**
 * One part of a leaf: its size and middle, in metres, with the leaf closed, and how far it is turned about the leaf's
 * forward axis, in radians. The origin is the leaf's hinge line, level with the ground. `shade` scales the plank wood's colour.
 */
interface LeafPart {
  readonly size: readonly [number, number, number];
  readonly at: readonly [number, number, number];
  readonly tilt: number;
  readonly kind: "wood" | "iron";
  readonly shade: number;
}

/**
 * The parts of one leaf: upright boards with dark seams between them, a batten across the top and the bottom, a diagonal
 * brace between them, and an iron strap hinge on each batten turning on a knuckle. Closed, the leaf reaches from its hinge
 * toward the middle of the opening: toward +x for the left leaf, -x for the right. The brace climbs from the hinge side's
 * bottom to the free side's top, as a real one does, so it holds the free edge up.
 */
function leafParts(side: -1 | 1): LeafPart[] {
  const toward = -side;
  const across = (metres: number): number => toward * metres;
  const boards = BOARD_SHADES.map((shade, index): LeafPart => ({
    size: [BOARD_WIDTH_METRES, LEAF_HEIGHT_METRES, BOARD_THICKNESS_METRES],
    at: [across(index * (BOARD_WIDTH_METRES + SEAM_METRES) + BOARD_WIDTH_METRES / 2), LEAF_MIDDLE_Y, BOARD_Z],
    tilt: 0,
    kind: "wood",
    shade,
  }));
  const battens = BATTEN_YS.map((y): LeafPart => ({
    size: [BATTEN_LENGTH_METRES, BATTEN_HEIGHT_METRES, BATTEN_THICKNESS_METRES],
    at: [across(LEAF_WIDTH_METRES / 2), y, BATTEN_Z],
    tilt: 0,
    kind: "wood",
    shade: BATTEN_SHADE,
  }));
  const [low, high] = BATTEN_YS;
  const rise = high - low - BATTEN_HEIGHT_METRES;
  const run = BATTEN_LENGTH_METRES - 2 * BRACE_WIDTH_METRES;
  const brace: LeafPart = {
    size: [Math.hypot(run, rise), BRACE_WIDTH_METRES, BATTEN_THICKNESS_METRES],
    at: [across(LEAF_WIDTH_METRES / 2), (low + high) / 2, BATTEN_Z],
    tilt: toward * Math.atan2(rise, run),
    kind: "wood",
    shade: BATTEN_SHADE,
  };
  const strapLength = LEAF_WIDTH_METRES * 0.72;
  const hinges = BATTEN_YS.flatMap((y): LeafPart[] => [
    { size: [strapLength, STRAP_HEIGHT_METRES, STRAP_THICKNESS_METRES], at: [across(strapLength / 2), y, STRAP_Z], tilt: 0, kind: "iron", shade: 1 },
    { size: [PINTLE_SIZE_METRES, STRAP_HEIGHT_METRES + 0.02, PINTLE_SIZE_METRES], at: [0, y, 0], tilt: 0, kind: "iron", shade: 1 },
  ]);
  return [...boards, ...battens, brace, ...hinges];
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

/** How finished shutters last began to swing: toward open or closed, when, and from how far each leaf stood turned. */
interface Swing {
  open: boolean;
  startedAt: number;
  /** Left leaf first. The right leaf trails it. */
  fromRadians: number[];
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

/** What one frame of drawing needs to know. */
export interface ShuttersFrame {
  readonly nowSeconds: number;
  /** Which pieces fade. Without it, none does. */
  readonly cutaway?: CabinCutaway | undefined;
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
      const color = iron ? new THREE.Color(IRON_COLOUR) : new THREE.Color(PLANK_WOOD_COLOUR).multiplyScalar(plan.shade);
      solids.set(plan, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: iron ? 0.55 : 0.9, metalness: iron ? 0.3 : 0 }));
    }
  }
  const pickGeometry = new THREE.BoxGeometry(WINDOW_OPENING_WIDTH_METRES, OPENING_HEIGHT_METRES, PICK_THICKNESS_METRES).translate(0, LEAF_MIDDLE_Y, 0);
  const blueprintMaterial = seeThrough(BLUEPRINT_COLOUR, BLUEPRINT_OPACITY);
  const deliveredMaterial = seeThrough(PLANK_WOOD_COLOUR, DELIVERED_OPACITY);
  const notAllowedMaterial = seeThrough(NOT_ALLOWED_COLOUR, BLUEPRINT_OPACITY);
  const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });

  const drawn = new Map<Entity, Drawn>();
  const fades = createCutawayFades();
  const pickers: THREE.Mesh[] = [];
  const blueprints = blueprintEntities(entities);
  const finished = shuttersEntities(entities);

  /** Adds both leaves, each hinged just past its side of the opening, and every part on them, see-through, to `root`. */
  function addLeaves(root: THREE.Group): Pick<Drawn, "leaves" | "stages"> {
    const leaves: Drawn["leaves"][number][] = [];
    const stages = LEAVES.map(({ side, parts }) => {
      const leaf = new THREE.Group();
      leaf.position.set(side * HINGE_ALONG_METRES, 0, HINGE_OUT_METRES);
      root.add(leaf);
      leaves.push({ group: leaf, side });
      return parts.map((plan) => {
        const mesh = new THREE.Mesh(geometries.get(plan), blueprintMaterial);
        mesh.position.set(...plan.at);
        mesh.rotation.z = plan.tilt;
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

  /** Turns each leaf its own `radians` from closed, left first. Each folds outward, away from the window, about its own hinge. */
  function turnLeaves(leaves: Drawn["leaves"], radians: (index: number) => number): void {
    leaves.forEach(({ group: leaf, side }, index) => (leaf.rotation.y = side * radians(index)));
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
    item.swing ??= { open, startedAt: 0, fromRadians: item.leaves.map(() => (open ? 0 : SHUTTER_OPEN_RADIANS)) };
    const state = item.swing;
    const leafRadians = (index: number): number => shutterSwingRadians(state.fromRadians[index] ?? 0, state.open, nowSeconds - state.startedAt, index > 0);
    if (state.open !== open) {
      state.fromRadians = item.leaves.map((_, index) => leafRadians(index));
      state.startedAt = nowSeconds;
      state.open = open;
    }
    turnLeaves(item.leaves, leafRadians);
  }

  /** Shows a finished piece at fade `level`, from 0, solid, to 1, see-through. */
  function fade(item: Drawn, level: number): void {
    for (const { mesh, solid, fading } of item.stages.flat()) {
      if (level > 0) showFading(fading, cutawayOpacity(level));
      mesh.material = level > 0 ? fading : solid;
    }
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
    fades.forget(entity);
  }

  return {
    group,
    update({ nowSeconds, cutaway = NO_CUTAWAY }) {
      const seen = new Set<Entity>();
      for (const entity of blueprints) {
        if (entity.blueprint.structure !== "shutters") continue;
        const item = draw(entity);
        place(item.root, entity.position, entity.facing?.turns ?? 0);
        turnLeaves(item.leaves, () => 0);
        showProgress(item, entity.blueprint.progress, entity.blueprint.delivered.plank ?? 0);
        seen.add(entity);
      }
      for (const entity of finished) {
        const item = draw(entity);
        const turns = entity.facing?.turns ?? 0;
        place(item.root, entity.position, turns);
        showProgress(item, 1, SHUTTERS_PLANK_COST);
        swing(item, entity.shutters.open, nowSeconds);
        fade(item, fades.level(entity, cutaway.fades(entity.position, turns), nowSeconds));
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
      for (const item of [...geometries.values(), pickGeometry, ...solids.values(), blueprintMaterial, deliveredMaterial, notAllowedMaterial, pickMaterial]) {
        item.dispose();
      }
      disposeFading(placingLeaves.stages);
      for (const item of drawn.values()) disposeFading(item.stages);
    },
  };
}

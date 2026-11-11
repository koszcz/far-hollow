// Draws log walls and door frames, and their blueprints: the "log-wall" and "door-frame" assets in asset-manifest.json,
// built in code. The log wall is approved by the owner. The door frame is still a draft. Both stand on the edge of a foundation square, along the line to the square beside it.
// - A log wall is a stack of debarked logs laid along the edge. Each delivered log is cut in two, since the wall is
//   one square wide, so each stage of construction lays two courses. Like the deck of a foundation, each course is a
//   little thicker or thinner, longer or shorter, and turned a little, so the wall looks hand-built. Each course sits
//   snug in a notch along the top of the one below, so no gaps show. The ends stick out a little past the edge, like
//   the corners of a log cabin, and show darker cut ends. A wall that runs along z sits half a course lower than one
//   that runs along x, so where two walls meet at a corner their logs take turns, like the corners of a log cabin.
//   Its bottom course sinks half into the deck. Where a wall meets another wall at a corner, its logs reach further
//   past the corner, so the corner shows crossed log ends, like a log cabin. Ends with no wall across them stay short,
//   so they never reach into a doorway. A door frame never stands at a corner: see `meetsDoorAtCorner` in edge-pieces.ts.
// - A door frame is two posts with a lintel across the top. Each stage puts up one of the three.
// A blueprint shows see-through. Each debarked log the player has delivered shows pale and half solid in its place.
// The part being built fades in above its place, is lowered, and set down, like the logs of a foundation.
// A finished wall or door frame between the camera and the player fades out, so the player never disappears behind it.
// While the player places one from the build menu, a see-through copy follows the mouse. It turns red where it is not allowed.
import * as THREE from "three";
import { BUILD_GRID_METRES } from "../sim/build-grid";
import { blueprintEntities, edgePieceEntities, type Entity, type EntityStore, type Vec3 } from "../sim/entities";
import type { EdgePieceKind } from "../sim/structure-kind";
import { DOOR_FRAME_LOG_COST, LOG_WALL_LOG_COST } from "../sim/structures";
import { BUILD_FADE_SHARE, buildLift } from "./campfire-meshes";
import { DEBARKED_LOG_COLOUR, DEBARKED_LOG_CUT_COLOUR } from "./debarked-log-shape";
import type { OutlinePart } from "./hover-outline";

const BLUEPRINT_COLOUR = 0xbfe3ff;
/** How see-through the parts of a blueprint not yet built are, from 0 (invisible) to 1 (solid). */
const BLUEPRINT_OPACITY = 0.35;
/** A delivered log waiting in its place is this solid, so it stands out from the parts still needed. */
const DELIVERED_OPACITY = 0.7;
/** A blueprint under the mouse shows in this red where its spot is not allowed. */
const NOT_ALLOWED_COLOUR = 0xe0614f;
/** A wall or door frame between the camera and the player is this solid, from 0 (invisible) to 1 (solid). */
const FADED_OPACITY = 0.2;

/** How tall a log wall and a door frame stand above the deck, in metres. A little taller than the player. */
export const EDGE_PIECE_HEIGHT_METRES = 2;
/** Each delivered log makes this many courses of a log wall. */
const COURSES_PER_LOG = 2;
const COURSE_COUNT = LOG_WALL_LOG_COST * COURSES_PER_LOG;
/**
 * How each course of a log wall differs from a plain one, from the bottom up: its thickness and length as shares of
 * the plain course, how far it sits off the middle along its length, and how far it is turned about its length, in radians.
 * A plain course is a little longer than the edge, so its ends stick out past it.
 * Fixed, so every wall looks the same and nothing changes from frame to frame.
 */
const COURSE_LOOKS = [
  { thickness: 1.06, length: 1.02, shift: 0.02, turn: 0.3 },
  { thickness: 0.95, length: 0.98, shift: -0.03, turn: 1.1 },
  { thickness: 1.02, length: 1.04, shift: 0.01, turn: 0.6 },
  { thickness: 0.93, length: 1, shift: -0.01, turn: 1.6 },
  { thickness: 1.04, length: 0.97, shift: 0.03, turn: 0.1 },
  { thickness: 0.97, length: 1.03, shift: -0.02, turn: 0.9 },
  { thickness: 1, length: 0.99, shift: 0.02, turn: 1.4 },
  { thickness: 0.94, length: 1.02, shift: -0.02, turn: 0.4 },
] as const;
/** How much of its thickness each course sinks into the notch along the top of the course below. */
const COURSE_NOTCH_SHARE = 0.12;
/** How far a plain course sticks out past each end of the edge, in metres. */
const COURSE_OVERHANG_METRES = 0.06;
/** How much further a course reaches past an end where another wall crosses it at a corner, in metres. */
const CORNER_REACH_METRES = 0.2;
/** How long a plain course is, in metres. */
const COURSE_LENGTH_METRES = BUILD_GRID_METRES + 2 * COURSE_OVERHANG_METRES;
/** Two corner points closer than this, in metres, are the same point. */
const SAME_POINT_METRES = 1e-6;
/** The radius of a plain course, chosen so the stacked courses reach exactly the wall's height. */
const COURSE_RADIUS_METRES = (() => {
  const looks = Array.from({ length: COURSE_COUNT }, (_, i) => courseLook(i));
  const sunk = looks.slice(1).reduce((sum, look) => sum + look.thickness * (1 - COURSE_NOTCH_SHARE), 0);
  return EDGE_PIECE_HEIGHT_METRES / (2 * ((looks[0]?.thickness ?? 1) + sunk));
})();
const POST_RADIUS_METRES = 0.1;
const LINTEL_RADIUS_METRES = 0.1;
/** How thick the invisible box that catches clicks on a blueprint is, across its edge, in metres. */
const PICK_THICKNESS_METRES = 0.35;

/** Where the camera looks at the player from, to fade out walls in the way. The player's middle is used, not their feet. */
const PLAYER_MIDDLE_METRES = 0.9;
/** A wall fades when the line from the camera to the player passes this close beyond its ends or over its top, in metres. */
const FADE_MARGIN_METRES = 0.3;

/** What a click on a wall or door frame blueprint landed on. Finished walls and door frames are not clicked. */
export type EdgePieceHit = { kind: "blueprint"; entity: Entity };

export interface EdgePieceMeshes {
  readonly group: THREE.Group;
  /**
   * Brings every wall, door frame, and their blueprints up to date with game state.
   * Finished pieces between `camera` and the player standing at `player` fade out. Without them, nothing fades.
   */
  update(view?: { camera: Vec3; player: Vec3 }): void;
  /** What a ray from the camera hits first among wall and door frame blueprints, and how far away. */
  pick(raycaster: THREE.Raycaster): { hit: EdgePieceHit; distance: number } | undefined;
  /** The parts of a wall or door frame blueprint, placed in the world. Empty once it is gone. */
  outlineOf(hit: EdgePieceHit): OutlinePart[];
  /** Shows a blueprint under the mouse at `spot`, facing `turns`, red where it is not allowed. Undefined hides it. */
  showPreview(preview: { structure: EdgePieceKind; spot: Vec3; turns: number; allowed: boolean } | undefined): void;
  dispose(): void;
}

function courseLook(course: number): (typeof COURSE_LOOKS)[number] {
  return COURSE_LOOKS[course % COURSE_LOOKS.length] ?? COURSE_LOOKS[0];
}

/**
 * How much lower a log wall running along z sits than one running along x, in metres: half the rise from one course to the next.
 * At a corner the logs of the two walls then take turns instead of passing through each other.
 */
const CORNER_STAGGER_METRES = (() => {
  const heights = courseHeights();
  return ((heights[COURSE_COUNT - 1] ?? 0) - (heights[0] ?? 0)) / (COURSE_COUNT - 1) / 2;
})();

/** The height of the middle of each course of a log wall above the deck, from the bottom up. */
function courseHeights(): number[] {
  const heights: number[] = [];
  let top = 0;
  for (let course = 0; course < COURSE_COUNT; course++) {
    const radius = COURSE_RADIUS_METRES * courseLook(course).thickness;
    const bottom = course === 0 ? 0 : top - 2 * radius * COURSE_NOTCH_SHARE;
    heights.push(bottom + radius);
    top = bottom + 2 * radius;
  }
  return heights;
}

/**
 * One part of a piece: its shape and where it rests, from the middle of the edge at deck height, facing the default way.
 * `scale` stretches it along the edge and across it, and `turn` turns it about its length, in radians.
 * `cutEnds` gives a log lying along the edge its darker cut ends.
 */
interface PartPlan {
  readonly geometry: THREE.BufferGeometry;
  readonly x: number;
  readonly y: number;
  readonly scale?: { readonly along: number; readonly across: number };
  readonly turn?: number;
  readonly cutEnds?: boolean;
}

/** A built part, with the solid wood it shows once built and its own see-through copies of it for fading in. */
interface Part {
  readonly mesh: THREE.Mesh;
  readonly solid: THREE.Material | THREE.Material[];
  readonly fading: THREE.MeshStandardMaterial[];
  readonly plan: PartPlan;
}

interface Drawn {
  readonly kind: EdgePieceKind;
  readonly root: THREE.Group;
  /** The parts each stage of construction adds, in order. Each part has its own see-through copy of the wood for fading in. */
  readonly stages: Part[][];
  readonly picker: THREE.Mesh;
}

/** How far round a piece facing `turns` quarter turns is drawn, in radians. Quarter turns go clockwise seen from above. */
function facingRadians(turns: number): number {
  return -turns * (Math.PI / 2);
}

export function createEdgePieceMeshes(entities: EntityStore): EdgePieceMeshes {
  const group = new THREE.Group();
  // Logs lie along x, the way a piece facing the default way runs.
  // Cylinder groups are the side, then the two ends, so a list of three materials gives the ends their own colour.
  const courseGeometry = new THREE.CylinderGeometry(COURSE_RADIUS_METRES, COURSE_RADIUS_METRES, COURSE_LENGTH_METRES, 9).rotateZ(Math.PI / 2);
  const postGeometry = new THREE.CylinderGeometry(POST_RADIUS_METRES, POST_RADIUS_METRES, EDGE_PIECE_HEIGHT_METRES, 8);
  const lintelGeometry = new THREE.CylinderGeometry(LINTEL_RADIUS_METRES, LINTEL_RADIUS_METRES, BUILD_GRID_METRES, 8).rotateZ(Math.PI / 2);
  const pickGeometry = new THREE.BoxGeometry(BUILD_GRID_METRES, EDGE_PIECE_HEIGHT_METRES, PICK_THICKNESS_METRES).translate(0, EDGE_PIECE_HEIGHT_METRES / 2, 0);
  const woodMaterial = new THREE.MeshStandardMaterial({ color: DEBARKED_LOG_COLOUR, flatShading: true });
  const cutMaterial = new THREE.MeshStandardMaterial({ color: DEBARKED_LOG_CUT_COLOUR, flatShading: true });
  const logMaterials = [woodMaterial, cutMaterial, cutMaterial];
  const see = (color: number, opacity: number) => new THREE.MeshStandardMaterial({ color, transparent: true, opacity, depthWrite: false });
  const blueprintMaterial = see(BLUEPRINT_COLOUR, BLUEPRINT_OPACITY);
  const deliveredMaterial = see(DEBARKED_LOG_COLOUR, DELIVERED_OPACITY);
  const notAllowedMaterial = see(NOT_ALLOWED_COLOUR, BLUEPRINT_OPACITY);
  const fadedMaterial = see(DEBARKED_LOG_COLOUR, FADED_OPACITY);
  const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });

  /** The parts each stage adds, for each kind of piece. */
  const heights = courseHeights();
  const STAGES: Readonly<Record<EdgePieceKind, readonly (readonly PartPlan[])[]>> = {
    logWall: Array.from({ length: LOG_WALL_LOG_COST }, (_, log) =>
      Array.from({ length: COURSES_PER_LOG }, (_, half) => {
        const course = log * COURSES_PER_LOG + half;
        const look = courseLook(course);
        return {
          geometry: courseGeometry,
          x: look.shift,
          y: heights[course] ?? 0,
          scale: { along: look.length, across: look.thickness },
          turn: look.turn,
          cutEnds: true,
        };
      }),
    ),
    doorFrame: [
      [{ geometry: postGeometry, x: -(BUILD_GRID_METRES / 2 - POST_RADIUS_METRES), y: EDGE_PIECE_HEIGHT_METRES / 2 }],
      [{ geometry: postGeometry, x: BUILD_GRID_METRES / 2 - POST_RADIUS_METRES, y: EDGE_PIECE_HEIGHT_METRES / 2 }],
      [{ geometry: lintelGeometry, x: 0, y: EDGE_PIECE_HEIGHT_METRES - LINTEL_RADIUS_METRES }],
    ],
  };
  const LOG_COST: Readonly<Record<EdgePieceKind, number>> = { logWall: LOG_WALL_LOG_COST, doorFrame: DOOR_FRAME_LOG_COST };

  const drawn = new Map<Entity, Drawn>();
  const pickers: THREE.Mesh[] = [];
  const blueprints = blueprintEntities(entities);
  const finished = edgePieceEntities(entities);

  /** Adds every part of a piece to `root`, see-through. */
  function addParts(root: THREE.Group, kind: EdgePieceKind): Drawn["stages"] {
    return STAGES[kind].map((parts) =>
      parts.map((plan) => {
        const mesh = new THREE.Mesh(plan.geometry, blueprintMaterial);
        mesh.castShadow = true;
        mesh.position.set(plan.x, plan.y, 0);
        mesh.scale.set(plan.scale?.along ?? 1, plan.scale?.across ?? 1, plan.scale?.across ?? 1);
        mesh.rotation.x = plan.turn ?? 0;
        root.add(mesh);
        const side = woodMaterial.clone();
        side.transparent = true;
        if (plan.cutEnds !== true) return { mesh, solid: woodMaterial, fading: [side], plan };
        const cut = cutMaterial.clone();
        cut.transparent = true;
        return { mesh, solid: logMaterials, fading: [side, cut, cut], plan };
      }),
    );
  }

  /** Puts a piece of this kind at `spot`, facing `turns`. A log wall running along z sits lower, so corners interlock. */
  function place(root: THREE.Group, kind: EdgePieceKind, spot: Vec3, turns: number): void {
    const stagger = kind === "logWall" && turns % 2 !== 0 ? CORNER_STAGGER_METRES : 0;
    root.position.set(spot.x, spot.y - stagger, spot.z);
    root.rotation.y = facingRadians(turns);
  }

  /**
   * Lengthens each course of a log wall at the ends where another wall crosses it at a corner.
   * The course reaches further past that end and stays where it was at the other.
   */
  function reachCorners(stages: Drawn["stages"], ends: WallEnds): void {
    const start = ends.start ? CORNER_REACH_METRES : 0;
    const end = ends.end ? CORNER_REACH_METRES : 0;
    for (const { mesh, plan } of stages.flat()) {
      if (plan.cutEnds !== true) continue;
      mesh.scale.x = (plan.scale?.along ?? 1) + (start + end) / COURSE_LENGTH_METRES;
      mesh.position.x = plan.x + (end - start) / 2;
    }
  }

  /** Every log wall, finished or a blueprint, as of the last update. A wall under the mouse reaches toward these. */
  let walls: WallLine[] = [];

  const previews = new Map<EdgePieceKind, { root: THREE.Group; stages: Drawn["stages"] }>();
  for (const kind of ["logWall", "doorFrame"] as const) {
    const root = new THREE.Group();
    root.visible = false;
    group.add(root);
    previews.set(kind, { root, stages: addParts(root, kind) });
  }

  function draw(entity: Entity & { position: Vec3 }, kind: EdgePieceKind): Drawn {
    const existing = drawn.get(entity);
    if (existing?.kind === kind) return existing;
    if (existing !== undefined) forget(entity);
    const root = new THREE.Group();
    const stages = addParts(root, kind);
    const picker = new THREE.Mesh(pickGeometry, pickMaterial);
    picker.userData.entity = entity;
    root.add(picker);
    pickers.push(picker);
    group.add(root);
    const result = { kind, root, stages, picker };
    drawn.set(entity, result);
    return result;
  }

  /**
   * Shows how far construction has gone. Built parts are solid and in place, the part being built moves through its stage,
   * parts whose log has been delivered wait half solid in their places, and the rest show see-through.
   */
  function showProgress(item: Drawn, progress: number, delivered: number): void {
    const stagesDone = progress * item.stages.length;
    item.stages.forEach((parts, index) => {
      const share = Math.min(1, Math.max(0, stagesDone - index));
      for (const { mesh, solid, fading, plan } of parts) {
        if (share <= 0) {
          mesh.material = index < delivered ? deliveredMaterial : blueprintMaterial;
          mesh.position.y = plan.y;
          continue;
        }
        const opacity = Math.min(1, share / BUILD_FADE_SHARE);
        for (const material of fading) material.opacity = opacity;
        mesh.material = opacity < 1 ? fading : solid;
        mesh.position.y = plan.y + buildLift(share);
      }
    });
  }

  function fade(item: Drawn, faded: boolean): void {
    for (const parts of item.stages) for (const { mesh, solid } of parts) mesh.material = faded ? fadedMaterial : solid;
  }

  function forget(entity: Entity): void {
    const item = drawn.get(entity);
    if (item === undefined) return;
    group.remove(item.root);
    disposeFading(item.stages);
    pickers.splice(pickers.indexOf(item.picker), 1);
    drawn.delete(entity);
  }

  function disposeFading(stages: Drawn["stages"]): void {
    for (const { fading } of stages.flat()) for (const material of new Set(fading)) material.dispose();
  }

  const hits: THREE.Intersection[] = [];

  return {
    group,
    update(view) {
      const seen = new Set<Entity>();
      walls = [];
      for (const entity of blueprints) {
        if (entity.blueprint.piece === "logWall") walls.push({ middle: entity.position, turns: entity.facing?.turns ?? 0 });
      }
      for (const entity of finished) if (entity.edgePiece === "logWall") walls.push({ middle: entity.position, turns: entity.facing?.turns ?? 0 });
      for (const entity of blueprints) {
        const kind = entity.blueprint.piece;
        if (kind !== "logWall" && kind !== "doorFrame") continue;
        const item = draw(entity, kind);
        place(item.root, kind, entity.position, entity.facing?.turns ?? 0);
        if (kind === "logWall") reachCorners(item.stages, wallEnds({ middle: entity.position, turns: entity.facing?.turns ?? 0 }, walls));
        showProgress(item, entity.blueprint.progress, entity.blueprint.delivered.debarkedLog ?? 0);
        seen.add(entity);
      }
      for (const entity of finished) {
        const item = draw(entity, entity.edgePiece);
        const turns = entity.facing?.turns ?? 0;
        place(item.root, entity.edgePiece, entity.position, turns);
        if (entity.edgePiece === "logWall") reachCorners(item.stages, wallEnds({ middle: entity.position, turns }, walls));
        showProgress(item, 1, LOG_COST[entity.edgePiece]);
        fade(item, view !== undefined && isBetweenCameraAndPlayer(entity.position, turns, view.camera, view.player));
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
    outlineOf(hit) {
      const item = drawn.get(hit.entity);
      if (item === undefined) return [];
      item.root.updateMatrixWorld(true);
      return item.stages.flat().map(({ mesh }) => ({ geometry: mesh.geometry, matrix: mesh.matrixWorld }));
    },
    showPreview(shown) {
      for (const [kind, preview] of previews) {
        preview.root.visible = shown?.structure === kind;
        if (shown?.structure !== kind) continue;
        const material = shown.allowed ? blueprintMaterial : notAllowedMaterial;
        for (const { mesh } of preview.stages.flat()) mesh.material = material;
        place(preview.root, kind, shown.spot, shown.turns);
        if (kind === "logWall") reachCorners(preview.stages, wallEnds({ middle: shown.spot, turns: shown.turns }, walls));
      }
    },
    dispose() {
      for (const item of [
        courseGeometry, postGeometry, lintelGeometry, pickGeometry, woodMaterial, cutMaterial, blueprintMaterial, deliveredMaterial, notAllowedMaterial,
        fadedMaterial, pickMaterial,
      ]) {
        item.dispose();
      }
      for (const item of drawn.values()) disposeFading(item.stages);
      for (const preview of previews.values()) disposeFading(preview.stages);
    },
  };
}

/** A log wall on the edge with this middle, facing `turns`. */
export interface WallLine {
  readonly middle: { readonly x: number; readonly z: number };
  readonly turns: number;
}

/** Which ends of a log wall another wall crosses at a corner. `start` is the end at the wall's -x, facing the default way. */
export interface WallEnds {
  readonly start: boolean;
  readonly end: boolean;
}

/** The two ends of a wall, in the world: first its start, then its end. */
function endsOf(wall: WallLine): [{ x: number; z: number }, { x: number; z: number }] {
  // Turning the default way's +x by the wall's facing gives the way from its start to its end.
  const radians = facingRadians(wall.turns);
  const half = { x: (Math.cos(radians) * BUILD_GRID_METRES) / 2, z: (-Math.sin(radians) * BUILD_GRID_METRES) / 2 };
  return [
    { x: wall.middle.x - half.x, z: wall.middle.z - half.z },
    { x: wall.middle.x + half.x, z: wall.middle.z + half.z },
  ];
}

/**
 * Which ends of `wall` meet another wall at a corner, among `walls`. A wall running the other way crosses an end when
 * one of its own ends is at that same point. A wall running the same way, carrying on in a straight line, is not a corner.
 */
export function wallEnds(wall: WallLine, walls: readonly WallLine[]): WallEnds {
  const [start, end] = endsOf(wall);
  const same = (a: { x: number; z: number }, b: { x: number; z: number }) =>
    Math.abs(a.x - b.x) < SAME_POINT_METRES && Math.abs(a.z - b.z) < SAME_POINT_METRES;
  const crossing = walls.filter((other) => Math.abs(other.turns - wall.turns) % 2 === 1).flatMap(endsOf);
  return { start: crossing.some((point) => same(point, start)), end: crossing.some((point) => same(point, end)) };
}

/**
 * Whether a wall or door frame stands in the way of the camera's view of the player.
 * `middle` is the middle of the piece's edge at deck height, and `turns` the way it faces.
 * It is in the way when the line from the camera to the player's middle crosses the piece, or passes just beyond its ends or over its top.
 */
export function isBetweenCameraAndPlayer(middle: Vec3, turns: number, camera: Vec3, player: Vec3): boolean {
  // The piece runs along x when it faces 0 or 2 quarter turns, and along z otherwise.
  const alongX = turns % 2 === 0;
  const across = (spot: Vec3) => (alongX ? spot.z - middle.z : spot.x - middle.x);
  const along = (spot: Vec3) => (alongX ? spot.x - middle.x : spot.z - middle.z);
  const target = { x: player.x, y: player.y + PLAYER_MIDDLE_METRES, z: player.z };
  const cameraSide = across(camera);
  const playerSide = across(target);
  // The camera and the player must be on opposite sides of the line the piece stands on.
  if (cameraSide === 0 || cameraSide * playerSide >= 0) return false;
  const share = cameraSide / (cameraSide - playerSide);
  const alongAtCrossing = along(camera) + (along(target) - along(camera)) * share;
  const heightAtCrossing = camera.y + (target.y - camera.y) * share - middle.y;
  return Math.abs(alongAtCrossing) <= BUILD_GRID_METRES / 2 + FADE_MARGIN_METRES && heightAtCrossing <= EDGE_PIECE_HEIGHT_METRES + FADE_MARGIN_METRES;
}

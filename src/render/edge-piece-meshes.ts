// Draws log walls and door frames, and their blueprints: the "log-wall" and "door-frame" assets in asset-manifest.json,
// both built in code. The log wall is a draft. The door frame is approved. Both stand on the edge of a foundation square, along the line to the square beside it.
// - A log wall is a stack of debarked logs laid along the edge. Each delivered log is cut in two, since the wall is
//   one square wide, so each stage of construction lays two courses.
// - A door frame is two posts with a lintel across the top. Each stage puts up one of the three. The posts taper and lean a
//   little, and the lintel sits in notches on their tops and reaches past them. Their cut ends show the paler cut wood.
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
const COURSE_RADIUS_METRES = EDGE_PIECE_HEIGHT_METRES / COURSE_COUNT / 2;
/** A door post is a little thicker at the foot than at the top, like the trunk it was cut from. */
const POST_FOOT_RADIUS_METRES = 0.125;
const POST_TOP_RADIUS_METRES = 0.11;
const LINTEL_RADIUS_METRES = 0.11;
/** How far the lintel reaches past the outside of each post, in metres. */
const LINTEL_OVERHANG_METRES = 0.08;
/** How far each door post leans from upright, in radians, so the frame looks set up by hand. */
const LEFT_POST_LEAN_RADIANS = 0.018;
const RIGHT_POST_LEAN_RADIANS = -0.012;
/** How many flat sides a door post or lintel has round its length. */
const DOOR_LOG_SIDES = 10;
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
  /** The finished piece the ray meets first, with how far away it is, or undefined if it meets none. The right-click menu uses it. */
  pickFinished(raycaster: THREE.Raycaster): { entity: Entity; distance: number } | undefined;
  outlineOf(hit: EdgePieceHit): OutlinePart[];
  /** Shows a blueprint under the mouse at `spot`, facing `turns`, red where it is not allowed. Undefined hides it. */
  showPreview(preview: { structure: EdgePieceKind; spot: Vec3; turns: number; allowed: boolean } | undefined): void;
  dispose(): void;
}

/** One part of a piece: its shape and where it rests, from the middle of the edge at deck height, facing the default way. */
interface PartPlan {
  readonly geometry: THREE.BufferGeometry;
  readonly x: number;
  readonly y: number;
  /** The solid wood the part is drawn in once built. Without it, the plain debarked-log wood. */
  readonly wood?: THREE.MeshStandardMaterial;
}

interface Drawn {
  readonly kind: EdgePieceKind;
  readonly root: THREE.Group;
  /** The parts each stage of construction adds, in order. Each part has its own see-through copy of the wood for fading in. */
  readonly stages: { mesh: THREE.Mesh; fading: THREE.MeshStandardMaterial; plan: PartPlan }[][];
  readonly picker: THREE.Mesh;
}

/** How far round a piece facing `turns` quarter turns is drawn, in radians. Quarter turns go clockwise seen from above. */
function facingRadians(turns: number): number {
  return -turns * (Math.PI / 2);
}

/**
 * A debarked log for a door frame, standing along y with its middle at the origin.
 * Its sides are coloured as stripped wood and its two ends as the paler cut wood, so it is drawn with vertex colours.
 */
function doorLogGeometry(topRadius: number, footRadius: number, length: number): THREE.BufferGeometry {
  const geometry = new THREE.CylinderGeometry(topRadius, footRadius, length, DOOR_LOG_SIDES);
  const index = geometry.getIndex();
  const colours = new Float32Array(geometry.getAttribute("position").count * 3);
  const side = new THREE.Color(DEBARKED_LOG_COLOUR);
  const cut = new THREE.Color(DEBARKED_LOG_CUT_COLOUR);
  // A cylinder has three groups: the sides, then the top end, then the foot end.
  geometry.groups.forEach((part, partIndex) => {
    const colour = partIndex === 0 ? side : cut;
    for (let i = part.start; i < part.start + part.count; i++) colour.toArray(colours, (index?.getX(i) ?? i) * 3);
  });
  geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  geometry.clearGroups();
  return geometry;
}

export function createEdgePieceMeshes(entities: EntityStore): EdgePieceMeshes {
  const group = new THREE.Group();
  // Logs lie along x, the way a piece facing the default way runs.
  const courseGeometry = new THREE.CylinderGeometry(COURSE_RADIUS_METRES, COURSE_RADIUS_METRES, BUILD_GRID_METRES, 8).rotateZ(Math.PI / 2);
  // The posts stop at the middle of the lintel, so the lintel sits half sunk in notches cut into their tops.
  const postHeight = EDGE_PIECE_HEIGHT_METRES - LINTEL_RADIUS_METRES;
  const leftPostGeometry = doorLogGeometry(POST_TOP_RADIUS_METRES, POST_FOOT_RADIUS_METRES, postHeight).rotateZ(LEFT_POST_LEAN_RADIANS);
  const rightPostGeometry = doorLogGeometry(POST_TOP_RADIUS_METRES, POST_FOOT_RADIUS_METRES, postHeight).rotateZ(RIGHT_POST_LEAN_RADIANS);
  const lintelLength = BUILD_GRID_METRES + 2 * LINTEL_OVERHANG_METRES;
  // Turned a little about its length, so its flat sides do not line up with the posts'.
  const lintelGeometry = doorLogGeometry(LINTEL_RADIUS_METRES, LINTEL_RADIUS_METRES, lintelLength).rotateY(0.3).rotateZ(Math.PI / 2);
  const doorWoodMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true });
  const pickGeometry = new THREE.BoxGeometry(BUILD_GRID_METRES, EDGE_PIECE_HEIGHT_METRES, PICK_THICKNESS_METRES).translate(0, EDGE_PIECE_HEIGHT_METRES / 2, 0);
  const woodMaterial = new THREE.MeshStandardMaterial({ color: DEBARKED_LOG_COLOUR, flatShading: true });
  const see = (color: number, opacity: number) => new THREE.MeshStandardMaterial({ color, transparent: true, opacity, depthWrite: false });
  const blueprintMaterial = see(BLUEPRINT_COLOUR, BLUEPRINT_OPACITY);
  const deliveredMaterial = see(DEBARKED_LOG_COLOUR, DELIVERED_OPACITY);
  const notAllowedMaterial = see(NOT_ALLOWED_COLOUR, BLUEPRINT_OPACITY);
  const fadedMaterial = see(DEBARKED_LOG_COLOUR, FADED_OPACITY);
  const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });

  /** The parts each stage adds, for each kind of piece. */
  const STAGES: Readonly<Record<EdgePieceKind, readonly (readonly PartPlan[])[]>> = {
    logWall: Array.from({ length: LOG_WALL_LOG_COST }, (_, log) =>
      Array.from({ length: COURSES_PER_LOG }, (_, half) => ({
        geometry: courseGeometry,
        x: 0,
        y: COURSE_RADIUS_METRES * (1 + 2 * (log * COURSES_PER_LOG + half)),
      })),
    ),
    doorFrame: [
      [{ geometry: leftPostGeometry, x: -(BUILD_GRID_METRES / 2 - POST_FOOT_RADIUS_METRES), y: postHeight / 2, wood: doorWoodMaterial }],
      [{ geometry: rightPostGeometry, x: BUILD_GRID_METRES / 2 - POST_FOOT_RADIUS_METRES, y: postHeight / 2, wood: doorWoodMaterial }],
      [{ geometry: lintelGeometry, x: 0, y: postHeight, wood: doorWoodMaterial }],
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
        root.add(mesh);
        const fading = (plan.wood ?? woodMaterial).clone();
        fading.transparent = true;
        return { mesh, fading, plan };
      }),
    );
  }

  function place(root: THREE.Group, spot: Vec3, turns: number): void {
    root.position.set(spot.x, spot.y, spot.z);
    root.rotation.y = facingRadians(turns);
  }

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
      for (const { mesh, fading, plan } of parts) {
        if (share <= 0) {
          mesh.material = index < delivered ? deliveredMaterial : blueprintMaterial;
          mesh.position.y = plan.y;
          continue;
        }
        fading.opacity = Math.min(1, share / BUILD_FADE_SHARE);
        mesh.material = fading.opacity < 1 ? fading : (plan.wood ?? woodMaterial);
        mesh.position.y = plan.y + buildLift(share);
      }
    });
  }

  function fade(item: Drawn, faded: boolean): void {
    for (const parts of item.stages) for (const { mesh, plan } of parts) mesh.material = faded ? fadedMaterial : (plan.wood ?? woodMaterial);
  }

  function forget(entity: Entity): void {
    const item = drawn.get(entity);
    if (item === undefined) return;
    group.remove(item.root);
    for (const parts of item.stages) for (const { fading } of parts) fading.dispose();
    pickers.splice(pickers.indexOf(item.picker), 1);
    drawn.delete(entity);
  }

  const hits: THREE.Intersection[] = [];

  return {
    group,
    update(view) {
      const seen = new Set<Entity>();
      for (const entity of blueprints) {
        const kind = entity.blueprint.piece;
        if (kind !== "logWall" && kind !== "doorFrame") continue;
        const item = draw(entity, kind);
        place(item.root, entity.position, entity.facing?.turns ?? 0);
        showProgress(item, entity.blueprint.progress, entity.blueprint.delivered.debarkedLog ?? 0);
        seen.add(entity);
      }
      for (const entity of finished) {
        const item = draw(entity, entity.edgePiece);
        const turns = entity.facing?.turns ?? 0;
        place(item.root, entity.position, turns);
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
    pickFinished(raycaster) {
      hits.length = 0;
      raycaster.intersectObjects(pickers, false, hits);
      hits.sort((a, b) => a.distance - b.distance);
      for (const hit of hits) {
        const entity = hit.object.userData.entity as Entity | undefined;
        if (entity !== undefined && entity.blueprint === undefined) return { entity, distance: hit.distance };
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
        place(preview.root, shown.spot, shown.turns);
      }
    },
    dispose() {
      for (const item of [
        courseGeometry, leftPostGeometry, rightPostGeometry, lintelGeometry, pickGeometry, woodMaterial, doorWoodMaterial, blueprintMaterial, deliveredMaterial, notAllowedMaterial,
        fadedMaterial, pickMaterial,
      ]) {
        item.dispose();
      }
      for (const item of drawn.values()) for (const parts of item.stages) for (const { fading } of parts) fading.dispose();
      for (const preview of previews.values()) for (const { fading } of preview.stages.flat()) fading.dispose();
    },
  };
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

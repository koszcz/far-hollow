// Draws log walls, door frames, and windows, and their blueprints: the approved "log-wall", "door-frame", and "window"
// assets in asset-manifest.json, built in code. Each stands on the edge of a foundation square, along the line to the square beside it.
// - A log wall is a stack of debarked logs laid along the edge. Each delivered log is cut in two, since the wall is
//   one square wide, so each stage of construction lays two courses. Like the deck of a foundation, each course is a
//   little thicker or thinner, longer or shorter, and turned a little, so the wall looks hand-built. Each course sits
//   snug in a notch along the top of the one below, so no gaps show. The ends stick out a little past the edge, like
//   the corners of a log cabin, and show darker cut ends. A wall that runs along z sits half a course lower than one
//   that runs along x, so where two walls meet at a corner their logs take turns, like the corners of a log cabin.
//   Its bottom course sinks half into the deck. Where a wall meets another wall at a corner, its logs reach further
//   past the corner, so the corner shows crossed log ends, like a log cabin. Ends with no wall across them stay short,
//   so they never reach into a doorway. A door frame or window never stands at a corner: see `meetsOpeningAtCorner` in edge-pieces.ts.
// - A window is a log wall with a square opening and no glass. It has the same courses as a log wall, and sits as low as one
//   when it runs along z, so the two line up side by side. A frame of sawn boards lines the opening: an upright board each
//   side, a sill under it, and a header over it, the last two half sunk into the logs. Its three stages lay the sill courses,
//   then the courses beside the opening, each two short logs, with the sill and the upright boards, then the courses over it
//   with the header. Each short log reaches and turns its own way. Shutters hang in the opening: see shutters-meshes.ts.
// - A door frame is two posts with a lintel across the top. Each stage puts up one of the three. The posts taper and lean a
//   little, and the lintel sits in notches on their tops and reaches past them. Their cut ends show the paler cut wood.
// A blueprint shows see-through. Each debarked log the player has delivered shows pale and half solid in its place.
// The part being built stays in its place and turns from half solid to solid, like the logs of a foundation.
// A finished wall, door frame, or window fades out where the wall mode says (cabin-cutaway.ts), and whenever the player would disappear behind it.
// It eases out and back in over a moment (cutaway-fade.ts), in its own wood, see-through.
// While the player places one from the build menu, a see-through copy follows the mouse. It turns red where it is not allowed.
import * as THREE from "three";
import { BUILD_GRID_METRES } from "../sim/build-grid";
import { blueprintEntities, edgePieceEntities, type Entity, type EntityStore, type Vec3 } from "../sim/entities";
import { EDGE_PIECE_KINDS, type EdgePieceKind } from "../sim/structure-kind";
import { DOOR_FRAME_LOG_COST, LOG_WALL_LOG_COST, WINDOW_LOG_COST } from "../sim/structures";
import { DEBARKED_LOG_COLOUR, DEBARKED_LOG_CUT_COLOUR } from "./debarked-log-shape";
import { PLANK_WOOD_COLOUR } from "./plank-furniture-meshes";
import { NO_CUTAWAY, type CabinCutaway } from "./cabin-cutaway";
import { createCutawayFades, cutawayOpacity, showFading } from "./cutaway-fade";
import type { OutlinePart } from "./hover-outline";
import { deliveredOpacity, NOT_ALLOWED_COLOUR, pickFinished, seeThrough } from "./structure-look";
import { areAtRightAngles, quarterTurnsToRadians, runsAlongX, type QuarterTurns } from "../sim/quarter-turns";
import { addGroundPoints, subtractGroundPoints } from "../sim/ground-point";
import { isEdgePiece, isLaidInCourses } from "../sim/edge-pieces";
import {
  CORNER_STAGGER_METRES,
  COURSE_LENGTH_METRES,
  COURSE_RADIUS_METRES,
  COURSES_PER_LOG,
  courseHeights,
  courseLook,
  EDGE_PIECE_HEIGHT_METRES,
} from "./log-courses";
import {
  isBesideOpening,
  JAMB_THICKNESS_METRES,
  WINDOW_OPENING,
  WINDOW_OPENING_WIDTH_METRES,
  WINDOW_STAGE_COURSES,
  WINDOW_STUB_INNER_METRES,
  WINDOW_STUB_LENGTH_METRES,
} from "./window-shape";

const BLUEPRINT_COLOUR = 0xbfe3ff;
/** How see-through the parts of a blueprint not yet built are, from 0 (invisible) to 1 (solid). */
const BLUEPRINT_OPACITY = 0.35;
/** A delivered log waiting in its place is this solid, so it stands out from the parts still needed. */
const DELIVERED_OPACITY = 0.7;
/** How much further a course reaches past an end where another wall crosses it at a corner, in metres. */
const CORNER_REACH_METRES = 0.2;
/** Two corner points closer than this, in metres, are the same point. */
const SAME_POINT_METRES = 1e-6;
/** A door post is a little thicker at the foot than at the top, like the trunk it was cut from. */
const POST_FOOT_RADIUS_METRES = 0.125;
const POST_TOP_RADIUS_METRES = 0.11;
const LINTEL_RADIUS_METRES = 0.11;
/** How wide the doorway is between the feet of a door frame's posts, in metres. A door hung in it fits this gap. */
export const DOORWAY_WIDTH_METRES = BUILD_GRID_METRES - 4 * POST_FOOT_RADIUS_METRES;
/** How high the doorway is, from the deck to the underside of the lintel, in metres. */
export const DOORWAY_HEIGHT_METRES = EDGE_PIECE_HEIGHT_METRES - 2 * LINTEL_RADIUS_METRES;
/** How far the lintel reaches past the outside of each post, in metres. */
const LINTEL_OVERHANG_METRES = 0.08;
/** How far each door post leans from upright, in radians, so the frame looks set up by hand. */
const LEFT_POST_LEAN_RADIANS = 0.018;
const RIGHT_POST_LEAN_RADIANS = -0.012;
/** How many flat sides a door post or lintel has round its length. */
const DOOR_LOG_SIDES = 10;
/** How thick the invisible box that catches clicks on a blueprint is, across its edge, in metres. */
const PICK_THICKNESS_METRES = 0.35;

/** What a click on a wall or door frame blueprint landed on. Finished walls and door frames are not clicked. */
export type EdgePieceHit = { kind: "blueprint"; entity: Entity };

export interface EdgePieceMeshes {
  readonly group: THREE.Group;
  /**
   * Brings every wall, door frame, and their blueprints up to date with game state.
   * Finished pieces fade where `cutaway` says, easing in and out over time. `nowSeconds` is the time of this frame.
   * Without `cutaway`, nothing fades. Without `nowSeconds`, a fade shows at once.
   */
  update(cutaway?: CabinCutaway, nowSeconds?: number): void;
  /** What a ray from the camera hits first among wall and door frame blueprints, and how far away. */
  pick(raycaster: THREE.Raycaster): { hit: EdgePieceHit; distance: number } | undefined;
  /** The parts of a wall or door frame blueprint, placed in the world. Empty once it is gone. */
  /** The finished piece the ray meets first, with how far away it is, or undefined if it meets none. The action menu uses it. */
  pickFinished(raycaster: THREE.Raycaster): { entity: Entity; distance: number } | undefined;
  outlineOf(hit: EdgePieceHit): OutlinePart[];
  /** Shows a blueprint under the mouse at `spot`, facing `turns`, red where it is not allowed. Undefined hides it. */
  showPlacingBlueprint(placingBlueprint: { structure: EdgePieceKind; spot: Vec3; turns: QuarterTurns; allowed: boolean } | undefined): void;
  dispose(): void;
}

/**
 * How tall the sill and the header of the window's frame are, in metres. Each sits half hidden in the round log it rests
 * on or under, so it is tall enough to cover the curve of the log at the wall's faces.
 */
const SILL_HEIGHT_METRES = 0.1;
/** How far the sill and the header reach past the outside of each upright board, in metres. */
const SILL_REACH_METRES = 0.03;
/**
 * How deep the frame's boards are across the wall, as a share of a plain course's thickness. A little less than the
 * logs, so the boards sit just inside the wall's faces and closed shutters never touch them.
 */
const FRAME_DEPTH_SHARE = 0.96;
/** The frame's sawn boards are a little darker than plank wood, so pale shutters stand out against them. */
const FRAME_WOOD_SHADE = 0.88;
/**
 * How each short log beside the opening differs from its course, from the bottom up, as a pair for the -x and +x
 * sides: how much longer or shorter it reaches past the end of the edge, in metres, and how much more it is turned
 * about its length, in radians. Its end against the frame stays put. Fixed, so every window looks the same.
 */
const STUB_LOOKS: readonly (readonly [{ reach: number; turn: number }, { reach: number; turn: number }])[] = [
  [
    { reach: 0.015, turn: 0.7 },
    { reach: -0.02, turn: -0.4 },
  ],
  [
    { reach: -0.025, turn: -0.9 },
    { reach: 0.01, turn: 0.5 },
  ],
  [
    { reach: 0.02, turn: 0.3 },
    { reach: 0.025, turn: -1.2 },
  ],
];

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
  /** The solid wood the part is drawn in once built. Without it, the plain debarked-log wood. */
  readonly wood?: THREE.MeshStandardMaterial;
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
  // Cylinder groups are the side, then the two ends, so a list of three materials gives the ends their own colour.
  const courseGeometry = new THREE.CylinderGeometry(COURSE_RADIUS_METRES, COURSE_RADIUS_METRES, COURSE_LENGTH_METRES, 9).rotateZ(Math.PI / 2);
  const stubGeometry = new THREE.CylinderGeometry(COURSE_RADIUS_METRES, COURSE_RADIUS_METRES, WINDOW_STUB_LENGTH_METRES, 9).rotateZ(Math.PI / 2);
  // The posts stop at the middle of the lintel, so the lintel sits half sunk in notches cut into their tops.
  const postHeight = EDGE_PIECE_HEIGHT_METRES - LINTEL_RADIUS_METRES;
  const leftPostGeometry = doorLogGeometry(POST_TOP_RADIUS_METRES, POST_FOOT_RADIUS_METRES, postHeight).rotateZ(LEFT_POST_LEAN_RADIANS);
  const rightPostGeometry = doorLogGeometry(POST_TOP_RADIUS_METRES, POST_FOOT_RADIUS_METRES, postHeight).rotateZ(RIGHT_POST_LEAN_RADIANS);
  const lintelLength = BUILD_GRID_METRES + 2 * LINTEL_OVERHANG_METRES;
  // Turned a little about its length, so its flat sides do not line up with the posts'.
  const lintelGeometry = doorLogGeometry(LINTEL_RADIUS_METRES, LINTEL_RADIUS_METRES, lintelLength)
    .rotateY(0.3)
    .rotateZ(Math.PI / 2);
  const doorWoodMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true });
  // The window's frame: an upright board each side of the opening, a sill under it, and a header over it.
  const frameDepth = 2 * COURSE_RADIUS_METRES * FRAME_DEPTH_SHARE;
  const openingHeight = WINDOW_OPENING.top - WINDOW_OPENING.bottom;
  const jambGeometry = new THREE.BoxGeometry(JAMB_THICKNESS_METRES, openingHeight, frameDepth);
  const sillGeometry = new THREE.BoxGeometry(2 * (WINDOW_STUB_INNER_METRES + SILL_REACH_METRES), SILL_HEIGHT_METRES, frameDepth);
  const frameWoodMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(PLANK_WOOD_COLOUR).multiplyScalar(FRAME_WOOD_SHADE), flatShading: true });
  const pickGeometry = new THREE.BoxGeometry(BUILD_GRID_METRES, EDGE_PIECE_HEIGHT_METRES, PICK_THICKNESS_METRES).translate(0, EDGE_PIECE_HEIGHT_METRES / 2, 0);
  const woodMaterial = new THREE.MeshStandardMaterial({ color: DEBARKED_LOG_COLOUR, flatShading: true });
  const cutMaterial = new THREE.MeshStandardMaterial({ color: DEBARKED_LOG_CUT_COLOUR, flatShading: true });
  const logMaterials = [woodMaterial, cutMaterial, cutMaterial];
  const blueprintMaterial = seeThrough(BLUEPRINT_COLOUR, BLUEPRINT_OPACITY);
  const deliveredMaterial = seeThrough(DEBARKED_LOG_COLOUR, DELIVERED_OPACITY);
  const notAllowedMaterial = seeThrough(NOT_ALLOWED_COLOUR, BLUEPRINT_OPACITY);
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
      [{ geometry: leftPostGeometry, x: -(BUILD_GRID_METRES / 2 - POST_FOOT_RADIUS_METRES), y: postHeight / 2, wood: doorWoodMaterial }],
      [{ geometry: rightPostGeometry, x: BUILD_GRID_METRES / 2 - POST_FOOT_RADIUS_METRES, y: postHeight / 2, wood: doorWoodMaterial }],
      [{ geometry: lintelGeometry, x: 0, y: postHeight, wood: doorWoodMaterial }],
    ],
    window: WINDOW_STAGE_COURSES.map((courses, stage) => {
      const logs = courses.flatMap((course, index): PartPlan[] => {
        const look = courseLook(course);
        const y = heights[course] ?? 0;
        const turn = look.turn;
        if (!isBesideOpening(course)) {
          return [{ geometry: courseGeometry, x: look.shift, y, scale: { along: look.length, across: look.thickness }, turn, cutEnds: true }];
        }
        // Beside the opening, each course is two short logs, one either side, butting against the frame's upright boards.
        // Each reaches its own way past the end of the edge and is turned its own way, so no two look alike.
        return [-1, 1].map((side, sideIndex) => {
          const stub = STUB_LOOKS[index]?.[sideIndex] ?? { reach: 0, turn: 0 };
          const length = WINDOW_STUB_LENGTH_METRES + stub.reach;
          return {
            geometry: stubGeometry,
            x: side * (WINDOW_STUB_INNER_METRES + length / 2),
            y,
            scale: { along: length / WINDOW_STUB_LENGTH_METRES, across: look.thickness },
            turn: turn + stub.turn,
            cutEnds: true,
          };
        });
      });
      // The frame goes in with the logs around it: the sill and the upright boards with the logs beside the opening,
      // and the header with the logs over it.
      const jambX = WINDOW_OPENING_WIDTH_METRES / 2 + JAMB_THICKNESS_METRES / 2;
      const frame: PartPlan[][] = [
        [],
        [
          { geometry: sillGeometry, x: 0, y: WINDOW_OPENING.bottom - SILL_HEIGHT_METRES / 2, wood: frameWoodMaterial },
          ...[-1, 1].map((side) => ({ geometry: jambGeometry, x: side * jambX, y: (WINDOW_OPENING.bottom + WINDOW_OPENING.top) / 2, wood: frameWoodMaterial })),
        ],
        [{ geometry: sillGeometry, x: 0, y: WINDOW_OPENING.top + SILL_HEIGHT_METRES / 2, wood: frameWoodMaterial }],
      ];
      return [...logs, ...(frame[stage] ?? [])];
    }),
  };
  const LOG_COST: Readonly<Record<EdgePieceKind, number>> = { logWall: LOG_WALL_LOG_COST, doorFrame: DOOR_FRAME_LOG_COST, window: WINDOW_LOG_COST };

  const drawn = new Map<Entity, Drawn>();
  const fades = createCutawayFades();
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
        const wood = plan.wood ?? woodMaterial;
        const side = wood.clone();
        side.transparent = true;
        if (plan.cutEnds !== true) return { mesh, solid: wood, fading: [side], plan };
        const cut = cutMaterial.clone();
        cut.transparent = true;
        return { mesh, solid: logMaterials, fading: [side, cut, cut], plan };
      }),
    );
  }

  /** Puts a piece of this kind at `spot`, facing `turns`. A log wall running along z sits lower, so corners interlock. */
  function place(root: THREE.Group, kind: EdgePieceKind, spot: Vec3, turns: QuarterTurns): void {
    const stagger = isLaidInCourses(kind) && !runsAlongX(turns) ? CORNER_STAGGER_METRES : 0;
    root.position.set(spot.x, spot.y - stagger, spot.z);
    root.rotation.y = quarterTurnsToRadians(turns);
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

  const placingBlueprints = new Map<EdgePieceKind, { root: THREE.Group; stages: Drawn["stages"] }>();
  for (const kind of EDGE_PIECE_KINDS) {
    const root = new THREE.Group();
    root.visible = false;
    group.add(root);
    placingBlueprints.set(kind, { root, stages: addParts(root, kind) });
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
   * Shows how far construction has gone. Built parts are solid. The part being built stays in its place and turns solid.
   * Parts whose log has been delivered wait half solid in their places, and the rest show see-through.
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
        const opacity = deliveredOpacity(DELIVERED_OPACITY, share);
        for (const material of fading) material.opacity = opacity;
        mesh.material = opacity < 1 ? fading : solid;
        mesh.position.y = plan.y;
      }
    });
  }

  /** Shows a finished piece at fade `level`, from 0, solid, to 1, see-through. */
  function fade(item: Drawn, level: number): void {
    for (const { mesh, solid, fading } of item.stages.flat()) {
      if (level <= 0) {
        mesh.material = solid;
        continue;
      }
      for (const material of fading) showFading(material, cutawayOpacity(level));
      mesh.material = fading;
    }
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

  function disposeFading(stages: Drawn["stages"]): void {
    for (const { fading } of stages.flat()) for (const material of new Set(fading)) material.dispose();
  }

  const hits: THREE.Intersection[] = [];

  return {
    group,
    update(cutaway = NO_CUTAWAY, nowSeconds) {
      const seen = new Set<Entity>();
      walls = [];
      for (const entity of blueprints) {
        if (entity.blueprint.structure === "logWall") walls.push({ middle: entity.position, turns: entity.facing?.turns ?? 0 });
      }
      for (const entity of finished) if (entity.edgePiece === "logWall") walls.push({ middle: entity.position, turns: entity.facing?.turns ?? 0 });
      for (const entity of blueprints) {
        const kind = entity.blueprint.structure;
        if (!isEdgePiece(kind)) continue;
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
        fade(item, fades.level(entity, cutaway.fades(entity.position, turns), nowSeconds));
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
      return item.stages.flat().map(({ mesh }) => ({ geometry: mesh.geometry, matrix: mesh.matrixWorld }));
    },
    showPlacingBlueprint(shown) {
      for (const [kind, placingBlueprint] of placingBlueprints) {
        placingBlueprint.root.visible = shown?.structure === kind;
        if (shown?.structure !== kind) continue;
        const material = shown.allowed ? blueprintMaterial : notAllowedMaterial;
        for (const { mesh } of placingBlueprint.stages.flat()) mesh.material = material;
        place(placingBlueprint.root, kind, shown.spot, shown.turns);
        if (kind === "logWall") reachCorners(placingBlueprint.stages, wallEnds({ middle: shown.spot, turns: shown.turns }, walls));
      }
    },
    dispose() {
      for (const item of [
        courseGeometry,
        stubGeometry,
        jambGeometry,
        sillGeometry,
        frameWoodMaterial,
        leftPostGeometry,
        rightPostGeometry,
        lintelGeometry,
        pickGeometry,
        woodMaterial,
        cutMaterial,
        doorWoodMaterial,
        blueprintMaterial,
        deliveredMaterial,
        notAllowedMaterial,
        pickMaterial,
      ]) {
        item.dispose();
      }
      for (const item of drawn.values()) disposeFading(item.stages);
      for (const placingBlueprint of placingBlueprints.values()) disposeFading(placingBlueprint.stages);
    },
  };
}

/** A log wall on the edge with this middle, facing `turns`. */
export interface WallLine {
  readonly middle: { readonly x: number; readonly z: number };
  readonly turns: QuarterTurns;
}

/** Which ends of a log wall another wall crosses at a corner. `start` is the end at the wall's -x, facing the default way. */
export interface WallEnds {
  readonly start: boolean;
  readonly end: boolean;
}

/** The two ends of a wall, in the world: first its start, then its end. */
function endsOf(wall: WallLine): [{ x: number; z: number }, { x: number; z: number }] {
  // Turning the default way's +x by the wall's facing gives the way from its start to its end.
  const radians = quarterTurnsToRadians(wall.turns);
  const half = { x: (Math.cos(radians) * BUILD_GRID_METRES) / 2, z: (-Math.sin(radians) * BUILD_GRID_METRES) / 2 };
  return [subtractGroundPoints(wall.middle, half), addGroundPoints(wall.middle, half)];
}

/**
 * Which ends of `wall` meet another wall at a corner, among `walls`. A wall running the other way crosses an end when
 * one of its own ends is at that same point. A wall running the same way, carrying on in a straight line, is not a corner.
 */
export function wallEnds(wall: WallLine, walls: readonly WallLine[]): WallEnds {
  const [start, end] = endsOf(wall);
  const same = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.abs(a.x - b.x) < SAME_POINT_METRES && Math.abs(a.z - b.z) < SAME_POINT_METRES;
  const crossing = walls.filter((other) => areAtRightAngles(other.turns, wall.turns)).flatMap(endsOf);
  return { start: crossing.some((point) => same(point, start)), end: crossing.some((point) => same(point, end)) };
}

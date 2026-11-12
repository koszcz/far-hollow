// Draws roof frames and their blueprints: the "roof-frame" asset in asset-manifest.json, built in code and approved by the owner.
// A frame is the timber skeleton of one foundation square, between the walls and the roof.
// - Beams: hewn timbers, debarked logs squared with an adze, lying level on the top of every wall and door frame on the
//   square's edges. A log wall that runs along z sits half a course lower than one along x, so its beam is hewn taller, and
//   every beam top is level. A beam reaches
//   about 0.15 m past the walls where no frame carries on beyond its end, so the join between walls and roof hides under the
//   overhang. Where two frames share an edge, only one of them lays its beam.
// - Rafters: three hewn timbers on the beams, sloping down the way the frame faces, 35 degrees, like the roof on them.
//   Frames side by side work out their heights and their valleys from each other, as roof-layout.ts says. Where the front
//   of a frame is an eave, its rafters reach on past the wall, under the roof's overhang. A valley has a rafter along each
//   low edge and one corner to corner under the line where its two slopes meet.
// - Gable ends: where a slope rises above the beams, as at each end of a ridge or the high side of a shed roof, upright
//   planks stand on the beams and close the gap up to the roof (gable-end-shape.ts). Beside a lower roof, as where a taller
//   wing stands beside a lower one, they stand on that roof's planks instead.
// Construction has one stage per debarked log: the beams along x, then the beams along z, then the three rafters. The gable
// ends go up with the last rafter. A blueprint shows see-through. Each delivered log shows pale and half solid in its place.
// The part being built stays in its place and turns from half solid to solid, like the logs of a foundation.
// When the player stands under a cabin roof, the frames under that roof hide with it, so the player stays in view.
// While the player places a frame from the build menu, a see-through copy follows the mouse. It turns red where it is not allowed.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { BUILD_GRID_METRES, isOnGridSquare } from "../sim/build-grid";
import { edgePieceOn } from "../sim/edge-pieces";
import { blueprintEntities, roofFrameEntities, type Entity, type EntityStore, type Vec3 } from "../sim/entities";
import { roofAbove } from "../sim/roofs";
import { SIDES, turnOffset, type EdgePieceKind, type QuarterTurns } from "../sim/structure-kind";
import { ROOF_FRAME_LOG_COST } from "../sim/structures";
import { DEBARKED_LOG_COLOUR } from "./debarked-log-shape";
import { CORNER_STAGGER_METRES, EDGE_PIECE_HEIGHT_METRES } from "./edge-piece-meshes";
import type { OutlinePart } from "./hover-outline";
import { seededRandom } from "./lean-to-meshes";
import { gableEndFloors, gableEndPlanks } from "./gable-end-shape";
import { ALONE, roofTopAt, type RoofPlace, type RoofShape } from "./roof-layout";
import {
  BEAM_RADIUS_METRES,
  COVER_THICKNESS_METRES,
  coverUnderside,
  EAVE_REACH_METRES,
  EDGES,
  FRAME_TOP_METRES,
  frameLayout,
  hewnTimber,
  isShown,
  neighboursOf,
  RAFTER_RADIUS_METRES,
  rafterBetween,
  raisedBy,
  ROOF_SEED,
  SECTION_RISE_METRES,
  shapeHeight,
  type FrameLayout,
  type Section,
} from "./roof-parts";
import { deliveredOpacity, facingRadians, NOT_ALLOWED_COLOUR, pickFinished, seeThrough } from "./structure-look";

const BLUEPRINT_COLOUR = 0xbfe3ff;
/** How see-through the parts of a blueprint not yet built are, from 0 (invisible) to 1 (solid). */
const BLUEPRINT_OPACITY = 0.35;
/** A delivered log waiting in its place is this solid, so it stands out from the parts still needed. */
const DELIVERED_OPACITY = 0.7;
/**
 * A beam reaches this far past the walls where no frame carries on beyond its end, in metres. Past an eave the roof slopes
 * down steeply, so a beam reaching further would poke through it.
 */
const BEAM_OVERHANG_METRES = 0.15;
/** Where the front of a frame is an eave, its rafters stop this far short of the edge of the roof's overhang, in metres. */
const RAFTER_TAIL_SHORT_METRES = 0.06;
/** A rafter stops this far short of the high edge of its square, in metres, so its square-cut end stays under a ridge. */
const RAFTER_HEAD_SHORT_METRES = 0.04;
/** How many stages lay beams: the beams along x, then the beams along z. The rest lay rafters. */
const BEAM_STAGES = 2;
/** How thick the invisible slab that catches clicks on a blueprint is, in metres. */
const PICK_THICKNESS_METRES = 0.3;

/** What a click on a frame blueprint landed on. Finished frames are not clicked this way. */
export type RoofFrameHit = { kind: "blueprint"; entity: Entity };

export interface RoofFrameMeshes {
  readonly group: THREE.Group;
  /**
   * Brings every roof frame and frame blueprint up to date with game state.
   * Finished frames under the roof above the player standing at `player` hide. Without it, nothing hides.
   */
  update(view?: { player: Vec3 }): void;
  /** What a ray from the camera hits first among frame blueprints, and how far away. */
  pick(raycaster: THREE.Raycaster): { hit: RoofFrameHit; distance: number } | undefined;
  /** The finished frame the ray meets first, with how far away it is, or undefined if it meets none. The action menu uses it. */
  pickFinished(raycaster: THREE.Raycaster): { entity: Entity; distance: number } | undefined;
  /** The parts of a frame blueprint, placed in the world. Empty once it is gone. */
  outlineOf(hit: RoofFrameHit): OutlinePart[];
  /** Shows a frame blueprint under the mouse over the deck at `spot`, sloping down the way `turns` faces, red where not allowed. */
  showPlacingBlueprint(placingBlueprint: { spot: Vec3; turns: QuarterTurns; allowed: boolean } | undefined): void;
  dispose(): void;
}

/** A beam on one edge of a square: which side, what stands under it, and how far it reaches past each end. */
interface BeamPlan {
  readonly side: QuarterTurns;
  readonly under: EdgePieceKind;
  readonly startReach: number;
  readonly endReach: number;
}

interface Drawn {
  readonly root: THREE.Group;
  /** Holds the rafters and gable ends, turned the way the frame is drawn and raised to its height. The beams stay level, in `root`. */
  readonly turned: THREE.Group;
  /** One part for each stage of construction, in order, each with its own see-through copy of the wood for fading in. */
  readonly parts: { mesh: THREE.Mesh; fading: THREE.MeshStandardMaterial }[];
  /** The plank gable ends between the beams and the roof. They go up with the last rafter. */
  readonly gables: THREE.Mesh;
  /** A see-through copy of the gable planks' material, for fading them in. */
  readonly gablesFading: THREE.MeshStandardMaterial;
  readonly picker: THREE.Mesh;
}

export function createRoofFrameMeshes(entities: EntityStore): RoofFrameMeshes {
  const group = new THREE.Group();
  const pickGeometry = new THREE.BoxGeometry(BUILD_GRID_METRES, PICK_THICKNESS_METRES, BUILD_GRID_METRES);
  const wood = new THREE.MeshStandardMaterial({ color: DEBARKED_LOG_COLOUR, flatShading: true, vertexColors: true });
  const gablePlanks = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, vertexColors: true });
  const blueprintMaterial = seeThrough(BLUEPRINT_COLOUR, BLUEPRINT_OPACITY);
  const deliveredMaterial = seeThrough(DEBARKED_LOG_COLOUR, DELIVERED_OPACITY);
  const notAllowedMaterial = seeThrough(NOT_ALLOWED_COLOUR, BLUEPRINT_OPACITY);
  const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });
  const empty = new THREE.BufferGeometry();

  const rafterCount = ROOF_FRAME_LOG_COST - BEAM_STAGES;
  /** The rafters of each shape, with or without tails past an eave at the front, made once and shared, in the order construction adds them. */
  const raftersByKind = new Map<string, readonly THREE.BufferGeometry[]>();
  function raftersOf(shape: RoofShape, eaveInFront: boolean): readonly THREE.BufferGeometry[] {
    const name = `${shape}:${eaveInFront}`;
    const known = raftersByKind.get(name);
    if (known !== undefined) return known;
    const made = shape === "straight" ? straightRafters(eaveInFront) : valleyRafters();
    raftersByKind.set(name, made);
    return made;
  }

  /** A point on the middle line of a rafter resting on the beams under a roof of `shape`, at (x, z), in the frame's own frame. */
  const onRafterLine = (shape: RoofShape, x: number, z: number) => new THREE.Vector3(x, FRAME_TOP_METRES + RAFTER_RADIUS_METRES + shapeHeight(shape, x, z), z);

  /** The rafters of a straight frame, side by side across it, from its high back edge down to its front, and past an eave there. */
  function straightRafters(eaveInFront: boolean): THREE.BufferGeometry[] {
    const random = seededRandom(ROOF_SEED);
    const jitter = (size: number) => (random() * 2 - 1) * size;
    const half = BUILD_GRID_METRES / 2;
    const front = half + (eaveInFront ? EAVE_REACH_METRES - RAFTER_TAIL_SHORT_METRES : 0);
    return Array.from({ length: rafterCount }, (_, i) => {
      const x = -half + RAFTER_RADIUS_METRES + (i * (BUILD_GRID_METRES - 2 * RAFTER_RADIUS_METRES)) / Math.max(1, rafterCount - 1) + jitter(0.01);
      return rafterBetween(onRafterLine("straight", x, -half + RAFTER_HEAD_SHORT_METRES), onRafterLine("straight", x, front), jitter);
    });
  }

  /**
   * The rafters of a valley, drawn sloping down to +z and +x, in the order construction adds them: one along the low edge
   * at +x, one corner to corner under the line where the slopes meet, and one along the low edge at +z.
   */
  function valleyRafters(): THREE.BufferGeometry[] {
    const random = seededRandom(ROOF_SEED + 3);
    const jitter = (size: number) => (random() * 2 - 1) * size;
    const half = BUILD_GRID_METRES / 2;
    const edge = half - RAFTER_RADIUS_METRES;
    return [
      rafterBetween(onRafterLine("valley", edge, -half), onRafterLine("valley", edge, half), jitter),
      rafterBetween(onRafterLine("valley", -half, -half), onRafterLine("valley", half, half), jitter),
      rafterBetween(onRafterLine("valley", -half, edge), onRafterLine("valley", half, edge), jitter),
    ];
  }

  /** The merged beams of one stage, made once for each set of beams and shared. */
  const beamGeometries = new Map<string, THREE.BufferGeometry>();
  /**
   * The beams of one stage, level on the walls, in the square's own frame, not turned: the beams along x for stage 0, or
   * along z for stage 1.
   */
  function beamsOf(beams: readonly BeamPlan[], stage: number): THREE.BufferGeometry {
    const along = beams.filter(({ side }) => side % 2 === stage);
    const name = `${stage}:${along.map(({ side, under, startReach, endReach }) => `${side}${under}${startReach}${endReach}`).join(",")}`;
    const known = beamGeometries.get(name);
    if (known !== undefined) return known;
    const logs = along.map(({ side, under, startReach, endReach }) => {
      const beamRandom = seededRandom(ROOF_SEED + 10 + side);
      const wobble = (size: number) => (beamRandom() * 2 - 1) * size;
      // A log wall along z sits lower, so its beam is hewn taller, and its top is level with the others. Every beam is as wide.
      const radius = BEAM_RADIUS_METRES + (under === "logWall" && side % 2 === 1 ? CORNER_STAGGER_METRES / 2 : 0);
      const geometry = hewnTimber(BUILD_GRID_METRES + startReach + endReach, radius, wobble, BEAM_RADIUS_METRES, 0.006);
      const middle = turnOffset({ x: 0, z: BUILD_GRID_METRES / 2 }, side);
      const shift = (endReach - startReach) / 2;
      // A beam on side 0 or 2 runs along x. Logs are made along z.
      if (side % 2 === 0) geometry.rotateY(Math.PI / 2);
      geometry.translate(middle.x + (side % 2 === 0 ? shift : 0), FRAME_TOP_METRES - radius, middle.z + (side % 2 === 0 ? 0 : shift));
      return geometry;
    });
    const geometry = logs.length === 0 ? empty : mergeGeometries(logs);
    for (const log of logs) log.dispose();
    beamGeometries.set(name, geometry);
    return geometry;
  }

  /**
   * The beam on every edge of the square of `frame` with a finished wall or door frame under it.
   * Where two frames share an edge, only one lays the beam: the finished one beside a blueprint, or else the one on the -x or -z side.
   * A beam reaches past an end only where no frame carries on beyond that end.
   */
  function beamPlans(layout: FrameLayout, frame: Section): BeamPlan[] {
    const middle = frame.position;
    const at = (dx: number, dz: number) => layout.sectionAt({ x: middle.x + dx * BUILD_GRID_METRES, z: middle.z + dz * BUILD_GRID_METRES });
    const reach = (dx: number, dz: number) => (at(dx, dz) === undefined ? BEAM_OVERHANG_METRES : 0);
    return SIDES.flatMap((side): BeamPlan[] => {
      const under = edgePieceOn(entities, middle, side);
      if (under === undefined) return [];
      const out = turnOffset({ x: 0, z: 1 }, side);
      const across = at(out.x, out.z);
      if (across !== undefined) {
        const finishedHere = frame.blueprint === undefined;
        const finishedThere = across.blueprint === undefined;
        const theirs = finishedHere === finishedThere ? side === 1 || side === 2 : finishedThere;
        if (theirs) return [];
      }
      return side % 2 === 0
        ? [{ side, under, startReach: reach(-1, 0), endReach: reach(1, 0) }]
        : [{ side, under, startReach: reach(0, -1), endReach: reach(0, 1) }];
    });
  }

  /** The gable ends for each shape and set of edge heights, made once and shared. */
  const gableGeometries = new Map<string, THREE.BufferGeometry>();
  function gablesFor(shape: RoofShape, floors: readonly (number | undefined)[]): THREE.BufferGeometry {
    const name = `${shape}:${floors.map((floor) => floor?.toFixed(3) ?? "-").join(",")}`;
    const known = gableGeometries.get(name);
    if (known !== undefined) return known;
    const planks = gableEndPlanks(coverUnderside(shape), floors);
    const geometry = planks.length === 0 ? empty : mergeGeometries(planks);
    for (const plank of planks) plank.dispose();
    gableGeometries.set(name, geometry);
    return geometry;
  }

  /**
   * The gable ends of a frame, from what is under its edges: a lower roof beside it, or else its own beams.
   * Over a lower roof, they stand on that roof's planks and reach up to this frame's roof. An edge with neither a frame
   * beside it nor a wall under it gets none, since nothing holds them up and the side is open anyway.
   */
  function gablesOf(layout: FrameLayout, section: Section, place: RoofPlace): THREE.BufferGeometry {
    const neighbours = neighboursOf(layout, section.position, place);
    const world = (x: number, z: number) => {
      const offset = turnOffset({ x, z }, place.drawTurns);
      return { x: section.position.x + offset.x, z: section.position.z + offset.z };
    };
    const floors = gableEndFloors(coverUnderside(place.shape), raisedBy(place), (edge, x, z) => {
      const beside = neighbours[edge];
      if (beside === undefined) return wallUnder(section, place, edge) ? FRAME_TOP_METRES : Number.POSITIVE_INFINITY;
      const besidePlace = layout.placeAt(beside.position);
      const coverTop =
        FRAME_TOP_METRES + 2 * RAFTER_RADIUS_METRES + COVER_THICKNESS_METRES + roofTopAt(besidePlace, beside.position, world(x, z)) * SECTION_RISE_METRES;
      // `roofTopAt` already counts the rises of the sections in front of it, so only the lift of odd columns is added.
      const lift = raisedBy(besidePlace) - besidePlace.inFront * SECTION_RISE_METRES;
      return beside.position.y - section.position.y + lift + coverTop;
    });
    return gablesFor(place.shape, floors);
  }

  /** Whether a finished wall or door frame stands under edge `edge`, in EDGES order, of a frame drawn turned by `place`. */
  function wallUnder(section: Section, place: RoofPlace, edge: number): boolean {
    const { axis, across } = EDGES[edge] ?? EDGES[0];
    const out = turnOffset({ x: axis === "x" ? 0 : across, z: axis === "x" ? across : 0 }, place.drawTurns);
    const side = SIDES.find((turns) => {
      const { x, z } = turnOffset({ x: 0, z: 1 }, turns);
      return Math.round(x) === Math.round(out.x) && Math.round(z) === Math.round(out.z);
    });
    return side !== undefined && edgePieceOn(entities, section.position, side) !== undefined;
  }

  /** The gable ends of a frame alone, resting on beams on every side. */
  const aloneGables = () =>
    gablesFor(
      "straight",
      gableEndFloors(coverUnderside("straight"), 0, () => FRAME_TOP_METRES),
    );

  /** Adds a frame's parts to `root` and `turned`, see-through: its two beam stages, then its rafters. Their shapes are set later. */
  function addParts(root: THREE.Group, turned: THREE.Group): Drawn["parts"] {
    return Array.from({ length: ROOF_FRAME_LOG_COST }, (_, index) => {
      const mesh = new THREE.Mesh(empty, blueprintMaterial);
      mesh.castShadow = true;
      (index < BEAM_STAGES ? root : turned).add(mesh);
      const fading = wood.clone();
      fading.transparent = true;
      return { mesh, fading };
    });
  }

  /** Gives the rafter stages of `parts` the rafters of a frame of `shape`, with tails past an eave in front where it has one. */
  function setRafters(parts: Drawn["parts"], shape: RoofShape, eaveInFront: boolean): void {
    const rafters = raftersOf(shape, eaveInFront);
    parts.forEach(({ mesh }, stage) => {
      if (stage >= BEAM_STAGES) mesh.geometry = rafters[stage - BEAM_STAGES] ?? empty;
    });
  }

  const placingBlueprint = new THREE.Group();
  placingBlueprint.visible = false;
  const placingTurned = new THREE.Group();
  placingBlueprint.add(placingTurned);
  const placingParts = addParts(placingBlueprint, placingTurned);
  const allSides: BeamPlan[] = SIDES.map((side) => ({ side, under: "doorFrame", startReach: BEAM_OVERHANG_METRES, endReach: BEAM_OVERHANG_METRES }));
  placingParts.forEach(({ mesh }, stage) => {
    if (stage < BEAM_STAGES) mesh.geometry = beamsOf(allSides, stage);
  });
  setRafters(placingParts, ALONE.shape, true);
  const placingGables = new THREE.Mesh(aloneGables(), blueprintMaterial);
  placingTurned.add(placingGables);
  group.add(placingBlueprint);

  const drawn = new Map<Entity, Drawn>();
  const pickers: THREE.Mesh[] = [];
  const blueprints = blueprintEntities(entities);
  const finished = roofFrameEntities(entities);

  function draw(entity: Entity & { position: Vec3 }): Drawn {
    const existing = drawn.get(entity);
    if (existing !== undefined) return existing;
    const root = new THREE.Group();
    const turned = new THREE.Group();
    root.add(turned);
    const parts = addParts(root, turned);
    const gables = new THREE.Mesh(aloneGables(), blueprintMaterial);
    gables.castShadow = true;
    turned.add(gables);
    const gablesFading = gablePlanks.clone();
    gablesFading.transparent = true;
    const picker = new THREE.Mesh(pickGeometry, pickMaterial);
    picker.position.y = EDGE_PIECE_HEIGHT_METRES + PICK_THICKNESS_METRES / 2;
    picker.userData.entity = entity;
    root.add(picker);
    pickers.push(picker);
    group.add(root);
    const result = { root, turned, parts, gables, gablesFading, picker };
    drawn.set(entity, result);
    return result;
  }

  /**
   * Shows how far construction has gone. Built parts are solid. The part being built stays in its place and turns solid.
   * Parts whose log has been delivered wait half solid in their places, and the rest show see-through.
   * The gable ends go up with the last rafter.
   */
  function showProgress(item: Drawn, progress: number, delivered: number): void {
    const stagesDone = progress * item.parts.length;
    item.parts.forEach(({ mesh, fading }, index) => {
      const share = Math.min(1, Math.max(0, stagesDone - index));
      if (share <= 0) {
        mesh.material = index < delivered ? deliveredMaterial : blueprintMaterial;
      } else {
        fading.opacity = deliveredOpacity(DELIVERED_OPACITY, share);
        mesh.material = fading.opacity < 1 ? fading : wood;
      }
      if (index !== item.parts.length - 1) return;
      if (share <= 0) {
        item.gables.material = mesh.material;
      } else {
        item.gablesFading.opacity = fading.opacity;
        item.gables.material = fading.opacity < 1 ? item.gablesFading : gablePlanks;
      }
    });
  }

  function forget(entity: Entity): void {
    const item = drawn.get(entity);
    if (item === undefined) return;
    group.remove(item.root);
    for (const { fading } of item.parts) fading.dispose();
    item.gablesFading.dispose();
    pickers.splice(pickers.indexOf(item.picker), 1);
    drawn.delete(entity);
  }

  const hits: THREE.Intersection[] = [];

  return {
    group,
    update(view) {
      const layout = frameLayout(entities);
      const seen = new Set<Entity>();
      const hiddenRoofs = view === undefined ? [] : roofAbove(entities, view.player);
      const show = (entity: Section, progress: number, delivered: number) => {
        const place = layout.placeAt(entity.position);
        const item = draw(entity);
        item.root.position.set(entity.position.x, entity.position.y, entity.position.z);
        item.root.visible =
          entity.blueprint !== undefined || !hiddenRoofs.some((roof) => roof.position !== undefined && isOnGridSquare(entity.position, roof.position));
        item.turned.position.y = raisedBy(place);
        item.turned.rotation.y = facingRadians(place.drawTurns);
        const beams = beamPlans(layout, entity);
        item.parts.forEach(({ mesh }, stage) => {
          if (stage < BEAM_STAGES) mesh.geometry = beamsOf(beams, stage);
        });
        // The front edge, as drawn, is the second in EDGES order.
        setRafters(item.parts, place.shape, neighboursOf(layout, entity.position, place)[1] === undefined);
        item.gables.geometry = gablesOf(layout, entity, place);
        showProgress(item, progress, delivered);
        seen.add(entity);
      };
      for (const entity of blueprints) {
        if (entity.blueprint.structure === "roofFrame") show(entity, entity.blueprint.progress, entity.blueprint.delivered.debarkedLog ?? 0);
      }
      for (const entity of finished) show(entity, 1, ROOF_FRAME_LOG_COST);
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
      return pickFinished(raycaster, pickers, isShown);
    },
    outlineOf(hit) {
      const item = drawn.get(hit.entity);
      if (item === undefined) return [];
      item.root.updateMatrixWorld(true);
      return item.parts.map(({ mesh }) => ({ geometry: mesh.geometry, matrix: mesh.matrixWorld }));
    },
    showPlacingBlueprint(shown) {
      placingBlueprint.visible = shown !== undefined;
      if (shown === undefined) return;
      const material = shown.allowed ? blueprintMaterial : notAllowedMaterial;
      for (const mesh of [...placingParts.map(({ mesh }) => mesh), placingGables]) mesh.material = material;
      placingBlueprint.position.set(shown.spot.x, shown.spot.y, shown.spot.z);
      placingTurned.rotation.y = facingRadians(shown.turns);
    },
    dispose() {
      for (const item of [
        ...[...raftersByKind.values()].flat(),
        ...beamGeometries.values(),
        ...gableGeometries.values(),
        empty,
        pickGeometry,
        wood,
        gablePlanks,
        blueprintMaterial,
        deliveredMaterial,
        notAllowedMaterial,
        pickMaterial,
      ]) {
        item.dispose();
      }
      for (const item of drawn.values()) {
        for (const { fading } of item.parts) fading.dispose();
        item.gablesFading.dispose();
      }
      for (const { fading } of placingParts) fading.dispose();
    },
  };
}

// Draws roof frames and their blueprints: the "roof-frame" asset in asset-manifest.json, built in code and approved by the owner.
// A frame is the timber skeleton of one foundation square, between the walls and the roof.
// - Beams: hewn timbers, debarked logs squared with an adze, lying level on the top of every wall and door frame on the
//   square's edges. A log wall that runs along z sits half a course lower than one along x, so its beam is hewn taller, and
//   every beam top is level. A beam reaches
//   about 0.3 m past the walls where no frame carries on beyond its end, so the join between walls and roof hides under the
//   overhang. Where two frames share an edge, only one of them lays its beam.
// - Rafters: three hewn timbers on the beams, sloping down the way the frame faces, 12 degrees, like the roof on them.
//   Frames side by side work out their heights and their hip and valley shapes from each other, as roof-layout.ts says.
//   A hip or valley has a rafter along each low edge and one corner to corner under the line where its two slopes meet.
// - Fill: where a slope rises above the beams, as at the high side of a slope, courses of split boards stacked on the beams
//   fill the gap up to the bark, their top boards cut to the slope. Beside a lower frame they rest on that frame's bark instead.
// Construction has one stage per debarked log: the beams along x, then the beams along z, then the three rafters. The fill
// goes up with the last rafter. A blueprint shows see-through. Each delivered log shows pale and half solid in its place.
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
import { roofTopAt, type RoofPlace, type RoofShape } from "./roof-layout";
import {
  BARK_THICKNESS_METRES,
  BEAM_RADIUS_METRES,
  EDGES,
  fillFloors,
  fillLogs,
  FRAME_TOP_METRES,
  frameLayout,
  hewnTimber,
  isShown,
  neighboursOf,
  RAFTER_RADIUS_METRES,
  rafterLog,
  raisedBy,
  ROOF_SEED,
  ROOF_SLOPE_RADIANS,
  SECTION_RISE_METRES,
  type FrameLayout,
  type Section,
} from "./roof-parts";
import { deliveredOpacity, facingRadians, NOT_ALLOWED_COLOUR, pickFinished, seeThrough } from "./structure-look";

const BLUEPRINT_COLOUR = 0xbfe3ff;
/** How see-through the parts of a blueprint not yet built are, from 0 (invisible) to 1 (solid). */
const BLUEPRINT_OPACITY = 0.35;
/** A delivered log waiting in its place is this solid, so it stands out from the parts still needed. */
const DELIVERED_OPACITY = 0.7;
/** A beam reaches this far past the walls where no frame carries on beyond its end, in metres. */
const BEAM_OVERHANG_METRES = 0.3;
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

/** One part of a frame: its shape, and where it rests, from the middle of the deck below. */
interface PartPlan {
  readonly geometry: THREE.BufferGeometry;
  readonly x: number;
  readonly y: number;
  readonly z: number;
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
  /** Holds the rafters and fill, turned the way the frame is drawn and raised to its height. The beams stay level, in `root`. */
  readonly turned: THREE.Group;
  /** The shape its rafters were made for. A frame whose shape changes is drawn again. */
  readonly shape: RoofShape;
  /** One part for each stage of construction, in order, each with its own see-through copy of the wood for fading in. */
  readonly parts: { mesh: THREE.Mesh; fading: THREE.MeshStandardMaterial; plan: PartPlan }[];
  /** The logs that fill the gaps between the beams and the roof. They go up with the last rafter. */
  readonly fill: THREE.Mesh;
  readonly picker: THREE.Mesh;
}

export function createRoofFrameMeshes(entities: EntityStore): RoofFrameMeshes {
  const group = new THREE.Group();
  const random = seededRandom(ROOF_SEED);
  const jitter = (size: number) => (random() * 2 - 1) * size;
  const pickGeometry = new THREE.BoxGeometry(BUILD_GRID_METRES, PICK_THICKNESS_METRES, BUILD_GRID_METRES);
  const wood = new THREE.MeshStandardMaterial({ color: DEBARKED_LOG_COLOUR, flatShading: true, vertexColors: true });
  const blueprintMaterial = seeThrough(BLUEPRINT_COLOUR, BLUEPRINT_OPACITY);
  const deliveredMaterial = seeThrough(DEBARKED_LOG_COLOUR, DELIVERED_OPACITY);
  const notAllowedMaterial = seeThrough(NOT_ALLOWED_COLOUR, BLUEPRINT_OPACITY);
  const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });
  const empty = new THREE.BufferGeometry();

  const rafterY = FRAME_TOP_METRES + RAFTER_RADIUS_METRES;
  // The rafters rest on the beam over the front wall, at z = +half a square, and rise towards the back.
  const rise = (z: number) => (BUILD_GRID_METRES / 2 - z) * Math.tan(ROOF_SLOPE_RADIANS);
  const rafterCount = ROOF_FRAME_LOG_COST - BEAM_STAGES;
  const straightRafters: readonly PartPlan[] = Array.from({ length: rafterCount }, (_, i) => {
    const z = jitter(0.03);
    return {
      geometry: rafterLog(jitter).rotateX(ROOF_SLOPE_RADIANS),
      x: -BUILD_GRID_METRES / 2 + RAFTER_RADIUS_METRES + (i * (BUILD_GRID_METRES - 2 * RAFTER_RADIUS_METRES)) / Math.max(1, rafterCount - 1),
      y: rafterY + rise(z),
      z,
    };
  });

  /** The rafters of each shape, made once and shared. The corner rafters are made only when a frame first needs them. */
  const raftersByShape = new Map<RoofShape, readonly PartPlan[]>([["straight", straightRafters]]);
  function raftersOf(shape: RoofShape): readonly PartPlan[] {
    const known = raftersByShape.get(shape);
    if (known !== undefined) return known;
    const made = cornerRafters(shape === "hip" ? "hip" : "valley");
    raftersByShape.set(shape, made);
    return made;
  }

  /**
   * The rafters of a hip or valley, drawn sloping down to +z and +x, in the order construction adds them: one along each low
   * edge, and one corner to corner under the line where the slopes meet.
   */
  function cornerRafters(shape: "hip" | "valley"): PartPlan[] {
    const cornerRandom = seededRandom(ROOF_SEED + (shape === "hip" ? 2 : 3));
    const wobble = (size: number) => (cornerRandom() * 2 - 1) * size;
    const half = BUILD_GRID_METRES / 2;
    // On a hip, the slope down to +z covers the part left of its meeting line, and the slope down to +x the part right of it.
    const edgeRafter = (turns: QuarterTurns, side: number): PartPlan => {
      const z = wobble(0.03);
      const geometry = rafterLog(wobble).rotateX(ROOF_SLOPE_RADIANS).rotateY(facingRadians(turns));
      const offset = turnOffset({ x: side * (half - RAFTER_RADIUS_METRES), z }, turns);
      return { geometry, x: offset.x, y: rafterY + rise(z), z: offset.z };
    };
    const downZ = edgeRafter(0, shape === "hip" ? -1 : 1);
    // The rafter under the meeting line runs corner to corner, from the high corner at -x -z down to the low one at +x +z.
    const diagonal = rafterLog(wobble, Math.SQRT2 * BUILD_GRID_METRES)
      .rotateX(Math.atan(Math.tan(ROOF_SLOPE_RADIANS) / Math.SQRT2))
      .rotateY(Math.PI / 4);
    const downX = edgeRafter(3, shape === "hip" ? 1 : -1);
    return [downZ, { geometry: diagonal, x: 0, y: rafterY + rise(0), z: 0 }, downX];
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

  /** The fill for each shape and set of edge heights, made once and shared. */
  const fills = new Map<string, THREE.BufferGeometry>();
  function fillFor(shape: RoofShape, floors: readonly (number | undefined)[]): THREE.BufferGeometry {
    const name = `${shape}:${floors.map((floor) => floor?.toFixed(3) ?? "-").join(",")}`;
    const known = fills.get(name);
    if (known !== undefined) return known;
    const logs = fillLogs(shape, floors);
    const geometry = logs.length === 0 ? empty : mergeGeometries(logs);
    for (const log of logs) log.dispose();
    fills.set(name, geometry);
    return geometry;
  }

  /**
   * The fill of a frame, from what is under its edges: a lower roof beside it, or else its own beams.
   * The fill logs rest on a lower roof's bark and reach up to this frame's roof. An edge with neither a frame beside it nor a
   * wall under it gets no fill, since nothing holds it up and the side is open anyway.
   */
  function fillOf(layout: FrameLayout, section: Section, place: RoofPlace): THREE.BufferGeometry {
    const neighbours = neighboursOf(layout, section.position, place);
    const world = (x: number, z: number) => {
      const offset = turnOffset({ x, z }, place.drawTurns);
      return { x: section.position.x + offset.x, z: section.position.z + offset.z };
    };
    const floors = fillFloors(place.shape, raisedBy(place), (edge, x, z) => {
      const beside = neighbours[edge];
      if (beside === undefined) return wallUnder(section, place, edge) ? FRAME_TOP_METRES : Number.POSITIVE_INFINITY;
      const besidePlace = layout.placeAt(beside.position);
      const barkTop =
        FRAME_TOP_METRES + 2 * RAFTER_RADIUS_METRES + BARK_THICKNESS_METRES + roofTopAt(besidePlace, beside.position, world(x, z)) * SECTION_RISE_METRES;
      // `roofTopAt` already counts the rises of the sections in front of it, so only the lift of odd columns is added.
      const lift = raisedBy(besidePlace) - besidePlace.inFront * SECTION_RISE_METRES;
      return beside.position.y - section.position.y + lift + barkTop;
    });
    return fillFor(place.shape, floors);
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

  /** The fill of a frame alone, resting on beams on every side. */
  const aloneFill = () =>
    fillFor(
      "straight",
      fillFloors("straight", 0, () => FRAME_TOP_METRES),
    );

  /** Adds a frame's parts to `root` and `turned`, see-through: its two beam stages, then its rafters. */
  function addParts(root: THREE.Group, turned: THREE.Group, shape: RoofShape): Drawn["parts"] {
    const beams = Array.from({ length: BEAM_STAGES }, (): PartPlan => ({ geometry: empty, x: 0, y: 0, z: 0 }));
    return [...beams, ...raftersOf(shape)].map((plan, index) => {
      const mesh = new THREE.Mesh(plan.geometry, blueprintMaterial);
      mesh.castShadow = true;
      mesh.position.set(plan.x, plan.y, plan.z);
      (index < BEAM_STAGES ? root : turned).add(mesh);
      const fading = wood.clone();
      fading.transparent = true;
      return { mesh, fading, plan };
    });
  }

  const placingBlueprint = new THREE.Group();
  placingBlueprint.visible = false;
  const placingTurned = new THREE.Group();
  placingBlueprint.add(placingTurned);
  const placingParts = addParts(placingBlueprint, placingTurned, "straight");
  const allSides: BeamPlan[] = SIDES.map((side) => ({ side, under: "doorFrame", startReach: BEAM_OVERHANG_METRES, endReach: BEAM_OVERHANG_METRES }));
  placingParts.forEach(({ mesh }, stage) => {
    if (stage < BEAM_STAGES) mesh.geometry = beamsOf(allSides, stage);
  });
  const placingFill = new THREE.Mesh(aloneFill(), blueprintMaterial);
  placingTurned.add(placingFill);
  group.add(placingBlueprint);

  const drawn = new Map<Entity, Drawn>();
  const pickers: THREE.Mesh[] = [];
  const blueprints = blueprintEntities(entities);
  const finished = roofFrameEntities(entities);

  function draw(entity: Entity & { position: Vec3 }, shape: RoofShape): Drawn {
    const existing = drawn.get(entity);
    if (existing?.shape === shape) return existing;
    if (existing !== undefined) forget(entity);
    const root = new THREE.Group();
    const turned = new THREE.Group();
    root.add(turned);
    const parts = addParts(root, turned, shape);
    const fill = new THREE.Mesh(aloneFill(), blueprintMaterial);
    fill.castShadow = true;
    turned.add(fill);
    const picker = new THREE.Mesh(pickGeometry, pickMaterial);
    picker.position.y = EDGE_PIECE_HEIGHT_METRES + PICK_THICKNESS_METRES / 2;
    picker.userData.entity = entity;
    root.add(picker);
    pickers.push(picker);
    group.add(root);
    const result = { root, turned, shape, parts, fill, picker };
    drawn.set(entity, result);
    return result;
  }

  /**
   * Shows how far construction has gone. Built parts are solid. The part being built stays in its place and turns solid.
   * Parts whose log has been delivered wait half solid in their places, and the rest show see-through.
   */
  function showProgress(item: Drawn, progress: number, delivered: number): void {
    const stagesDone = progress * item.parts.length;
    item.parts.forEach(({ mesh, fading, plan }, index) => {
      const share = Math.min(1, Math.max(0, stagesDone - index));
      if (share <= 0) {
        mesh.material = index < delivered ? deliveredMaterial : blueprintMaterial;
        mesh.position.y = plan.y;
      } else {
        fading.opacity = deliveredOpacity(DELIVERED_OPACITY, share);
        mesh.material = fading.opacity < 1 ? fading : wood;
        mesh.position.y = plan.y;
      }
      // The fill goes up with the last rafter.
      if (index === item.parts.length - 1) {
        item.fill.material = mesh.material;
        item.fill.position.y = mesh.position.y - plan.y;
      }
    });
  }

  function forget(entity: Entity): void {
    const item = drawn.get(entity);
    if (item === undefined) return;
    group.remove(item.root);
    for (const { fading } of item.parts) fading.dispose();
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
        const item = draw(entity, place.shape);
        item.root.position.set(entity.position.x, entity.position.y, entity.position.z);
        item.root.visible =
          entity.blueprint !== undefined || !hiddenRoofs.some((roof) => roof.position !== undefined && isOnGridSquare(entity.position, roof.position));
        item.turned.position.y = raisedBy(place);
        item.turned.rotation.y = facingRadians(place.drawTurns);
        const beams = beamPlans(layout, entity);
        item.parts.forEach(({ mesh }, stage) => {
          if (stage < BEAM_STAGES) mesh.geometry = beamsOf(beams, stage);
        });
        item.fill.geometry = fillOf(layout, entity, place);
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
      for (const mesh of [...placingParts.map(({ mesh }) => mesh), placingFill]) mesh.material = material;
      placingBlueprint.position.set(shown.spot.x, shown.spot.y, shown.spot.z);
      placingTurned.rotation.y = facingRadians(shown.turns);
    },
    dispose() {
      for (const item of [
        ...[...raftersByShape.values()].flatMap((rafters) => rafters.map(({ geometry }) => geometry)),
        ...beamGeometries.values(),
        ...fills.values(),
        empty,
        pickGeometry,
        wood,
        blueprintMaterial,
        deliveredMaterial,
        notAllowedMaterial,
        pickMaterial,
      ]) {
        item.dispose();
      }
      for (const item of drawn.values()) for (const { fading } of item.parts) fading.dispose();
      for (const { fading } of placingParts) fading.dispose();
    },
  };
}

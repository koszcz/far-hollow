// Draws roof frames and their blueprints: the "roof-frame" asset in asset-manifest.json, built in code and approved by the owner.
// A frame is the timber skeleton of one foundation square, between the walls and the roof.
// - Beams: hewn timbers, debarked logs squared with an adze, lying level on the top of every wall and door frame on the
//   square's edges. A log wall that runs along z sits half a course lower than one along x, so its beam is hewn taller, and
//   every beam top is level. A beam reaches
//   about 0.15 m past the walls where no frame carries on beyond its end, so the join between walls and roof hides under the
//   overhang. Where two frames share an edge, only one of them lays its beam.
// - Rafters: three hewn timbers on the beams, sloping down the way the frame faces, 35 degrees, like the roof on them.
//   Frames side by side work out their heights and their valleys from each other, as roof-layout.ts says. Where the front
//   of a frame is an eave, its rafters reach on past the wall, under the roof's overhang. Both ends of a rafter are cut
//   upright. Where two frames slope away from each other, their rafters meet in pegged pairs over a hewn ridge pole, which
//   the frame sloping down to +z or +x lays with its last rafter. On a roof an odd number of squares wide, the middle
//   frame is a ridge section's: each of its three rafters is a pair, rising from its front and back edges to a ridge pole
//   along its middle. The beams are a shade darker than the wall logs. A valley has a rafter along each
//   low edge and one corner to corner under the line where its two slopes meet.
// - Gable ends: where a slope rises above the beams, as at each end of a ridge or the high side of a shed roof, stacked
//   debarked logs stand on the beams and close the gap up to the roof (gable-end-shape.ts). Beside a lower roof, as where a taller
//   wing stands beside a lower one, they stand on that roof's planks instead.
// Construction has one stage per debarked log: the beams along x, then the beams along z, then the three rafters. The gable
// ends go up with the last rafter. A blueprint shows see-through. Each delivered log shows pale and half solid in its place.
// The part being built stays in its place and turns from half solid to solid, like the logs of a foundation.
// In the cutaway and walls down wall modes, the roof frames fade away with the roofs, so the player sees inside (cabin-cutaway.ts).
// A hidden frame still casts its shadow, as the roof does.
// While the player places a frame from the build menu, a see-through copy follows the mouse. It turns red where it is not allowed.
import * as THREE from "three";
import { isOnGridSquare } from "../sim/build-grid";
import { type Entity, type EntityStore, type Vec3 } from "../sim/entities";
import { blueprintEntities, roofFrameEntities } from "../sim/entity-queries";
import { quarterTurnsToRadians, type QuarterTurns } from "../sim/quarter-turns";
import { ROOF_FRAME_LOG_COST } from "../sim/structure-cabin-shell";
import { DEBARKED_LOG_COLOUR } from "./debarked-log-shape";
import type { OutlinePart } from "./hover-outline";
import { ALONE, type RoofShape } from "./roof-layout";
import { BEAM_STAGES, createRoofFrameGeometries, type Eaves } from "./roof-frame-geometry";
import { frameLayout, hideKeepingShadow, raisedBy, neighboursOf, type FrameLayout, type Section } from "./roof-parts";
import { deliveredOpacity, NOT_ALLOWED_COLOUR, pickFinished, seeThrough } from "./structure-look";
import { createCutawayFades, showFading } from "./cutaway-fade";

const BLUEPRINT_COLOUR = 0xbfe3ff;
/** How see-through the parts of a blueprint not yet built are, from 0 (invisible) to 1 (solid). */
const BLUEPRINT_OPACITY = 0.35;
/** A delivered log waiting in its place is this solid, so it stands out from the parts still needed. */
const DELIVERED_OPACITY = 0.7;
/** The beams are hewn from older, darker logs than the walls, so they read as their own part: their colour is the log colour times this. */
const BEAM_SHADE = 0.8;

/** What a click on a frame blueprint landed on. Finished frames are not clicked this way. */
export type RoofFrameHit = { kind: "blueprint"; entity: Entity };

export interface RoofFrameMeshes {
  readonly group: THREE.Group;
  /**
   * Brings every roof frame and frame blueprint up to date with game state.
   * Finished frames under the roof sections in `hiddenRoofs`, or among them, fade away, but still cast their shadows.
   * `nowSeconds` is the time of this frame. Without it, a frame hides or shows at once.
   */
  update(hiddenRoofs?: readonly Entity[], nowSeconds?: number): void;
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

interface Drawn {
  readonly root: THREE.Group;
  /** Holds the rafters and gable ends, turned the way the frame is drawn and raised to its height. The beams stay level, in `root`. */
  readonly turned: THREE.Group;
  /** One part for each stage of construction, in order, each with its wood when built and a see-through copy of it for fading in. */
  readonly parts: { mesh: THREE.Mesh; solid: THREE.MeshStandardMaterial; fading: THREE.MeshStandardMaterial }[];
  /** The ridge pole and its pegs, where the frame lays one. It goes up with the last rafter. */
  readonly ridge: THREE.Mesh;
  /** The log gable ends between the beams and the roof. They go up with the last rafter. */
  readonly gables: THREE.Mesh;
  /** A see-through copy of the gable logs' material, for fading them in. */
  readonly gablesFading: THREE.MeshStandardMaterial;
  readonly picker: THREE.Mesh;
}

export function createRoofFrameMeshes(entities: EntityStore): RoofFrameMeshes {
  const group = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: DEBARKED_LOG_COLOUR, flatShading: true, vertexColors: true });
  const beamWood = wood.clone();
  beamWood.color.multiplyScalar(BEAM_SHADE);
  const gableLogs = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, vertexColors: true });
  const blueprintMaterial = seeThrough(BLUEPRINT_COLOUR, BLUEPRINT_OPACITY);
  const deliveredMaterial = seeThrough(DEBARKED_LOG_COLOUR, DELIVERED_OPACITY);
  const notAllowedMaterial = seeThrough(NOT_ALLOWED_COLOUR, BLUEPRINT_OPACITY);
  // The surface that catches clicks is seen from above and below, so it is two-sided.
  const pickMaterial = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
  const shapes = createRoofFrameGeometries(entities);
  const { empty } = shapes;

  /** Adds a frame's parts to `root` and `turned`, see-through: its two beam stages, then its rafters. Their shapes are set later. */
  function addParts(root: THREE.Group, turned: THREE.Group): Drawn["parts"] {
    return Array.from({ length: ROOF_FRAME_LOG_COST }, (_, index) => {
      const mesh = new THREE.Mesh(empty, blueprintMaterial);
      mesh.castShadow = true;
      (index < BEAM_STAGES ? root : turned).add(mesh);
      const solid = index < BEAM_STAGES ? beamWood : wood;
      const fading = solid.clone();
      fading.transparent = true;
      return { mesh, solid, fading };
    });
  }

  /** Gives the rafter stages of `parts` the rafters of a frame of `shape`, with tails past the eaves `eaves` names. */
  function setRafters(parts: Drawn["parts"], shape: RoofShape, eaves: Eaves): void {
    const rafters = shapes.raftersOf(shape, eaves);
    parts.forEach(({ mesh }, stage) => {
      if (stage >= BEAM_STAGES) mesh.geometry = rafters[stage - BEAM_STAGES] ?? empty;
    });
  }

  const drawn = new Map<Entity, Drawn>();
  const fades = createCutawayFades();
  const pickers: THREE.Mesh[] = [];
  const blueprints = blueprintEntities(entities);
  const finished = roofFrameEntities(entities);

  /** Makes the meshes of one frame and adds them to the group. Their shapes are set later. */
  function makeDrawn(): Drawn {
    const root = new THREE.Group();
    const turned = new THREE.Group();
    root.add(turned);
    const parts = addParts(root, turned);
    const gables = new THREE.Mesh(shapes.aloneGables(), blueprintMaterial);
    gables.castShadow = true;
    turned.add(gables);
    const ridge = new THREE.Mesh(empty, blueprintMaterial);
    ridge.castShadow = true;
    turned.add(ridge);
    const gablesFading = gableLogs.clone();
    gablesFading.transparent = true;
    // The picker turns and rises with the rafters, and takes their shape each update.
    const picker = new THREE.Mesh(shapes.pickSurfaceOf(ALONE.shape), pickMaterial);
    turned.add(picker);
    group.add(root);
    return { root, turned, parts, ridge, gables, gablesFading, picker };
  }

  function draw(entity: Section): Drawn {
    const existing = drawn.get(entity);
    if (existing !== undefined) return existing;
    const result = makeDrawn();
    result.picker.userData.entity = entity;
    pickers.push(result.picker);
    drawn.set(entity, result);
    return result;
  }

  /** Gives a frame's meshes the shape its place in `layout` sets: its height, turn, beams, rafters, gable ends, and ridge pole. */
  function shapeFrame(item: Drawn, layout: FrameLayout, entity: Section): void {
    const place = layout.placeAt(entity.position);
    item.root.position.set(entity.position.x, entity.position.y, entity.position.z);
    item.turned.position.y = raisedBy(place);
    item.turned.rotation.y = quarterTurnsToRadians(place.drawTurns);
    const beams = shapes.beamPlans(layout, entity);
    item.parts.forEach(({ mesh }, stage) => {
      if (stage < BEAM_STAGES) mesh.geometry = shapes.beamsOf(beams, stage);
    });
    // The back and front edges, as drawn, are the first and second in EDGES order.
    const [back, front] = neighboursOf(layout, entity.position, place);
    setRafters(item.parts, place.shape, { front: front === undefined, back: back === undefined });
    item.picker.geometry = shapes.pickSurfaceOf(place.shape);
    item.gables.geometry = shapes.gablesOf(layout, entity, place);
    const ridge = shapes.ridgeReach(layout, entity, place);
    item.ridge.geometry = ridge === undefined ? empty : shapes.ridgeOf(place.shape, ridge.start, ridge.end);
  }

  /** The frame blueprint under the mouse while the player places one. It is laid out with the other frames, so it shows the shape it will take. */
  const placing = makeDrawn();
  placing.root.visible = false;

  /**
   * Shows how far construction has gone. Built parts are solid. The part being built stays in its place and turns solid.
   * Parts whose log has been delivered wait half solid in their places, and the rest show see-through.
   * The ridge pole and the gable ends go up with the last rafter.
   */
  function showProgress(item: Drawn, progress: number, delivered: number): void {
    const stagesDone = progress * item.parts.length;
    item.parts.forEach(({ mesh, solid, fading }, index) => {
      const share = Math.min(1, Math.max(0, stagesDone - index));
      if (share <= 0) {
        mesh.material = index < delivered ? deliveredMaterial : blueprintMaterial;
      } else {
        fading.opacity = deliveredOpacity(DELIVERED_OPACITY, share);
        mesh.material = fading.opacity < 1 ? fading : solid;
      }
      if (index !== item.parts.length - 1) return;
      item.ridge.material = mesh.material;
      if (share <= 0) {
        item.gables.material = mesh.material;
      } else {
        item.gablesFading.opacity = fading.opacity;
        item.gables.material = fading.opacity < 1 ? item.gablesFading : gableLogs;
      }
    });
  }

  /**
   * Shows a frame at fade `level`, from 0, as built, to 1, gone. A fully faded frame is drawn only into shadows.
   * While it fades, every part shows see-through: the beams, rafters, ridge pole, and gable ends.
   */
  function showFade(item: Drawn, level: number): void {
    hideKeepingShadow(item.root, level >= 1);
    if (level <= 0 || level >= 1) return;
    for (const { mesh, fading } of item.parts) {
      showFading(fading, 1 - level);
      mesh.material = fading;
    }
    const last = item.parts[item.parts.length - 1];
    if (last !== undefined) item.ridge.material = last.fading;
    showFading(item.gablesFading, 1 - level);
    item.gables.material = item.gablesFading;
  }

  function forget(entity: Entity): void {
    const item = drawn.get(entity);
    if (item === undefined) return;
    group.remove(item.root);
    for (const { fading } of item.parts) fading.dispose();
    item.gablesFading.dispose();
    pickers.splice(pickers.indexOf(item.picker), 1);
    drawn.delete(entity);
    fades.forget(entity);
  }

  const hits: THREE.Intersection[] = [];

  return {
    group,
    update(hiddenRoofs = [], nowSeconds) {
      const layout = frameLayout(entities);
      const seen = new Set<Entity>();
      const show = (entity: Section, progress: number, delivered: number) => {
        const item = draw(entity);
        shapeFrame(item, layout, entity);
        showProgress(item, progress, delivered);
        const hidden =
          entity.blueprint === undefined && hiddenRoofs.some((roof) => roof.position !== undefined && isOnGridSquare(entity.position, roof.position));
        showFade(item, fades.level(entity, hidden, nowSeconds));
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
      return pickFinished(raycaster, pickers);
    },
    outlineOf(hit) {
      const item = drawn.get(hit.entity);
      if (item === undefined) return [];
      item.root.updateMatrixWorld(true);
      return item.parts.map(({ mesh }) => ({ geometry: mesh.geometry, matrix: mesh.matrixWorld }));
    },
    showPlacingBlueprint(shown) {
      placing.root.visible = shown !== undefined;
      if (shown === undefined) return;
      const section: Section = {
        position: shown.spot,
        facing: { turns: shown.turns },
        blueprint: { structure: "roofFrame", progress: 0, materialsSpent: 0, delivered: {} },
      };
      shapeFrame(placing, frameLayout(entities, section), section);
      const material = shown.allowed ? blueprintMaterial : notAllowedMaterial;
      for (const mesh of [...placing.parts.map(({ mesh }) => mesh), placing.ridge, placing.gables]) mesh.material = material;
    },
    dispose() {
      shapes.dispose();
      for (const item of [wood, beamWood, gableLogs, blueprintMaterial, deliveredMaterial, notAllowedMaterial, pickMaterial]) {
        item.dispose();
      }
      for (const item of drawn.values()) {
        for (const { fading } of item.parts) fading.dispose();
        item.gablesFading.dispose();
      }
      for (const { fading } of placing.parts) fading.dispose();
      placing.gablesFading.dispose();
    },
  };
}

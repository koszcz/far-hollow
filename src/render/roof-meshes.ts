// Draws cabin roof sections and their blueprints: the "roof" asset in asset-manifest.json, built in code and approved by the owner.
// A roof section is the planks laid on the roof frame of one foundation square (roof-frame-meshes.ts), the same planks the
// sawhorse cuts. They are grey and weathered, and lie in 6 overlapping rows across the slope, from the eaves up. Each row
// is short planks of different widths side by side, running down the slope, with a thin gap between them. Each square
// lays them in one of a few layouts, so squares side by side differ. Their lower ends are ragged and
// staggered, and each plank lies a little less steep than the roof, so its lower end lifts over the row below and every
// row casts a clear shadow line. The roof slopes 35 degrees the way its frame does, and sits where its frame's layout puts
// it, as roof-layout.ts works out: sections one behind another share one slope, two rows that slope away from each other
// meet at a ridge, and a wing that ends against another meets it in valleys. At a ridge, the planks of the slope down to
// +z or +x reach a little past it, over the other slope. On a roof an odd number of squares wide, the middle section is a
// ridge section: two half slopes, each with 6 rows from its edge up to the ridge along its middle. A valley (the approved "roof-corners" asset) has two dark valley boards in
// its gutter, one on each slope. The planks on both slopes stop a hand's width short of the line where the slopes meet,
// cut a little ragged, so the boards show between them.
// The planks reach a little past the square's edges where a section is beside it, so the sections overlap. Where an edge
// has none, the planks reach 0.5 m past the outside of the wall, over the eaves, the gable ends, and the high side of a shed.
// Construction has one stage per plank, and lays one row each stage. A blueprint shows see-through. The row being laid fades
// in above its place, is lowered, and set down, like the logs of a foundation.
// In the cutaway and walls down wall modes, every cabin roof fades away over a moment, so the player sees inside (cabin-cutaway.ts, cutaway-fade.ts).
// A hidden roof still casts its shadow, so the room under it stays dark except where daylight comes in through a window or doorway.
// While the player places a roof from the build menu, a see-through copy follows the mouse, sloping the way the frame under it
// does. It turns red where it is not allowed.
import * as THREE from "three";
import { type Entity, type EntityStore, type Vec3 } from "../sim/entities";
import { blueprintEntities, cabinRoofEntities } from "../sim/entity-queries";
import { quarterTurnsToRadians, type QuarterTurns } from "../sim/quarter-turns";
import type { OutlinePart } from "./hover-outline";
import { ALONE, type RoofShape } from "./roof-layout";
import { frameLayout, hideKeepingShadow, neighboursOf, raisedBy, roofPickSurface, shapeHeight, type Section } from "./roof-parts";
import { buildLift, buildOpacity, NOT_ALLOWED_COLOUR, pickFinished, seeThrough } from "./structure-look";
import { ROOF_SNOW, type SnowCoverLook } from "./snow-cover-look";
import { COVER_BASE_METRES, layoutOf, plankReach, plankRows, PLANK_THICKNESS_METRES, ROWS, type Reach } from "./roof-plank-geometry";
import { createCutawayFades, showFading } from "./cutaway-fade";

const BLUEPRINT_COLOUR = 0xbfe3ff;
/** How see-through the parts of a blueprint not yet built are, from 0 (invisible) to 1 (solid). */
const BLUEPRINT_OPACITY = 0.35;

/** What a click on a roof blueprint landed on. Finished roofs are not clicked. */
export type RoofHit = { kind: "blueprint"; entity: Entity };

export interface RoofMeshes {
  readonly group: THREE.Group;
  /**
   * Brings every roof section and roof blueprint up to date with game state.
   * Finished sections in `hidden` fade away, but still cast their shadows: the roofs the wall mode hides.
   * `nowSeconds` is the time of this frame. Without it, a section hides or shows at once.
   */
  update(hidden?: readonly Entity[], nowSeconds?: number): void;
  /** What a ray from the camera hits first among roof blueprints, and how far away. */
  pick(raycaster: THREE.Raycaster): { hit: RoofHit; distance: number } | undefined;
  /** The finished piece the ray meets first, with how far away it is, or undefined if it meets none. The action menu uses it. */
  pickFinished(raycaster: THREE.Raycaster): { entity: Entity; distance: number } | undefined;
  /** The parts of a roof blueprint, placed in the world. Empty once it is gone. */
  outlineOf(hit: RoofHit): OutlinePart[];
  /**
   * Shows a roof blueprint under the mouse over the deck at `spot`, sloping down the way `turns` faces, red where it is not
   * allowed. Undefined hides it.
   */
  showPlacingBlueprint(placingBlueprint: { spot: Vec3; turns: QuarterTurns; allowed: boolean } | undefined): void;
  dispose(): void;
}

interface Drawn {
  readonly root: THREE.Group;
  /** One row of planks for each stage of construction, in order, each with its own see-through copy of the plank material for fading in. */
  readonly parts: { mesh: THREE.Mesh; fading: THREE.MeshStandardMaterial }[];
  readonly picker: THREE.Mesh;
}

/** `snow`, if given, lays snow on the finished roofs. */
export function createRoofMeshes(entities: EntityStore, snow?: SnowCoverLook): RoofMeshes {
  const group = new THREE.Group();
  const planks = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, vertexColors: true });
  // The see-through copies made from it below keep no snow: they show only while a roof is built or faded.
  const plankFading = planks.clone();
  snow?.cover(planks, ROOF_SNOW);
  const blueprintMaterial = seeThrough(BLUEPRINT_COLOUR, BLUEPRINT_OPACITY);
  const notAllowedMaterial = seeThrough(NOT_ALLOWED_COLOUR, BLUEPRINT_OPACITY);
  // The surface that catches clicks is seen from above and below, so it is two-sided.
  const pickMaterial = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
  /** The surface that catches clicks on a section of each shape, along the tops of its planks, made once and shared. */
  const pickSurfaces = new Map<RoofShape, THREE.BufferGeometry>();
  function pickSurfaceOf(shape: RoofShape): THREE.BufferGeometry {
    const known = pickSurfaces.get(shape);
    if (known !== undefined) return known;
    const made = roofPickSurface((x, z) => COVER_BASE_METRES + PLANK_THICKNESS_METRES + shapeHeight(shape, x, z));
    pickSurfaces.set(shape, made);
    return made;
  }

  /** The rows of each shape, reach past its edges, and layout, made once and shared. */
  const rowsByKind = new Map<string, readonly THREE.BufferGeometry[]>();
  function rowsOf(shape: RoofShape, reach: Reach, layout: number): readonly THREE.BufferGeometry[] {
    const name = `${shape}:${reach.back},${reach.front},${reach.left},${reach.right}:${layout}`;
    const known = rowsByKind.get(name);
    if (known !== undefined) return known;
    const made = plankRows(shape, reach, layout);
    rowsByKind.set(name, made);
    return made;
  }

  /** Adds a row of planks for each stage of a roof section to `root`, see-through. Their shapes are set later. */
  function addParts(root: THREE.Group): Drawn["parts"] {
    return Array.from({ length: ROWS }, () => {
      const mesh = new THREE.Mesh(undefined, blueprintMaterial);
      mesh.castShadow = true;
      root.add(mesh);
      const fading = plankFading.clone();
      fading.transparent = true;
      return { mesh, fading };
    });
  }

  function setRows(parts: Drawn["parts"], shape: RoofShape, reach: Reach, layout = 0): void {
    const rows = rowsOf(shape, reach, layout);
    parts.forEach(({ mesh }, index) => {
      const row = rows[index];
      if (row !== undefined) mesh.geometry = row;
    });
  }

  const placingBlueprint = new THREE.Group();
  placingBlueprint.visible = false;
  const placingParts = addParts(placingBlueprint);
  setRows(placingParts, ALONE.shape, plankReach(ALONE, [undefined, undefined, undefined, undefined]));
  group.add(placingBlueprint);

  const drawn = new Map<Entity, Drawn>();
  const fades = createCutawayFades();
  const pickers: THREE.Mesh[] = [];
  const blueprints = blueprintEntities(entities);
  const finished = cabinRoofEntities(entities);

  function draw(entity: Section): Drawn {
    const existing = drawn.get(entity);
    if (existing !== undefined) return existing;
    const root = new THREE.Group();
    const parts = addParts(root);
    // The picker takes the section's shape each update.
    const picker = new THREE.Mesh(pickSurfaceOf(ALONE.shape), pickMaterial);
    picker.userData.entity = entity;
    root.add(picker);
    pickers.push(picker);
    group.add(root);
    const result = { root, parts, picker };
    drawn.set(entity, result);
    return result;
  }

  /** Shows how far construction has gone. Laid rows are solid and in place, the row being laid moves through its stage, and the rest show see-through. */
  function showProgress(item: Drawn, progress: number): void {
    const stagesDone = progress * item.parts.length;
    item.parts.forEach(({ mesh, fading }, index) => {
      const share = Math.min(1, Math.max(0, stagesDone - index));
      if (share <= 0) {
        mesh.material = blueprintMaterial;
        mesh.position.y = 0;
      } else {
        fading.opacity = buildOpacity(share);
        mesh.material = fading.opacity < 1 ? fading : planks;
        mesh.position.y = buildLift(share);
      }
    });
  }

  /**
   * Shows a section at fade `level`, from 0, as built, to 1, gone. A fully faded section is drawn only into shadows.
   * While it fades, every row shows see-through.
   */
  function showFade(item: Drawn, level: number): void {
    hideKeepingShadow(item.root, level >= 1);
    if (level <= 0 || level >= 1) return;
    for (const { mesh, fading } of item.parts) {
      showFading(fading, 1 - level);
      mesh.material = fading;
    }
  }

  function forget(entity: Entity): void {
    const item = drawn.get(entity);
    if (item === undefined) return;
    group.remove(item.root);
    for (const { fading } of item.parts) fading.dispose();
    pickers.splice(pickers.indexOf(item.picker), 1);
    drawn.delete(entity);
    fades.forget(entity);
  }

  const hits: THREE.Intersection[] = [];

  return {
    group,
    update(hiddenRoof = [], nowSeconds) {
      const layout = frameLayout(entities);
      const seen = new Set<Entity>();
      const hidden = new Set(hiddenRoof);
      const show = (entity: Section, progress: number, hidden: boolean) => {
        // A roof sits where the frame under it does, and takes its shape.
        const place = layout.placeAt(entity.position);
        const item = draw(entity);
        item.root.position.set(entity.position.x, entity.position.y + raisedBy(place), entity.position.z);
        item.root.rotation.y = quarterTurnsToRadians(place.drawTurns);
        const beside = neighboursOf(layout, entity.position, place).map((one) => (one === undefined ? undefined : layout.placeAt(one.position)));
        setRows(item.parts, place.shape, plankReach(place, beside), place.shape === "valley" ? 0 : layoutOf(entity.position));
        item.picker.geometry = pickSurfaceOf(place.shape);
        showProgress(item, progress);
        showFade(item, fades.level(entity, hidden, nowSeconds));
        seen.add(entity);
      };
      for (const entity of blueprints) if (entity.blueprint.structure === "roof") show(entity, entity.blueprint.progress, false);
      for (const entity of finished) show(entity, 1, hidden.has(entity));
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
      placingBlueprint.visible = shown !== undefined;
      if (shown === undefined) return;
      const material = shown.allowed ? blueprintMaterial : notAllowedMaterial;
      for (const { mesh } of placingParts) mesh.material = material;
      // A roof takes the shape and height of the frame under it, so the blueprint shows the shape the roof will take.
      const layout = frameLayout(entities);
      const place = layout.sectionAt(shown.spot) === undefined ? { ...ALONE, drawTurns: shown.turns } : layout.placeAt(shown.spot);
      const beside = neighboursOf(layout, shown.spot, place).map((one) => (one === undefined ? undefined : layout.placeAt(one.position)));
      setRows(placingParts, place.shape, plankReach(place, beside), place.shape === "valley" ? 0 : layoutOf(shown.spot));
      placingBlueprint.position.set(shown.spot.x, shown.spot.y + raisedBy(place), shown.spot.z);
      placingBlueprint.rotation.y = quarterTurnsToRadians(place.drawTurns);
    },
    dispose() {
      for (const item of [
        ...[...rowsByKind.values()].flat(),
        ...pickSurfaces.values(),
        planks,
        plankFading,
        blueprintMaterial,
        notAllowedMaterial,
        pickMaterial,
      ])
        item.dispose();
      for (const item of drawn.values()) for (const { fading } of item.parts) fading.dispose();
      for (const { fading } of placingParts) fading.dispose();
    },
  };
}

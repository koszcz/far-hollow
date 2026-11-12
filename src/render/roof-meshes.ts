// Draws cabin roof sections and their blueprints: the "roof" asset in asset-manifest.json, a draft built in code (ticket 11).
// A roof section is the planks laid on the roof frame of one foundation square (roof-frame-meshes.ts), the same planks the
// sawhorse cuts. They are grey and weathered, and lie in 6 overlapping rows across the slope, from the eaves up. Each row
// is short planks side by side, running down the slope, with a thin gap between them. Their lower ends are ragged and
// staggered, and each plank lies a little less steep than the roof, so its lower end lifts over the row below and every
// row casts a clear shadow line. The roof slopes 35 degrees the way its frame does, and sits where its frame's layout puts
// it, as roof-layout.ts works out: sections one behind another share one slope, two rows that slope away from each other
// meet at a ridge, and a wing that ends against another meets it in valleys. At a ridge, the planks of the slope down to
// +z or +x reach a little past it, over the other slope. A valley (the "roof-corners" draft) has planks on both its slopes,
// each cut along the line where they meet and reaching a little past it, so each slope tucks under the other.
// The planks reach a little past the square's edges where a section is beside it, so the sections overlap. Where an edge
// has none, the planks reach 0.5 m past the outside of the wall, over the eaves, the gable ends, and the high side of a shed.
// Construction has one stage per plank, and lays one row each stage. A blueprint shows see-through. The row being laid fades
// in above its place, is lowered, and set down, like the logs of a foundation.
// When the player stands under a cabin roof, that roof and every section joined to it hide, so the player stays in view.
// While the player places a roof from the build menu, a see-through copy follows the mouse, sloping the way the frame under it
// does. It turns red where it is not allowed.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { BUILD_GRID_METRES } from "../sim/build-grid";
import { blueprintEntities, cabinRoofEntities, type Entity, type EntityStore, type Vec3 } from "../sim/entities";
import type { QuarterTurns } from "../sim/structure-kind";
import { roofAbove } from "../sim/roofs";
import { ROOF_PLANK_COST } from "../sim/structures";
import type { OutlinePart } from "./hover-outline";
import { seededRandom } from "./lean-to-meshes";
import { ALONE, type RoofPlace, type RoofShape } from "./roof-layout";
import {
  EAVE_REACH_METRES,
  FRAME_TOP_METRES,
  frameLayout,
  isShown,
  neighboursOf,
  PLANK_GAP_METRES,
  PLANK_WIDTH_METRES,
  RAFTER_RADIUS_METRES,
  raisedBy,
  ROOF_SEED,
  ROOF_SLOPE_RADIANS,
  shapeHeight,
  WEATHERED_PLANK_COLOURS,
  type Section,
} from "./roof-parts";
import { buildLift, buildOpacity, facingRadians, NOT_ALLOWED_COLOUR, pickFinished, seeThrough } from "./structure-look";

const BLUEPRINT_COLOUR = 0xbfe3ff;
/** How see-through the parts of a blueprint not yet built are, from 0 (invisible) to 1 (solid). */
const BLUEPRINT_OPACITY = 0.35;
/** How many rows of planks a section has: one for each plank it costs, laid one per stage. */
const ROWS = ROOF_PLANK_COST;
/** How thick a plank is, in metres. */
const PLANK_THICKNESS_METRES = 0.02;
/** Each plank is this much longer than its row's share of the slope, so the rows overlap. */
const ROW_OVERLAP = 1.6;
/** Each plank lies this much less steep than the roof, in radians, so its lower end lifts over the row below it. */
const PLANK_KICK_RADIANS = 0.06;
/** How far the lower ends of planks side by side are staggered up and down the slope, at most, in metres. */
const STAGGER_METRES = 0.035;
/** How far each corner of a plank's lower end is torn ragged, at most, in metres. */
const RAGGED_METRES = 0.012;
/** The lower end of a plank is this much darker than the rest, worn by the weather. */
const WORN_END_SHARE = 0.82;
/** The planks reach this far past an edge with a section beside it, in metres, so the two overlap. */
const NEIGHBOUR_LAP_METRES = 0.06;
/** At a ridge, the planks of the slope down to +z or +x reach this far past it, in metres, over the other slope. */
const RIDGE_LAP_METRES = 0.07;
/** Valley planks reach this far past the line where the two slopes meet, in metres, so the slopes lap. */
const VALLEY_LAP_METRES = 0.06;
/** In a valley, the planks on the slope down to +x lie this much higher, in metres, so the two slopes do not flicker. */
const VALLEY_FACE_LIFT_METRES = 0.006;
/** How thick the invisible slab that catches clicks on a blueprint is, in metres. */
const PICK_THICKNESS_METRES = 0.3;

/** What a click on a roof blueprint landed on. Finished roofs are not clicked. */
export type RoofHit = { kind: "blueprint"; entity: Entity };

export interface RoofMeshes {
  readonly group: THREE.Group;
  /**
   * Brings every roof section and roof blueprint up to date with game state.
   * Finished sections above the player standing at `player` hide. Without it, nothing hides.
   */
  update(view?: { player: Vec3 }): void;
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

/** How far the planks reach past each edge of a section, drawn unturned, in metres: back (-z), front (+z), left (-x), and right (+x). */
interface Reach {
  readonly back: number;
  readonly front: number;
  readonly left: number;
  readonly right: number;
}

interface Drawn {
  readonly root: THREE.Group;
  /** One row of planks for each stage of construction, in order, each with its own see-through copy of the plank material for fading in. */
  readonly parts: { mesh: THREE.Mesh; fading: THREE.MeshStandardMaterial }[];
  readonly picker: THREE.Mesh;
}

/** The underside of the planks above the deck where the roof is lowest, in metres: on the rafters. */
const COVER_BASE_METRES = FRAME_TOP_METRES + 2 * RAFTER_RADIUS_METRES;

/**
 * The rows of planks of a section of `shape`, drawn unturned, reaching past its edges as `reach` says, from the eaves up.
 * Each is one shape coloured per plank. Draw them with `vertexColors: true`, `flatShading: true`, and the material colour white.
 */
export function plankRows(shape: RoofShape, reach: Reach): THREE.BufferGeometry[] {
  const half = BUILD_GRID_METRES / 2;
  if (shape === "straight") {
    const random = seededRandom(ROOF_SEED);
    return Array.from({ length: ROWS }, (_, row) =>
      slopeRow(row, { x0: -half - reach.left, x1: half + reach.right, z0: -half - reach.back, z1: half + reach.front }, random),
    );
  }
  // A valley: the slope down to +z covers the part of the square right of the line x = z, and the slope down to +x the
  // part left of it. Each is laid like a straight section, the one down to +x turned a quarter round to face +x.
  const random = seededRandom(ROOF_SEED + 5);
  return Array.from({ length: ROWS }, (_, row) => {
    const alongZ = slopeRow(row, { x0: -half - reach.left, x1: half + reach.right, z0: -half - reach.back, z1: half + reach.front }, random);
    const alongX = slopeRow(row, { x0: -half - reach.front, x1: half + reach.back, z0: -half - reach.left, z1: half + reach.right }, random)
      .rotateY(facingRadians(3))
      .translate(0, VALLEY_FACE_LIFT_METRES, 0);
    // Cut each slope along the line where they meet, a little past it. Moving a point across its own slope keeps its height.
    clip(alongZ, (x, z) => ({ x: Math.max(x, z - VALLEY_LAP_METRES), z }));
    clip(alongX, (x, z) => ({ x, z: Math.max(z, x - VALLEY_LAP_METRES) }));
    const geometry = mergeGeometries([alongZ, alongX]);
    alongZ.dispose();
    alongX.dispose();
    return geometry;
  });
}

/** Moves every corner of `geometry` across the ground as `to` says, keeping its height. */
function clip(geometry: THREE.BufferGeometry, to: (x: number, z: number) => { x: number; z: number }): void {
  const positions = geometry.getAttribute("position");
  for (let v = 0; v < positions.count; v += 1) {
    const moved = to(positions.getX(v), positions.getZ(v));
    positions.setX(v, moved.x);
    positions.setZ(v, moved.z);
  }
  geometry.computeVertexNormals();
}

/**
 * Row `row` of planks, counted from the front, on a slope down to +z covering x0 to x1 across and z0 (the high back) to z1
 * (the low front), as one shape. The planks of each row reach up under the row above. The top row stops at the back.
 */
function slopeRow(row: number, area: { x0: number; x1: number; z0: number; z1: number }, random: () => number): THREE.BufferGeometry {
  const jitter = (size: number) => (random() * 2 - 1) * size;
  const share = (area.z1 - area.z0) / ROWS;
  const low = area.z1 - row * share;
  const high = Math.max(area.z0, low - share * ROW_OVERLAP);
  const count = Math.ceil((area.x1 - area.x0) / PLANK_WIDTH_METRES);
  const width = (area.x1 - area.x0) / count;
  const planks = Array.from({ length: count }, (_, i) => {
    const middle = area.x0 + (i + 0.5) * width;
    return plank(middle, width - PLANK_GAP_METRES, high, low + jitter(STAGGER_METRES), jitter);
  });
  const geometry = mergeGeometries(planks);
  for (const one of planks) one.dispose();
  return geometry;
}

/**
 * One plank lying down the slope, `width` wide, its middle at `x`, from `high` at the back to `low` at the front, along z.
 * Its lower end is torn ragged and darker. It lies a little less steep than the roof, its upper end on the rafters.
 */
function plank(x: number, width: number, high: number, low: number, jitter: (size: number) => number): THREE.BufferGeometry {
  const run = low - high;
  const length = run / Math.cos(ROOF_SLOPE_RADIANS);
  const geometry = new THREE.BoxGeometry(width + jitter(0.006), PLANK_THICKNESS_METRES, length);
  const positions = geometry.getAttribute("position");
  // Tear the lower end, at +z: each of its two corners, top and bottom face alike, sits a different way along the plank.
  const tears = [jitter(RAGGED_METRES), jitter(RAGGED_METRES)];
  for (let v = 0; v < positions.count; v += 1) {
    if (positions.getZ(v) > 0) positions.setZ(v, positions.getZ(v) + (tears[positions.getX(v) < 0 ? 0 : 1] ?? 0));
  }
  const colour = new THREE.Color(WEATHERED_PLANK_COLOURS[Math.floor((jitter(1) + 1) * 2.5) % WEATHERED_PLANK_COLOURS.length] ?? WEATHERED_PLANK_COLOURS[0]);
  colour.multiplyScalar(1 + jitter(0.06));
  const worn = colour.clone().multiplyScalar(WORN_END_SHARE);
  const colours = new Float32Array(positions.count * 3);
  for (let v = 0; v < positions.count; v += 1) {
    const one = positions.getZ(v) > length / 2 - 0.05 ? worn : colour;
    colours.set([one.r, one.g, one.b], v * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  geometry.rotateX(ROOF_SLOPE_RADIANS - PLANK_KICK_RADIANS + jitter(0.01));
  geometry.rotateY(jitter(0.012));
  const middle = (high + low) / 2;
  // Lift it so its upper end rests on the rafters, and its lower end stands clear of the row below.
  const y = COVER_BASE_METRES + shapeHeight("straight", 0, middle) + PLANK_THICKNESS_METRES / 2 + (length / 2) * Math.sin(PLANK_KICK_RADIANS);
  geometry.translate(x + jitter(0.004), y, middle);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * How far the planks of a section placed at `place` reach past each edge, from the sections beside it.
 * `neighbours` are the places of the sections beside each edge in EDGES order (back, front, left, right), undefined where there are none.
 */
export function plankReach(place: RoofPlace, neighbours: readonly (RoofPlace | undefined)[]): Reach {
  const [back, front, left, right] = neighbours;
  const side = (beside: RoofPlace | undefined) => (beside === undefined ? EAVE_REACH_METRES : NEIGHBOUR_LAP_METRES);
  // Behind a section is the one above it on the same slope, which laps over it, or the other slope of a ridge.
  const ridge = back !== undefined && (back.drawTurns - place.drawTurns + 4) % 4 === 2;
  const lapsRidge = place.drawTurns === 0 || place.drawTurns === 3;
  return {
    back: back === undefined ? EAVE_REACH_METRES : ridge && lapsRidge ? RIDGE_LAP_METRES : 0,
    front: side(front),
    left: side(left),
    right: side(right),
  };
}

export function createRoofMeshes(entities: EntityStore): RoofMeshes {
  const group = new THREE.Group();
  const pickGeometry = new THREE.BoxGeometry(BUILD_GRID_METRES, PICK_THICKNESS_METRES, BUILD_GRID_METRES);
  const planks = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, vertexColors: true });
  const blueprintMaterial = seeThrough(BLUEPRINT_COLOUR, BLUEPRINT_OPACITY);
  const notAllowedMaterial = seeThrough(NOT_ALLOWED_COLOUR, BLUEPRINT_OPACITY);
  const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });

  /** The rows of each shape and reach past its edges, made once and shared. */
  const rowsByKind = new Map<string, readonly THREE.BufferGeometry[]>();
  function rowsOf(shape: RoofShape, reach: Reach): readonly THREE.BufferGeometry[] {
    const name = `${shape}:${reach.back},${reach.front},${reach.left},${reach.right}`;
    const known = rowsByKind.get(name);
    if (known !== undefined) return known;
    const made = plankRows(shape, reach);
    rowsByKind.set(name, made);
    return made;
  }

  /** Adds a row of planks for each stage of a roof section to `root`, see-through. Their shapes are set later. */
  function addParts(root: THREE.Group): Drawn["parts"] {
    return Array.from({ length: ROWS }, () => {
      const mesh = new THREE.Mesh(undefined, blueprintMaterial);
      mesh.castShadow = true;
      root.add(mesh);
      const fading = planks.clone();
      fading.transparent = true;
      return { mesh, fading };
    });
  }

  function setRows(parts: Drawn["parts"], shape: RoofShape, reach: Reach): void {
    const rows = rowsOf(shape, reach);
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
  const pickers: THREE.Mesh[] = [];
  const blueprints = blueprintEntities(entities);
  const finished = cabinRoofEntities(entities);

  function draw(entity: Section): Drawn {
    const existing = drawn.get(entity);
    if (existing !== undefined) return existing;
    const root = new THREE.Group();
    const parts = addParts(root);
    const picker = new THREE.Mesh(pickGeometry, pickMaterial);
    picker.position.y = COVER_BASE_METRES + PICK_THICKNESS_METRES / 2;
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
      const hidden = new Set(view === undefined ? [] : roofAbove(entities, view.player));
      const show = (entity: Section, progress: number, visible: boolean) => {
        // A roof sits where the frame under it does, and takes its shape.
        const place = layout.placeAt(entity.position);
        const item = draw(entity);
        item.root.position.set(entity.position.x, entity.position.y + raisedBy(place), entity.position.z);
        item.root.rotation.y = facingRadians(place.drawTurns);
        item.root.visible = visible;
        const beside = neighboursOf(layout, entity.position, place).map((one) => (one === undefined ? undefined : layout.placeAt(one.position)));
        setRows(item.parts, place.shape, plankReach(place, beside));
        showProgress(item, progress);
        seen.add(entity);
      };
      for (const entity of blueprints) if (entity.blueprint.structure === "roof") show(entity, entity.blueprint.progress, true);
      for (const entity of finished) show(entity, 1, !hidden.has(entity));
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
      for (const { mesh } of placingParts) mesh.material = material;
      placingBlueprint.position.set(shown.spot.x, shown.spot.y, shown.spot.z);
      placingBlueprint.rotation.y = facingRadians(shown.turns);
    },
    dispose() {
      for (const item of [...[...rowsByKind.values()].flat(), pickGeometry, planks, blueprintMaterial, notAllowedMaterial, pickMaterial]) item.dispose();
      for (const item of drawn.values()) for (const { fading } of item.parts) fading.dispose();
      for (const { fading } of placingParts) fading.dispose();
    },
  };
}

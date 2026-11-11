// Draws cabin roof sections and their blueprints: the "roof" asset in asset-manifest.json, approved, built in code.
// A roof section covers one foundation square at the top of the walls. Debarked-log rafters with pale cut ends run across
// the square, and curled, ragged strips of bark, like the lean-to's, lie over them like shingles. The bark reaches a little
// past the square's edges, so the sections beside it overlap. The roof slopes down to the front (+z) to shed rain.
// Sections one behind another, finished or planned, share one slope: each sits higher by the rise of the sections in front
// of it. The front section's rafters rest on the top of the front wall. Where a section's side or back has no section
// beside it, debarked logs stacked on the wall fill the gap up to the bark, their top logs cut to the slope, so no gap is
// left for rain or wind. Each strip of bark is laid a little less steep than the roof, so its ragged lower edge lifts over
// the strip below it, in the same section or the one in front. The bark carries a grain painted in code: streaks along
// its length, a few deep cracks, and a knot here and there, so it reads as bark and not as brown boards.
// Construction has one stage per log, then one per strip of bark: the rafters go up first, then the bark covers them.
// A blueprint shows see-through. Each debarked log the player has delivered shows pale and half solid in its place.
// The part being built fades in above its place, is lowered, and set down, like the logs of a foundation.
// When the player stands under a cabin roof, that roof and every section joined to it hide, so the player stays in view.
// While the player places a roof from the build menu, a see-through copy follows the mouse. It turns red where it is not allowed.
import * as THREE from "three";
import { BUILD_GRID_METRES } from "../sim/build-grid";
import { blueprintEntities, cabinRoofEntities, type Entity, type EntityStore, type Vec3 } from "../sim/entities";
import { roofAbove } from "../sim/roofs";
import { ROOF_BARK_COST, ROOF_LOG_COST } from "../sim/structures";
import { BUILD_FADE_SHARE, buildLift } from "./campfire-meshes";
import { DEBARKED_LOG_COLOUR, DEBARKED_LOG_CUT_COLOUR } from "./debarked-log-shape";
import { EDGE_PIECE_HEIGHT_METRES } from "./edge-piece-meshes";
import type { OutlinePart } from "./hover-outline";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { BARK_COLOURS, barkStrip, seededRandom } from "./lean-to-meshes";

const BLUEPRINT_COLOUR = 0xbfe3ff;
/** How see-through the parts of a blueprint not yet built are, from 0 (invisible) to 1 (solid). */
const BLUEPRINT_OPACITY = 0.35;
/** A delivered log waiting in its place is this solid, so it stands out from the parts still needed. */
const DELIVERED_OPACITY = 0.7;
/** A blueprint under the mouse shows in this red where its spot is not allowed. */
const NOT_ALLOWED_COLOUR = 0xe0614f;
const RAFTER_RADIUS_METRES = 0.07;
/** A rafter is this much thinner at one end than the other, in metres, like a log from a young tree. */
const RAFTER_TAPER_METRES = 0.012;
/** A rafter has this many flat sides, like the other debarked logs. */
const RAFTER_SIDES = 7;
/** The rafters reach this far past the walls at the front and back, in metres. */
const RAFTER_OVERHANG_METRES = 0.12;
/** The bark reaches this far past each side of the square, in metres, so the sections beside it overlap. */
const BARK_OVERHANG_METRES = 0.1;
const BARK_THICKNESS_METRES = 0.04;
/** Each bark strip is this much longer than its share of the roof, so the strips overlap like shingles. */
const BARK_OVERLAP = 1.75;
/**
 * Roof bark is pressed flatter than the lean-to's and trimmed neater, so the roof reads as one tight cover:
 * its edges curl up this far, its lower edge frays this far, and it wavers this far, in metres.
 */
const ROOF_BARK_SHAPE = { curl: 0.01, fray: 0.025, waver: 0.004 };
/** The bark grain is painted this many pixels wide and high. One picture covers this many metres of bark along and across. */
const GRAIN_PIXELS = { wide: 512, high: 256 };
const GRAIN_METRES = { along: 0.6, across: 0.3 };
/** Each bark strip lies this much less steep than the roof, in radians, so its lower edge lifts over the strip below it. */
const BARK_KICK_RADIANS = 0.04;
/** Each bark strip lies this much above the rafters, in metres, so its tilted upper edge stays clear of them. */
const BARK_LIFT_METRES = 0.012;
/** The logs that fill the gaps between the walls and the roof are this thick, like the logs of a log wall, in metres. */
const FILL_RADIUS_METRES = 0.1;
/** A fill log is cut into this many lengths, so its top can follow the slope of the roof. */
const FILL_LENGTHS = 12;
/** How steeply each roof section slopes down to the front, in radians. */
const ROOF_SLOPE_RADIANS = THREE.MathUtils.degToRad(12);
/** All roof sections share this seed, so they all have the same ragged bark and crooked rafters, and line up. */
const ROOF_SEED = 20261112;
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
  /** The parts of a roof blueprint, placed in the world. Empty once it is gone. */
  outlineOf(hit: RoofHit): OutlinePart[];
  /** Shows a roof blueprint under the mouse over the deck at `spot`, red where it is not allowed. Undefined hides it. */
  showPreview(preview: { spot: Vec3; allowed: boolean } | undefined): void;
  dispose(): void;
}

/** One part of a roof section: its shape, its finished material, and where it rests, from the middle of the deck below. */
interface PartPlan {
  readonly geometry: THREE.BufferGeometry;
  readonly wood: THREE.MeshStandardMaterial;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

interface Drawn {
  readonly root: THREE.Group;
  /** One part for each stage of construction, in order, each with its own see-through copy of its material for fading in. */
  readonly parts: { mesh: THREE.Mesh; fading: THREE.MeshStandardMaterial; plan: PartPlan }[];
  /** The logs that fill the gaps under its open sides and back. They go up with the last rafter. */
  readonly fill: THREE.Mesh;
  readonly picker: THREE.Mesh;
}

/** Where a roof section sits in the slope it shares with the sections in front of and behind it. */
interface SlopePlace {
  /** How many sections lie one behind another in front of this one. */
  readonly inFront: number;
  /** Whether no section lies behind this one, so logs fill the gap between the back wall and the roof. */
  readonly backmost: boolean;
  /** Whether no section lies beside this one on its left (-x) or right (+x), so logs fill the gap there. */
  readonly leftOpen: boolean;
  readonly rightOpen: boolean;
  /** Whether this section sits in an odd column, so it lies a little higher and its bark laps over its neighbours'. */
  readonly oddColumn: boolean;
}

const ALONE: SlopePlace = { inFront: 0, backmost: true, leftOpen: true, rightOpen: true, oddColumn: false };
/**
 * Sections in odd columns lie this much higher, in metres. Bark that overlaps a neighbour's at the same height flickers,
 * because the screen cannot tell which is on top.
 */
const ODD_COLUMN_LIFT_METRES = 0.012;

export function createRoofMeshes(entities: EntityStore): RoofMeshes {
  const group = new THREE.Group();
  const random = seededRandom(ROOF_SEED);
  const jitter = (size: number) => (random() * 2 - 1) * size;
  const pickGeometry = new THREE.BoxGeometry(BUILD_GRID_METRES, PICK_THICKNESS_METRES, BUILD_GRID_METRES);
  const woodMaterial = new THREE.MeshStandardMaterial({ color: DEBARKED_LOG_COLOUR, flatShading: true, vertexColors: true });
  const grain = paintBarkGrain(seededRandom(ROOF_SEED + 1));
  const barkMaterials = BARK_COLOURS.map((color) => new THREE.MeshStandardMaterial({ color, flatShading: true, vertexColors: true, map: grain }));
  const see = (color: number, opacity: number) => new THREE.MeshStandardMaterial({ color, transparent: true, opacity, depthWrite: false });
  const blueprintMaterial = see(BLUEPRINT_COLOUR, BLUEPRINT_OPACITY);
  const deliveredMaterial = see(DEBARKED_LOG_COLOUR, DELIVERED_OPACITY);
  const notAllowedMaterial = see(NOT_ALLOWED_COLOUR, BLUEPRINT_OPACITY);
  const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });

  const rafterY = EDGE_PIECE_HEIGHT_METRES + RAFTER_RADIUS_METRES;
  const barkY = EDGE_PIECE_HEIGHT_METRES + 2 * RAFTER_RADIUS_METRES + BARK_THICKNESS_METRES / 2;
  // The rafters rest on the top of the front wall, at z = +half a square, and rise towards the back.
  const frontWallZ = BUILD_GRID_METRES / 2;
  const rise = (z: number) => (frontWallZ - z) * Math.tan(ROOF_SLOPE_RADIANS);
  // Strips of bark run along x, side by side down the slope, from the front of the roof up to the back.
  const barkSpan = BUILD_GRID_METRES + 2 * BARK_OVERHANG_METRES;
  const stripShare = barkSpan / ROOF_BARK_COST;
  const stripLength = (stripShare / Math.cos(ROOF_SLOPE_RADIANS)) * BARK_OVERLAP;
  /** The parts each stage adds, in order: the rafters, then the strips of bark. */
  const STAGES: readonly PartPlan[] = [
    ...Array.from({ length: ROOF_LOG_COST }, (_, i) => {
      const z = jitter(0.03);
      return {
        geometry: rafterLog(jitter).rotateX(ROOF_SLOPE_RADIANS),
        wood: woodMaterial,
        x: -BUILD_GRID_METRES / 2 + RAFTER_RADIUS_METRES + (i * (BUILD_GRID_METRES - 2 * RAFTER_RADIUS_METRES)) / Math.max(1, ROOF_LOG_COST - 1),
        y: rafterY + rise(z),
        z,
      };
    }),
    ...Array.from({ length: ROOF_BARK_COST }, (_, i) => {
      // A bark strip is made with its ragged lower edge at -z. Turned round, that edge points down the slope, to the front,
      // and laps over the strip laid before it.
      const geometry = barkStrip(barkSpan + jitter(0.03), stripLength, i % BARK_COLOURS.length, jitter, ROOF_BARK_SHAPE);
      spreadGrain(geometry, barkSpan, stripLength, jitter);
      geometry.rotateY(Math.PI + jitter(0.01));
      geometry.rotateZ(jitter(0.006));
      geometry.rotateX(ROOF_SLOPE_RADIANS - BARK_KICK_RADIANS);
      const z = barkSpan / 2 - (i + 0.5) * stripShare;
      return {
        geometry,
        wood: barkMaterials[i % barkMaterials.length] ?? woodMaterial,
        x: jitter(0.01),
        y: barkY + BARK_LIFT_METRES + rise(z),
        z,
      };
    }),
  ];

/** One section's rise over the section in front of it, in metres. */
  const sectionRise = BUILD_GRID_METRES * Math.tan(ROOF_SLOPE_RADIANS);
  /** The underside of the bark at `z`, in a section's own frame. The fill logs reach up to it. */
  const barkUnderside = (z: number) => EDGE_PIECE_HEIGHT_METRES + 2 * RAFTER_RADIUS_METRES + rise(z);
  /** The fill for each kind of place, made once and shared. */
  const fills = new Map<string, THREE.BufferGeometry>();

  const drawn = new Map<Entity, Drawn>();
  const pickers: THREE.Mesh[] = [];
  const blueprints = blueprintEntities(entities);
  const finished = cabinRoofEntities(entities);

  /**
   * The logs that fill the gaps between the walls and the roof, for a section at `place`. A section `inFront` sections back
   * sits that many rises up, so the wall tops are that much lower in its own frame.
   */
  function fillFor(place: SlopePlace): THREE.BufferGeometry {
    const name = `${place.inFront},${place.backmost},${place.leftOpen},${place.rightOpen}`;
    const known = fills.get(name);
    if (known !== undefined) return known;
    const wallTop = EDGE_PIECE_HEIGHT_METRES - place.inFront * sectionRise;
    const logs: THREE.BufferGeometry[] = [];
    const half = BUILD_GRID_METRES / 2;
    // The back logs run along x on the back wall. Each side's logs run along z on its wall, and the backmost section's
    // reach past the back to meet the back logs at the corner.
    if (place.backmost) {
      const from = -half - (place.leftOpen ? FILL_RADIUS_METRES : 0);
      const to = half + (place.rightOpen ? FILL_RADIUS_METRES : 0);
      logs.push(...fillStack(wallTop, barkUnderside(-half), (bottom) => cutLog(bottom, from, to, "x", -half, barkUnderside)));
    }
    for (const [open, x] of [[place.leftOpen, -half], [place.rightOpen, half]] as const) {
      if (!open) continue;
      const back = -half - (place.backmost ? FILL_RADIUS_METRES : 0);
      logs.push(...fillStack(wallTop, barkUnderside(back), (bottom) => {
        // The log stops where the bark comes down to its bottom.
        const front = Math.min(half, frontWallZ - (bottom - EDGE_PIECE_HEIGHT_METRES - 2 * RAFTER_RADIUS_METRES) / Math.tan(ROOF_SLOPE_RADIANS));
        return front > back ? cutLog(bottom, back, front, "z", x, barkUnderside) : undefined;
      }));
    }
    const geometry = logs.length === 0 ? new THREE.BufferGeometry() : mergeGeometries(logs);
    for (const log of logs) log.dispose();
    fills.set(name, geometry);
    return geometry;
  }

  /** Adds every part of a roof section to `root`, see-through. */
  function addParts(root: THREE.Group): Drawn["parts"] {
    return STAGES.map((plan) => {
      const mesh = new THREE.Mesh(plan.geometry, blueprintMaterial);
      mesh.castShadow = true;
      mesh.position.set(plan.x, plan.y, plan.z);
      root.add(mesh);
      const fading = plan.wood.clone();
      fading.transparent = true;
      return { mesh, fading, plan };
    });
  }

  const preview = new THREE.Group();
  preview.visible = false;
  const previewParts = addParts(preview);
  const previewFill = new THREE.Mesh(fillFor(ALONE), blueprintMaterial);
  preview.add(previewFill);
  group.add(preview);

  function draw(entity: Entity & { position: Vec3 }): Drawn {
    const existing = drawn.get(entity);
    if (existing !== undefined) return existing;
    const root = new THREE.Group();
    const parts = addParts(root);
    const fill = new THREE.Mesh(fillFor(ALONE), blueprintMaterial);
    fill.castShadow = true;
    root.add(fill);
    const picker = new THREE.Mesh(pickGeometry, pickMaterial);
    picker.position.y = EDGE_PIECE_HEIGHT_METRES + PICK_THICKNESS_METRES / 2;
    picker.userData.entity = entity;
    root.add(picker);
    pickers.push(picker);
    group.add(root);
    const result = { root, parts, fill, picker };
    drawn.set(entity, result);
    return result;
  }

  /**
   * Shows how far construction has gone. Built parts are solid and in place, the part being built moves through its stage,
   * rafters whose log has been delivered wait half solid in their places, and the rest show see-through.
   */
  function showProgress(item: Drawn, progress: number, delivered: number, place: SlopePlace): void {
    const stagesDone = progress * item.parts.length;
    item.root.position.y += place.inFront * sectionRise + (place.oddColumn ? ODD_COLUMN_LIFT_METRES : 0);
    item.fill.geometry = fillFor(place);
    item.parts.forEach(({ mesh, fading, plan }, index) => {
      const share = Math.min(1, Math.max(0, stagesDone - index));
      if (share <= 0) {
        mesh.material = index < Math.min(delivered, ROOF_LOG_COST) ? deliveredMaterial : blueprintMaterial;
        mesh.position.y = plan.y;
      } else {
        fading.opacity = Math.min(1, share / BUILD_FADE_SHARE);
        mesh.material = fading.opacity < 1 ? fading : plan.wood;
        mesh.position.y = plan.y + buildLift(share);
      }
      // The fill goes up with the last rafter.
      if (index === ROOF_LOG_COST - 1) {
        item.fill.material = mesh.material;
        item.fill.position.y = mesh.position.y - plan.y;
      }
    });
  }

  /** Where each section, finished or planned, sits in the slope it shares with the sections in front and behind. */
  function slopePlaces(sections: readonly (Entity & { position: Vec3 })[]): Map<Entity, SlopePlace> {
    const key = (column: number, row: number) => `${column},${row}`;
    const cell = (value: number) => Math.floor(value / BUILD_GRID_METRES + 0.25);
    const taken = new Set(sections.map(({ position }) => key(cell(position.x), cell(position.z))));
    const places = new Map<Entity, SlopePlace>();
    for (const section of sections) {
      const column = cell(section.position.x);
      const row = cell(section.position.z);
      let inFront = 0;
      while (taken.has(key(column, row + inFront + 1))) inFront += 1;
      places.set(section, {
        inFront,
        backmost: !taken.has(key(column, row - 1)),
        leftOpen: !taken.has(key(column - 1, row)),
        rightOpen: !taken.has(key(column + 1, row)),
        oddColumn: Math.abs(column) % 2 === 1,
      });
    }
    return places;
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
      const seen = new Set<Entity>();
      const roofBlueprints = [...blueprints].filter((entity) => entity.blueprint.piece === "roof");
      const places = slopePlaces([...roofBlueprints, ...finished]);
      for (const entity of roofBlueprints) {
        const item = draw(entity);
        item.root.position.set(entity.position.x, entity.position.y, entity.position.z);
        item.root.visible = true;
        showProgress(item, entity.blueprint.progress, entity.blueprint.delivered.debarkedLog ?? 0, places.get(entity) ?? ALONE);
        seen.add(entity);
      }
      const hidden = new Set(view === undefined ? [] : roofAbove(entities, view.player));
      for (const entity of finished) {
        const item = draw(entity);
        item.root.position.set(entity.position.x, entity.position.y, entity.position.z);
        item.root.visible = !hidden.has(entity);
        showProgress(item, 1, ROOF_LOG_COST, places.get(entity) ?? ALONE);
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
      return item.parts.map(({ mesh }) => ({ geometry: mesh.geometry, matrix: mesh.matrixWorld }));
    },
    showPreview(shown) {
      preview.visible = shown !== undefined;
      if (shown === undefined) return;
      const material = shown.allowed ? blueprintMaterial : notAllowedMaterial;
      for (const mesh of [...previewParts.map(({ mesh }) => mesh), previewFill]) mesh.material = material;
      preview.position.set(shown.spot.x, shown.spot.y, shown.spot.z);
    },
    dispose() {
      for (const item of [
        ...STAGES.map(({ geometry }) => geometry), ...fills.values(), pickGeometry, woodMaterial, ...barkMaterials, blueprintMaterial, deliveredMaterial, notAllowedMaterial,
        pickMaterial,
      ]) {
        item.dispose();
      }
      grain?.dispose();
      for (const item of drawn.values()) for (const { fading } of item.parts) fading.dispose();
      for (const { fading } of previewParts) fading.dispose();
    },
  };
}

/**
 * One rafter: a debarked log lying along z, faceted and a little tapered, with pale cut ends.
 * It carries a colour per corner, so draw it with `vertexColors: true` and the material colour set to the log colour.
 */
function rafterLog(jitter: (size: number) => number): THREE.BufferGeometry {
  const length = BUILD_GRID_METRES + 2 * RAFTER_OVERHANG_METRES + jitter(0.04);
  const thick = RAFTER_RADIUS_METRES + jitter(0.006);
  const geometry = new THREE.CylinderGeometry(thick - RAFTER_TAPER_METRES, thick, length, RAFTER_SIDES, 1)
    .rotateY(random01(jitter) * Math.PI)
    .rotateX(Math.PI / 2 + jitter(0.015))
    .rotateY(jitter(0.03));
  // After the turn onto its side, the cut ends face along z.
  return paleLog(geometry, (normal) => Math.abs(normal.z));
}

/**
 * Colours a debarked log's corners: its cut ends pale, where `endness` of a corner's normal is near 1, and its sides plain.
 * Draw it with `vertexColors: true` and the material colour set to the log colour.
 */
function paleLog(geometry: THREE.BufferGeometry, endness: (normal: THREE.Vector3) => number): THREE.BufferGeometry {
  const normals = geometry.getAttribute("normal");
  const side = new THREE.Color(1, 1, 1);
  const log = new THREE.Color(DEBARKED_LOG_COLOUR);
  const cutColour = new THREE.Color(DEBARKED_LOG_CUT_COLOUR);
  const cut = new THREE.Color(cutColour.r / log.r, cutColour.g / log.g, cutColour.b / log.b);
  const colours = new Float32Array(normals.count * 3);
  const normal = new THREE.Vector3();
  for (let i = 0; i < normals.count; i += 1) {
    const colour = endness(normal.fromBufferAttribute(normals, i)) > 0.9 ? cut : side;
    colours.set([colour.r, colour.g, colour.b], i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  return geometry;
}


/** A number from 0 up to 1, from a jitter that gives numbers from -size to size. */
function random01(jitter: (size: number) => number): number {
  return (jitter(1) + 1) / 2;
}

/**
 * Stacks fill logs from `bottom` up to `top`. `log` makes the log whose bottom is at a height, or nothing if it would not fit.
 */
function fillStack(
  bottom: number, top: number, log: (bottom: number) => THREE.BufferGeometry | undefined,
): THREE.BufferGeometry[] {
  const logs: THREE.BufferGeometry[] = [];
  for (let at = bottom; at < top - 0.005; at += 2 * FILL_RADIUS_METRES) {
    const made = log(at);
    if (made !== undefined) logs.push(made);
  }
  return logs;
}

/**
 * A fill log resting at height `bottom`, running along `axis` from `from` to `to`, its middle at `across` on the other axis.
 * Its top is cut down to the bark's underside, so the top log of a stack fills the gap under the slope exactly.
 */
function cutLog(
  bottom: number, from: number, to: number, axis: "x" | "z", across: number, ceiling: (z: number) => number,
): THREE.BufferGeometry {
  const geometry = new THREE.CylinderGeometry(FILL_RADIUS_METRES, FILL_RADIUS_METRES, to - from, RAFTER_SIDES, FILL_LENGTHS);
  // The cylinder stands along y. Lay it along its axis.
  if (axis === "x") geometry.rotateZ(Math.PI / 2);
  else geometry.rotateX(Math.PI / 2);
  const middle = (from + to) / 2;
  geometry.translate(axis === "x" ? middle : across, bottom + FILL_RADIUS_METRES, axis === "x" ? across : middle);
  const positions = geometry.getAttribute("position");
  for (let i = 0; i < positions.count; i += 1) {
    positions.setY(i, Math.max(bottom, Math.min(positions.getY(i), ceiling(positions.getZ(i)))));
  }
  geometry.computeVertexNormals();
  return paleLog(geometry, (normal) => Math.abs(axis === "x" ? normal.x : normal.z));
}

/**
 * Lays the bark grain over a strip `width` long and `length` deep: one picture for each GRAIN_METRES, starting at a
 * different place on each strip, so no two strips show the same marks.
 */
function spreadGrain(geometry: THREE.BufferGeometry, width: number, length: number, jitter: (size: number) => number): void {
  const uvs = geometry.getAttribute("uv");
  const start = { u: jitter(0.5) + 0.5, v: jitter(0.5) + 0.5 };
  for (let i = 0; i < uvs.count; i += 1) {
    uvs.setXY(i, start.u + (uvs.getX(i) * width) / GRAIN_METRES.along, start.v + (uvs.getY(i) * length) / GRAIN_METRES.across);
  }
}

/**
 * Paints bark grain that repeats without seams: pale, so it only darkens the bark's colour in streaks along its length,
 * a few deep cracks, and a knot here and there. Without a page to paint on, as in tests, the bark has no grain.
 */
function paintBarkGrain(random: () => number): THREE.Texture | null {
  if (typeof document === "undefined") return null;
  const { wide, high } = GRAIN_PIXELS;
  const canvas = document.createElement("canvas");
  canvas.width = wide;
  canvas.height = high;
  const context = canvas.getContext("2d");
  if (context === null) return null;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, wide, high);
  context.lineCap = "round";
  /** Draws a mark, and again across each edge it might cross, so the picture repeats without seams. */
  const wrapped = (draw: (x: number, y: number) => void, x: number, y: number) => {
    for (const shiftX of [-wide, 0, wide]) for (const shiftY of [-high, 0, high]) draw(x + shiftX, y + shiftY);
  };
  /** A wavy line along the bark, `long` pixels, `thick` pixels wide. */
  const streak = (colour: string, long: number, thick: number) => {
    const startX = random() * wide;
    const startY = random() * high;
    const sway = (random() - 0.5) * 6;
    wrapped((x, y) => {
      context.strokeStyle = colour;
      context.lineWidth = thick;
      context.beginPath();
      context.moveTo(x, y);
      context.bezierCurveTo(x + long / 3, y + sway, x + (2 * long) / 3, y - sway, x + long, y + sway / 2);
      context.stroke();
    }, startX, startY);
  };
  for (let i = 0; i < 140; i += 1) streak(`rgba(40, 24, 12, ${0.12 + random() * 0.2})`, 60 + random() * 260, 1 + random() * 2);
  for (let i = 0; i < 50; i += 1) streak(`rgba(255, 236, 210, ${0.1 + random() * 0.15})`, 40 + random() * 160, 1 + random() * 1.5);
  for (let i = 0; i < 9; i += 1) streak(`rgba(25, 14, 6, ${0.45 + random() * 0.2})`, 120 + random() * 300, 2 + random() * 2);
  for (let i = 0; i < 3; i += 1) {
    const radius = 6 + random() * 6;
    wrapped((x, y) => {
      context.fillStyle = "rgba(255, 236, 210, 0.35)";
      context.beginPath();
      context.ellipse(x, y, radius * 2.4, radius * 1.4, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "rgba(25, 14, 6, 0.7)";
      context.beginPath();
      context.ellipse(x, y, radius * 1.2, radius * 0.7, 0, 0, Math.PI * 2);
      context.fill();
    }, random() * wide, random() * high);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  // three.js lowers this to what the graphics card supports.
  texture.anisotropy = 8;
  return texture;
}

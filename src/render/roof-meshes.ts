// Draws cabin roof sections and their blueprints: the "roof" asset in asset-manifest.json, approved, built in code.
// A roof section is the bark laid on the roof frame of one foundation square (roof-frame-meshes.ts). Curled, ragged strips of
// bark, like the lean-to's, lie on the frame's rafters like shingles. The roof slopes the way its frame does, and sits where its
// frame's layout puts it: sections one behind another share one slope, and where two roofs sloping at right angles meet, the
// corner section becomes a hip or a valley, as roof-layout.ts works out. Those two corner pieces are a draft (the
// "roof-corners" asset): their bark is laid on both slopes, from the eaves up, each strip cut along the line where the slopes
// meet and reaching a little past it, so on a hip each slope laps over the ridge and on a valley each slope tucks under the other.
// The bark reaches a little past the square's edges, so the sections beside it overlap. Where an edge has no section beside
// it, the bark reaches further, past the ends of the frame's beams, so it covers the frame's overhang and keeps the slope.
// Each strip of bark is laid a little less steep than the roof, so its ragged lower edge lifts over the strip below it, in the
// same section or the one in front. The bark carries a grain painted in code: streaks along its length, a few deep cracks, and
// a knot here and there, so it reads as bark and not as brown boards.
// Construction has one stage per strip of bark. A blueprint shows see-through. The strip being laid fades in above its place,
// is lowered, and set down, like the logs of a foundation.
// When the player stands under a cabin roof, that roof and every section joined to it hide, so the player stays in view.
// While the player places a roof from the build menu, a see-through copy follows the mouse, sloping the way the frame under it
// does. It turns red where it is not allowed.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { BUILD_GRID_METRES } from "../sim/build-grid";
import { blueprintEntities, cabinRoofEntities, type Entity, type EntityStore, type Vec3 } from "../sim/entities";
import type { QuarterTurns } from "../sim/structure-kind";
import { roofAbove } from "../sim/roofs";
import { ROOF_BARK_COST } from "../sim/structures";
import type { OutlinePart } from "./hover-outline";
import { BARK_COLOURS, barkStrip, seededRandom } from "./lean-to-meshes";
import type { RoofShape } from "./roof-layout";
import {
  BARK_THICKNESS_METRES,
  EDGES,
  FRAME_TOP_METRES,
  frameLayout,
  isShown,
  neighboursOf,
  RAFTER_RADIUS_METRES,
  raisedBy,
  ROOF_SEED,
  ROOF_SLOPE_RADIANS,
  shapeHeight,
  type Section,
} from "./roof-parts";
import { buildLift, buildOpacity, facingRadians, NOT_ALLOWED_COLOUR, pickFinished, seeThrough } from "./structure-look";

const BLUEPRINT_COLOUR = 0xbfe3ff;
/** How see-through the parts of a blueprint not yet built are, from 0 (invisible) to 1 (solid). */
const BLUEPRINT_OPACITY = 0.35;
/** The bark reaches this far past each side of the square, in metres, so the sections beside it overlap. */
const BARK_OVERHANG_METRES = 0.1;
/**
 * Where an edge has no section beside it, the bark reaches this much further, in metres, past the ends of the frame's beams,
 * which reach 0.3 m past the walls.
 */
const EAVE_REACH_METRES = 0.25;
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
/** Corner bark reaches this far past the line where its two slopes meet, in metres, so the slopes lap. */
const CORNER_LAP_METRES = 0.06;
/** On a hip or valley, the bark on the slope down to +x lies this much higher, in metres, so the two slopes do not flicker. */
const CORNER_FACE_LIFT_METRES = 0.006;
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

interface Drawn {
  readonly root: THREE.Group;
  /** The shape its strips were made for. A section whose shape changes is drawn again. */
  readonly shape: RoofShape;
  /** One strip of bark for each stage of construction, in order, each with its own see-through copy of its material for fading in. */
  readonly parts: { mesh: THREE.Mesh; fading: THREE.MeshStandardMaterial; bark: THREE.MeshStandardMaterial }[];
  readonly picker: THREE.Mesh;
}

export function createRoofMeshes(entities: EntityStore): RoofMeshes {
  const group = new THREE.Group();
  const pickGeometry = new THREE.BoxGeometry(BUILD_GRID_METRES, PICK_THICKNESS_METRES, BUILD_GRID_METRES);
  const grain = paintBarkGrain(seededRandom(ROOF_SEED + 1));
  const barkMaterials = BARK_COLOURS.map((color) => new THREE.MeshStandardMaterial({ color, flatShading: true, vertexColors: true, map: grain }));
  const blueprintMaterial = seeThrough(BLUEPRINT_COLOUR, BLUEPRINT_OPACITY);
  const notAllowedMaterial = seeThrough(NOT_ALLOWED_COLOUR, BLUEPRINT_OPACITY);
  const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });
  const barkOf = (index: number) => barkMaterials[index % barkMaterials.length] ?? blueprintMaterial;

  const barkY = FRAME_TOP_METRES + 2 * RAFTER_RADIUS_METRES + BARK_THICKNESS_METRES / 2;
  // The rafters rest on the beam over the front wall, at z = +half a square, and the bark on them rises towards the back.
  const rise = (z: number) => (BUILD_GRID_METRES / 2 - z) * Math.tan(ROOF_SLOPE_RADIANS);
  // Strips of bark run along x, side by side down the slope, from the front of the roof up to the back.
  const barkSpan = BUILD_GRID_METRES + 2 * BARK_OVERHANG_METRES;
  const stripShare = barkSpan / ROOF_BARK_COST;
  const stripLength = (stripShare / Math.cos(ROOF_SLOPE_RADIANS)) * BARK_OVERLAP;

  /** One strip of bark, made with its ragged lower edge at -z, then turned round to point down the slope, to the front. */
  function strip(index: number, wobble: (size: number) => number): THREE.BufferGeometry {
    const geometry = barkStrip(barkSpan + wobble(0.03), stripLength, index % BARK_COLOURS.length, wobble, ROOF_BARK_SHAPE);
    spreadGrain(geometry, barkSpan, stripLength, wobble);
    geometry.rotateY(Math.PI + wobble(0.01));
    geometry.rotateZ(wobble(0.006));
    geometry.rotateX(ROOF_SLOPE_RADIANS - BARK_KICK_RADIANS);
    return geometry;
  }

  /** The strips of a straight section, in its own frame, laid from the front up. */
  function straightStrips(): THREE.BufferGeometry[] {
    const random = seededRandom(ROOF_SEED);
    const jitter = (size: number) => (random() * 2 - 1) * size;
    return Array.from({ length: ROOF_BARK_COST }, (_, i) => {
      const geometry = strip(i, jitter);
      const z = barkSpan / 2 - (i + 0.5) * stripShare;
      return geometry.translate(jitter(0.01), barkY + BARK_LIFT_METRES + rise(z), z);
    });
  }

  /**
   * The strips of a hip or valley, drawn sloping down to +z and +x, laid from the eaves up. Each row has a strip on each slope.
   * Each slope is drawn like a straight section in its own frame: turns 0 for the slope down to +z, and turns 3 for the
   * slope down to +x. In those frames the line where the slopes meet runs along x = z and x = -z.
   */
  function cornerStrips(shape: "hip" | "valley"): THREE.BufferGeometry[] {
    const cornerRandom = seededRandom(ROOF_SEED + (shape === "hip" ? 4 : 5));
    const wobble = (size: number) => (cornerRandom() * 2 - 1) * size;
    // On a hip, the slope down to +z covers the part left of its meeting line, and the slope down to +x the part right of it.
    // On a valley it is the other way round.
    const faces = [
      { turns: 0 as QuarterTurns, side: shape === "hip" ? -1 : 1, meets: (z: number) => z },
      { turns: 3 as QuarterTurns, side: shape === "hip" ? 1 : -1, meets: (z: number) => -z },
    ];
    return Array.from({ length: ROOF_BARK_COST }, (_, i) => {
      const strips = faces.map((face, f) => {
        const geometry = strip(i, wobble);
        const z = barkSpan / 2 - (i + 0.5) * stripShare;
        geometry.translate(wobble(0.01), barkY + BARK_LIFT_METRES + rise(z) + f * CORNER_FACE_LIFT_METRES, z);
        // Cut the strip along the meeting line, a little past it, so the two slopes lap.
        const positions = geometry.getAttribute("position");
        for (let v = 0; v < positions.count; v += 1) {
          const limit = face.meets(positions.getZ(v)) - face.side * CORNER_LAP_METRES;
          const x = positions.getX(v);
          positions.setX(v, face.side < 0 ? Math.min(x, limit) : Math.max(x, limit));
        }
        geometry.computeVertexNormals();
        return geometry.rotateY(facingRadians(face.turns));
      });
      const geometry = mergeGeometries(strips);
      for (const one of strips) one.dispose();
      return geometry;
    });
  }

  /** The strips of each shape, reaching a little past every edge, made once. The corner strips are made only when a roof first needs them. */
  const stripsByShape = new Map<RoofShape, readonly THREE.BufferGeometry[]>();
  function stripsOf(shape: RoofShape): readonly THREE.BufferGeometry[] {
    const known = stripsByShape.get(shape);
    if (known !== undefined) return known;
    const made = shape === "straight" ? straightStrips() : cornerStrips(shape);
    stripsByShape.set(shape, made);
    return made;
  }

  /** The strips of each shape and set of open edges, made once and shared. */
  const reachedStrips = new Map<string, readonly THREE.BufferGeometry[]>();
  /**
   * The strips of a section of `shape` whose edges in EDGES order are open where `open` says, with no section beside them.
   * Past an open edge, the bark reaches further, keeping the slope, so it covers the frame's beams.
   */
  function stripsReaching(shape: RoofShape, open: readonly boolean[]): readonly THREE.BufferGeometry[] {
    const name = `${shape}:${open.map((edge) => (edge ? 1 : 0)).join("")}`;
    const known = reachedStrips.get(name);
    if (known !== undefined) return known;
    const half = BUILD_GRID_METRES / 2;
    const [back, front, left, right] = open;
    const made = stripsOf(shape).map((base) => {
      const geometry = base.clone();
      const positions = geometry.getAttribute("position");
      for (let v = 0; v < positions.count; v += 1) {
        const x = positions.getX(v);
        const z = positions.getZ(v);
        const outX = (x > half && right === true ? EAVE_REACH_METRES : 0) - (x < -half && left === true ? EAVE_REACH_METRES : 0);
        const outZ = (z > half && front === true ? EAVE_REACH_METRES : 0) - (z < -half && back === true ? EAVE_REACH_METRES : 0);
        if (outX === 0 && outZ === 0) continue;
        positions.setXYZ(v, x + outX, positions.getY(v) + shapeHeight(shape, x + outX, z + outZ) - shapeHeight(shape, x, z), z + outZ);
      }
      geometry.computeVertexNormals();
      return geometry;
    });
    reachedStrips.set(name, made);
    return made;
  }

  /** Adds every strip of a roof section of `shape` to `root`, see-through. */
  function addParts(root: THREE.Group, shape: RoofShape): Drawn["parts"] {
    return stripsOf(shape).map((geometry, index) => {
      const mesh = new THREE.Mesh(geometry, blueprintMaterial);
      mesh.castShadow = true;
      root.add(mesh);
      const bark = barkOf(index);
      const fading = bark.clone();
      fading.transparent = true;
      return { mesh, fading, bark };
    });
  }

  const allOpen = EDGES.map(() => true);
  const placingBlueprint = new THREE.Group();
  placingBlueprint.visible = false;
  const placingParts = addParts(placingBlueprint, "straight");
  stripsReaching("straight", allOpen).forEach((geometry, index) => {
    const part = placingParts[index];
    if (part !== undefined) part.mesh.geometry = geometry;
  });
  group.add(placingBlueprint);

  const drawn = new Map<Entity, Drawn>();
  const pickers: THREE.Mesh[] = [];
  const blueprints = blueprintEntities(entities);
  const finished = cabinRoofEntities(entities);

  function draw(entity: Section, shape: RoofShape): Drawn {
    const existing = drawn.get(entity);
    if (existing?.shape === shape) return existing;
    if (existing !== undefined) forget(entity);
    const root = new THREE.Group();
    const parts = addParts(root, shape);
    const picker = new THREE.Mesh(pickGeometry, pickMaterial);
    picker.position.y = barkY + PICK_THICKNESS_METRES / 2;
    picker.userData.entity = entity;
    root.add(picker);
    pickers.push(picker);
    group.add(root);
    const result = { root, shape, parts, picker };
    drawn.set(entity, result);
    return result;
  }

  /** Shows how far construction has gone. Laid strips are solid and in place, the strip being laid moves through its stage, and the rest show see-through. */
  function showProgress(item: Drawn, progress: number): void {
    const stagesDone = progress * item.parts.length;
    item.parts.forEach(({ mesh, fading, bark }, index) => {
      const share = Math.min(1, Math.max(0, stagesDone - index));
      if (share <= 0) {
        mesh.material = blueprintMaterial;
        mesh.position.y = 0;
      } else {
        fading.opacity = buildOpacity(share);
        mesh.material = fading.opacity < 1 ? fading : bark;
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
        const item = draw(entity, place.shape);
        item.root.position.set(entity.position.x, entity.position.y + raisedBy(place), entity.position.z);
        item.root.rotation.y = facingRadians(place.drawTurns);
        item.root.visible = visible;
        const open = neighboursOf(layout, entity.position, place).map((beside) => beside === undefined);
        stripsReaching(place.shape, open).forEach((geometry, index) => {
          const part = item.parts[index];
          if (part !== undefined) part.mesh.geometry = geometry;
        });
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
      for (const item of [
        ...[...stripsByShape.values(), ...reachedStrips.values()].flat(),
        pickGeometry,
        ...barkMaterials,
        blueprintMaterial,
        notAllowedMaterial,
        pickMaterial,
      ]) {
        item.dispose();
      }
      grain?.dispose();
      for (const item of drawn.values()) for (const { fading } of item.parts) fading.dispose();
      for (const { fading } of placingParts) fading.dispose();
    },
  };
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
    wrapped(
      (x, y) => {
        context.strokeStyle = colour;
        context.lineWidth = thick;
        context.beginPath();
        context.moveTo(x, y);
        context.bezierCurveTo(x + long / 3, y + sway, x + (2 * long) / 3, y - sway, x + long, y + sway / 2);
        context.stroke();
      },
      startX,
      startY,
    );
  };
  for (let i = 0; i < 140; i += 1) streak(`rgba(40, 24, 12, ${0.12 + random() * 0.2})`, 60 + random() * 260, 1 + random() * 2);
  for (let i = 0; i < 50; i += 1) streak(`rgba(255, 236, 210, ${0.1 + random() * 0.15})`, 40 + random() * 160, 1 + random() * 1.5);
  for (let i = 0; i < 9; i += 1) streak(`rgba(25, 14, 6, ${0.45 + random() * 0.2})`, 120 + random() * 300, 2 + random() * 2);
  for (let i = 0; i < 3; i += 1) {
    const radius = 6 + random() * 6;
    wrapped(
      (x, y) => {
        context.fillStyle = "rgba(255, 236, 210, 0.35)";
        context.beginPath();
        context.ellipse(x, y, radius * 2.4, radius * 1.4, 0, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = "rgba(25, 14, 6, 0.7)";
        context.beginPath();
        context.ellipse(x, y, radius * 1.2, radius * 0.7, 0, 0, Math.PI * 2);
        context.fill();
      },
      random() * wide,
      random() * high,
    );
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  // three.js lowers this to what the graphics card supports.
  texture.anisotropy = 8;
  return texture;
}

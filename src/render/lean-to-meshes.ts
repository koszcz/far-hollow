// Draws lean-tos and lean-to blueprints with the code-built asset listed in asset-manifest.json as "lean-to" (approved).
// The frame is crooked sticks: two front posts with forked tops, a ridge pole resting in the forks, and rafters sloping from the
// ridge pole down to the ground at the back. Curled strips of bark cover the rafters like shingles, from the back up to the ridge
// pole. The front stays open.
// Each part is one stage of construction, in the order the cost spends it: sticks first, then bark. While a stage is under way,
// its part fades in and is lowered into place. Parts not started show see-through as part of the outline.
// While the player places a lean-to from the build menu, a see-through copy follows the mouse. It turns red where it is not allowed.
import * as THREE from "three";
import { blueprintEntities, leanToEntities, type Entity, type EntityStore } from "../sim/entities";
import { LEAN_TO_BARK_COST, LEAN_TO_DEPTH_METRES, LEAN_TO_STICK_COST, LEAN_TO_WIDTH_METRES } from "../sim/structures";
import type { OutlinePart } from "./hover-outline";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createStickSegment, STICK_COLOUR } from "./stick-shape";
import { facingRadians, NOT_ALLOWED_COLOUR, pickFinished } from "./structure-look";

/** Bark strips take turns between these two browns, so the roof does not look like one sheet. */
export const BARK_COLOURS = [0x5b3f2c, 0x6b4b34] as const;
const BLUEPRINT_COLOUR = 0xbfe3ff;
/** How see-through the parts of a blueprint not yet built are, from 0 (invisible) to 1 (solid). */
const BLUEPRINT_OPACITY = 0.35;

/** The front posts and the ridge pole stand this high, in metres. */
const RIDGE_HEIGHT_METRES = 1.45;
/** The front posts stand this far in from each side, in metres. */
const POST_INSET_METRES = 0.15;
/** The frame stays this far inside the lean-to's front and back edges, in metres. */
const EDGE_INSET_METRES = 0.08;
const BARK_THICKNESS_METRES = 0.04;
/** Each bark strip is this much longer than its share of the roof, so the strips overlap like shingles. */
const BARK_OVERLAP = 1.35;
/** A part being built starts this far above its place, in metres, and is lowered into it. */
const BUILD_DROP_METRES = 0.3;
/** A part being built is fully solid once this share of its stage has passed. */
const BUILD_FADE_SHARE = 0.5;

/** The front posts and the ridge pole: three of the lean-to's sticks. The rest are rafters. */
const FRAME_STICKS = 3;
const RAFTER_COUNT = LEAN_TO_STICK_COST - FRAME_STICKS;

/** One part of the lean-to, in the order construction adds it. */
interface PartShape {
  readonly geometry: THREE.BufferGeometry;
  readonly material: "stick" | "bark";
  /** Which of the two bark browns, for bark. */
  readonly shade: number;
}

/** Clicks on a lean-to blueprint hit an invisible box this tall over the ground it covers, in metres. */
const PICK_HEIGHT_METRES = 1.5;

export interface LeanToMeshes {
  readonly group: THREE.Group;
  /** Brings every lean-to and lean-to blueprint up to date with game state. */
  update(): void;
  /** What a ray from the camera hits first among lean-to blueprints, and how far away. A finished lean-to is not clicked. */
  pick(raycaster: THREE.Raycaster): { hit: { kind: "blueprint"; entity: Entity }; distance: number } | undefined;
  /** The parts of a lean-to or its blueprint, placed in the world. Empty once it is gone. */
  /** The finished piece the ray meets first, with how far away it is, or undefined if it meets none. The action menu uses it. */
  pickFinished(raycaster: THREE.Raycaster): { entity: Entity; distance: number } | undefined;
  outlineOf(entity: Entity): OutlinePart[];
  /** Shows a lean-to blueprint under the mouse at a spot, red where it is not allowed. Undefined hides it. */
  showPlacingBlueprint(placingBlueprint: { spot: { x: number; y: number; z: number }; turns: number; allowed: boolean } | undefined): void;
  dispose(): void;
}

interface Drawn {
  readonly root: THREE.Group;
  readonly parts: THREE.Mesh[];
  /** See-through copies of the stick and bark materials, for the one part being built. */
  readonly fadingStick: THREE.MeshStandardMaterial;
  readonly fadingBark: THREE.MeshStandardMaterial;
  readonly picker: THREE.Mesh;
}

export function createLeanToMeshes(entities: EntityStore): LeanToMeshes {
  const group = new THREE.Group();
  const shapes = createPartShapes();
  const stickMaterial = new THREE.MeshStandardMaterial({ color: STICK_COLOUR, flatShading: true, vertexColors: true });
  const barkMaterials = BARK_COLOURS.map((color) => new THREE.MeshStandardMaterial({ color, flatShading: true, vertexColors: true }));
  const blueprintMaterial = new THREE.MeshStandardMaterial({
    color: BLUEPRINT_COLOUR,
    transparent: true,
    opacity: BLUEPRINT_OPACITY,
    depthWrite: false,
  });
  const notAllowedMaterial = new THREE.MeshStandardMaterial({
    color: NOT_ALLOWED_COLOUR,
    transparent: true,
    opacity: BLUEPRINT_OPACITY,
    depthWrite: false,
  });
  const pickGeometry = new THREE.BoxGeometry(LEAN_TO_WIDTH_METRES, PICK_HEIGHT_METRES, LEAN_TO_DEPTH_METRES);
  pickGeometry.translate(0, PICK_HEIGHT_METRES / 2, 0);
  const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });

  const drawn = new Map<Entity, Drawn>();
  const pickers: THREE.Mesh[] = [];
  const blueprints = blueprintEntities(entities);
  const leanTos = leanToEntities(entities);

  function solidMaterial(shape: PartShape): THREE.Material {
    return shape.material === "stick" ? stickMaterial : (barkMaterials[shape.shade % barkMaterials.length] ?? stickMaterial);
  }

  function addParts(root: THREE.Group, material: THREE.Material): THREE.Mesh[] {
    return shapes.map((shape) => {
      const mesh = new THREE.Mesh(shape.geometry, material);
      mesh.castShadow = true;
      root.add(mesh);
      return mesh;
    });
  }

  const placingBlueprint = new THREE.Group();
  placingBlueprint.visible = false;
  const placingParts = addParts(placingBlueprint, blueprintMaterial);
  group.add(placingBlueprint);

  function draw(entity: Entity & { position: { x: number; y: number; z: number } }): Drawn {
    const existing = drawn.get(entity);
    if (existing !== undefined) return existing;
    const root = new THREE.Group();
    const parts = addParts(root, blueprintMaterial);
    const fadingStick = stickMaterial.clone();
    fadingStick.transparent = true;
    const fadingBark = (barkMaterials[0] ?? stickMaterial).clone();
    fadingBark.transparent = true;
    const picker = new THREE.Mesh(pickGeometry, pickMaterial);
    picker.userData.entity = entity;
    root.add(picker);
    pickers.push(picker);
    root.position.set(entity.position.x, entity.position.y, entity.position.z);
    root.rotation.y = facingRadians(entity.facing?.turns ?? 0);
    group.add(root);
    const result = { root, parts, fadingStick, fadingBark, picker };
    drawn.set(entity, result);
    return result;
  }

  /** Shows how far construction has gone. The pose depends only on progress, so a paused build holds still. */
  function showProgress(item: Drawn, progress: number): void {
    const stagesDone = progress * shapes.length;
    item.parts.forEach((mesh, index) => {
      const shape = shapes[index];
      if (shape === undefined) return;
      const share = Math.min(1, Math.max(0, stagesDone - index));
      if (share <= 0) {
        mesh.material = blueprintMaterial;
        mesh.position.y = 0;
        return;
      }
      const opacity = Math.min(1, share / BUILD_FADE_SHARE);
      if (opacity < 1) {
        const fading = shape.material === "stick" ? item.fadingStick : item.fadingBark;
        fading.opacity = opacity;
        mesh.material = fading;
      } else {
        mesh.material = solidMaterial(shape);
      }
      // The part eases down into place over its stage.
      const lowered = 1 - (1 - share) * (1 - share);
      mesh.position.y = BUILD_DROP_METRES * (1 - lowered);
    });
  }

  function forget(entity: Entity): void {
    const item = drawn.get(entity);
    if (item === undefined) return;
    group.remove(item.root);
    item.fadingStick.dispose();
    item.fadingBark.dispose();
    pickers.splice(pickers.indexOf(item.picker), 1);
    drawn.delete(entity);
  }

  const hits: THREE.Intersection[] = [];

  return {
    group,
    update() {
      const seen = new Set<Entity>();
      for (const blueprint of blueprints) {
        if (blueprint.blueprint.structure !== "leanTo") continue;
        showProgress(draw(blueprint), blueprint.blueprint.progress);
        seen.add(blueprint);
      }
      for (const leanTo of leanTos) {
        showProgress(draw(leanTo), 1);
        seen.add(leanTo);
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
    outlineOf(entity) {
      const item = drawn.get(entity);
      if (item === undefined) return [];
      item.root.updateMatrixWorld(true);
      return item.parts.map((mesh) => ({ geometry: mesh.geometry, matrix: mesh.matrixWorld }));
    },
    showPlacingBlueprint(shown) {
      placingBlueprint.visible = shown !== undefined;
      if (shown === undefined) return;
      placingBlueprint.position.set(shown.spot.x, shown.spot.y, shown.spot.z);
      placingBlueprint.rotation.y = facingRadians(shown.turns);
      const material = shown.allowed ? blueprintMaterial : notAllowedMaterial;
      for (const mesh of placingParts) mesh.material = material;
    },
    dispose() {
      for (const item of [
        ...shapes.map(({ geometry }) => geometry),
        stickMaterial,
        ...barkMaterials,
        blueprintMaterial,
        notAllowedMaterial,
        pickGeometry,
        pickMaterial,
      ]) {
        item.dispose();
      }
      for (const item of drawn.values()) {
        item.fadingStick.dispose();
        item.fadingBark.dispose();
      }
    },
  };
}

/**
 * Every part of a lean-to facing the default way, with its open front towards +z, in the order construction adds them:
 * the two front posts, the ridge pole, the rafters, then the bark strips from the back up to the ridge.
 * A seeded random number keeps every lean-to the same shape.
 */
function createPartShapes(): PartShape[] {
  const random = seededRandom(LEAN_TO_SEED);
  const jitter = (size: number) => (random() * 2 - 1) * size;
  const halfWidth = LEAN_TO_WIDTH_METRES / 2;
  const frontZ = LEAN_TO_DEPTH_METRES / 2 - EDGE_INSET_METRES;
  const backZ = -LEAN_TO_DEPTH_METRES / 2 + EDGE_INSET_METRES;
  const postX = halfWidth - POST_INSET_METRES;
  const parts: PartShape[] = [];
  const stick = (geometry: THREE.BufferGeometry) => parts.push({ geometry, material: "stick", shade: 0 });

  // Each front post ends in a fork. The ridge pole rests in the crotch, between the two arms.
  for (const side of [-1, 1]) stick(forkedPost(new THREE.Vector3(side * postX, 0, frontZ), jitter));
  stick(
    crookedPole(
      new THREE.Vector3(-halfWidth - RIDGE_OVERHANG_METRES, RIDGE_HEIGHT_METRES, frontZ),
      new THREE.Vector3(halfWidth + RIDGE_OVERHANG_METRES, RIDGE_HEIGHT_METRES + jitter(0.03), frontZ),
      RIDGE_RADIUS_METRES,
      RIDGE_RADIUS_METRES * 0.75,
      5,
      jitter,
    ),
  );
  // Each rafter runs from the ground at the back up over the ridge pole.
  for (let i = 0; i < RAFTER_COUNT; i += 1) {
    const x = -postX + (i / (RAFTER_COUNT - 1)) * 2 * postX + jitter(0.06);
    const foot = new THREE.Vector3(x + jitter(0.08), 0, backZ + jitter(0.05));
    const top = new THREE.Vector3(x, RIDGE_HEIGHT_METRES + RIDGE_RADIUS_METRES * 1.8, frontZ + 0.12 + jitter(0.06));
    stick(rafter(foot, top, jitter));
  }

  // The bark lies on top of the rafters, along the slope from the back edge up to the ridge pole.
  const lift = RIDGE_RADIUS_METRES * 3;
  const low = new THREE.Vector3(0, lift, backZ);
  const high = new THREE.Vector3(0, RIDGE_HEIGHT_METRES + lift, frontZ);
  const slope = high.clone().sub(low);
  const stripLength = (slope.length() / LEAN_TO_BARK_COST) * BARK_OVERLAP;
  const angle = Math.atan2(slope.y, slope.z);
  for (let row = 0; row < LEAN_TO_BARK_COST; row += 1) {
    const geometry = barkStrip(LEAN_TO_WIDTH_METRES + 0.1 + jitter(0.08), stripLength, row % BARK_COLOURS.length, jitter);
    geometry.rotateZ(jitter(0.025));
    geometry.rotateX(-angle);
    const middle = low.clone().addScaledVector(slope, (row + 0.5) / LEAN_TO_BARK_COST);
    // Each strip sits a little higher than the one below it, so its lower edge laps over that strip.
    geometry.translate(middle.x + jitter(0.06), middle.y + row * 0.006, middle.z);
    parts.push({ geometry, material: "bark", shade: row });
  }
  return parts;
}

/** All lean-tos share this seed, so they all have the same crooks and ragged edges. */
const LEAN_TO_SEED = 20261111;
/** The ridge pole sticks out this far past each side of the lean-to, in metres. */
const RIDGE_OVERHANG_METRES = 0.1;
const RIDGE_RADIUS_METRES = 0.055;
const POST_RADIUS_METRES = 0.06;
/** A post forks this far below the ridge pole, in metres. Its arms rise this far above it. */
const FORK_BELOW_METRES = 0.06;
const FORK_ABOVE_METRES = 0.2;
/** How far each arm of a fork leans out, forward or back, at its tip, in metres. */
const FORK_SPREAD_METRES = 0.18;
const RAFTER_RADIUS_METRES = 0.05;
/** The inside of bark is pale, like the inner bark on a freshly peeled log. */
const BARK_INSIDE_COLOUR = 0xc39a6b;
/** Peeled bark curls: each strip's two long edges lift this far above its middle, in metres. Its lower edge frays this far. */
const BARK_CURL_METRES = 0.03;
const BARK_FRAY_METRES = 0.09;
/** A bark strip wavers up and down this far along its length, in metres. */
const BARK_WAVER_METRES = 0.012;

/** A small, repeatable random number generator: the same seed always gives the same numbers, from 0 up to 1. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

/** A pole from one point to another, bent a little at each of its joints, with a pale cut end at `from` and, unless told not to, at `to`. */
function crookedPole(
  from: THREE.Vector3,
  to: THREE.Vector3,
  fromRadius: number,
  toRadius: number,
  joints: number,
  jitter: (size: number) => number,
  paleTo = true,
): THREE.BufferGeometry {
  const points = [from];
  for (let i = 1; i < joints; i += 1) {
    const point = from.clone().lerp(to, i / joints);
    // Bend sideways to the pole: across it in x or z, whichever the pole does not run along.
    const runsAlongX = Math.abs(to.x - from.x) > Math.abs(to.z - from.z);
    point.x += runsAlongX ? 0 : jitter(0.035);
    point.z += runsAlongX ? jitter(0.035) : 0;
    point.y += Math.abs(to.y - from.y) > 0.5 ? 0 : jitter(0.025);
    points.push(point);
  }
  points.push(to);
  const pieces = points.slice(1).map((end, i) => {
    const start = points[i] ?? from;
    const radius = (share: number) => fromRadius + (toRadius - fromRadius) * share;
    // Inner pieces start a little inside the previous one, so no notch shows at the bends.
    const begin = i === 0 ? start : start.clone().addScaledVector(end.clone().sub(start).normalize(), -radius(i / joints) * 0.6);
    return createStickSegment({
      from: begin,
      to: end,
      fromRadius: radius(i / joints),
      toRadius: radius((i + 1) / joints),
      sides: POLE_SIDES,
      paleFrom: i === 0,
      paleTo: paleTo && i === joints - 1,
    });
  });
  return mergeAndDispose(pieces);
}

/** A front post standing at `foot`: a crooked pole that forks into two arms, one leaning forward and one back. */
function forkedPost(foot: THREE.Vector3, jitter: (size: number) => number): THREE.BufferGeometry {
  const crotch = new THREE.Vector3(foot.x + jitter(0.03), RIDGE_HEIGHT_METRES - FORK_BELOW_METRES, foot.z + jitter(0.03));
  const pieces = [crookedPole(foot, crotch, POST_RADIUS_METRES, POST_RADIUS_METRES * 0.85, 3, jitter, false)];
  for (const way of [-1, 1]) {
    const tip = new THREE.Vector3(crotch.x + jitter(0.02), RIDGE_HEIGHT_METRES + FORK_ABOVE_METRES, crotch.z + way * FORK_SPREAD_METRES);
    const start = crotch.clone().addScaledVector(tip.clone().sub(crotch).normalize(), -POST_RADIUS_METRES * 0.5);
    pieces.push(
      createStickSegment({ from: start, to: tip, fromRadius: POST_RADIUS_METRES * 0.7, toRadius: POST_RADIUS_METRES * 0.45, sides: POLE_SIDES, paleTo: true }),
    );
  }
  return mergeAndDispose(pieces);
}

/**
 * A rafter from its foot on the ground up to its tip over the ridge pole: a crooked pole, thick at the foot, with one short
 * side twig. Stretching the approved stick shape would stretch its twigs too, so the rafter uses the same pieces instead.
 */
function rafter(foot: THREE.Vector3, tip: THREE.Vector3, jitter: (size: number) => number): THREE.BufferGeometry {
  const pole = crookedPole(foot, tip, RAFTER_RADIUS_METRES, RAFTER_RADIUS_METRES * 0.6, 3, jitter, true);
  const start = foot.clone().lerp(tip, 0.45 + jitter(0.15));
  const side = jitter(1) < 0 ? -1 : 1;
  const end = start.clone().add(new THREE.Vector3(side * 0.16, 0.04, (tip.z - foot.z) * 0.08));
  const twig = createStickSegment({ from: start, to: end, fromRadius: RAFTER_RADIUS_METRES * 0.45, toRadius: RAFTER_RADIUS_METRES * 0.2, sides: 5 });
  return mergeAndDispose([pole, twig]);
}

/**
 * One strip of bark lying flat, `width` long in x and `length` deep in z, its lower edge at -z.
 * Its two long edges curl up, it wavers along its length, and its lower edge is ragged.
 * It carries a colour per corner: white outside and a pale tint inside and on its edges.
 * Draw it with `vertexColors: true` and the material colour set to the bark brown `shade`.
 * `shape` can make the curl, the fray of the lower edge, and the waver smaller than the lean-to's, in metres.
 */
export function barkStrip(
  width: number,
  length: number,
  shade: number,
  jitter: (size: number) => number,
  shape: { curl: number; fray: number; waver: number } = { curl: BARK_CURL_METRES, fray: BARK_FRAY_METRES, waver: BARK_WAVER_METRES },
): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(width, BARK_THICKNESS_METRES, length, BARK_COLUMNS, 1, 4);
  const positions = geometry.getAttribute("position");
  const normals = geometry.getAttribute("normal");
  // One fray depth per column, so the top, bottom and edge faces of the strip agree.
  const fray = Array.from({ length: BARK_COLUMNS + 1 }, () => jitter(0.5) + 0.5);
  const wave = jitter(Math.PI);
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    let z = positions.getZ(i);
    const column = Math.round((x / width + 0.5) * BARK_COLUMNS);
    if (z < -length / 2 + 0.001) z += (fray[column] ?? 0) * shape.fray;
    const across = z / (length / 2);
    const curl = shape.curl * across * across + shape.waver * Math.sin(x * 1.6 + wave);
    positions.setXYZ(i, x, positions.getY(i) + curl, z);
  }
  const outside = new THREE.Color(BARK_COLOURS[shade] ?? BARK_COLOURS[0]);
  const inside = new THREE.Color(BARK_INSIDE_COLOUR);
  const pale = new THREE.Color(inside.r / outside.r, inside.g / outside.g, inside.b / outside.b);
  const colours = new Float32Array(normals.count * 3);
  for (let i = 0; i < normals.count; i += 1) {
    const colour = normals.getY(i) > 0.5 ? WHITE : pale;
    colours.set([colour.r, colour.g, colour.b], i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  return geometry;
}

const WHITE = new THREE.Color(1, 1, 1);
const POLE_SIDES = 6;
/** A bark strip is cut into this many columns along its length, for its waver and ragged edge. */
const BARK_COLUMNS = 14;

function mergeAndDispose(pieces: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = mergeGeometries(pieces);
  for (const piece of pieces) piece.dispose();
  return merged;
}

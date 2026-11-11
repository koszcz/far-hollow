// Draws lean-tos and lean-to blueprints with the code-built draft listed in asset-manifest.json as "lean-to".
// The frame is sticks: two front posts, a ridge pole across their tops, and rafters sloping from the ridge pole down to the
// ground at the back. Strips of bark cover the rafters from the back up to the ridge pole. The front stays open.
// Each part is one stage of construction, in the order the cost spends it: sticks first, then bark. While a stage is under way,
// its part fades in and is lowered into place. Parts not started show see-through as part of the outline.
// While the player places a lean-to from the build menu, a see-through copy follows the mouse. It turns red where it is not allowed.
import * as THREE from "three";
import { blueprintEntities, leanToEntities, type Entity, type EntityStore } from "../sim/entities";
import { LEAN_TO_BARK_COST, LEAN_TO_DEPTH_METRES, LEAN_TO_STICK_COST, LEAN_TO_WIDTH_METRES } from "../sim/structures";
import type { OutlinePart } from "./hover-outline";
import { STICK_COLOUR } from "./stick-shape";

/** Bark strips take turns between these two browns, so the roof does not look like one sheet. */
const BARK_COLOURS = [0x5b3f2c, 0x6b4b34] as const;
const BLUEPRINT_COLOUR = 0xbfe3ff;
/** How see-through the parts of a blueprint not yet built are, from 0 (invisible) to 1 (solid). */
const BLUEPRINT_OPACITY = 0.35;
/** A blueprint under the mouse shows in this red where its spot is not allowed. */
const NOT_ALLOWED_COLOUR = 0xe0614f;

/** The front posts and the ridge pole stand this high, in metres. */
const RIDGE_HEIGHT_METRES = 1.45;
/** The front posts stand this far in from each side, in metres. */
const POST_INSET_METRES = 0.15;
/** The frame stays this far inside the lean-to's front and back edges, in metres. */
const EDGE_INSET_METRES = 0.08;
const POLE_RADIUS_METRES = 0.045;
const BARK_THICKNESS_METRES = 0.04;
/** Each bark strip is this much longer than its share of the roof, so the strips overlap like shingles. */
const BARK_OVERLAP = 1.2;
/** A part being built starts this far above its place, in metres, and is lowered into it. */
const BUILD_DROP_METRES = 0.3;
/** A part being built is fully solid once this share of its stage has passed. */
const BUILD_FADE_SHARE = 0.5;

/** The front posts and the ridge pole: three of the lean-to's sticks. The rest are rafters. */
const FRAME_STICKS = 3;
const RAFTER_COUNT = LEAN_TO_STICK_COST - FRAME_STICKS;

/** How far round a structure facing `turns` quarter turns is drawn, in radians. Quarter turns go clockwise seen from above. */
function facingRadians(turns: number): number {
  return -turns * (Math.PI / 2);
}

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
  outlineOf(entity: Entity): OutlinePart[];
  /** Shows a lean-to blueprint under the mouse at a spot, red where it is not allowed. Undefined hides it. */
  showPreview(preview: { spot: { x: number; y: number; z: number }; turns: number; allowed: boolean } | undefined): void;
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
  const stickMaterial = new THREE.MeshStandardMaterial({ color: STICK_COLOUR, flatShading: true });
  const barkMaterials = BARK_COLOURS.map((color) => new THREE.MeshStandardMaterial({ color, flatShading: true }));
  const blueprintMaterial = new THREE.MeshStandardMaterial({
    color: BLUEPRINT_COLOUR, transparent: true, opacity: BLUEPRINT_OPACITY, depthWrite: false,
  });
  const notAllowedMaterial = new THREE.MeshStandardMaterial({
    color: NOT_ALLOWED_COLOUR, transparent: true, opacity: BLUEPRINT_OPACITY, depthWrite: false,
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

  const preview = new THREE.Group();
  preview.visible = false;
  const previewParts = addParts(preview, blueprintMaterial);
  group.add(preview);

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
        if (blueprint.blueprint.piece !== "leanTo") continue;
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
    outlineOf(entity) {
      const item = drawn.get(entity);
      if (item === undefined) return [];
      item.root.updateMatrixWorld(true);
      return item.parts.map((mesh) => ({ geometry: mesh.geometry, matrix: mesh.matrixWorld }));
    },
    showPreview(shown) {
      preview.visible = shown !== undefined;
      if (shown === undefined) return;
      preview.position.set(shown.spot.x, shown.spot.y, shown.spot.z);
      preview.rotation.y = facingRadians(shown.turns);
      const material = shown.allowed ? blueprintMaterial : notAllowedMaterial;
      for (const mesh of previewParts) mesh.material = material;
    },
    dispose() {
      for (const item of [
        ...shapes.map(({ geometry }) => geometry), stickMaterial, ...barkMaterials, blueprintMaterial, notAllowedMaterial,
        pickGeometry, pickMaterial,
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
 */
function createPartShapes(): PartShape[] {
  const halfWidth = LEAN_TO_WIDTH_METRES / 2;
  const frontZ = LEAN_TO_DEPTH_METRES / 2 - EDGE_INSET_METRES;
  const backZ = -LEAN_TO_DEPTH_METRES / 2 + EDGE_INSET_METRES;
  const postX = halfWidth - POST_INSET_METRES;
  const parts: PartShape[] = [];
  const stick = (from: THREE.Vector3, to: THREE.Vector3) => parts.push({ geometry: poleBetween(from, to), material: "stick", shade: 0 });

  for (const side of [-1, 1]) stick(new THREE.Vector3(side * postX, 0, frontZ), new THREE.Vector3(side * postX, RIDGE_HEIGHT_METRES + 0.1, frontZ));
  stick(new THREE.Vector3(-halfWidth, RIDGE_HEIGHT_METRES, frontZ), new THREE.Vector3(halfWidth, RIDGE_HEIGHT_METRES, frontZ));
  for (let i = 0; i < RAFTER_COUNT; i += 1) {
    const x = -postX + (i / (RAFTER_COUNT - 1)) * 2 * postX;
    stick(new THREE.Vector3(x, RIDGE_HEIGHT_METRES + POLE_RADIUS_METRES * 2, frontZ + 0.1), new THREE.Vector3(x, 0, backZ));
  }

  // The bark lies on top of the rafters, along the slope from the back edge up to the ridge pole.
  const lift = POLE_RADIUS_METRES * 3;
  const low = new THREE.Vector3(0, lift, backZ);
  const high = new THREE.Vector3(0, RIDGE_HEIGHT_METRES + lift, frontZ);
  const slope = high.clone().sub(low);
  const stripLength = (slope.length() / LEAN_TO_BARK_COST) * BARK_OVERLAP;
  const angle = Math.atan2(slope.y, slope.z);
  for (let row = 0; row < LEAN_TO_BARK_COST; row += 1) {
    const geometry = new THREE.BoxGeometry(LEAN_TO_WIDTH_METRES, BARK_THICKNESS_METRES, stripLength);
    geometry.rotateX(-angle);
    const middle = low.clone().addScaledVector(slope, (row + 0.5) / LEAN_TO_BARK_COST);
    geometry.translate(middle.x, middle.y, middle.z);
    parts.push({ geometry, material: "bark", shade: row });
  }
  return parts;
}

/** A round pole from one point to another. */
function poleBetween(from: THREE.Vector3, to: THREE.Vector3): THREE.BufferGeometry {
  const length = from.distanceTo(to);
  const geometry = new THREE.CylinderGeometry(POLE_RADIUS_METRES * 0.85, POLE_RADIUS_METRES, length, 6);
  // The cylinder stands along y. Turn it to point from `from` to `to`, then move its middle between them.
  const direction = to.clone().sub(from).normalize();
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction));
  const middle = from.clone().add(to).multiplyScalar(0.5);
  geometry.translate(middle.x, middle.y, middle.z);
  return geometry;
}

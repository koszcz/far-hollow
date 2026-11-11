// Draws berry bushes and mushroom patches: "berry-bush" (approved) and "mushrooms" (draft) in asset-manifest.json.
// A bush is Kenney's bush, loaded in berry-bush-model.ts, with red berries while it has food.
// A mushroom patch is three small mushrooms, built in code. It shows nothing while it grows back.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { forageSpotEntities, type Entity, type EntityStore } from "../sim/entities";
import type { BerryBushShape } from "./berry-bush-model";
import type { OutlinePart } from "./hover-outline";

/** Kenney's bush is thin single-sided leaves, so the leaves draw on both sides. */
const LEAF_COLOUR = 0x2f6b2c;
const BERRY_COLOUR = 0xb3202e;
const STEM_COLOUR = 0xe8dcc0;
const CAP_COLOUR = 0x8a4b2a;
/** Each plant is drawn between these sizes, so the valley does not look copy-pasted. */
const PLANT_MIN_SCALE = 0.8;
const PLANT_MAX_SCALE = 1.2;
/** Clicks hit an invisible box this wide and tall around each plant, in metres. */
const BUSH_PICK_SIZE_METRES = { width: 1.4, height: 1 };
const MUSHROOM_PICK_SIZE_METRES = { width: 0.6, height: 0.4 };

/** What a click on a forage spot landed on. */
export interface ForageHit {
  kind: "forage";
  entity: Entity;
}

export interface ForageMeshes {
  readonly group: THREE.Group;
  /** Brings every bush and mushroom patch up to date with game state. */
  update(): void;
  /** What a ray from the camera hits first among bushes and mushroom patches, and how far away. */
  pick(raycaster: THREE.Raycaster): { hit: ForageHit; distance: number } | undefined;
  /** The shapes that draw a bush or mushroom patch, placed in the world. Empty when nothing is drawn there. */
  outlineOf(hit: ForageHit): OutlinePart[];
  dispose(): void;
}

/** Three mushrooms of different sizes, with pale stems and brown caps coloured by vertex. */
export function createMushroomsGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const { x, z, size } of [
    { x: 0, z: 0, size: 1 },
    { x: 0.14, z: 0.08, size: 0.7 },
    { x: -0.1, z: 0.12, size: 0.55 },
  ]) {
    const stemHeight = 0.12 * size;
    const stem = new THREE.CylinderGeometry(0.025 * size, 0.03 * size, stemHeight, 6).translate(x, stemHeight / 2, z);
    const cap = new THREE.SphereGeometry(0.08 * size, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2)
      .scale(1, 0.7, 1)
      .translate(x, stemHeight, z);
    parts.push(coloured(stem, STEM_COLOUR), coloured(cap, CAP_COLOUR));
  }
  return mergeOwned(parts);
}

/** bushShape is the loaded berry bush, from loadBerryBushShape. Its geometry is shared, so this never disposes of it. */
export function createForageMeshes(entities: EntityStore, bushShape: BerryBushShape): ForageMeshes {
  const group = new THREE.Group();
  const spots = forageSpotEntities(entities);
  const capacity = Math.max(1, spots.size);

  const bushGeometry = bushShape.bush;
  const berriesGeometry = bushShape.berries;
  const mushroomsGeometry = createMushroomsGeometry();
  const leafMaterial = new THREE.MeshStandardMaterial({ color: LEAF_COLOUR, flatShading: true, side: THREE.DoubleSide });
  const berryMaterial = new THREE.MeshStandardMaterial({ color: BERRY_COLOUR, roughness: 0.45 });
  const mushroomMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true });
  const bushPickGeometry = new THREE.BoxGeometry(BUSH_PICK_SIZE_METRES.width, BUSH_PICK_SIZE_METRES.height, BUSH_PICK_SIZE_METRES.width);
  bushPickGeometry.translate(0, BUSH_PICK_SIZE_METRES.height / 2, 0);
  const mushroomPickGeometry = new THREE.BoxGeometry(MUSHROOM_PICK_SIZE_METRES.width, MUSHROOM_PICK_SIZE_METRES.height, MUSHROOM_PICK_SIZE_METRES.width);
  mushroomPickGeometry.translate(0, MUSHROOM_PICK_SIZE_METRES.height / 2, 0);
  const pickMaterial = new THREE.MeshBasicMaterial();

  const batch = (geometry: THREE.BufferGeometry, material: THREE.Material): THREE.InstancedMesh => {
    const mesh = new THREE.InstancedMesh(geometry, material, capacity);
    mesh.count = 0;
    mesh.frustumCulled = false;
    return mesh;
  };
  const bushes = batch(bushGeometry, leafMaterial);
  const berries = batch(berriesGeometry, berryMaterial);
  const mushrooms = batch(mushroomsGeometry, mushroomMaterial);
  group.add(bushes, berries, mushrooms);
  // Invisible boxes that clicks are tested against. They are never added to the scene, so they never draw.
  const bushPickers = batch(bushPickGeometry, pickMaterial);
  const mushroomPickers = batch(mushroomPickGeometry, pickMaterial);

  /** The spot each instance draws, in instance order, so a click can find its spot. */
  let bushesDrawn: Entity[] = [];
  let berriesDrawn: Entity[] = [];
  let mushroomsDrawn: Entity[] = [];

  const connected = spots.connect();
  const regrowing = entities.with("forageSpot", "regrowing").connect();
  let dirty = true;
  const markDirty = () => {
    dirty = true;
  };
  for (const query of [connected, regrowing]) {
    query.onEntityAdded.subscribe(markDirty);
    query.onEntityRemoved.subscribe(markDirty);
  }

  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  function rebuild(): void {
    bushesDrawn = [];
    berriesDrawn = [];
    mushroomsDrawn = [];
    for (const spot of connected) {
      const look = lookFor(spot.position.x, spot.position.z);
      rotation.setFromAxisAngle(up, look * Math.PI * 2);
      position.set(spot.position.x, spot.position.y, spot.position.z);
      scale.setScalar(PLANT_MIN_SCALE + (PLANT_MAX_SCALE - PLANT_MIN_SCALE) * look);
      matrix.compose(position, rotation, scale);
      const hasFood = spot.regrowing === undefined;
      if (spot.forageSpot.food === "berries") {
        bushes.setMatrixAt(bushesDrawn.length, matrix);
        bushPickers.setMatrixAt(bushesDrawn.length, matrix);
        bushesDrawn.push(spot);
        if (hasFood) {
          berries.setMatrixAt(berriesDrawn.length, matrix);
          berriesDrawn.push(spot);
        }
      } else if (hasFood) {
        mushrooms.setMatrixAt(mushroomsDrawn.length, matrix);
        mushroomPickers.setMatrixAt(mushroomsDrawn.length, matrix);
        mushroomsDrawn.push(spot);
      }
    }
    bushes.count = bushesDrawn.length;
    bushPickers.count = bushesDrawn.length;
    berries.count = berriesDrawn.length;
    mushrooms.count = mushroomsDrawn.length;
    mushroomPickers.count = mushroomsDrawn.length;
    for (const mesh of [bushes, berries, mushrooms, bushPickers, mushroomPickers]) mesh.instanceMatrix.needsUpdate = true;
    // Clicks test these spheres first, so they must cover the plants as they are drawn now.
    bushPickers.computeBoundingSphere();
    mushroomPickers.computeBoundingSphere();
  }

  const hits: THREE.Intersection[] = [];

  return {
    group,
    update() {
      if (dirty) rebuild();
      dirty = false;
    },
    pick(raycaster) {
      hits.length = 0;
      raycaster.intersectObjects([bushPickers, mushroomPickers], false, hits);
      hits.sort((a, b) => a.distance - b.distance);
      for (const hit of hits) {
        if (hit.instanceId === undefined) continue;
        const spot = (hit.object === bushPickers ? bushesDrawn : mushroomsDrawn)[hit.instanceId];
        if (spot?.forageSpot !== undefined) return { hit: { kind: "forage", entity: spot }, distance: hit.distance };
      }
      return undefined;
    },
    outlineOf(hit) {
      group.updateMatrixWorld();
      const placed = (mesh: THREE.InstancedMesh, index: number): THREE.Matrix4 => {
        mesh.getMatrixAt(index, matrix);
        return new THREE.Matrix4().multiplyMatrices(group.matrixWorld, matrix);
      };
      const parts: OutlinePart[] = [];
      const bush = bushesDrawn.indexOf(hit.entity);
      if (bush >= 0) parts.push({ geometry: bushGeometry, matrix: placed(bushes, bush) });
      const berry = berriesDrawn.indexOf(hit.entity);
      if (berry >= 0) parts.push({ geometry: berriesGeometry, matrix: placed(berries, berry) });
      const mushroom = mushroomsDrawn.indexOf(hit.entity);
      if (mushroom >= 0) parts.push({ geometry: mushroomsGeometry, matrix: placed(mushrooms, mushroom) });
      return parts;
    },
    dispose() {
      connected.disconnect();
      regrowing.disconnect();
      for (const item of [
        mushroomsGeometry, bushPickGeometry, mushroomPickGeometry,
        leafMaterial, berryMaterial, mushroomMaterial, pickMaterial,
        bushes, berries, mushrooms, bushPickers, mushroomPickers,
      ]) item.dispose();
    },
  };
}

/** Merges shapes into one and disposes of the parts. All parts must have the same attributes. */
function mergeOwned(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  // Flat shading needs no shared corners, and merging needs every part indexed the same way.
  const loose = parts.map((part) => (part.index === null ? part : part.toNonIndexed()));
  const merged = mergeGeometries(loose);
  for (const part of [...parts, ...loose]) part.dispose();
  merged.computeVertexNormals();
  return merged;
}

/** Gives every corner of a shape one colour, as a vertex colour. */
function coloured(geometry: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const colour = new THREE.Color(hex);
  const count = geometry.getAttribute("position").count;
  const colours = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) colour.toArray(colours, i * 3);
  geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  return geometry;
}

/** A steady value from 0 to 1 for a spot, used to vary each plant's size and turn. It only affects drawing. */
function lookFor(x: number, z: number): number {
  const value = Math.sin(x * 12.9898 + z * 78.233) * 43_758.5453;
  return value - Math.floor(value);
}

// Draws berry bushes and mushroom patches: "berry-bush" (approved) and "mushrooms" (approved) in asset-manifest.json.
// A bush is Kenney's bush, loaded in berry-bush-model.ts, with red berries while it has food.
// A mushroom patch is Kenney's group of three mushrooms, loaded in mushrooms-model.ts. It shows nothing while it grows back.
import * as THREE from "three";
import { forageSpotEntities, type Entity, type EntityStore } from "../sim/entities";
import type { BerryBushShape } from "./berry-bush-model";
import { createCulledBatch, type CullViews } from "./culled-batch";
import type { MushroomsShape } from "./mushrooms-model";
import type { OutlinePart } from "./hover-outline";

/** Kenney's bush is thin single-sided leaves, so the leaves draw on both sides. */
const LEAF_COLOUR = 0x2f6b2c;
const BERRY_COLOUR = 0xb3202e;
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
  /** Draws only the plants each camera can see. Call it once the cameras have moved for this frame. */
  cull(views: CullViews): void;
  /** What a ray from the camera hits first among bushes and mushroom patches, and how far away. */
  pick(raycaster: THREE.Raycaster): { hit: ForageHit; distance: number } | undefined;
  /** The shapes that draw a bush or mushroom patch, placed in the world. Empty when nothing is drawn there. */
  outlineOf(hit: ForageHit): OutlinePart[];
  dispose(): void;
}

/**
 * bushShape is the loaded berry bush, from loadBerryBushShape. mushroomsShape is the loaded mushroom patch, from
 * loadMushroomsShape. Their geometry is shared, so this never disposes of it.
 */
export function createForageMeshes(entities: EntityStore, bushShape: BerryBushShape, mushroomsShape: MushroomsShape): ForageMeshes {
  const group = new THREE.Group();
  const spots = forageSpotEntities(entities);
  const capacity = Math.max(1, spots.size);

  const bushGeometry = bushShape.bush;
  const berriesGeometry = bushShape.berries;
  const mushroomsGeometry = mushroomsShape;
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
  // The drawn plants: each batch draws only what the camera sees, and casts shadows only inside the sun's shadow box.
  const bushes = createCulledBatch([{ geometry: bushGeometry, material: leafMaterial }], capacity, true);
  const berries = createCulledBatch([{ geometry: berriesGeometry, material: berryMaterial }], capacity, true);
  const mushrooms = createCulledBatch([{ geometry: mushroomsGeometry, material: mushroomMaterial }], capacity, true);
  const drawnBatches = [bushes, berries, mushrooms];
  for (const drawn of drawnBatches) group.add(...drawn.meshes);
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
        bushes.set(bushesDrawn.length, matrix);
        bushPickers.setMatrixAt(bushesDrawn.length, matrix);
        bushesDrawn.push(spot);
        if (hasFood) {
          berries.set(berriesDrawn.length, matrix);
          berriesDrawn.push(spot);
        }
      } else if (hasFood) {
        mushrooms.set(mushroomsDrawn.length, matrix);
        mushroomPickers.setMatrixAt(mushroomsDrawn.length, matrix);
        mushroomsDrawn.push(spot);
      }
    }
    for (let index = bushesDrawn.length; index < capacity; index += 1) bushes.set(index, undefined);
    for (let index = berriesDrawn.length; index < capacity; index += 1) berries.set(index, undefined);
    for (let index = mushroomsDrawn.length; index < capacity; index += 1) mushrooms.set(index, undefined);
    bushPickers.count = bushesDrawn.length;
    mushroomPickers.count = mushroomsDrawn.length;
    for (const mesh of [bushPickers, mushroomPickers]) mesh.instanceMatrix.needsUpdate = true;
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
      for (const drawn of drawnBatches) drawn.cull();
    },
    cull(views) {
      for (const drawn of drawnBatches) drawn.cull(views);
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
      const parts: OutlinePart[] = [];
      const outline = (drawn: typeof bushes, index: number, geometry: THREE.BufferGeometry): void => {
        if (index >= 0 && drawn.matrixAt(index, matrix)) parts.push({ geometry, matrix: new THREE.Matrix4().multiplyMatrices(group.matrixWorld, matrix) });
      };
      outline(bushes, bushesDrawn.indexOf(hit.entity), bushGeometry);
      outline(berries, berriesDrawn.indexOf(hit.entity), berriesGeometry);
      outline(mushrooms, mushroomsDrawn.indexOf(hit.entity), mushroomsGeometry);
      return parts;
    },
    dispose() {
      connected.disconnect();
      regrowing.disconnect();
      for (const item of [
        bushPickGeometry,
        mushroomPickGeometry,
        leafMaterial,
        berryMaterial,
        mushroomMaterial,
        pickMaterial,
        bushes,
        berries,
        mushrooms,
        bushPickers,
        mushroomPickers,
      ])
        item.dispose();
    },
  };
}

/** A steady value from 0 to 1 for a spot, used to vary each plant's size and turn. It only affects drawing. */
function lookFor(x: number, z: number): number {
  const value = Math.sin(x * 12.9898 + z * 78.233) * 43_758.5453;
  return value - Math.floor(value);
}

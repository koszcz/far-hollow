// Draws drying racks and drying rack blueprints: the draft "drying-rack" asset in asset-manifest.json, built in code.
// Added by food-keeping ticket 02.
// A drying rack is two A-frame ends of sticks, a top rail across their peaks, and two lower rails, lashed with cord.
// The food on it hangs from the top rail on short lengths of cord, one spot for each food it holds, in the order it was hung.
// Fresh berries hang as a red bunch and a fresh mushroom as a pale-stemmed brown cap. Once dried, each shows the shrunken,
// darker shape of the draft "dried-food-piles" asset, from dried-food-shapes.ts.
// The model is built in two stages, each taking half of construction: the sticks, then the cord lashings.
// plank-furniture-meshes.ts draws the stages. This file adds the food.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { furnitureEntities, type Entity, type EntityStore } from "../sim/entities";
import { DRYING_RACK_DEPTH_METRES, DRYING_RACK_WIDTH_METRES } from "../sim/furniture/drying-rack";
import { quarterTurnsToRadians } from "../sim/quarter-turns";
import { DRYING_RACK_FOOD_LIMIT, isDried, PRESERVED_FORM, type FoodOnRack, type RackFood } from "../sim/rack-food";
import { driedFoodParts } from "./dried-food-shapes";
import { createFurnitureMeshes, type FurnitureMeshes, type FurniturePart } from "./plank-furniture-meshes";

/** How many stages the drying rack model is built in: the sticks, then the cord lashings. */
export const DRYING_RACK_MODEL_STAGES = 2;
/** How tall a drying rack is, to the top of its top rail, in metres. */
export const DRYING_RACK_HEIGHT_METRES = 1.05;

/** How thick the sticks are, in metres. */
const STICK_METRES = 0.03;
/** How high the two lower rails sit, in metres, and how far out from the middle they run, front and back. */
const LOWER_RAIL_HEIGHT_METRES = 0.45;
/** The bark-brown of the sticks, as in a pile, and the pale cord, as in the cord pile. */
const STICK_COLOUR = 0x9b7350;
const CORD_COLOUR = 0xd8c08a;
/** Each A-frame end stands this far in from the rack's sides, in metres. */
const END_INSET_METRES = 0.05;
/** How long each food's string is, from the top rail down to the food, in metres. */
const STRING_METRES = 0.12;
/** Food on the rack is drawn this much larger than true size, so it reads from the game's camera, as the carried stone is. */
const FOOD_SCALE = 2;
/** Fresh food on the rack: red berries, and a mushroom's brown cap and pale stem. */
const BERRY_COLOUR = 0xb3202e;
const CAP_COLOUR = 0xb05a34;
const STEM_COLOUR = 0xead8b8;

/** Where each A-frame end stands along the rails. */
const END_X = DRYING_RACK_WIDTH_METRES / 2 - END_INSET_METRES;
/** The top of the A-frames, where the top rail rests. */
const PEAK_METRES = DRYING_RACK_HEIGHT_METRES - STICK_METRES / 2;
/** How far each leg's foot stands out from the middle, front or back. */
const FOOT_Z = DRYING_RACK_DEPTH_METRES / 2 - STICK_METRES;
/** How far each leg leans from upright, in radians, so the two legs of an end meet at the peak. */
const LEG_LEAN = Math.atan2(FOOT_Z, PEAK_METRES);
const LEG_LENGTH = Math.hypot(FOOT_Z, PEAK_METRES);
/** How far out from the middle the legs are at the lower rails' height. */
const LOWER_RAIL_Z = FOOT_Z * (1 - LOWER_RAIL_HEIGHT_METRES / PEAK_METRES);

/** The sticks: two legs at each end, leaning in to meet at the peak, the top rail across the peaks, and a lower rail front and back. */
function sticks(): FurniturePart[] {
  const legs = [-END_X, END_X].flatMap((x): FurniturePart[] =>
    [-1, 1].map((side) => ({
      size: [STICK_METRES, LEG_LENGTH, STICK_METRES],
      at: [x, PEAK_METRES / 2, (side * FOOT_Z) / 2],
      // A leg at the back leans its top forward, and one at the front leans it back.
      lean: -side * LEG_LEAN,
      colour: STICK_COLOUR,
    })),
  );
  const topRail: FurniturePart = { size: [DRYING_RACK_WIDTH_METRES, STICK_METRES, STICK_METRES], at: [0, PEAK_METRES, 0], colour: STICK_COLOUR };
  const lowerRails = [-1, 1].map((side): FurniturePart => ({
    size: [2 * END_X + STICK_METRES * 2, STICK_METRES * 0.85, STICK_METRES * 0.85],
    at: [0, LOWER_RAIL_HEIGHT_METRES, side * (LOWER_RAIL_Z + STICK_METRES)],
    colour: STICK_COLOUR,
  }));
  return [...legs, topRail, ...lowerRails];
}

/** The cord lashings: a band of cord round each joint where a rail meets an end. */
function lashings(): FurniturePart[] {
  const band = STICK_METRES * 1.6;
  return [-END_X, END_X].flatMap((x): FurniturePart[] => [
    { size: [band, band, band], at: [x, PEAK_METRES, 0], colour: CORD_COLOUR },
    ...[-1, 1].map((side): FurniturePart => ({
      size: [band, band, band],
      at: [x, LOWER_RAIL_HEIGHT_METRES, side * (LOWER_RAIL_Z + STICK_METRES)],
      colour: CORD_COLOUR,
    })),
  ]);
}

/** Where each food hangs along the top rail, in the order the rack fills: spread evenly between the two ends. */
export function hangingSpotX(index: number): number {
  const span = 2 * END_X - 0.16;
  return -span / 2 + (span * (index + 0.5)) / DRYING_RACK_FOOD_LIMIT;
}

/** The look of one food on the rack: fresh berries or mushroom, or their dried form. */
type HangingLook = RackFood | "driedBerries" | "driedMushroom";

/** The look of a food on the rack, as it is now. */
function lookOf(item: FoodOnRack): HangingLook {
  return isDried(item) ? PRESERVED_FORM[item.food] : item.food;
}

export function createDryingRackMeshes(entities: EntityStore): FurnitureMeshes {
  const racks = createFurnitureMeshes(entities, {
    structure: "dryingRack",
    stages: [sticks(), lashings()],
    pickBox: { size: [DRYING_RACK_WIDTH_METRES, DRYING_RACK_HEIGHT_METRES, DRYING_RACK_DEPTH_METRES], at: [0, DRYING_RACK_HEIGHT_METRES / 2, 0] },
  });

  const resources = new Set<{ dispose(): void }>();
  const track = <T extends { dispose(): void }>(resource: T): T => {
    resources.add(resource);
    return resource;
  };
  const material = (colour: number) => track(new THREE.MeshStandardMaterial({ color: colour, roughness: 0.8, flatShading: true }));
  const stringMaterial = material(CORD_COLOUR);
  const stringGeometry = track(new THREE.BoxGeometry(0.004, STRING_METRES, 0.004).translate(0, -STRING_METRES / 2, 0));
  const berryGeometry = track(
    mergeGeometries(
      [
        [0, 0, 0.016],
        [0.018, 0.012, 0.014],
        [-0.017, 0.01, 0.015],
        [0.004, 0.028, 0.013],
        [0, -0.016, 0.014],
      ].map(([x = 0, y = 0, radius = 0.014]) => new THREE.SphereGeometry(radius, 7, 5).translate(x, y, 0)),
    ),
  );
  const fresh: Readonly<Record<RackFood, readonly { geometry: THREE.BufferGeometry; material: THREE.Material }[]>> = {
    berries: [{ geometry: berryGeometry, material: material(BERRY_COLOUR) }],
    mushroom: [
      { geometry: track(new THREE.CylinderGeometry(0.008, 0.01, 0.035, 6).translate(0, -0.0175, 0)), material: material(STEM_COLOUR) },
      {
        geometry: track(new THREE.SphereGeometry(0.03, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.7, 1).rotateX(Math.PI)),
        material: material(CAP_COLOUR),
      },
    ],
  };
  // Dried food hangs upside down from its string, so turn the pile shapes over: their underside goes up, against the string.
  const dried = driedFoodParts(material, track);
  for (const parts of Object.values(dried)) for (const part of parts) part.geometry.rotateX(Math.PI);
  const looks: Readonly<Record<HangingLook, readonly { geometry: THREE.BufferGeometry; material: THREE.Material }[]>> = { ...fresh, ...dried };

  /** The food hanging on each rack, as a group set where the rack stands, with one group for each spot. */
  const hanging = new Map<Entity, { root: THREE.Group; spots: { group: THREE.Group; look: HangingLook | undefined }[] }>();
  const finished = furnitureEntities(entities);

  function hangingOf(entity: Entity) {
    let item = hanging.get(entity);
    if (item === undefined) {
      const root = new THREE.Group();
      racks.group.add(root);
      item = { root, spots: [] };
      hanging.set(entity, item);
    }
    return item;
  }

  /** Shows `look` at one spot along the rail, or nothing, rebuilding the spot only when its look changes. */
  function showSpot(spot: { group: THREE.Group; look: HangingLook | undefined }, look: HangingLook | undefined): void {
    if (spot.look === look) return;
    spot.look = look;
    spot.group.clear();
    if (look === undefined) return;
    spot.group.add(new THREE.Mesh(stringGeometry, stringMaterial));
    for (const part of looks[look]) {
      const mesh = new THREE.Mesh(part.geometry, part.material);
      mesh.position.y = -STRING_METRES;
      mesh.scale.setScalar(FOOD_SCALE);
      mesh.castShadow = true;
      spot.group.add(mesh);
    }
  }

  return {
    ...racks,
    update() {
      racks.update();
      const seen = new Set<Entity>();
      for (const entity of finished) {
        if (entity.furniture !== "dryingRack") continue;
        const item = hangingOf(entity);
        item.root.position.set(entity.position.x, entity.position.y + PEAK_METRES - STICK_METRES / 2, entity.position.z);
        item.root.rotation.y = quarterTurnsToRadians(entity.facing?.turns ?? 0);
        const food = entity.dryingRack ?? [];
        while (item.spots.length < food.length) item.spots.push({ group: new THREE.Group(), look: undefined });
        item.spots.forEach((spot, index) => {
          if (spot.group.parent === null) {
            spot.group.position.x = hangingSpotX(index);
            item.root.add(spot.group);
          }
          const onRack = food[index];
          showSpot(spot, onRack === undefined ? undefined : lookOf(onRack));
        });
        seen.add(entity);
      }
      for (const [entity, item] of [...hanging]) {
        if (seen.has(entity)) continue;
        racks.group.remove(item.root);
        hanging.delete(entity);
      }
    },
    dispose() {
      racks.dispose();
      for (const resource of resources) resource.dispose();
    },
  };
}

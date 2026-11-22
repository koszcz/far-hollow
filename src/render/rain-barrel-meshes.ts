// Draws rain barrels and rain barrel blueprints: the draft "rain-barrel" asset in asset-manifest.json, built in code.
// A rain barrel is a ring of plank staves round a plank bottom, open on top, held by two dark hoops.
// Inside, a water surface rises with the drinks it holds. An empty barrel shows no water.
// The model is built in two stages, each taking half of construction: the bottom with its staves, then the hoops.
// plank-furniture-meshes.ts draws the stages. This file adds the water.
import * as THREE from "three";
import { furnitureEntities, type Entity, type EntityStore } from "../sim/entities";
import { RAIN_BARREL_DRINK_LIMIT, RAIN_BARREL_WIDTH_METRES } from "../sim/furniture/rain-barrel";
import { createFurnitureMeshes, type FurnitureMeshes, type FurniturePart } from "./plank-furniture-meshes";

/** How many stages the rain barrel model is built in: the bottom with its staves, then the hoops. */
export const RAIN_BARREL_MODEL_STAGES = 2;
/** How tall a rain barrel is, in metres. */
export const RAIN_BARREL_HEIGHT_METRES = 0.8;

/** How many staves stand round the barrel, and how thick each is, in metres. */
const STAVE_COUNT = 12;
const STAVE_METRES = 0.03;
/** How thick the bottom is, and how high its top is above the ground, in metres. */
const BOTTOM_METRES = 0.03;
const BOTTOM_TOP_METRES = 0.06;
/** How tall and how thick each hoop is, how high their middles are above the ground, and their dark wood. */
const HOOP_HEIGHT_METRES = 0.045;
const HOOP_METRES = 0.012;
const HOOP_HEIGHTS_METRES = [0.18, 0.62];
const HOOP_COLOUR = 0x4a3b2a;
/** A full barrel's water stops this far below the rim, in metres. */
const FULL_BELOW_RIM_METRES = 0.06;
/** The water: dark and a little blue, see-through, with a glossy top. */
const WATER_COLOUR = 0x4f7f9c;
const WATER_OPACITY = 0.8;

/** The height of the water surface above the barrel's base for the drinks it holds, in metres, or undefined if it holds none. */
export function waterSurfaceHeight(drinks: number): number | undefined {
  if (drinks <= 0) return undefined;
  const share = Math.min(1, drinks / RAIN_BARREL_DRINK_LIMIT);
  return BOTTOM_TOP_METRES + share * (RAIN_BARREL_HEIGHT_METRES - FULL_BELOW_RIM_METRES - BOTTOM_TOP_METRES);
}

/** Parts set round the barrel's middle, one at each stave's angle, at this height. */
function aroundBarrel(radius: number, height: number, make: (angle: number) => Omit<FurniturePart, "at" | "turn">): FurniturePart[] {
  return Array.from({ length: STAVE_COUNT }, (_, i) => {
    const angle = (i / STAVE_COUNT) * Math.PI * 2;
    return { ...make(angle), at: [Math.sin(angle) * radius, height, Math.cos(angle) * radius], turn: angle };
  });
}

export function createRainBarrelMeshes(entities: EntityStore): FurnitureMeshes {
  const radius = RAIN_BARREL_WIDTH_METRES / 2;
  const staveRadius = radius - STAVE_METRES / 2;
  // Each stave is a little wider than its share of the ring, so the staves meet without gaps.
  const staveWidth = ((2 * Math.PI * radius) / STAVE_COUNT) * 1.04;
  const bottomWidth = (radius - STAVE_METRES) * Math.SQRT2;
  const staves: FurniturePart[] = [
    { size: [bottomWidth, BOTTOM_METRES, bottomWidth], at: [0, BOTTOM_TOP_METRES - BOTTOM_METRES / 2, 0] },
    ...aroundBarrel(staveRadius, RAIN_BARREL_HEIGHT_METRES / 2, () => ({ size: [staveWidth, RAIN_BARREL_HEIGHT_METRES, STAVE_METRES] })),
  ];
  const hoops: FurniturePart[] = HOOP_HEIGHTS_METRES.flatMap((height) =>
    aroundBarrel(radius + HOOP_METRES / 2, height, () => ({ size: [staveWidth * 1.03, HOOP_HEIGHT_METRES, HOOP_METRES], colour: HOOP_COLOUR })),
  );
  const barrels = createFurnitureMeshes(entities, {
    structure: "rainBarrel",
    stages: [staves, hoops],
    pickBox: { size: [RAIN_BARREL_WIDTH_METRES, RAIN_BARREL_HEIGHT_METRES, RAIN_BARREL_WIDTH_METRES], at: [0, RAIN_BARREL_HEIGHT_METRES / 2, 0] },
  });

  const waterGeometry = new THREE.CylinderGeometry(radius - STAVE_METRES, radius - STAVE_METRES, 0.01, 20);
  const waterMaterial = new THREE.MeshStandardMaterial({ color: WATER_COLOUR, transparent: true, opacity: WATER_OPACITY, roughness: 0.15 });
  const waters = new Map<Entity, THREE.Mesh>();
  const finished = furnitureEntities(entities);

  /** The water mesh of a barrel, made the first time it is needed. */
  function waterOf(entity: Entity): THREE.Mesh {
    let water = waters.get(entity);
    if (water === undefined) {
      water = new THREE.Mesh(waterGeometry, waterMaterial);
      water.receiveShadow = true;
      barrels.group.add(water);
      waters.set(entity, water);
    }
    return water;
  }

  return {
    ...barrels,
    update() {
      barrels.update();
      const seen = new Set<Entity>();
      for (const entity of finished) {
        if (entity.furniture !== "rainBarrel") continue;
        const height = waterSurfaceHeight(entity.rainBarrel?.held ?? 0);
        const water = waterOf(entity);
        water.visible = height !== undefined;
        water.position.set(entity.position.x, entity.position.y + (height ?? 0), entity.position.z);
        seen.add(entity);
      }
      for (const [entity, water] of [...waters]) {
        if (seen.has(entity)) continue;
        barrels.group.remove(water);
        waters.delete(entity);
      }
    },
    dispose() {
      barrels.dispose();
      waterGeometry.dispose();
      waterMaterial.dispose();
    },
  };
}

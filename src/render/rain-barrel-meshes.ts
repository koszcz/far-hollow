// Draws rain barrels and rain barrel blueprints: the approved "rain-barrel" asset in asset-manifest.json, built in code.
// A rain barrel is a ring of plank staves that bulge at the middle, round a bottom of boards, open on top.
// A band of darker wood runs round the rim, and two dark iron hoops hold the staves.
// Inside, a water surface rises with the drinks it holds. An empty barrel shows no water.
// The model is built in two stages, each taking half of construction: the bottom with its staves and rim, then the hoops.
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
/** The staves bulge: the barrel's outside is this far from its middle at the top and bottom, in metres. At half height it is the full half width. */
const END_RADIUS_METRES = 0.26;
/** How much darker or lighter each stave is than plank wood, in turn round the barrel. */
const STAVE_SHADES = [1, 0.9, 1.04, 0.94, 0.86, 1.02, 0.97, 0.91, 1.05, 0.88, 0.99, 0.93];
/** How thick the bottom is, how high its top is above the ground, and how many boards it is made of, in metres. */
const BOTTOM_METRES = 0.03;
const BOTTOM_TOP_METRES = 0.06;
const BOTTOM_BOARDS = 5;
/** The rim: a darker band of wood round the top edge, this tall and this much thicker than a stave, in metres. */
const RIM_HEIGHT_METRES = 0.025;
const RIM_EXTRA_METRES = 0.008;
const RIM_SHADE = 0.78;
/** How tall and how thick each hoop is, how high their middles are above the ground, and their dark iron. */
const HOOP_HEIGHT_METRES = 0.05;
const HOOP_METRES = 0.012;
const HOOP_HEIGHTS_METRES = [0.17, 0.63];
const HOOP_COLOUR = 0x3e3d3b;
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

/** How far the barrel's outside is from its middle at this height above its base, in metres. It is widest at half height. */
function outsideRadius(height: number): number {
  const half = RAIN_BARREL_HEIGHT_METRES / 2;
  const fromMiddle = Math.min(1, Math.abs(height - half) / half);
  return RAIN_BARREL_WIDTH_METRES / 2 - fromMiddle * (RAIN_BARREL_WIDTH_METRES / 2 - END_RADIUS_METRES);
}

/** How far the staves lean out from upright, in radians: each lower half tips out, each upper half tips back in. */
const STAVE_LEAN = Math.atan2(RAIN_BARREL_WIDTH_METRES / 2 - END_RADIUS_METRES, RAIN_BARREL_HEIGHT_METRES / 2);

/** How wide one part of a ring round the barrel is at this outside radius, a little wider than its share so the parts meet without gaps. */
function ringPartWidth(radius: number): number {
  return ((2 * Math.PI * radius) / STAVE_COUNT) * 1.05;
}

/** Parts set round the barrel, one at each stave's angle, with their middles this far out and this high. */
function aroundBarrel(radius: number, height: number, make: (i: number) => Omit<FurniturePart, "at" | "turn">): FurniturePart[] {
  return Array.from({ length: STAVE_COUNT }, (_, i) => {
    const angle = (i / STAVE_COUNT) * Math.PI * 2;
    return { ...make(i), at: [Math.sin(angle) * radius, height, Math.cos(angle) * radius], turn: angle };
  });
}

/** The lean of a part on the barrel's side at this height: out below half height, in above it. */
function sideLean(height: number): number {
  return height < RAIN_BARREL_HEIGHT_METRES / 2 ? STAVE_LEAN : -STAVE_LEAN;
}

/** The bottom: boards laid side by side, each cut to the round inside of the staves. */
function bottomBoards(): FurniturePart[] {
  const inside = outsideRadius(BOTTOM_TOP_METRES) - STAVE_METRES;
  const boardWidth = (inside * 2) / BOTTOM_BOARDS;
  return Array.from({ length: BOTTOM_BOARDS }, (_, i) => {
    const x = -inside + boardWidth * (i + 0.5);
    const length = 2 * Math.sqrt(inside * inside - x * x);
    return { size: [boardWidth * 0.98, BOTTOM_METRES, length], at: [x, BOTTOM_TOP_METRES - BOTTOM_METRES / 2, 0] };
  });
}

/** The staves, each in two halves that meet at the bulge. Both halves of a stave share its shade. */
function staveHalves(): FurniturePart[] {
  const half = RAIN_BARREL_HEIGHT_METRES / 2;
  const length = Math.hypot(half, RAIN_BARREL_WIDTH_METRES / 2 - END_RADIUS_METRES);
  const width = ringPartWidth((RAIN_BARREL_WIDTH_METRES / 2 + END_RADIUS_METRES) / 2);
  return [half / 2, half * 1.5].flatMap((height) =>
    aroundBarrel(outsideRadius(height) - STAVE_METRES / 2, height, (i) => ({
      size: [width, length, STAVE_METRES],
      lean: sideLean(height),
      shade: STAVE_SHADES[i % STAVE_SHADES.length] ?? 1,
    })),
  );
}

/** The rim: a band of darker wood round the top edge of the staves. */
function rim(): FurniturePart[] {
  const height = RAIN_BARREL_HEIGHT_METRES - RIM_HEIGHT_METRES / 2;
  const thickness = STAVE_METRES + RIM_EXTRA_METRES;
  const radius = outsideRadius(height) + RIM_EXTRA_METRES / 2 - thickness / 2;
  return aroundBarrel(radius, height, () => ({
    size: [ringPartWidth(radius + thickness / 2), RIM_HEIGHT_METRES, thickness],
    lean: -STAVE_LEAN,
    shade: RIM_SHADE,
  }));
}

/** The hoops: iron bands round the staves, each leaning with the staves it holds. */
function hoops(): FurniturePart[] {
  return HOOP_HEIGHTS_METRES.flatMap((height) => {
    const radius = outsideRadius(height) + HOOP_METRES / 2;
    return aroundBarrel(radius, height, () => ({
      size: [ringPartWidth(radius + HOOP_METRES / 2), HOOP_HEIGHT_METRES, HOOP_METRES],
      lean: sideLean(height),
      colour: HOOP_COLOUR,
    }));
  });
}

export function createRainBarrelMeshes(entities: EntityStore): FurnitureMeshes {
  const staves: FurniturePart[] = [...bottomBoards(), ...staveHalves(), ...rim()];
  const barrels = createFurnitureMeshes(entities, {
    structure: "rainBarrel",
    stages: [staves, hoops()],
    pickBox: { size: [RAIN_BARREL_WIDTH_METRES, RAIN_BARREL_HEIGHT_METRES, RAIN_BARREL_WIDTH_METRES], at: [0, RAIN_BARREL_HEIGHT_METRES / 2, 0] },
  });

  const waterGeometry = new THREE.CylinderGeometry(1, 1, 0.01, 24);
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
        // The water fills the barrel's round inside, which is wider at the bulge.
        const inside = outsideRadius(height ?? 0) - STAVE_METRES;
        water.scale.set(inside, 1, inside);
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

// Draws campfires and campfire blueprints with the code-built placeholder shape approved in asset-manifest.json as "campfire".
// A blueprint grows stick by stick with the code-built "campfire-build-animation".
// A lit campfire has flames, a wide glow, and a brighter pool of light that marks how far its warmth reaches. Together they are the code-built "fire-effect".
import * as THREE from "three";
import { CAMPFIRE_STICK_COST } from "../sim/building";
import { CAMPFIRE_FUEL_LIMIT_MINUTES, CAMPFIRE_WARMTH_RADIUS_METRES } from "../sim/campfires";
import { blueprintEntities, campfireEntities, type Entity, type EntityStore } from "../sim/entities";

const STONE_COLOUR = 0x8c8c86;
const STICK_COLOUR = 0x8a6a45;
const BLUEPRINT_COLOUR = 0xbfe3ff;
/** How see-through the parts of a blueprint not yet built are, from 0 (invisible) to 1 (solid). */
const BLUEPRINT_OPACITY = 0.35;

const STONE_COUNT = 8;
const STONE_RING_RADIUS_METRES = 0.55;
const STONE_SIZE_METRES = 0.14;
const STICK_LENGTH_METRES = 0.8;
const STICK_RADIUS_METRES = 0.035;
/** Sticks lean in toward the centre at this angle from upright, in radians, to make a cone. */
const STICK_LEAN_RADIANS = 0.5;
const FLAME_OUTER_COLOUR = 0xff6a1a;
const FLAME_INNER_COLOUR = 0xffd04a;
const GLOW_COLOUR = 0xff9a4a;
const FLAME_HEIGHT_METRES = 0.9;
const FLAME_RADIUS_METRES = 0.3;
/** Flames on a campfire with almost no fuel left shrink to this share of their full size. Fuller fires burn bigger. */
const FLAME_SMALLEST_SCALE = 0.35;
/** A campfire holding this much fuel, in game minutes, or more, burns at full size. */
const FLAME_FULL_SIZE_FUEL_MINUTES = CAMPFIRE_FUEL_LIMIT_MINUTES / 4;
/** How bright the glow is at full size. It lights the ground out to GLOW_REACH_METRES. */
const GLOW_STRENGTH = 6;
const GLOW_REACH_METRES = 14;
/** How far the light falls off with distance. 1 is a gentle, game-like fall-off. */
const GLOW_FALL_OFF = 1;
const GLOW_HEIGHT_METRES = 0.8;
/**
 * A second, brighter light lights a pool of ground that ends where the fire stops warming the player, at CAMPFIRE_WARMTH_RADIUS_METRES.
 * It does not fall off with distance, so it stays bright across the pool and fades only near its edge.
 * It does not shrink as the fuel runs low, because the warmth range does not either.
 */
const WARMTH_POOL_STRENGTH = 3;
const WARMTH_POOL_HEIGHT_METRES = 2;
/** A light's reach is measured from the light itself, so this makes it end on the ground exactly at the warmth range. */
const WARMTH_POOL_REACH_METRES = Math.hypot(CAMPFIRE_WARMTH_RADIUS_METRES, WARMTH_POOL_HEIGHT_METRES);
/** How fast and how much the flames and glow flicker. */
const FLICKER_PER_SECOND = 9;
const FLICKER_AMOUNT = 0.12;

/** Clicks on a campfire or blueprint hit an invisible cylinder this wide and tall, in metres. */
const PICK_RADIUS_METRES = 0.8;
const PICK_HEIGHT_METRES = 0.8;

/** What a click on a campfire or blueprint landed on. */
export type CampfireHit = { kind: "blueprint"; entity: Entity } | { kind: "campfire"; entity: Entity };

export interface CampfireMeshes {
  readonly group: THREE.Group;
  /** Brings every campfire and blueprint up to date with game state. */
  update(nowSeconds: number): void;
  /** What a ray from the camera hits first among campfires and blueprints, and how far away. */
  pick(raycaster: THREE.Raycaster): { hit: CampfireHit; distance: number } | undefined;
  dispose(): void;
}

interface Drawn {
  readonly root: THREE.Group;
  readonly stones: THREE.Mesh[];
  /** Each stick's shape starts at its foot, so it grows upward from the ground. */
  readonly sticks: { mesh: THREE.Mesh }[];
  readonly picker: THREE.Mesh;
  /** Flames and glow. Hidden while the campfire is unlit. */
  readonly fire: THREE.Group;
  readonly flames: THREE.Group;
  readonly glow: THREE.PointLight;
  /** Lights the ground out to the warmth range. */
  readonly warmthPool: THREE.PointLight;
}

export function createCampfireMeshes(entities: EntityStore): CampfireMeshes {
  const group = new THREE.Group();
  const stoneGeometry = new THREE.DodecahedronGeometry(STONE_SIZE_METRES, 0);
  const stickGeometry = new THREE.CylinderGeometry(STICK_RADIUS_METRES, STICK_RADIUS_METRES, STICK_LENGTH_METRES, 5);
  stickGeometry.translate(0, STICK_LENGTH_METRES / 2, 0);
  const pickGeometry = new THREE.CylinderGeometry(PICK_RADIUS_METRES, PICK_RADIUS_METRES, PICK_HEIGHT_METRES, 8);
  pickGeometry.translate(0, PICK_HEIGHT_METRES / 2, 0);
  const stoneMaterial = new THREE.MeshStandardMaterial({ color: STONE_COLOUR, flatShading: true });
  const stickMaterial = new THREE.MeshStandardMaterial({ color: STICK_COLOUR, flatShading: true });
  const blueprintMaterial = new THREE.MeshStandardMaterial({
    color: BLUEPRINT_COLOUR, transparent: true, opacity: BLUEPRINT_OPACITY, depthWrite: false,
  });
  const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });
  const flameGeometry = new THREE.ConeGeometry(FLAME_RADIUS_METRES, FLAME_HEIGHT_METRES, 7, 1, true);
  flameGeometry.translate(0, FLAME_HEIGHT_METRES / 2, 0);
  // Flames give off their own light, so they ignore the scene's lights and stay bright at night.
  const outerFlameMaterial = new THREE.MeshBasicMaterial({
    color: FLAME_OUTER_COLOUR, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide,
  });
  const innerFlameMaterial = new THREE.MeshBasicMaterial({ color: FLAME_INNER_COLOUR, side: THREE.DoubleSide });

  const drawn = new Map<Entity, Drawn>();
  const pickers: THREE.Mesh[] = [];
  const blueprints = blueprintEntities(entities);
  const campfires = campfireEntities(entities);

  function draw(entity: Entity & { position: { x: number; y: number; z: number } }): Drawn {
    const existing = drawn.get(entity);
    if (existing !== undefined) return existing;
    const root = new THREE.Group();
    const stones: THREE.Mesh[] = [];
    for (let i = 0; i < STONE_COUNT; i += 1) {
      const angle = (i / STONE_COUNT) * Math.PI * 2;
      const stone = new THREE.Mesh(stoneGeometry, blueprintMaterial);
      stone.position.set(Math.sin(angle) * STONE_RING_RADIUS_METRES, STONE_SIZE_METRES * 0.5, Math.cos(angle) * STONE_RING_RADIUS_METRES);
      stone.rotation.set(angle, angle * 2, 0);
      root.add(stone);
      stones.push(stone);
    }
    const sticks: Drawn["sticks"] = [];
    for (let i = 0; i < CAMPFIRE_STICK_COST; i += 1) {
      const angle = (i / CAMPFIRE_STICK_COST) * Math.PI * 2;
      const pivot = new THREE.Group();
      // Each stick's foot sits out from the centre, and the stick leans in so the tops meet.
      const footOut = Math.sin(STICK_LEAN_RADIANS) * STICK_LENGTH_METRES * 0.9;
      pivot.position.set(Math.sin(angle) * footOut, 0, Math.cos(angle) * footOut);
      pivot.rotation.set(0, angle, 0);
      const mesh = new THREE.Mesh(stickGeometry, blueprintMaterial);
      mesh.rotation.x = -STICK_LEAN_RADIANS;
      pivot.add(mesh);
      root.add(pivot);
      sticks.push({ mesh });
    }
    const fire = new THREE.Group();
    fire.visible = false;
    const flames = new THREE.Group();
    const outerFlame = new THREE.Mesh(flameGeometry, outerFlameMaterial);
    const innerFlame = new THREE.Mesh(flameGeometry, innerFlameMaterial);
    innerFlame.scale.set(0.55, 0.7, 0.55);
    flames.add(outerFlame, innerFlame);
    fire.add(flames);
    // The glow stays in the scene while unlit, at zero strength, so lighting a fire does not rebuild every material.
    const glow = new THREE.PointLight(GLOW_COLOUR, 0, GLOW_REACH_METRES, GLOW_FALL_OFF);
    glow.position.set(0, GLOW_HEIGHT_METRES, 0);
    root.add(glow);
    const warmthPool = new THREE.PointLight(GLOW_COLOUR, 0, WARMTH_POOL_REACH_METRES, 0);
    warmthPool.position.set(0, WARMTH_POOL_HEIGHT_METRES, 0);
    root.add(warmthPool);
    root.add(fire);
    const picker = new THREE.Mesh(pickGeometry, pickMaterial);
    picker.userData.entity = entity;
    root.add(picker);
    pickers.push(picker);
    root.position.set(entity.position.x, entity.position.y, entity.position.z);
    group.add(root);
    const result = { root, stones, sticks, picker, fire, flames, glow, warmthPool };
    drawn.set(entity, result);
    return result;
  }

  /** Shows how far construction has gone: built sticks are solid, the stick being laid grows, and the rest are see-through. */
  function showProgress(item: Drawn, progress: number): void {
    const stagesDone = progress * CAMPFIRE_STICK_COST;
    item.sticks.forEach(({ mesh }, index) => {
      const grown = Math.min(1, Math.max(0, stagesDone - index));
      const started = grown > 0;
      mesh.material = started ? stickMaterial : blueprintMaterial;
      // A stick being laid rises from the ground. Unstarted sticks show at full size as part of the outline.
      mesh.scale.set(1, started ? Math.max(0.05, grown) : 1, 1);
    });
    for (const stone of item.stones) stone.material = progress >= 1 ? stoneMaterial : blueprintMaterial;
  }

  /**
   * Shows a lit campfire's flames, glow, and warmth pool, flickering. The flames burn smaller as the fuel runs low,
   * so the player can see roughly how much fuel is left.
   */
  function showFire(item: Drawn, campfire: { lit: boolean; fuelMinutes: number }, nowSeconds: number, seed: number): void {
    item.fire.visible = campfire.lit;
    if (!campfire.lit) {
      item.glow.intensity = 0;
      item.warmthPool.intensity = 0;
      return;
    }
    const fullness = Math.min(1, campfire.fuelMinutes / FLAME_FULL_SIZE_FUEL_MINUTES);
    const size = FLAME_SMALLEST_SCALE + (1 - FLAME_SMALLEST_SCALE) * fullness;
    const t = nowSeconds * FLICKER_PER_SECOND + seed;
    const flicker = 1 + FLICKER_AMOUNT * (Math.sin(t) * 0.6 + Math.sin(t * 2.3 + 1.7) * 0.4);
    item.flames.scale.set(size, size * flicker, size);
    item.flames.rotation.y = t * 0.1;
    item.glow.intensity = GLOW_STRENGTH * size * flicker;
    item.warmthPool.intensity = WARMTH_POOL_STRENGTH * flicker;
  }

  function forget(entity: Entity): void {
    const item = drawn.get(entity);
    if (item === undefined) return;
    group.remove(item.root);
    pickers.splice(pickers.indexOf(item.picker), 1);
    drawn.delete(entity);
  }

  const hits: THREE.Intersection[] = [];

  return {
    group,
    update(nowSeconds) {
      const seen = new Set<Entity>();
      for (const blueprint of blueprints) {
        showProgress(draw(blueprint), blueprint.blueprint.progress);
        seen.add(blueprint);
      }
      for (const campfire of campfires) {
        const item = draw(campfire);
        showProgress(item, 1);
        showFire(item, campfire.campfire, nowSeconds, campfire.position.x * 3.1 + campfire.position.z * 1.7);
        seen.add(campfire);
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
        if (entity?.campfire !== undefined) return { hit: { kind: "campfire", entity }, distance: hit.distance };
      }
      return undefined;
    },
    dispose() {
      for (const item of [stoneGeometry, stickGeometry, pickGeometry, stoneMaterial, stickMaterial, blueprintMaterial, pickMaterial,
        flameGeometry, outerFlameMaterial, innerFlameMaterial]) {
        item.dispose();
      }
    },
  };
}

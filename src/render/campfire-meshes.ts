// Draws campfires and campfire blueprints with the code-built shape listed in asset-manifest.json as "campfire" (approved).
// The shape is a ring of uneven stones in two greys, a cone of sticks that match the sticks on the forest floor,
// and a bed of ash once the campfire is built. The stick tips turn black while the fire burns.
// A blueprint is built with the code-built "campfire-build-animation" (approved). First the stones drop into place
// one by one round the ring. Then each stick fades in above its place, already at its lean, is lowered straight down,
// and is set down. Sticks never turn or bounce. The ash spreads out from the centre at the end.
// A lit campfire has flames, embers, sparks, and smoke from fire-effect.ts, a wide glow, and a brighter pool of light that
// marks how far its warmth reaches. Together they are the code-built "fire-effect" (approved).
// A campfire with a pot on it shows the code-built "pot" (approved) from pot-shape.ts nested on its sticks, steaming while lit.
import * as THREE from "three";
import { createFireMaker, type Fire } from "./fire-effect";
import { createPotMaker, type PotMesh } from "./pot-shape";
import { createStickGeometry, STICK_COLOUR, STICK_LENGTH_METRES } from "./stick-shape";
import { CAMPFIRE_STICK_COST } from "../sim/building";
import { CAMPFIRE_FUEL_LIMIT_MINUTES, CAMPFIRE_WARMTH_RADIUS_METRES } from "../sim/campfires";
import type { OutlinePart } from "./hover-outline";
import { blueprintEntities, campfireEntities, type Entity, type EntityStore } from "../sim/entities";

/** Stones take turns between these two greys, so the ring does not look cast from one mould. */
const STONE_COLOURS = [0x8c8c86, 0x6f6e69] as const;
/** The ash bed is a dark grey-brown disc on the ground inside the ring. */
const ASH_COLOUR = 0x3d3934;
const ASH_RADIUS_METRES = 0.42;
/** The ash sits just above the ground so the ground does not flicker through it. */
const ASH_LIFT_METRES = 0.01;
/** While lit, each stick fades from its own colour to this colour toward its tip. */
const CHAR_COLOUR = 0x1e1a17;
/** The top share of each stick that turns black while the fire burns. */
const CHAR_SHARE = 0.4;
const BLUEPRINT_COLOUR = 0xbfe3ff;
/** How see-through the parts of a blueprint not yet built are, from 0 (invisible) to 1 (solid). */
const BLUEPRINT_OPACITY = 0.35;

const STONE_COUNT = 10;
const STONE_RING_RADIUS_METRES = 0.55;
/** Each stone's size is picked between these, in metres. */
const STONE_SMALLEST_METRES = 0.11;
const STONE_LARGEST_METRES = 0.18;
/** Each stone corner moves by up to this share of the stone's size, so no two stones look alike. */
const STONE_LUMPINESS = 0.25;
/** Stones sink into the ground by up to this share of their size. */
const STONE_MOST_SUNK = 0.45;
/** The same seed gives the same stones every time, so every campfire looks the same. */
const STONE_SEED = 4217;
/** Sticks lean in toward the centre at this angle from upright, in radians, to make a cone. */
const STICK_LEAN_RADIANS = 0.5;

// The build animation. The stones take the first BUILD_STONES_SHARE of the build. The sticks then share the rest equally,
// one stage each, and every BUILD_*_SHARE below that is not about stones or ash is a share of one stick's stage.
/** A new stick fades in this high above its place, in metres, already leaning at its final angle. */
const BUILD_HOVER_METRES = 0.35;
/** It is lowered, easing in and out, to just this high above its place, in metres. */
const BUILD_LOWERED_METRES = 0.06;
/** The new stick fades in over this first share of its stage. */
export const BUILD_FADE_SHARE = 0.15;
/** The stick is lowered until this share of its stage. */
export const BUILD_LOWERED_SHARE = 0.6;
/** It pauses just above its place until this share. */
export const BUILD_HOLD_SHARE = 0.68;
/** It drops, speeding up, and touches down at this share. It rests in place for the rest of the stage. */
export const BUILD_SET_DOWN_SHARE = 0.8;
/** The stones are placed in this first share of the whole build, before any stick. */
export const BUILD_STONES_SHARE = 0.2;
/** Each stone drops this far into place, in metres. */
const BUILD_STONE_DROP_METRES = 0.08;
/** Each stone's drop takes this share of the stones' part of the build. The drops overlap, one starting after another round the ring. */
const BUILD_STONE_DROP_SHARE = 0.3;
/** The ash spreads out from the centre, settling, between this share of the whole build and the end. */
const BUILD_ASH_SPREAD_FROM = 0.9;
const GLOW_COLOUR = 0xff9a4a;
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
/** How fast and how much the glow flickers. */
const FLICKER_PER_SECOND = 9;
const FLICKER_AMOUNT = 0.12;

/** A pot on the fire nests over the tips of the sticks, this high above the ground. The tips hide inside it, below the water. */
const POT_HEIGHT_METRES = 0.67;

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
  /** The stones and sticks of a campfire or blueprint, placed in the world. Empty once it is gone. */
  outlineOf(hit: CampfireHit): OutlinePart[];
  dispose(): void;
}

interface Drawn {
  readonly root: THREE.Group;
  readonly stones: THREE.Mesh[];
  /** Each stick's shape starts at its foot, so it turns about its foot. `fading` is its own see-through copy of the stick material. */
  readonly sticks: { mesh: THREE.Mesh; fading: THREE.MeshStandardMaterial }[];
  /** The ash bed inside the ring. Shown only once the campfire is built. */
  readonly ash: THREE.Mesh;
  readonly picker: THREE.Mesh;
  /** Flames, embers, sparks, and smoke. Hidden while the campfire is unlit. */
  readonly fire: Fire;
  readonly glow: THREE.PointLight;
  /** Lights the ground out to the warmth range. */
  readonly warmthPool: THREE.PointLight;
  /** The pot sitting on the fire. Hidden while there is none. */
  readonly pot: PotMesh;
}

export function createCampfireMeshes(entities: EntityStore): CampfireMeshes {
  const group = new THREE.Group();
  const stones = createStones();
  const { plain: stickGeometry, charred: charredStickGeometry } = createStandingStickGeometries();
  const ashGeometry = createAshGeometry();
  const pickGeometry = new THREE.CylinderGeometry(PICK_RADIUS_METRES, PICK_RADIUS_METRES, PICK_HEIGHT_METRES, 8);
  pickGeometry.translate(0, PICK_HEIGHT_METRES / 2, 0);
  const stoneMaterials = STONE_COLOURS.map((color) => new THREE.MeshStandardMaterial({ color, flatShading: true }));
  // Both stick geometries carry a colour per corner: pale cut ends, and on the charred one a tip that darkens.
  const stickMaterial = new THREE.MeshStandardMaterial({ color: STICK_COLOUR, flatShading: true, vertexColors: true });
  const ashMaterial = new THREE.MeshStandardMaterial({ color: ASH_COLOUR, flatShading: true });
  const blueprintMaterial = new THREE.MeshStandardMaterial({
    color: BLUEPRINT_COLOUR, transparent: true, opacity: BLUEPRINT_OPACITY, depthWrite: false,
  });
  const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });
  const fireMaker = createFireMaker();
  const potMaker = createPotMaker();

  const drawn = new Map<Entity, Drawn>();
  const pickers: THREE.Mesh[] = [];
  const blueprints = blueprintEntities(entities);
  const campfires = campfireEntities(entities);

  function draw(entity: Entity & { position: { x: number; y: number; z: number } }): Drawn {
    const existing = drawn.get(entity);
    if (existing !== undefined) return existing;
    const root = new THREE.Group();
    const stoneMeshes: THREE.Mesh[] = [];
    for (const placed of stones) {
      const stone = new THREE.Mesh(placed.geometry, blueprintMaterial);
      stone.position.copy(placed.position);
      stone.rotation.y = placed.turn;
      root.add(stone);
      stoneMeshes.push(stone);
    }
    const ash = new THREE.Mesh(ashGeometry, ashMaterial);
    ash.position.y = ASH_LIFT_METRES;
    ash.receiveShadow = true;
    ash.visible = false;
    root.add(ash);
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
      const fading = stickMaterial.clone();
      fading.transparent = true;
      sticks.push({ mesh, fading });
    }
    const fire = fireMaker.make();
    fire.group.visible = false;
    // The glow stays in the scene while unlit, at zero strength, so lighting a fire does not rebuild every material.
    const glow = new THREE.PointLight(GLOW_COLOUR, 0, GLOW_REACH_METRES, GLOW_FALL_OFF);
    glow.position.set(0, GLOW_HEIGHT_METRES, 0);
    root.add(glow);
    const warmthPool = new THREE.PointLight(GLOW_COLOUR, 0, WARMTH_POOL_REACH_METRES, 0);
    warmthPool.position.set(0, WARMTH_POOL_HEIGHT_METRES, 0);
    root.add(warmthPool);
    root.add(fire.group);
    const pot = potMaker.make();
    pot.group.position.y = POT_HEIGHT_METRES;
    pot.group.visible = false;
    root.add(pot.group);
    const picker = new THREE.Mesh(pickGeometry, pickMaterial);
    picker.userData.entity = entity;
    root.add(picker);
    pickers.push(picker);
    root.position.set(entity.position.x, entity.position.y, entity.position.z);
    group.add(root);
    const result = { root, stones: stoneMeshes, sticks, ash, picker, fire, glow, warmthPool, pot };
    drawn.set(entity, result);
    return result;
  }

  /**
   * Shows how far construction has gone. Built sticks are solid and in place, the stick being laid moves through its stage,
   * and sticks not started show see-through in place as part of the outline. The pose depends only on progress, so a
   * paused build holds still.
   */
  function showProgress(item: Drawn, progress: number): void {
    const stagesDone = (Math.max(0, progress - BUILD_STONES_SHARE) / (1 - BUILD_STONES_SHARE)) * CAMPFIRE_STICK_COST;
    const stonesDone = Math.min(1, progress / BUILD_STONES_SHARE);
    item.sticks.forEach(({ mesh, fading }, index) => {
      const share = Math.min(1, Math.max(0, stagesDone - index));
      if (share <= 0) {
        mesh.material = blueprintMaterial;
        mesh.position.y = 0;
        return;
      }
      const opacity = Math.min(1, share / BUILD_FADE_SHARE);
      fading.opacity = opacity;
      mesh.material = opacity < 1 ? fading : stickMaterial;
      mesh.position.y = buildLift(share);
    });
    item.stones.forEach((stone, index) => {
      const startsAt = (index / item.stones.length) * (1 - BUILD_STONE_DROP_SHARE);
      const share = stonesDone - startsAt;
      const placed = stones[index];
      stone.material = share > 0 ? (stoneMaterials[index % stoneMaterials.length] ?? blueprintMaterial) : blueprintMaterial;
      const fall = Math.min(1, Math.max(0, share / BUILD_STONE_DROP_SHARE));
      // The stone speeds up as it falls, and lands at its resting height.
      if (placed !== undefined) stone.position.y = placed.position.y + (share > 0 ? BUILD_STONE_DROP_METRES * (1 - fall * fall) : 0);
    });
    const spread = Math.min(1, Math.max(0, (progress - BUILD_ASH_SPREAD_FROM) / (1 - BUILD_ASH_SPREAD_FROM)));
    item.ash.visible = spread > 0;
    const settled = spread * spread * (3 - 2 * spread);
    item.ash.scale.set(Math.max(0.01, settled), 1, Math.max(0.01, settled));
  }

  /**
   * Shows a lit campfire's fire, glow, and warmth pool, flickering. The flames burn smaller as the fuel runs low,
   * so the player can see roughly how much fuel is left.
   */
  function showFire(item: Drawn, campfire: { lit: boolean; fuelMinutes: number }, nowSeconds: number, seed: number): void {
    item.fire.group.visible = campfire.lit;
    for (const { mesh } of item.sticks) {
      mesh.material = stickMaterial;
      mesh.geometry = campfire.lit ? charredStickGeometry : stickGeometry;
    }
    if (!campfire.lit) {
      item.glow.intensity = 0;
      item.warmthPool.intensity = 0;
      return;
    }
    const fullness = Math.min(1, campfire.fuelMinutes / FLAME_FULL_SIZE_FUEL_MINUTES);
    const size = FLAME_SMALLEST_SCALE + (1 - FLAME_SMALLEST_SCALE) * fullness;
    const t = nowSeconds * FLICKER_PER_SECOND + seed;
    const flicker = 1 + FLICKER_AMOUNT * (Math.sin(t) * 0.6 + Math.sin(t * 2.3 + 1.7) * 0.4);
    item.fire.animate(nowSeconds, size, seed);
    item.glow.intensity = GLOW_STRENGTH * size * flicker;
    item.warmthPool.intensity = WARMTH_POOL_STRENGTH * flicker;
  }

  function forget(entity: Entity): void {
    const item = drawn.get(entity);
    if (item === undefined) return;
    group.remove(item.root);
    for (const { fading } of item.sticks) fading.dispose();
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
        item.pot.group.visible = campfire.potOnFire !== undefined;
        if (campfire.potOnFire !== undefined) item.pot.show(campfire.campfire.lit ? "steaming" : "full", nowSeconds);
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
    outlineOf(hit) {
      const item = drawn.get(hit.entity);
      if (item === undefined) return [];
      item.root.updateMatrixWorld(true);
      return [...item.stones, ...item.sticks.map(({ mesh }) => mesh)].map((mesh) => ({
        geometry: mesh.geometry,
        matrix: mesh.matrixWorld,
      }));
    },
    dispose() {
      for (const item of [
        ...stones.map(({ geometry }) => geometry), ...stoneMaterials, stickGeometry, charredStickGeometry, ashGeometry,
        pickGeometry, stickMaterial, ashMaterial, blueprintMaterial, pickMaterial,
      ]) {
        item.dispose();
      }
      for (const item of drawn.values()) for (const { fading } of item.sticks) fading.dispose();
      fireMaker.dispose();
      potMaker.dispose();
    },
  };
}

/** How far the whole build has gone, from 0 to 1, when the sticks have reached `stages` stick stages, such as 2.5. */
export function buildProgressAtStickStage(stages: number): number {
  return BUILD_STONES_SHARE + ((1 - BUILD_STONES_SHARE) * stages) / CAMPFIRE_STICK_COST;
}

/**
 * How high above its place the stick being laid is, in metres, at `share` of its stage.
 * It is lowered from where it fades in, holds just above its place, drops, and rests.
 */
export function buildLift(share: number): number {
  if (share < BUILD_LOWERED_SHARE) {
    return BUILD_HOVER_METRES + (BUILD_LOWERED_METRES - BUILD_HOVER_METRES) * easeInOut(share / BUILD_LOWERED_SHARE);
  }
  if (share < BUILD_HOLD_SHARE) return BUILD_LOWERED_METRES;
  if (share >= BUILD_SET_DOWN_SHARE) return 0;
  const dropped = ((share - BUILD_HOLD_SHARE) / (BUILD_SET_DOWN_SHARE - BUILD_HOLD_SHARE)) ** 2;
  return BUILD_LOWERED_METRES * (1 - dropped);
}

function easeInOut(t: number): number {
  return t * t * (3 - 2 * t);
}

/** One stone of the ring: its own lumpy shape, where it sits, and how far it is turned. */
interface PlacedStone {
  readonly geometry: THREE.BufferGeometry;
  readonly position: THREE.Vector3;
  readonly turn: number;
}

/** Makes the ring of stones. Each stone has its own size and lumpy shape, and some sit deeper in the ground than others. */
function createStones(): PlacedStone[] {
  const random = seededRandom(STONE_SEED);
  const result: PlacedStone[] = [];
  for (let i = 0; i < STONE_COUNT; i += 1) {
    const size = STONE_SMALLEST_METRES + (STONE_LARGEST_METRES - STONE_SMALLEST_METRES) * random();
    const geometry = new THREE.DodecahedronGeometry(size, 0);
    // Squash each stone a little so it lies flat, then move every corner by a small random amount.
    geometry.scale(1 + random() * 0.3, 0.6 + random() * 0.25, 0.9 + random() * 0.3);
    lumpify(geometry, size * STONE_LUMPINESS, random);
    const bottom = boundsOf(geometry).min.y;
    const sunk = size * STONE_MOST_SUNK * random();
    // Spread the stones evenly round the ring, with a little wobble in angle and distance.
    const angle = ((i + (random() - 0.5) * 0.4) / STONE_COUNT) * Math.PI * 2;
    const distance = STONE_RING_RADIUS_METRES + (random() - 0.5) * 0.06;
    result.push({
      geometry,
      position: new THREE.Vector3(Math.sin(angle) * distance, -bottom - sunk, Math.cos(angle) * distance),
      turn: angle + random() * 0.6,
    });
  }
  return result;
}

/** Moves each corner of a shape by up to `amount` in every direction. Corners shared by several faces move together. */
function lumpify(geometry: THREE.BufferGeometry, amount: number, random: () => number): void {
  const position = geometry.getAttribute("position");
  const moves = new Map<string, THREE.Vector3>();
  for (let i = 0; i < position.count; i += 1) {
    const key = `${position.getX(i).toFixed(4)},${position.getY(i).toFixed(4)},${position.getZ(i).toFixed(4)}`;
    let move = moves.get(key);
    if (move === undefined) {
      move = new THREE.Vector3(random() - 0.5, random() - 0.5, random() - 0.5).multiplyScalar(amount * 2);
      moves.set(key, move);
    }
    position.setXYZ(i, position.getX(i) + move.x, position.getY(i) + move.y, position.getZ(i) + move.z);
  }
  geometry.computeVertexNormals();
}

/**
 * The forest-floor stick from stick-shape.ts, stood upright with its foot at the origin, in two versions.
 * The plain one keeps the stick's own colours. The charred one also fades to black toward the tip, for a burning fire.
 */
function createStandingStickGeometries(): { plain: THREE.BufferGeometry; charred: THREE.BufferGeometry } {
  const plain = createStickGeometry();
  // The stick lies along x. Turning it a quarter turn stands it up along y.
  plain.rotateZ(Math.PI / 2);
  const box = boundsOf(plain);
  plain.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  const charred = plain.clone();
  const position = charred.getAttribute("position");
  const colours = charred.getAttribute("color");
  // Vertex colours multiply the material colour, so the char colour is divided by the stick colour first.
  const base = new THREE.Color(STICK_COLOUR);
  const char = new THREE.Color(CHAR_COLOUR);
  const tip = new THREE.Color(char.r / base.r, char.g / base.g, char.b / base.b);
  const charStart = STICK_LENGTH_METRES * (1 - CHAR_SHARE);
  const colour = new THREE.Color();
  for (let i = 0; i < position.count; i += 1) {
    const share = Math.min(1, Math.max(0, (position.getY(i) - charStart) / (STICK_LENGTH_METRES - charStart)));
    colour.setRGB(colours.getX(i), colours.getY(i), colours.getZ(i)).lerp(tip, share);
    colours.setXYZ(i, colour.r, colour.g, colour.b);
  }
  return { plain, charred };
}

/** A flat, slightly ragged disc of ash lying on y = 0. */
function createAshGeometry(): THREE.BufferGeometry {
  const random = seededRandom(STONE_SEED + 1);
  const geometry = new THREE.CircleGeometry(ASH_RADIUS_METRES, 14);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.getAttribute("position");
  // Corner 0 is the centre. Push the rim corners in and out a little so the edge is not a perfect circle.
  for (let i = 1; i < position.count; i += 1) {
    const stretch = 0.85 + random() * 0.25;
    position.setXYZ(i, position.getX(i) * stretch, 0, position.getZ(i) * stretch);
  }
  // The first and last rim corners share a spot. Keep them together so the disc has no gap.
  position.setXYZ(position.count - 1, position.getX(1), 0, position.getZ(1));
  geometry.computeVertexNormals();
  return geometry;
}

function boundsOf(geometry: THREE.BufferGeometry): THREE.Box3 {
  return new THREE.Box3().setFromBufferAttribute(geometry.getAttribute("position") as THREE.BufferAttribute);
}

/** A small repeatable random-number generator, so the stones need no outside state. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

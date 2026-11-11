// Draws campfires and campfire blueprints with the code-built placeholder shape approved in asset-manifest.json as "campfire".
// A blueprint grows stick by stick with the code-built "campfire-build-animation".
import * as THREE from "three";
import { CAMPFIRE_STICK_COST } from "../sim/building";
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
/** Clicks on a campfire or blueprint hit an invisible cylinder this wide and tall, in metres. */
const PICK_RADIUS_METRES = 0.8;
const PICK_HEIGHT_METRES = 0.8;

/** What a click on a campfire or blueprint landed on. */
export type CampfireHit = { kind: "blueprint"; entity: Entity } | { kind: "campfire"; entity: Entity };

export interface CampfireMeshes {
  readonly group: THREE.Group;
  /** Brings every campfire and blueprint up to date with game state. */
  update(): void;
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
  const ghostMaterial = new THREE.MeshStandardMaterial({
    color: BLUEPRINT_COLOUR, transparent: true, opacity: BLUEPRINT_OPACITY, depthWrite: false,
  });
  const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });

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
      const stone = new THREE.Mesh(stoneGeometry, ghostMaterial);
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
      const mesh = new THREE.Mesh(stickGeometry, ghostMaterial);
      mesh.rotation.x = -STICK_LEAN_RADIANS;
      pivot.add(mesh);
      root.add(pivot);
      sticks.push({ mesh });
    }
    const picker = new THREE.Mesh(pickGeometry, pickMaterial);
    picker.userData.entity = entity;
    root.add(picker);
    pickers.push(picker);
    root.position.set(entity.position.x, entity.position.y, entity.position.z);
    group.add(root);
    const result = { root, stones, sticks, picker };
    drawn.set(entity, result);
    return result;
  }

  /** Shows how far construction has gone: built sticks are solid, the stick being laid grows, and the rest are see-through. */
  function showProgress(item: Drawn, progress: number): void {
    const stagesDone = progress * CAMPFIRE_STICK_COST;
    item.sticks.forEach(({ mesh }, index) => {
      const grown = Math.min(1, Math.max(0, stagesDone - index));
      const started = grown > 0;
      mesh.material = started ? stickMaterial : ghostMaterial;
      // A stick being laid rises from the ground. Unstarted sticks show at full size as part of the outline.
      mesh.scale.set(1, started ? Math.max(0.05, grown) : 1, 1);
    });
    for (const stone of item.stones) stone.material = progress >= 1 ? stoneMaterial : ghostMaterial;
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
    update() {
      const seen = new Set<Entity>();
      for (const blueprint of blueprints) {
        showProgress(draw(blueprint), blueprint.blueprint.progress);
        seen.add(blueprint);
      }
      for (const campfire of campfires) {
        showProgress(draw(campfire), 1);
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
      for (const item of [stoneGeometry, stickGeometry, pickGeometry, stoneMaterial, stickMaterial, ghostMaterial, pickMaterial]) {
        item.dispose();
      }
    },
  };
}

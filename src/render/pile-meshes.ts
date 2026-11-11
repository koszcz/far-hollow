// Draws piles the player dropped with the code-built "pile" (draft) in asset-manifest.json.
// A draft: each pile shows one copy of its kind for each thing it holds, up to MAX_SHOWN, so a pile grows from one to many.
// Sticks and firewood reuse the "sticks" and "firewood" shapes, the pot reuses the "pot", and the bedroll lies as the "rolled-bedroll".
// Bark, food, and tools are rough shapes built here. The pivot of each pile is its middle, on the ground.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { BackpackContent } from "../sim/backpack";
import { pileEntities, type Entity, type EntityStore } from "../sim/entities";
import { createFirewoodGeometry, FIREWOOD_COLOUR } from "./firewood-shape";
import type { OutlinePart } from "./hover-outline";
import { createPotMaker, type PotMesh } from "./pot-shape";
import { createRolledBedrollShape } from "./rolled-bedroll-shape";
import { createStickGeometry, STICK_COLOUR } from "./stick-shape";

/** A pile shows at most this many copies of its kind, however many it holds. */
export const MAX_SHOWN = 12;
/** Clicks on a pile hit an invisible cylinder this wide and tall, so a small pile is easy to hit, in metres. */
const PICK_RADIUS_METRES = 0.45;
const PICK_HEIGHT_METRES = 0.35;
/** The golden angle, which spreads small things around a pile without lining them up. */
const GOLDEN_ANGLE = 2.39996;

const BARK_COLOUR = 0x5b4030;
const BERRY_COLOUR = 0x8e2a3c;
const MUSHROOM_CAP_COLOUR = 0xa0603a;
const MUSHROOM_STEM_COLOUR = 0xe8dcc0;
const HANDLE_COLOUR = 0x8a6440;
const STEEL_COLOUR = 0x8a9096;

/** One part of a thing in a pile: a shape and what it is drawn with. */
interface Part {
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.Material;
}

export interface PileMeshes {
  readonly group: THREE.Group;
  /** Brings every pile up to date with game state. */
  update(): void;
  /** What a ray from the camera hits first among piles, and how far away. */
  pick(raycaster: THREE.Raycaster): { hit: { kind: "pile"; entity: Entity }; distance: number } | undefined;
  /** The shapes of a pile, placed in the world. Empty once it is gone. */
  outlineOf(entity: Entity): OutlinePart[];
  dispose(): void;
}

interface Drawn {
  readonly root: THREE.Group;
  readonly meshes: THREE.Mesh[];
  readonly picker: THREE.Mesh;
  /** What the pile showed when it was drawn, so it is redrawn when that changes. */
  readonly key: string;
}

/** How long things lie in a pile: in a criss-cross stack. Everything else spreads around the middle. */
type Layout = "stack" | "spread";

/** Where the `index`th thing in a pile lies, and which way it turns about the vertical axis. */
function placeInPile(layout: Layout, index: number): { x: number; y: number; z: number; heading: number } {
  if (layout === "stack") {
    // Three side by side to a layer, each layer across the one below.
    const layer = Math.floor(index / 3);
    const across = (index % 3) - 1;
    const turned = layer % 2 === 1;
    const offset = across * 0.11;
    return { x: turned ? offset : 0, y: layer * 0.08, z: turned ? 0 : offset, heading: turned ? Math.PI / 2 : 0 };
  }
  const radius = index === 0 ? 0 : 0.09 * Math.sqrt(index);
  const angle = index * GOLDEN_ANGLE;
  return { x: Math.cos(angle) * radius, y: 0, z: Math.sin(angle) * radius, heading: angle };
}

function box(width: number, height: number, length: number, x = 0, y = 0, z = 0): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(width, height, length);
  geometry.translate(x, y + height / 2, z);
  return geometry;
}

export function createPileMeshes(entities: EntityStore): PileMeshes {
  const group = new THREE.Group();
  const resources = new Set<{ dispose(): void }>();
  const track = <T extends { dispose(): void }>(resource: T): T => {
    resources.add(resource);
    return resource;
  };
  const material = (color: number, options: THREE.MeshStandardMaterialParameters = {}) =>
    track(new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...options }));
  const handle = material(HANDLE_COLOUR);
  const steel = material(STEEL_COLOUR, { metalness: 0.6, roughness: 0.4 });

  // Bark: a curled strip, as a slice of a hollow tube lying on its side.
  const barkGeometry = track(new THREE.CylinderGeometry(0.05, 0.05, 0.35, 8, 1, true, 0, Math.PI * 0.9));
  barkGeometry.rotateX(Math.PI / 2);
  barkGeometry.translate(0, 0.05, 0);
  // Mushroom: a pale stem under a brown cap.
  const mushroomCap = track(new THREE.SphereGeometry(0.045, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2));
  mushroomCap.translate(0, 0.05, 0);
  const rolledBedroll = track(createRolledBedrollShape());

  const SHAPES: Readonly<Record<Exclude<BackpackContent, "pot" | "potOfRiverWater" | "potOfBoiledWater">, readonly Part[]>> = {
    stick: [{ geometry: track(createStickGeometry()), material: material(STICK_COLOUR, { vertexColors: true }) }],
    firewood: [{ geometry: track(createFirewoodGeometry()), material: material(FIREWOOD_COLOUR, { vertexColors: true }) }],
    bark: [{ geometry: barkGeometry, material: material(BARK_COLOUR, { side: THREE.DoubleSide }) }],
    // A handful of berries is three berries.
    berries: [
      {
        geometry: track(
          mergeGeometries(
            [[0, 0], [0.025, 0.015], [-0.01, 0.028]].map(([x = 0, z = 0]) => new THREE.SphereGeometry(0.018, 6, 4).translate(x, 0.018, z)),
          ),
        ),
        material: material(BERRY_COLOUR, { roughness: 0.4 }),
      },
    ],
    mushroom: [
      { geometry: track(box(0.018, 0.05, 0.018)), material: material(MUSHROOM_STEM_COLOUR) },
      { geometry: mushroomCap, material: material(MUSHROOM_CAP_COLOUR) },
    ],
    // The axe: a wooden handle with a steel head at one end.
    axe: [
      { geometry: track(box(0.035, 0.03, 0.6)), material: handle },
      { geometry: track(box(0.12, 0.03, 0.05, 0.03, 0, 0.27)), material: steel },
    ],
    knife: [
      { geometry: track(box(0.025, 0.02, 0.1, 0, 0, -0.05)), material: handle },
      { geometry: track(box(0.025, 0.006, 0.13, 0, 0.007, 0.065)), material: steel },
    ],
    // The drawknife: a long blade with a handle at each end, turned forwards.
    drawknife: [
      { geometry: track(box(0.3, 0.006, 0.035)), material: steel },
      { geometry: track(box(0.025, 0.025, 0.1, -0.16, 0, 0.05)), material: handle },
      { geometry: track(box(0.025, 0.025, 0.1, 0.16, 0, 0.05)), material: handle },
    ],
    fireStriker: [{ geometry: track(box(0.07, 0.01, 0.03)), material: steel }],
    bedroll: rolledBedroll.parts,
  };
  const LAYOUTS: Readonly<Record<BackpackContent, Layout>> = {
    stick: "stack",
    firewood: "stack",
    bark: "stack",
    axe: "spread",
    knife: "spread",
    drawknife: "spread",
    fireStriker: "spread",
    berries: "spread",
    mushroom: "spread",
    bedroll: "spread",
    pot: "spread",
    potOfRiverWater: "spread",
    potOfBoiledWater: "spread",
  };

  const potMaker = createPotMaker();
  const pickGeometry = track(new THREE.CylinderGeometry(PICK_RADIUS_METRES, PICK_RADIUS_METRES, PICK_HEIGHT_METRES, 12));
  pickGeometry.translate(0, PICK_HEIGHT_METRES / 2, 0);
  const pickMaterial = track(new THREE.MeshBasicMaterial({ visible: false }));

  const piles = pileEntities(entities);
  const drawn = new Map<Entity, Drawn>();
  const pickers: THREE.Mesh[] = [];
  const hits: THREE.Intersection[] = [];

  /** Adds one thing of `content` to a pile's root, and returns the meshes that draw it. */
  function addThing(root: THREE.Group, content: BackpackContent, index: number): THREE.Mesh[] {
    const spot = placeInPile(LAYOUTS[content], index);
    const holder = new THREE.Group();
    holder.position.set(spot.x, spot.y, spot.z);
    holder.rotation.y = spot.heading;
    root.add(holder);
    if (content === "pot" || content === "potOfRiverWater" || content === "potOfBoiledWater") {
      const pot: PotMesh = potMaker.make();
      pot.show(content === "pot" ? "empty" : "full", 0);
      holder.add(pot.group);
      return pot.group.children.filter((child): child is THREE.Mesh => child instanceof THREE.Mesh && child.visible);
    }
    return SHAPES[content].map(({ geometry, material: drawnWith }) => {
      const mesh = new THREE.Mesh(geometry, drawnWith);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      holder.add(mesh);
      return mesh;
    });
  }

  function remove(entity: Entity, item: Drawn): void {
    group.remove(item.root);
    pickers.splice(pickers.indexOf(item.picker), 1);
    drawn.delete(entity);
  }

  function draw(entity: Entity & { pile: NonNullable<Entity["pile"]>; position: NonNullable<Entity["position"]> }): void {
    const shown = Math.min(entity.pile.count, MAX_SHOWN);
    const key = `${entity.pile.content}:${shown}`;
    const before = drawn.get(entity);
    if (before?.key === key) return;
    if (before !== undefined) remove(entity, before);
    const root = new THREE.Group();
    const meshes: THREE.Mesh[] = [];
    for (let index = 0; index < shown; index += 1) meshes.push(...addThing(root, entity.pile.content, index));
    const picker = new THREE.Mesh(pickGeometry, pickMaterial);
    picker.userData.entity = entity;
    root.add(picker);
    pickers.push(picker);
    root.position.set(entity.position.x, entity.position.y, entity.position.z);
    group.add(root);
    drawn.set(entity, { root, meshes, picker, key });
  }

  return {
    group,
    update() {
      const seen = new Set<Entity>();
      for (const pile of piles) {
        draw(pile);
        seen.add(pile);
      }
      for (const [entity, item] of [...drawn]) {
        if (!seen.has(entity)) remove(entity, item);
      }
    },
    pick(raycaster) {
      hits.length = 0;
      raycaster.intersectObjects(pickers, false, hits);
      hits.sort((a, b) => a.distance - b.distance);
      const first = hits[0];
      const entity = first?.object.userData.entity as Entity | undefined;
      if (first === undefined || entity?.pile === undefined) return undefined;
      return { hit: { kind: "pile", entity }, distance: first.distance };
    },
    outlineOf(entity) {
      const item = drawn.get(entity);
      if (item === undefined) return [];
      item.root.updateMatrixWorld(true);
      return item.meshes.map((mesh) => ({ geometry: mesh.geometry, matrix: mesh.matrixWorld }));
    },
    dispose() {
      for (const resource of resources) resource.dispose();
      potMaker.dispose();
    },
  };
}

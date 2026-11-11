// Draws piles the player dropped with the code-built "pile" (approved) in asset-manifest.json.
// Each pile shows one copy of its kind for each thing it holds, up to MAX_SHOWN, so a pile grows from one to many.
// Firewood lies in a stack, each layer resting in the gaps of the one below, like the woodpile. Bark lies in up to three
// rows of strips, each strip nested in the one below. Everything else spreads around the middle.
// Firewood reuses the "firewood" shape, bark the ground form of the "bark" asset, mushrooms the "mushrooms" patch, the pot
// the "pot", and the bedroll lies as the "rolled-bedroll". The tools and berries are built here.
// The saw blade and the saw are rough draft shapes added by the crafting feature.
// Sticks never form piles: each dropped stick lies on its own, as a stick on the forest floor does.
// The pivot of each pile is its middle, on the ground.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { BackpackContent } from "../sim/backpack";
import { pileEntities, type Entity, type EntityStore } from "../sim/entities";
import { barkParts } from "./bark-meshes";
import { createFirewoodGeometry, FIREWOOD_COLOUR } from "./firewood-shape";
import type { OutlinePart } from "./hover-outline";
import type { MushroomsShape } from "./mushrooms-model";
import { createPotMaker, type PotMesh } from "./pot-shape";
import { createRolledBedrollShape } from "./rolled-bedroll-shape";

/** A pile shows at most this many copies of its kind, however many it holds. */
export const MAX_SHOWN = 12;
/** Clicks on a pile hit an invisible cylinder this wide and tall, so a small pile is easy to hit, in metres. */
const PICK_RADIUS_METRES = 0.45;
const PICK_HEIGHT_METRES = 0.35;
/** The golden angle, which spreads small things around a pile without lining them up. */
const GOLDEN_ANGLE = 2.39996;

/** Firewood lies this far apart, side by side, in metres. A piece is about 0.14 m wide. */
const FIREWOOD_SPACING_METRES = 0.15;
/** Each layer of firewood rests this much higher than the one below, sunk into its gaps, in metres. */
const FIREWOOD_LAYER_METRES = 0.11;
/** The bottom layer of firewood holds this many. Each layer above holds one fewer, so 12 pieces fill three layers. */
const FIREWOOD_BOTTOM_LAYER = 5;
/** Bark lies in this many rows side by side, this far apart, in metres. */
const BARK_ROWS = 3;
const BARK_ROW_SPACING_METRES = 0.16;
/** Each strip of bark nested in the one below sits this much higher and this much further along, in metres, so each shows. */
const BARK_NEST_METRES = 0.022;
const BARK_STAGGER_METRES = 0.045;
/** A mushroom in a pile is the "mushrooms" patch at this share of its size: a small clump. */
const MUSHROOM_SCALE = 0.45;

const HANDLE_COLOUR = 0x8a6440;
/** The axe's handle is painted red near its end, like its backpack icon. */
const PAINT_COLOUR = 0xa8402f;
const AXE_HEAD_COLOUR = 0x6c7378;
const KNIFE_BLADE_COLOUR = 0xc9d2d8;
/** The drawknife's blade is blue steel, like its backpack icon. */
const DRAWKNIFE_BLADE_COLOUR = 0x6f8ea6;
const STRIKER_COLOUR = 0x5a6066;
/** The same red and leaf green as the berry bush. */
const BERRY_COLOUR = 0xb3202e;
const LEAF_COLOUR = 0x2f6b2c;

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

/** How things lie in a pile. A spread places things this many metres apart near the middle, wider further out. */
type Layout = { readonly kind: "firewood" } | { readonly kind: "bark" } | { readonly kind: "spread"; readonly spacing: number };

/** A small steady number from -1 to 1 for each index, so piles look loose but always look the same. */
function wobble(index: number, salt: number): number {
  const noise = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return (noise - Math.floor(noise)) * 2 - 1;
}

/** The order to fill a layer of `size` places: the middle first, then outwards, so a small pile sits on its pivot. */
function middleOut(slot: number, size: number): number {
  const middle = (size - 1) / 2;
  const order = Array.from({ length: size }, (_, place) => place).sort((a, b) => Math.abs(a - middle) - Math.abs(b - middle) || a - b);
  return order[slot] ?? slot;
}

/** Where the `index`th thing in a pile lies, and which way it turns about the vertical axis. */
function placeInPile(layout: Layout, index: number): { x: number; y: number; z: number; heading: number } {
  if (layout.kind === "firewood") {
    // Layers of 5, 4, then 3. Each sits half a place over from the one below, so its pieces rest in the gaps.
    let layer = 0;
    let slot = index;
    while (slot >= FIREWOOD_BOTTOM_LAYER - layer && layer < FIREWOOD_BOTTOM_LAYER - 1) {
      slot -= FIREWOOD_BOTTOM_LAYER - layer;
      layer += 1;
    }
    const size = FIREWOOD_BOTTOM_LAYER - layer;
    const place = middleOut(slot, size);
    return {
      x: (place - (size - 1) / 2) * FIREWOOD_SPACING_METRES,
      y: layer * FIREWOOD_LAYER_METRES,
      z: wobble(index, 1) * 0.04,
      // Bark faces left and right in turn, and no piece lies quite straight.
      heading: (index % 2 === 0 ? 0 : Math.PI) + wobble(index, 2) * 0.06,
    };
  }
  if (layout.kind === "bark") {
    // Up to three rows side by side, middle first. Each new strip nests in the one below, curl ends turned in turn.
    const row = middleOut(index % BARK_ROWS, BARK_ROWS);
    const depth = Math.floor(index / BARK_ROWS);
    return {
      x: (row - (BARK_ROWS - 1) / 2) * BARK_ROW_SPACING_METRES,
      y: depth * BARK_NEST_METRES,
      z: (depth - 1.5) * BARK_STAGGER_METRES + wobble(index, 3) * 0.015,
      heading: ((row + depth) % 2 === 0 ? 0 : Math.PI) + wobble(index, 4) * 0.08,
    };
  }
  const radius = index === 0 ? 0 : layout.spacing * Math.sqrt(index);
  const angle = index * GOLDEN_ANGLE;
  return { x: Math.cos(angle) * radius, y: 0, z: Math.sin(angle) * radius, heading: angle };
}

/**
 * A flat shape lying on the ground: `outline` is drawn as seen from above, with x to the right and y along +z.
 * It is `thickness` thick, with its underside at height `y`.
 */
function flatPiece(outline: THREE.Shape, thickness: number, y = 0): THREE.BufferGeometry {
  const geometry = new THREE.ExtrudeGeometry(outline, { depth: thickness, bevelEnabled: false, curveSegments: 6 });
  // The outline's y becomes +z, and the thickness runs downwards from y = 0. Then lift it onto the ground.
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, thickness + y, 0);
  return geometry;
}

/** A round rod lying along z, from `from` to `to`, resting on the ground. */
function rod(radius: number, from: number, to: number, x = 0, sides = 7): THREE.BufferGeometry {
  const geometry = new THREE.CylinderGeometry(radius, radius, to - from, sides);
  geometry.rotateX(Math.PI / 2);
  geometry.translate(x, radius, (from + to) / 2);
  return geometry;
}

/** The axe: a wooden handle along z, painted red at its end, with a steel head at +z, its bit to +x. Lying flat. */
function axeParts(handle: THREE.Material, paint: THREE.Material, head: THREE.Material): Part[] {
  const radius = 0.018;
  const outline = new THREE.Shape();
  // The poll behind the handle, the cheeks round it, then the bit flaring wider towards its curved edge.
  outline.moveTo(-0.035, 0.235);
  outline.lineTo(-0.035, 0.29);
  outline.lineTo(0.03, 0.295);
  outline.lineTo(0.1, 0.33);
  outline.quadraticCurveTo(0.135, 0.255, 0.1, 0.19);
  outline.lineTo(0.03, 0.235);
  outline.closePath();
  return [
    { geometry: rod(radius, -0.3, 0.3), material: handle },
    { geometry: rod(radius * 1.08, -0.3, -0.2), material: paint },
    { geometry: flatPiece(outline, 0.03, radius - 0.015), material: head },
  ];
}

/** The knife: a wooden handle along z with a bright blade at +z, its edge curving up to the point. Lying flat. */
function knifeParts(handle: THREE.Material, blade: THREE.Material): Part[] {
  const radius = 0.012;
  const outline = new THREE.Shape();
  outline.moveTo(0.008, 0);
  outline.lineTo(0.008, 0.11);
  outline.lineTo(0.004, 0.135);
  outline.quadraticCurveTo(-0.012, 0.09, -0.012, 0);
  outline.closePath();
  return [
    { geometry: rod(radius, -0.1, 0), material: handle },
    { geometry: flatPiece(outline, 0.004, radius - 0.002), material: blade },
  ];
}

/** The drawknife: a long blue-steel blade along x with a bevelled edge to -z, and a wooden handle at each end turned to +z. */
function drawknifeParts(handle: THREE.Material, blade: THREE.Material): Part[] {
  const halfLength = 0.15;
  const outline = new THREE.Shape();
  outline.moveTo(-halfLength, 0);
  outline.lineTo(halfLength, 0);
  outline.lineTo(halfLength - 0.01, -0.028);
  outline.quadraticCurveTo(0, -0.042, -halfLength + 0.01, -0.028);
  outline.closePath();
  // Each tang runs from a blade end forwards and a little outwards to its handle.
  const tang = new THREE.Shape();
  tang.moveTo(halfLength - 0.012, -0.004);
  tang.lineTo(halfLength + 0.012, 0.035);
  tang.lineTo(halfLength + 0.024, 0.03);
  tang.lineTo(halfLength, -0.004);
  tang.closePath();
  const handles = [-1, 1].map((side) => {
    const geometry = rod(0.014, 0, 0.1, 0, 8);
    geometry.rotateY(side * 0.25);
    geometry.translate(side * (halfLength + 0.02), 0, 0.032);
    return geometry;
  });
  const tangs = [-1, 1].map((side) => {
    const geometry = flatPiece(tang, 0.006, 0.006);
    if (side < 0) geometry.scale(-1, 1, 1);
    return geometry;
  });
  return [
    { geometry: flatPiece(outline, 0.005, 0.006), material: blade },
    { geometry: mergeGeometries(tangs), material: blade },
    { geometry: mergeGeometries(handles), material: handle },
  ];
}

/** The fire striker: a flat steel loop with rounded ends, like its backpack icon. */
function strikerGeometry(): THREE.BufferGeometry {
  const rounded = (halfWidth: number, halfDepth: number): THREE.Path => {
    const path = new THREE.Path();
    path.moveTo(-halfWidth + halfDepth, -halfDepth);
    path.lineTo(halfWidth - halfDepth, -halfDepth);
    path.absarc(halfWidth - halfDepth, 0, halfDepth, -Math.PI / 2, Math.PI / 2, false);
    path.lineTo(-halfWidth + halfDepth, halfDepth);
    path.absarc(-halfWidth + halfDepth, 0, halfDepth, Math.PI / 2, (Math.PI * 3) / 2, false);
    return path;
  };
  const outline = new THREE.Shape(rounded(0.042, 0.018).getPoints(8));
  outline.holes.push(rounded(0.03, 0.007));
  return flatPiece(outline, 0.006);
}

/** A handful of berries: seven red berries on one leaf. */
function berriesParts(berry: THREE.Material, leaf: THREE.Material): Part[] {
  const spots: readonly (readonly [number, number, number])[] = [
    [0, 0, 0.016], [0.026, 0.008, 0.014], [-0.022, 0.012, 0.015], [0.006, 0.03, 0.013],
    [-0.008, -0.024, 0.014], [0.022, -0.02, 0.012], [0.004, 0.006, 0.013],
  ];
  const berries = spots.map(([x, z, radius], index) =>
    // The last berry rests on top of the others.
    new THREE.SphereGeometry(radius, 7, 5).translate(x, radius + 0.003 + (index === spots.length - 1 ? 0.022 : 0), z),
  );
  const leafGeometry = new THREE.SphereGeometry(1, 8, 4).scale(0.05, 0.003, 0.025).rotateY(0.6).translate(-0.01, 0.003, 0.012);
  return [
    { geometry: mergeGeometries(berries), material: berry },
    { geometry: leafGeometry, material: leaf },
  ];
}

export function createPileMeshes(entities: EntityStore, mushrooms: MushroomsShape): PileMeshes {
  const group = new THREE.Group();
  const resources = new Set<{ dispose(): void }>();
  const track = <T extends { dispose(): void }>(resource: T): T => {
    resources.add(resource);
    return resource;
  };
  const material = (color: number, options: THREE.MeshStandardMaterialParameters = {}) =>
    track(new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...options }));
  /** Tracks each part's geometry. Its material is already tracked. */
  const owned = (parts: readonly Part[]): Part[] => parts.map((part) => ({ geometry: track(part.geometry), material: part.material }));
  const handle = material(HANDLE_COLOUR);
  const steel = (color: number) => material(color, { metalness: 0.6, roughness: 0.4 });

  // A smaller copy of the mushroom patch. The patch itself belongs to the caller.
  const mushroomGeometry = track(mushrooms.clone().scale(MUSHROOM_SCALE, MUSHROOM_SCALE, MUSHROOM_SCALE));
  const rolledBedroll = track(createRolledBedrollShape());

  const SHAPES: Readonly<Record<Exclude<BackpackContent, "stick" | "pot" | "potOfRiverWater" | "potOfBoiledWater">, readonly Part[]>> = {
    firewood: [{ geometry: track(createFirewoodGeometry().center().translate(0, 0.07, 0)), material: material(FIREWOOD_COLOUR, { vertexColors: true }) }],
    bark: owned(barkParts().map((part) => ({ geometry: part.geometry, material: track(part.material) }))),
    berries: owned(berriesParts(material(BERRY_COLOUR, { roughness: 0.4 }), material(LEAF_COLOUR))),
    mushroom: [{ geometry: mushroomGeometry, material: material(0xffffff, { vertexColors: true }) }],
    axe: owned(axeParts(handle, material(PAINT_COLOUR), steel(AXE_HEAD_COLOUR))),
    knife: owned(knifeParts(handle, steel(KNIFE_BLADE_COLOUR))),
    drawknife: owned(drawknifeParts(handle, steel(DRAWKNIFE_BLADE_COLOUR))),
    fireStriker: [{ geometry: track(strikerGeometry()), material: steel(STRIKER_COLOUR) }],
    // The saw blade: a long, thin steel strip with no handle. A rough draft shape.
    sawBlade: [{ geometry: track(new THREE.BoxGeometry(0.07, 0.004, 0.45)), material: steel(KNIFE_BLADE_COLOUR) }],
    // The saw: the same blade with a wooden handle at one end. A rough draft shape.
    saw: [
      { geometry: track(new THREE.BoxGeometry(0.07, 0.004, 0.45).translate(0, 0, 0.06)), material: steel(KNIFE_BLADE_COLOUR) },
      { geometry: track(new THREE.BoxGeometry(0.04, 0.03, 0.12).translate(0, 0, -0.22)), material: handle },
    ],
    bedroll: rolledBedroll.parts,
  };
  const spread = (spacing: number): Layout => ({ kind: "spread", spacing });
  const LAYOUTS: Readonly<Record<Exclude<BackpackContent, "stick">, Layout>> = {
    firewood: { kind: "firewood" },
    bark: { kind: "bark" },
    axe: spread(0.16),
    knife: spread(0.09),
    drawknife: spread(0.12),
    fireStriker: spread(0.06),
    sawBlade: spread(0.1),
    saw: spread(0.12),
    berries: spread(0.06),
    mushroom: spread(0.1),
    bedroll: spread(0.3),
    pot: spread(0.3),
    potOfRiverWater: spread(0.3),
    potOfBoiledWater: spread(0.3),
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
  function addThing(root: THREE.Group, content: Exclude<BackpackContent, "stick">, index: number): THREE.Mesh[] {
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
    const content = entity.pile.content;
    // Sticks never form piles, so a pile of sticks is never drawn.
    if (content === "stick") return;
    const shown = Math.min(entity.pile.count, MAX_SHOWN);
    const key = `${content}:${shown}`;
    const before = drawn.get(entity);
    if (before?.key === key) return;
    if (before !== undefined) remove(entity, before);
    const root = new THREE.Group();
    const meshes: THREE.Mesh[] = [];
    for (let index = 0; index < shown; index += 1) meshes.push(...addThing(root, content, index));
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

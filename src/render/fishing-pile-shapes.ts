// How fishing gear and fish look lying in a pile, the approved "fishing-piles" asset in asset-manifest.json. Built in code.
// Added by fishing ticket 01. Fishing ticket 02 added raw fish, and ticket 03 cooked fish. pile-meshes.ts lays these shapes out
// like the other things in a pile.
// The fishing line is a flat wooden winder with pale line wound round its middle and a hook caught in the line.
// The fishing rod is a long, thin rod, thicker at the butt, with a cord-wrapped grip, spare line wound above the grip, and a
// short length of line trailing from its tip to a hook.
// A raw fish is a trout lying on its side: a body that tapers to a forked tail, a fin on its back and one under its tail,
// a grey-green back, a pale belly, and a dark eye.
// A cooked fish is the same trout, its skin browned, its belly golden, and dark char marks across its upper side.
// Each shape lies flat, its pivot at the middle of its underside, its long side along z.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Fish, FishingContent } from "../sim/backpack";

/** One part of a thing in a pile: a shape and what it is drawn with. */
export interface FishingPilePart {
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.Material;
}

/** How long the fishing rod is, in metres. It is made of two sticks joined end to end. */
const ROD_LENGTH_METRES = 1.5;
const ROD_TIP_RADIUS_METRES = 0.006;
const ROD_BUTT_RADIUS_METRES = 0.014;
/** The line that trails from the rod's tip, in metres. */
const TRAILING_LINE_METRES = 0.3;
const LINE_RADIUS_METRES = 0.002;

/** How long a raw fish is from snout to tail tip, in metres. */
export const FISH_LENGTH_METRES = 0.3;
const FISH_BODY_LENGTH_METRES = 0.24;
/** How deep the fish's body is from back to belly, and how thick it is from side to side, in metres. */
const FISH_DEPTH_METRES = 0.07;
export const FISH_THICKNESS_METRES = 0.035;

const WOOD_COLOUR = 0x9b7350;
/** The cord wrapped round the rod's grip, darker than the wood. */
const GRIP_COLOUR = 0x5a3f2a;
const LINE_COLOUR = 0xe8e2cc;
/** A hook of dull, bent wire. */
const HOOK_COLOUR = 0x7d8288;
const FISH_BACK_COLOUR = 0x6f8a76;
const FISH_BELLY_COLOUR = 0xd8cdb4;
const FISH_EYE_COLOUR = 0x231f1c;
/** The scorched stripes the fire leaves across a cooked fish. */
export const CHAR_COLOUR = 0x2e1d12;

/** How long the cord-wrapped grip at the rod's butt is, in metres. */
const GRIP_LENGTH_METRES = 0.25;
/** How long the hook is, from its eye to the far side of its bend, in metres. */
const HOOK_SIZE_METRES = 0.022;
const HOOK_WIRE_RADIUS_METRES = 0.0012;

/** The colours of a fish's back and belly. */
export interface FishColours {
  readonly back: number;
  readonly belly: number;
}

/** A raw trout: a grey-green back and a pale belly. */
export const RAW_FISH_COLOURS: FishColours = { back: FISH_BACK_COLOUR, belly: FISH_BELLY_COLOUR };
/** A cooked trout: browned, crisp skin and a golden belly. */
export const COOKED_FISH_COLOURS: FishColours = { back: 0x6b4526, belly: 0xc9944f };

/** Makes a material from a colour. The caller disposes it. */
type MakeMaterial = (colour: number) => THREE.Material;
/** Hands a geometry to the caller to dispose, and returns it. */
type Track = <T extends { dispose(): void }>(resource: T) => T;

/**
 * The fishing line, the fishing rod, raw fish, and cooked fish, as parts to lie in a pile.
 * `material` makes a material from a colour, and the caller disposes it. `track` hands each geometry to the caller to dispose.
 */
export function fishingPileParts(material: MakeMaterial, track: Track): Readonly<Record<FishingContent | Fish, readonly FishingPilePart[]>> {
  const wood = material(WOOD_COLOUR);
  const line = material(LINE_COLOUR);
  const hook = material(HOOK_COLOUR);
  const grip = material(GRIP_COLOUR);
  const rodAxis = ROD_BUTT_RADIUS_METRES;
  // A rod part along z, centred on the rod's axis at `middle`.
  const alongRod = (geometry: THREE.BufferGeometry, middle: number) => geometry.rotateX(Math.PI / 2).translate(0, rodAxis, middle);
  const rod = alongRod(new THREE.CylinderGeometry(ROD_TIP_RADIUS_METRES, ROD_BUTT_RADIUS_METRES, ROD_LENGTH_METRES, 6), 0);
  // The butt of the rod points to -z after the turn. The grip wraps its last stretch.
  const butt = -ROD_LENGTH_METRES / 2;
  const gripGeometry = alongRod(
    new THREE.CylinderGeometry(ROD_BUTT_RADIUS_METRES * 1.2, ROD_BUTT_RADIUS_METRES * 1.25, GRIP_LENGTH_METRES, 6),
    butt + GRIP_LENGTH_METRES / 2,
  );
  // Spare line wound round the rod just above the grip.
  const spareLine = alongRod(
    new THREE.CylinderGeometry(ROD_BUTT_RADIUS_METRES * 1.15, ROD_BUTT_RADIUS_METRES * 1.15, 0.05, 8),
    butt + GRIP_LENGTH_METRES + 0.06,
  );
  // The tip of the rod points to +z. The line runs on from the tip and bends a little to one side, to the hook.
  const bend = 0.5;
  const trailing = new THREE.CylinderGeometry(LINE_RADIUS_METRES, LINE_RADIUS_METRES, TRAILING_LINE_METRES, 4)
    .rotateX(Math.PI / 2)
    .rotateY(bend)
    .translate(Math.sin(bend) * (TRAILING_LINE_METRES / 2), LINE_RADIUS_METRES, ROD_LENGTH_METRES / 2 + Math.cos(bend) * (TRAILING_LINE_METRES / 2));
  const lineEndX = Math.sin(bend) * TRAILING_LINE_METRES;
  const lineEndZ = ROD_LENGTH_METRES / 2 + Math.cos(bend) * TRAILING_LINE_METRES;
  return {
    fishingLine: [
      // The winder: a flat stick with a crossbar at each end, so the line cannot slip off.
      { geometry: track(new THREE.BoxGeometry(0.03, 0.01, 0.1).translate(0, 0.005, 0)), material: wood },
      { geometry: track(new THREE.BoxGeometry(0.06, 0.01, 0.015).translate(0, 0.005, 0.045)), material: wood },
      { geometry: track(new THREE.BoxGeometry(0.06, 0.01, 0.015).translate(0, 0.005, -0.045)), material: wood },
      // The line wound round the winder's middle.
      { geometry: track(new THREE.BoxGeometry(0.036, 0.016, 0.06).translate(0, 0.008, 0)), material: line },
      // A hook caught across the top of the wound line.
      {
        geometry: track(
          hookGeometry()
            .rotateY(Math.PI / 2)
            .translate(-HOOK_SIZE_METRES / 2, 0.016, 0.01),
        ),
        material: hook,
      },
    ],
    fishingRod: [
      { geometry: track(rod), material: wood },
      { geometry: track(gripGeometry), material: grip },
      { geometry: track(spareLine), material: line },
      { geometry: track(trailing), material: line },
      { geometry: track(hookGeometry().rotateY(bend).translate(lineEndX, 0, lineEndZ)), material: hook },
    ],
    rawFish: rawFishParts(material, track),
    cookedFish: [...fishParts(material, track, COOKED_FISH_COLOURS), charMarkPart(material, track)],
  };
}

/**
 * A small hook lying flat on the ground: a straight shank along +z from its eye, curving round at the far end back towards
 * the eye. Its eye is at the origin, where the line ties on.
 */
function hookGeometry(): THREE.BufferGeometry {
  const wire = HOOK_WIRE_RADIUS_METRES;
  const bendRadius = HOOK_SIZE_METRES * 0.28;
  const shankLength = HOOK_SIZE_METRES - bendRadius;
  const shank = new THREE.CylinderGeometry(wire, wire, shankLength, 4).rotateX(Math.PI / 2).translate(0, wire, shankLength / 2);
  // The bend: most of a ring, lying flat, from the end of the shank round towards the eye.
  const curve = new THREE.TorusGeometry(bendRadius, wire, 4, 10, Math.PI * 1.3).rotateX(Math.PI / 2).translate(-bendRadius, wire, shankLength);
  return merged([shank, curve]);
}

/** Merges shapes into one. Each shape is consumed. */
function merged(geometries: readonly THREE.BufferGeometry[]): THREE.BufferGeometry {
  const flat = geometries.map((geometry) => {
    const unindexed = geometry.index === null ? geometry : geometry.toNonIndexed();
    if (unindexed !== geometry) geometry.dispose();
    return unindexed;
  });
  const result = mergeGeometries(flat);
  for (const geometry of flat) geometry.dispose();
  return result;
}

/**
 * A raw fish lying on its side, its snout towards +z and its back towards -x. Its pivot is the middle of its underside.
 * The fishing animation hangs the same fish from the line as the player lifts it out of the water.
 */
export function rawFishParts(material: MakeMaterial, track: Track): readonly FishingPilePart[] {
  return fishParts(material, track, RAW_FISH_COLOURS);
}

/** Where the body's middle sits along the fish. The body sits forward, so the snout and tail tip lie at the fish's two ends. */
const BODY_MIDDLE_METRES = FISH_LENGTH_METRES / 2 - FISH_BODY_LENGTH_METRES / 2;

/**
 * A trout's body: an egg shape, deep behind a blunt head, that tapers to a narrow wrist where the tail joins.
 * `depth`, `thickness`, and `length` are its full size along x, y, and z. Its middle is at the origin. The tail end is -z.
 */
function troutBody(depth: number, thickness: number, length: number): THREE.BufferGeometry {
  const body = new THREE.SphereGeometry(0.5, 14, 10);
  const position = body.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < position.count; i++) {
    // The sphere's poles are on y. They become the snout and the tail, so y runs along the fish.
    const along = position.getY(i) * 2; // -1 at the tail end, +1 at the snout.
    // Narrow the back half towards the tail, and the head a little.
    const taper = along < 0 ? 1 - 0.55 * Math.pow(-along, 1.6) : 1 - 0.15 * along * along;
    // Swapping y and z and flipping one of them is a turn, not a mirror, so the faces stay facing out.
    position.setXYZ(i, position.getX(i) * depth * taper, -position.getZ(i) * thickness * taper, (along / 2) * length);
  }
  body.computeVertexNormals();
  return body;
}

/**
 * A flat fin in the plane of the fish's flat side, from points across the fish (x) and along it (z), `thickness` thick.
 * Its thickness is centred on y = 0.
 */
function flatFin(points: readonly (readonly [number, number])[], thickness: number): THREE.BufferGeometry {
  const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
  // The shape is drawn in x and y and pushed out along z. Turn it to lie in x and z, pushed out along y.
  return new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 1 }).rotateX(-Math.PI / 2).translate(0, -thickness / 2, 0);
}

/**
 * A fish lying on its side in these colours, its snout towards +z and its back towards -x. Its pivot is the middle of its underside.
 * The parts come in this order: the body with its fins in the back colour, the belly, the tail in the back colour, then the eye.
 * The fish on a campfire use the same shape, and darken from raw to cooked.
 */
export function fishParts(material: MakeMaterial, track: Track, colours: FishColours): readonly FishingPilePart[] {
  const back = material(colours.back);
  const belly = material(colours.belly);
  const eye = material(FISH_EYE_COLOUR);
  const half = FISH_THICKNESS_METRES / 2;
  const depth = FISH_DEPTH_METRES;
  const middle = BODY_MIDDLE_METRES;
  const finThickness = FISH_THICKNESS_METRES * 0.12;
  // The fin on the back stands out from the middle of the back.
  const backFin = flatFin(
    [
      [-depth * 0.4, middle + 0.035],
      [-depth * 0.8, middle + 0.012],
      [-depth * 0.72, middle - 0.03],
      [-depth * 0.36, middle - 0.025],
    ],
    finThickness,
  );
  // A smaller fin on the belly side, near the tail.
  const underFin = flatFin(
    [
      [depth * 0.18, middle - 0.055],
      [depth * 0.48, middle - 0.08],
      [depth * 0.38, middle - 0.1],
      [depth * 0.12, middle - 0.095],
    ],
    finThickness,
  );
  const bodyShape = troutBody(depth, FISH_THICKNESS_METRES, FISH_BODY_LENGTH_METRES).translate(0, 0, middle);
  const body = merged([bodyShape, backFin, underFin]).translate(0, half, 0);
  // The pale belly shows along the lower side of the body.
  const underside = troutBody(depth * 0.7, FISH_THICKNESS_METRES * 1.04, FISH_BODY_LENGTH_METRES * 0.85).translate(depth * 0.2, half, middle);
  // A forked tail fan behind the body, narrow at the wrist and widest at its two tips, with a notch between them.
  const wrist = middle - FISH_BODY_LENGTH_METRES / 2 + 0.012;
  const tip = -FISH_LENGTH_METRES / 2;
  const fan = depth * 0.42;
  const tail = flatFin(
    [
      [-depth * 0.09, wrist],
      [-fan, tip],
      [0, tip + (wrist - tip) * 0.35],
      [fan, tip],
      [depth * 0.09, wrist],
    ],
    FISH_THICKNESS_METRES * 0.15,
  ).translate(0, half, 0);
  const eyeBall = new THREE.SphereGeometry(0.006, 6, 4).translate(-depth * 0.12, FISH_THICKNESS_METRES * 0.85, middle + FISH_BODY_LENGTH_METRES * 0.36);
  return [
    { geometry: track(body), material: back },
    { geometry: track(underside), material: belly },
    { geometry: track(tail), material: back },
    { geometry: track(eyeBall), material: eye },
  ];
}

/** Three dark stripes the fire scorches across the upper side of a cooked fish, slanting a little. The fish on a campfire use them too. */
export function charMarkPart(material: MakeMaterial, track: Track): FishingPilePart {
  const marks = [-0.045, 0, 0.045].map((offset) =>
    new THREE.BoxGeometry(FISH_DEPTH_METRES * 0.6, 0.006, 0.007)
      .rotateY(0.35)
      .translate(-FISH_DEPTH_METRES * 0.05, FISH_THICKNESS_METRES * 0.96, BODY_MIDDLE_METRES + offset),
  );
  return { geometry: track(merged(marks)), material: material(CHAR_COLOUR) };
}

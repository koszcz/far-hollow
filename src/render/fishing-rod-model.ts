// Builds the approved "fishing-rod" asset in asset-manifest.json: the rod in the player's hands while they fish. Built in code.
// Added by fishing ticket 02. It matches the fishing rod in the approved "fishing-piles": a thin wooden rod, thicker at
// the butt, with a dark cord grip and spare line wound just above the grip. In the hand it shows a little more character:
// it bows gently down towards the tip, two trimmed twig knots stand on the lower stick, and dark cord lashes the two
// sticks where they meet. A turn of line is tied at the tip.
// The line itself runs from the tip and is drawn by player-mesh.ts, because its far end moves as the player casts.
// The butt is at the group's origin and the rod points along +z. The bow drops the tip towards -y.
import * as THREE from "three";

/** How long the rod is, from butt to tip, measured along z, in metres. */
export const FISHING_ROD_LENGTH_METRES = 1.5;
/** How far the tip drops below a straight rod, in metres. The bow grows towards the tip. */
const BOW_METRES = 0.05;
const BUTT_RADIUS_METRES = 0.014;
const TIP_RADIUS_METRES = 0.006;
/** Where the two sticks meet, from the butt, in metres. Dark cord lashes them together there. */
const JOIN_FROM_BUTT_METRES = 0.7;
const LASHING_LENGTH_METRES = 0.06;
/** How far each stick runs past the join, hidden under the lashing, in metres. */
const STICK_OVERLAP_METRES = 0.025;
/** The radius of each stick where they meet, in metres. The upper stick starts a little thinner than the lower ends. */
const LOWER_STICK_TOP_RADIUS_METRES = 0.0105;
const UPPER_STICK_BASE_RADIUS_METRES = 0.0095;
/** The grip: cord wound round the butt, where the right hand holds it, in metres. It matches the rod in fishing-piles. */
const GRIP_LENGTH_METRES = 0.25;
/** Spare line wound round the rod just above the grip, in metres. */
const SPARE_LINE_LENGTH_METRES = 0.05;
const SPARE_LINE_GAP_METRES = 0.035;
/** The trimmed twig knots on the lower stick: how far from the butt, which way round the rod, and how long. */
const KNOTS = [
  { along: 0.38, around: 0.4, length: 0.016 },
  { along: 0.56, around: Math.PI + 0.7, length: 0.012 },
] as const;
const KNOT_RADIUS_METRES = 0.0045;

const WOOD_COLOUR = 0x9b7350;
/** The cord on the grip and the lashing, darker than the wood. */
const CORD_COLOUR = 0x5a3f2a;
const LINE_COLOUR = 0xe8e2cc;
/** The pale wood where a twig was cut off. */
const CUT_WOOD_COLOUR = 0xc8a678;

export interface FishingRod {
  readonly group: THREE.Group;
  /** Where the line is tied, at the tip, from the butt. */
  readonly tip: THREE.Vector3;
  /** The parts, for the asset showcase, which lays them out on their own. */
  readonly parts: readonly { readonly geometry: THREE.BufferGeometry; readonly material: THREE.Material }[];
  dispose(): void;
}

/** How far the rod drops below straight at `along` metres from the butt. */
function dropAt(along: number): number {
  const t = along / FISHING_ROD_LENGTH_METRES;
  return BOW_METRES * t * t;
}

/** The point on the rod's axis at `along` metres from the butt. */
function axisAt(along: number, target = new THREE.Vector3()): THREE.Vector3 {
  return target.set(0, -dropAt(along), along);
}

/**
 * A tube that follows the rod's bow from `from` to `to` metres along it, with its radius given by `radius`.
 * The bow lies in the y-z plane, so x always stays square to the rod. Each ring is turned to face along the rod.
 */
function bowedTube(from: number, to: number, radius: (along: number) => number, sides: number, rings: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const centre = new THREE.Vector3();
  const side = new THREE.Vector3(1, 0, 0);
  const up = new THREE.Vector3();
  const forward = new THREE.Vector3();
  for (let ring = 0; ring <= rings; ring++) {
    const along = from + ((to - from) * ring) / rings;
    axisAt(along, centre);
    // The slope of the bow: the drop changes by 2 * BOW * along / length² for each metre along.
    const slope = (2 * BOW_METRES * along) / (FISHING_ROD_LENGTH_METRES * FISHING_ROD_LENGTH_METRES);
    forward.set(0, -slope, 1).normalize();
    up.crossVectors(forward, side).normalize();
    const r = radius(along);
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2;
      positions.push(
        centre.x + side.x * Math.cos(angle) * r + up.x * Math.sin(angle) * r,
        centre.y + side.y * Math.cos(angle) * r + up.y * Math.sin(angle) * r,
        centre.z + side.z * Math.cos(angle) * r + up.z * Math.sin(angle) * r,
      );
    }
  }
  for (let ring = 0; ring < rings; ring++) {
    for (let i = 0; i < sides; i++) {
      const a = ring * sides + i;
      const b = ring * sides + ((i + 1) % sides);
      const c = a + sides;
      const d = b + sides;
      indices.push(a, b, d, a, d, c);
    }
  }
  // Cap both ends with a fan round the centre.
  for (const [ring, along, flip] of [
    [0, from, true],
    [rings, to, false],
  ] as const) {
    const middle = positions.length / 3;
    axisAt(along, centre);
    positions.push(centre.x, centre.y, centre.z);
    for (let i = 0; i < sides; i++) {
      const a = ring * sides + i;
      const b = ring * sides + ((i + 1) % sides);
      if (flip) indices.push(middle, b, a);
      else indices.push(middle, a, b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** A radius that tapers straight from `startRadius` at `start` to `endRadius` at `end`, plus `proud`. */
function taper(start: number, startRadius: number, end: number, endRadius: number, proud = 0): (along: number) => number {
  return (along) => startRadius + ((endRadius - startRadius) * (along - start)) / (end - start) + proud;
}

const lowerStick = taper(0, BUTT_RADIUS_METRES, JOIN_FROM_BUTT_METRES, LOWER_STICK_TOP_RADIUS_METRES);
const upperStick = taper(JOIN_FROM_BUTT_METRES, UPPER_STICK_BASE_RADIUS_METRES, FISHING_ROD_LENGTH_METRES, TIP_RADIUS_METRES);

/** A trimmed twig stub on the lower stick, leaning towards the tip, with its cut end as a separate pale cap. */
function knot(along: number, around: number, length: number): { stub: THREE.BufferGeometry; cut: THREE.BufferGeometry } {
  const base = axisAt(along);
  const r = lowerStick(along);
  // Out from the rod at `around`, leaning 40° towards the tip.
  const out = new THREE.Vector3(Math.cos(around), Math.sin(around), 0);
  const lean = new THREE.Vector3()
    .copy(out)
    .multiplyScalar(Math.cos(0.7))
    .add(new THREE.Vector3(0, 0, Math.sin(0.7)))
    .normalize();
  const turn = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), lean);
  const start = base.clone().addScaledVector(out, r * 0.5);
  const stub = new THREE.CylinderGeometry(KNOT_RADIUS_METRES * 0.85, KNOT_RADIUS_METRES, length, 5)
    .translate(0, length / 2, 0)
    .applyQuaternion(turn)
    .translate(start.x, start.y, start.z);
  const cut = new THREE.CylinderGeometry(KNOT_RADIUS_METRES * 0.8, KNOT_RADIUS_METRES * 0.8, 0.0015, 5)
    .translate(0, length, 0)
    .applyQuaternion(turn)
    .translate(start.x, start.y, start.z);
  return { stub, cut };
}

export function createFishingRod(): FishingRod {
  const wood = new THREE.MeshStandardMaterial({ color: WOOD_COLOUR, roughness: 1, flatShading: true });
  const cutWood = new THREE.MeshStandardMaterial({ color: CUT_WOOD_COLOUR, roughness: 1, flatShading: true });
  const cord = new THREE.MeshStandardMaterial({ color: CORD_COLOUR, roughness: 1, flatShading: true });
  const line = new THREE.MeshStandardMaterial({ color: LINE_COLOUR, roughness: 0.8 });
  const join = JOIN_FROM_BUTT_METRES;
  const spareFrom = GRIP_LENGTH_METRES + SPARE_LINE_GAP_METRES;
  const parts: { geometry: THREE.BufferGeometry; material: THREE.Material }[] = [
    // The two sticks, each running a little past the join, under the lashing.
    { geometry: bowedTube(0, join + STICK_OVERLAP_METRES, lowerStick, 6, 6), material: wood },
    { geometry: bowedTube(join - STICK_OVERLAP_METRES, FISHING_ROD_LENGTH_METRES, upperStick, 6, 10), material: wood },
    // The lashing where the sticks meet.
    {
      geometry: bowedTube(join - LASHING_LENGTH_METRES / 2, join + LASHING_LENGTH_METRES / 2, () => LOWER_STICK_TOP_RADIUS_METRES + 0.0025, 6, 1),
      material: cord,
    },
    // The grip, as on the rod in fishing-piles: a little fatter at the butt.
    { geometry: bowedTube(0, GRIP_LENGTH_METRES, taper(0, BUTT_RADIUS_METRES * 1.25, GRIP_LENGTH_METRES, BUTT_RADIUS_METRES * 1.18), 6, 1), material: cord },
    // Spare line wound round the rod just above the grip.
    { geometry: bowedTube(spareFrom, spareFrom + SPARE_LINE_LENGTH_METRES, () => BUTT_RADIUS_METRES * 1.12, 8, 1), material: line },
    // The knot of line tied round the tip, a little proud of the rod.
    {
      geometry: bowedTube(FISHING_ROD_LENGTH_METRES - 0.03, FISHING_ROD_LENGTH_METRES - 0.005, (along) => upperStick(along) + 0.002, 6, 1),
      material: line,
    },
  ];
  for (const { along, around, length } of KNOTS) {
    const { stub, cut } = knot(along, around, length);
    parts.push({ geometry: stub, material: wood }, { geometry: cut, material: cutWood });
  }
  const group = new THREE.Group();
  for (const { geometry, material } of parts) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    group.add(mesh);
  }
  return {
    group,
    tip: axisAt(FISHING_ROD_LENGTH_METRES),
    parts,
    dispose() {
      for (const { geometry } of parts) geometry.dispose();
      wood.dispose();
      cutWood.dispose();
      cord.dispose();
      line.dispose();
    },
  };
}

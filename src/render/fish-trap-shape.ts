// The fish trap and cord shapes. Built in code. Added by fish-trap ticket 01.
// The fish trap is part of the approved "fish-trap" asset: fish-trap-meshes.ts draws a set trap half in the river's water,
// with the stake and line from createFishTrapStakeGeometries that tie it to the bank.
// The trap lying in a pile and a coil of cord in a pile are the draft "fish-trap-piles" asset: pile-meshes.ts lays them out.
// A fish trap is a woven cone basket, about 70 cm long, its wide mouth at -z and its narrow tail at +z. Eighteen slightly
// bent sticks run from a hoop at the mouth to the tail, where a knot of cord gathers them. Bands of pale withy are woven
// over and under the sticks. An inner funnel of sticks points from the mouth into the basket, so a fish swims in but not
// out. Its axis runs along z, at the height of the mouth's radius, so the mouth rests on y = 0.
// One cord is a flat coil of twisted bark string, about 12 cm across. Sizes are in metres.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** How long the trap is, from its mouth to its tail, and how wide its mouth and tail are, in metres. */
export const FISH_TRAP_LENGTH_METRES = 0.7;
export const FISH_TRAP_MOUTH_RADIUS_METRES = 0.2;
const TAIL_RADIUS_METRES = 0.05;
/** The trap is made of this many sticks round the cone. */
const STICK_COUNT = 18;
const STICK_RADIUS_METRES = 0.007;
/** How far each stick bends and strays from a straight line, in metres, so the basket looks made by hand. */
const STICK_WOBBLE_METRES = 0.008;
/** Each band of withy is woven round the cone this far from the mouth, as a share of its length. */
const WITHY_BANDS = [0.1, 0.3, 0.5, 0.7, 0.88] as const;
const WITHY_RADIUS_METRES = 0.005;
/** How far a withy weaves out over a stick and in under the next, in metres. */
const WEAVE_DEPTH_METRES = 0.004;
/** The inner funnel's sticks end this far into the basket, as a share of its length, round an opening this wide. */
const FUNNEL_COUNT = 12;
const FUNNEL_DEPTH_SHARE = 0.35;
const FUNNEL_OPENING_RADIUS_METRES = 0.045;
const CORD_RADIUS_METRES = 0.008;

/** Sticks: the same pale tan as the stick icon. Withy: paler, freshly peeled. Cord: twisted bark, a darker brown. */
export const TRAP_STICK_COLOUR = 0xb08a5c;
export const WITHY_COLOUR = 0xd2b47e;
export const CORD_COLOUR = 0x7a5532;
/** The stake that ties a set trap to the bank: a cut stick, a little darker than the trap's sticks. */
export const STAKE_COLOUR = 0x8c6a44;

/** The cone's radius this far from the mouth, as a share of its length. */
function radiusAt(share: number): number {
  return FISH_TRAP_MOUTH_RADIUS_METRES + (TAIL_RADIUS_METRES - FISH_TRAP_MOUTH_RADIUS_METRES) * share;
}

/** A repeatable number from -1 to 1 for a stick and a point on it, so every trap is woven the same way. */
function wobble(stick: number, point: number): number {
  const value = Math.sin(stick * 12.9898 + point * 78.233) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
}

/** A point on the cone's surface at this angle, this far from the mouth as a share of its length, and this far out. */
function onCone(angle: number, share: number, out = 0): THREE.Vector3 {
  const radius = radiusAt(share) + out;
  return new THREE.Vector3(
    Math.cos(angle) * radius,
    FISH_TRAP_MOUTH_RADIUS_METRES + Math.sin(angle) * radius,
    -FISH_TRAP_LENGTH_METRES / 2 + FISH_TRAP_LENGTH_METRES * share,
  );
}

/** A thin tube along points. */
function tube(points: THREE.Vector3[], radius: number, closed = false): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points, closed);
  return new THREE.TubeGeometry(curve, closed ? points.length * 2 : 8, radius, 4, closed);
}

/** The trap's sticks, its woven withy, and its cord, as three merged geometries. The caller disposes them. */
export function createFishTrapGeometries(): { sticks: THREE.BufferGeometry; withy: THREE.BufferGeometry; cord: THREE.BufferGeometry } {
  const axisY = FISH_TRAP_MOUTH_RADIUS_METRES;
  const mouthZ = -FISH_TRAP_LENGTH_METRES / 2;
  const tailZ = mouthZ + FISH_TRAP_LENGTH_METRES;
  const sticks: THREE.BufferGeometry[] = [];
  for (let i = 0; i < STICK_COUNT; i += 1) {
    const angle = (i / STICK_COUNT) * Math.PI * 2;
    // Each stick strays a little sideways and outward along its length. The sticks run a little past the tail, where the
    // cord gathers them closer.
    const points = [0, 0.33, 0.66, 1].map((share, point) => {
      const stray = share === 0 ? 0 : wobble(i, point) * STICK_WOBBLE_METRES;
      return onCone(angle + stray / radiusAt(share), share, Math.abs(wobble(i, point + 7)) * STICK_WOBBLE_METRES * 0.5);
    });
    points.push(onCone(angle, 1.08, -0.025));
    sticks.push(tube(points, STICK_RADIUS_METRES));
  }
  // A thicker hoop of stick holds the mouth open.
  sticks.push(new THREE.TorusGeometry(radiusAt(0), STICK_RADIUS_METRES * 2, 5, 24).translate(0, axisY, mouthZ));
  // The inner funnel: sticks from the hoop, leaning in to a small opening inside the basket.
  for (let i = 0; i < FUNNEL_COUNT; i += 1) {
    const angle = ((i + 0.5) / FUNNEL_COUNT) * Math.PI * 2;
    const from = onCone(angle, 0, -STICK_RADIUS_METRES * 2);
    const to = new THREE.Vector3(
      Math.cos(angle) * FUNNEL_OPENING_RADIUS_METRES,
      axisY + Math.sin(angle) * FUNNEL_OPENING_RADIUS_METRES,
      mouthZ + FISH_TRAP_LENGTH_METRES * FUNNEL_DEPTH_SHARE,
    );
    sticks.push(tube([from, from.clone().lerp(to, 0.5), to], STICK_RADIUS_METRES * 0.8));
  }
  // A ring of withy holds the funnel's opening.
  sticks.push(
    new THREE.TorusGeometry(FUNNEL_OPENING_RADIUS_METRES, WITHY_RADIUS_METRES, 4, 12).translate(
      0,
      axisY,
      mouthZ + FISH_TRAP_LENGTH_METRES * FUNNEL_DEPTH_SHARE,
    ),
  );

  // Each band is two withies, woven out over one stick and in under the next, each the other way round to its partner.
  const withies: THREE.BufferGeometry[] = [];
  for (const share of WITHY_BANDS) {
    for (const [strand, along] of [
      [0, -0.006],
      [1, 0.006],
    ] as const) {
      const points: THREE.Vector3[] = [];
      for (let step = 0; step < STICK_COUNT * 2; step += 1) {
        const angle = (step / (STICK_COUNT * 2)) * Math.PI * 2;
        const over = (step + strand) % 2 === 0 ? 1 : -1;
        points.push(onCone(angle, share + along / FISH_TRAP_LENGTH_METRES, STICK_RADIUS_METRES + over * WEAVE_DEPTH_METRES));
      }
      withies.push(tube(points, WITHY_RADIUS_METRES, true));
    }
  }

  // Cord lashes the hoop at four spots and gathers the sticks at the tail in a knot.
  const cords: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i += 1) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const at = onCone(angle, 0);
    cords.push(
      new THREE.TorusGeometry(STICK_RADIUS_METRES * 2.6, CORD_RADIUS_METRES * 0.6, 4, 8)
        .rotateY(Math.PI / 2)
        .rotateX(angle)
        .translate(at.x, at.y, at.z),
    );
  }
  cords.push(new THREE.TorusGeometry(radiusAt(1.02) - 0.012, CORD_RADIUS_METRES, 4, 14).translate(0, axisY, tailZ + FISH_TRAP_LENGTH_METRES * 0.02));
  cords.push(new THREE.SphereGeometry(CORD_RADIUS_METRES * 2.2, 5, 4).translate(0, axisY + radiusAt(1.02) - 0.008, tailZ + FISH_TRAP_LENGTH_METRES * 0.02));
  const merged = { sticks: mergeGeometries(sticks), withy: mergeGeometries(withies), cord: mergeGeometries(cords) };
  for (const geometry of [...sticks, ...withies, ...cords]) geometry.dispose();
  return merged;
}

/** How tall the stake stands above the ground, and how deep it goes in, in metres. */
const STAKE_HEIGHT_METRES = 0.4;
const STAKE_DEPTH_METRES = 0.1;
const STAKE_RADIUS_METRES = 0.016;

/**
 * The stake a set trap is tied to and the cord line to the trap's hoop, both in the trap's own frame. `stakeAt` is the foot
 * of the stake on the bank. The line runs from near the stake's top to the side of the mouth's hoop nearest the stake, and
 * sags a little between them. The caller disposes the geometries.
 */
export function createFishTrapStakeGeometries(stakeAt: THREE.Vector3Like): { stake: THREE.BufferGeometry; line: THREE.BufferGeometry } {
  const foot = new THREE.Vector3(stakeAt.x, stakeAt.y, stakeAt.z);
  // The stake leans a little away from the trap, as if the line pulls on it.
  const lean = new THREE.Vector3(foot.x, 0, foot.z).normalize().multiplyScalar(0.06);
  const top = foot.clone().add(new THREE.Vector3(lean.x, STAKE_HEIGHT_METRES, lean.z));
  const bottom = foot
    .clone()
    .add(new THREE.Vector3(-lean.x * (STAKE_DEPTH_METRES / STAKE_HEIGHT_METRES), -STAKE_DEPTH_METRES, -lean.z * (STAKE_DEPTH_METRES / STAKE_HEIGHT_METRES)));
  const length = top.distanceTo(bottom);
  const stake = new THREE.CylinderGeometry(STAKE_RADIUS_METRES * 0.9, STAKE_RADIUS_METRES, length, 6);
  stake.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(bottom).normalize()));
  stake.translate((top.x + bottom.x) / 2, (top.y + bottom.y) / 2, (top.z + bottom.z) / 2);
  // The cord ties round the stake just below its top, and onto the hoop on the stake's side.
  const tieOnStake = foot.clone().lerp(top, 0.8);
  const side = Math.atan2(foot.y - FISH_TRAP_MOUTH_RADIUS_METRES, foot.x);
  const tieOnHoop = onCone(side, 0);
  const middle = tieOnStake.clone().lerp(tieOnHoop, 0.5);
  middle.y -= Math.min(0.08, tieOnStake.distanceTo(tieOnHoop) * 0.12);
  const lineParts = [
    tube([tieOnStake, middle, tieOnHoop], CORD_RADIUS_METRES * 0.6),
    new THREE.TorusGeometry(STAKE_RADIUS_METRES * 1.1, CORD_RADIUS_METRES * 0.7, 4, 10)
      .rotateX(Math.PI / 2)
      .translate(tieOnStake.x, tieOnStake.y, tieOnStake.z),
  ];
  const line = mergeGeometries(lineParts);
  for (const part of lineParts) part.dispose();
  return { stake, line };
}

/** Makes a material from a colour. The caller disposes it. */
type MakeMaterial = (colour: number) => THREE.Material;
/** Hands a geometry to the caller to dispose, and returns it. */
type Track = <T extends { dispose(): void }>(resource: T) => T;

/** One part of a thing in a pile: a shape and what it is drawn with. */
interface PilePart {
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.Material;
}

/** A fish trap lying in a pile, tipped so its whole side rests on the ground, its pivot at the middle of its underside. */
export function fishTrapPileParts(material: MakeMaterial, track: Track): readonly PilePart[] {
  const { sticks, withy, cord } = createFishTrapGeometries();
  // Tip the cone so its lowest line, from the mouth's foot to the tail's foot, lies flat.
  const tilt = Math.atan((FISH_TRAP_MOUTH_RADIUS_METRES - TAIL_RADIUS_METRES) / FISH_TRAP_LENGTH_METRES);
  const lay = (geometry: THREE.BufferGeometry) => geometry.rotateX(-tilt);
  return [
    { geometry: track(lay(sticks)), material: material(TRAP_STICK_COLOUR) },
    { geometry: track(lay(withy)), material: material(WITHY_COLOUR) },
    { geometry: track(lay(cord)), material: material(CORD_COLOUR) },
  ];
}

/** One cord lying in a pile: a flat coil of two loops, resting on y = 0. */
export function cordPileParts(material: MakeMaterial, track: Track): readonly PilePart[] {
  const loops = [0.06, 0.045].map((radius, i) =>
    new THREE.TorusGeometry(radius, CORD_RADIUS_METRES, 4, 14).rotateX(Math.PI / 2).translate(i * 0.01, CORD_RADIUS_METRES * (1 + i * 2), 0),
  );
  const coil = mergeGeometries(loops);
  for (const loop of loops) loop.dispose();
  return [{ geometry: track(coil), material: material(CORD_COLOUR) }];
}

// The fish trap and cord shapes. Built in code. Added by fish-trap ticket 01.
// The fish trap is part of the draft "fish-trap" asset: fish-trap-meshes.ts draws a set trap half in the river's water.
// The trap lying in a pile and a coil of cord in a pile are the draft "fish-trap-piles" asset: pile-meshes.ts lays them out.
// A fish trap is a cone basket of sticks, about 70 cm long, its wide mouth at -z and its narrow tail at +z, bound with two
// rings of cord. Its axis runs along z, at the height of the mouth's radius, so the mouth rests on y = 0.
// One cord is a flat coil of twisted bark string, about 12 cm across. Sizes are in metres.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** How long the trap is, from its mouth to its tail, and how wide its mouth and tail are, in metres. */
export const FISH_TRAP_LENGTH_METRES = 0.7;
export const FISH_TRAP_MOUTH_RADIUS_METRES = 0.2;
const TAIL_RADIUS_METRES = 0.05;
/** The trap is made of this many sticks round the cone. */
const STICK_COUNT = 10;
const STICK_RADIUS_METRES = 0.009;
/** Each cord ring binds the cone this far from the mouth, as a share of its length. */
const CORD_RINGS = [0.2, 0.65] as const;
const CORD_RADIUS_METRES = 0.008;

/** Sticks: the same pale tan as the stick icon. Cord: twisted bark, a darker brown. */
export const TRAP_STICK_COLOUR = 0xb08a5c;
export const CORD_COLOUR = 0x7a5532;

/** The cone's radius this far from the mouth, as a share of its length. */
function radiusAt(share: number): number {
  return FISH_TRAP_MOUTH_RADIUS_METRES + (TAIL_RADIUS_METRES - FISH_TRAP_MOUTH_RADIUS_METRES) * share;
}

/** The trap's sticks and its cord rings, as two merged geometries. The caller disposes them. */
export function createFishTrapGeometries(): { sticks: THREE.BufferGeometry; cord: THREE.BufferGeometry } {
  const axisY = FISH_TRAP_MOUTH_RADIUS_METRES;
  const mouthZ = -FISH_TRAP_LENGTH_METRES / 2;
  const sticks: THREE.BufferGeometry[] = [];
  for (let i = 0; i < STICK_COUNT; i += 1) {
    const angle = (i / STICK_COUNT) * Math.PI * 2;
    const from = new THREE.Vector3(Math.cos(angle) * radiusAt(0), axisY + Math.sin(angle) * radiusAt(0), mouthZ);
    // The sticks run a little past the tail, where the cord gathers them.
    const to = new THREE.Vector3(Math.cos(angle) * radiusAt(1.05), axisY + Math.sin(angle) * radiusAt(1.05), mouthZ + FISH_TRAP_LENGTH_METRES * 1.05);
    const length = from.distanceTo(to);
    const stick = new THREE.CylinderGeometry(STICK_RADIUS_METRES, STICK_RADIUS_METRES, length, 5);
    // A cylinder stands along y. Turn it to run from `from` to `to`.
    stick.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize()));
    stick.translate((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
    sticks.push(stick);
  }
  // A thicker hoop of stick holds the mouth open.
  sticks.push(new THREE.TorusGeometry(radiusAt(0), STICK_RADIUS_METRES * 1.4, 5, 16).translate(0, axisY, mouthZ));
  const rings = CORD_RINGS.map((share) =>
    new THREE.TorusGeometry(radiusAt(share), CORD_RADIUS_METRES, 4, 16).translate(0, axisY, mouthZ + FISH_TRAP_LENGTH_METRES * share),
  );
  const merged = { sticks: mergeGeometries(sticks), cord: mergeGeometries(rings) };
  for (const geometry of [...sticks, ...rings]) geometry.dispose();
  return merged;
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
  const { sticks, cord } = createFishTrapGeometries();
  // Tip the cone so its lowest line, from the mouth's foot to the tail's foot, lies flat.
  const tilt = Math.atan((FISH_TRAP_MOUTH_RADIUS_METRES - TAIL_RADIUS_METRES) / FISH_TRAP_LENGTH_METRES);
  const lay = (geometry: THREE.BufferGeometry) => geometry.rotateX(-tilt);
  return [
    { geometry: track(lay(sticks)), material: material(TRAP_STICK_COLOUR) },
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

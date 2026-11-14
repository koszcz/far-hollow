// Builds the "saw-model" asset in asset-manifest.json: the bow saw the player holds while sawing planks. The owner approved it on 2026-11-14.
// It matches the saw in the approved "crafting-icons": a thin steel blade with big teeth, strung across the ends of a
// stick bent into a bow, and lashed on with twine at each end. The stick tapers from its thick end, at the grip, to its
// thin end, and bends a little unevenly, as a cut sapling does. An iron pin holds each end of the blade. The teeth are set
// alternately to the left and the right of the blade.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** How long the blade is, from end to end, in metres. */
export const SAW_BLADE_LENGTH_METRES = 0.55;
/** How far below the grip the tips of the teeth are, in metres. */
export const SAW_TEETH_BELOW_GRIP_METRES = 0.05;

/** How tall the blade is, above its teeth, in metres. */
const BLADE_HEIGHT_METRES = 0.028;
/** How tall each tooth is, in metres. */
const TOOTH_HEIGHT_METRES = 0.008;
/** How far apart the tips of the teeth are, in metres. */
const TOOTH_PITCH_METRES = 0.016;
/** How thick the blade is, in metres. */
const BLADE_THICKNESS_METRES = 0.003;
/** How far each tooth leans out to the side of the blade, its set, in metres. */
const TOOTH_SET_METRES = 0.0012;
/** How far the bow rises above the blade at its middle, in metres. */
const BOW_RISE_METRES = 0.2;
/** The radius of the bent stick at its thick end, the grip, in metres. */
const BOW_THICK_RADIUS_METRES = 0.013;
/** The radius of the bent stick at its thin end, in metres. */
const BOW_THIN_RADIUS_METRES = 0.008;
/** The bow stick reaches this far past each end of the blade, so the ends are lashed on, in metres. */
const BOW_OVERHANG_METRES = 0.02;
/** How far in from each end of the blade its pin goes through, in metres. */
const PIN_INSET_METRES = 0.012;
/** The radius of each pin, in metres. */
const PIN_RADIUS_METRES = 0.0035;
/** How many turns of twine lash each end, and how far apart the turns are along the stick, in metres. */
const LASHING_TURNS = 5;
const LASHING_TURN_SPACING_METRES = 0.0065;
/** How thick the twine is, as a radius, in metres. */
const TWINE_RADIUS_METRES = 0.0024;

const STEEL_COLOUR = 0xb8c4cc;
/** The pins are dark iron, so they show against the steel. */
const PIN_COLOUR = 0x4a4f54;
/** The colour of the stick icon, because the frame is a stick. */
const STICK_COLOUR = 0xc08a55;
const TWINE_COLOUR = 0xeadbb0;

/** One part of the saw: its shape, its paint, and where it sits from the grip. */
export interface SawPart {
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.MeshStandardMaterial;
  readonly position: THREE.Vector3;
}

/** The radius of the bow stick at `u`, from 0 at the thick end to 1 at the thin end. */
function bowRadiusAt(u: number): number {
  return BOW_THICK_RADIUS_METRES + (BOW_THIN_RADIUS_METRES - BOW_THICK_RADIUS_METRES) * u;
}

/** A tube along `curve` whose radius at each ring is `radiusAt(u)`, with u from 0 to 1 along the curve. */
function taperedTube(curve: THREE.Curve<THREE.Vector3>, segments: number, radialSegments: number, radiusAt: (u: number) => number): THREE.BufferGeometry {
  // Build the tube with a radius of 1, then pull each ring in toward its centre to the radius it should have.
  const tube = new THREE.TubeGeometry(curve, segments, 1, radialSegments, false);
  const positions = tube.getAttribute("position");
  const centre = new THREE.Vector3();
  const vertex = new THREE.Vector3();
  for (let ring = 0; ring <= segments; ring++) {
    const u = ring / segments;
    curve.getPointAt(u, centre);
    const radius = radiusAt(u);
    for (let side = 0; side <= radialSegments; side++) {
      const index = ring * (radialSegments + 1) + side;
      vertex.fromBufferAttribute(positions, index).sub(centre).multiplyScalar(radius).add(centre);
      positions.setXYZ(index, vertex.x, vertex.y, vertex.z);
    }
  }
  tube.computeVertexNormals();
  return tube;
}

/** Turns of twine around the stick from `u` onward, each a ring at right angles to the stick. */
function lashing(curve: THREE.Curve<THREE.Vector3>, startU: number, step: number): THREE.BufferGeometry {
  const turns: THREE.BufferGeometry[] = [];
  const forward = new THREE.Vector3(0, 0, 1);
  const point = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const length = curve.getLength();
  for (let turn = 0; turn < LASHING_TURNS; turn++) {
    const u = startU + (step * turn * LASHING_TURN_SPACING_METRES) / length;
    curve.getPointAt(u, point);
    curve.getTangentAt(u, tangent);
    const ring = new THREE.TorusGeometry(bowRadiusAt(u) + TWINE_RADIUS_METRES * 0.6, TWINE_RADIUS_METRES, 5, 10);
    ring.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(forward, tangent));
    ring.translate(point.x, point.y, point.z);
    turns.push(ring);
  }
  const merged = mergeGeometries(turns);
  for (const turn of turns) turn.dispose();
  return merged;
}

/**
 * A bow saw. Its blade runs along +z from the grip, at the origin, with the teeth pointing down. The bow arcs up
 * over the blade. The hand holds the near end of the bow, where it is lashed to the blade.
 */
export function createSaw(): { readonly group: THREE.Group; readonly parts: readonly SawPart[]; dispose(): void } {
  const steel = new THREE.MeshStandardMaterial({ color: STEEL_COLOUR, metalness: 0.25, roughness: 0.45 });
  const iron = new THREE.MeshStandardMaterial({ color: PIN_COLOUR, metalness: 0.5, roughness: 0.6 });
  const stick = new THREE.MeshStandardMaterial({ color: STICK_COLOUR, roughness: 1, flatShading: true });
  const twine = new THREE.MeshStandardMaterial({ color: TWINE_COLOUR, roughness: 1, flatShading: true });
  const geometries: THREE.BufferGeometry[] = [];
  const group = new THREE.Group();
  const parts: SawPart[] = [];
  const add = (geometry: THREE.BufferGeometry, material: THREE.MeshStandardMaterial): THREE.Mesh => {
    geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    group.add(mesh);
    parts.push({ geometry, material, position: mesh.position });
    return mesh;
  };

  // The blade's outline in its own plane: x along the blade, y up. Its lower edge is straight. The teeth hang below it.
  const top = -SAW_TEETH_BELOW_GRIP_METRES + TOOTH_HEIGHT_METRES + BLADE_HEIGHT_METRES;
  const bottom = -SAW_TEETH_BELOW_GRIP_METRES + TOOTH_HEIGHT_METRES;
  const outline = new THREE.Shape();
  outline.moveTo(0, top);
  outline.lineTo(SAW_BLADE_LENGTH_METRES, top);
  outline.lineTo(SAW_BLADE_LENGTH_METRES, bottom);
  outline.lineTo(0, bottom);
  // Lay a flat shape along +z, centred on its thickness, then move it `side` metres to the side.
  const layAlongZ = (geometry: THREE.BufferGeometry, side: number): THREE.BufferGeometry => {
    geometry.translate(0, 0, -BLADE_THICKNESS_METRES / 2 + side);
    geometry.rotateY(-Math.PI / 2);
    return geometry;
  };
  add(layAlongZ(new THREE.ExtrudeGeometry(outline, { depth: BLADE_THICKNESS_METRES, bevelEnabled: false }), 0), steel);

  // The teeth, each a triangle below the blade. Every other tooth leans to one side, and the rest to the other.
  const teeth: [THREE.Shape[], THREE.Shape[]] = [[], []];
  let toothIndex = 0;
  for (let x = SAW_BLADE_LENGTH_METRES; x > TOOTH_PITCH_METRES / 2; x -= TOOTH_PITCH_METRES) {
    const tooth = new THREE.Shape();
    tooth.moveTo(x, bottom + 0.0005);
    tooth.lineTo(x - TOOTH_PITCH_METRES / 2, bottom - TOOTH_HEIGHT_METRES);
    tooth.lineTo(Math.max(0, x - TOOTH_PITCH_METRES), bottom + 0.0005);
    teeth[toothIndex % 2 === 0 ? 0 : 1].push(tooth);
    toothIndex++;
  }
  for (const [index, side] of [TOOTH_SET_METRES, -TOOTH_SET_METRES].entries()) {
    const shapes = teeth[index === 0 ? 0 : 1];
    add(layAlongZ(new THREE.ExtrudeGeometry(shapes, { depth: BLADE_THICKNESS_METRES, bevelEnabled: false }), side), steel);
  }

  // The bow: a stick bent from one end of the blade, up over it, to the other end. It bends a little unevenly, and a
  // little to one side, so it reads as a cut sapling rather than a bent rod.
  const bladeMiddleY = (top + bottom) / 2;
  const arch = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(0, bladeMiddleY, -BOW_OVERHANG_METRES),
    new THREE.Vector3(0, top + BOW_RISE_METRES * 2, SAW_BLADE_LENGTH_METRES / 2),
    new THREE.Vector3(0, bladeMiddleY, SAW_BLADE_LENGTH_METRES + BOW_OVERHANG_METRES),
  );
  // Fixed nudges along the arch, in metres, sideways and up. They are zero at the ends, so the stick still meets the blade.
  const nudges: readonly [number, number][] = [
    [0, 0],
    [0.003, 0.006],
    [-0.002, -0.004],
    [0.004, 0.008],
    [0.001, -0.006],
    [-0.003, 0.005],
    [0, 0],
  ];
  const bow = new THREE.CatmullRomCurve3(nudges.map(([side, up], index) => arch.getPoint(index / (nudges.length - 1)).add(new THREE.Vector3(side, up, 0))));
  add(taperedTube(bow, 32, 7, bowRadiusAt), stick);

  // An iron pin through each end of the blade, as the icon's pin holes show.
  for (const z of [PIN_INSET_METRES, SAW_BLADE_LENGTH_METRES - PIN_INSET_METRES]) {
    const pin = new THREE.CylinderGeometry(PIN_RADIUS_METRES, PIN_RADIUS_METRES, BLADE_THICKNESS_METRES * 3, 8);
    pin.rotateZ(Math.PI / 2);
    pin.translate(0, bladeMiddleY, z);
    add(pin, iron);
  }

  // Turns of twine wrap the stick where each end of the blade is lashed to it, working up from the stick's end.
  add(lashing(bow, 0.02, 1), twine);
  add(lashing(bow, 0.98, -1), twine);

  return {
    group,
    parts,
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      steel.dispose();
      iron.dispose();
      stick.dispose();
      twine.dispose();
    },
  };
}

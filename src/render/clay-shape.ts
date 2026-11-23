// How one clay lies in a pile, part of the approved "clay" asset in asset-manifest.json. Built in code.
// Added by clay ticket 01. pile-meshes.ts lays clay out like the other things in a pile, and the gather-stone motion
// shows this lump in the player's hands while they dig clay.
// One clay is a soft ball of wet river clay, about 16 cm across and 12 cm tall, cut flat where it sits.
// A thumb dent is pressed into its top. It is smooth-shaded with a wet sheen, unlike the faceted stones,
// and it is darker in the dent and at its damp foot. Its warm grey-brown keeps it apart from the grey stones.
// The pivot is the middle of the lump's underside. Sizes are in metres.
import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { createRandom } from "../sim/random";

/** Wet river clay: a warm grey-brown. */
const CLAY_COLOUR = 0x9a7860;
/** How wide, tall, and long the lump is, in metres. */
const SIZE = [0.16, 0.12, 0.17] as const;
/** How far the soft lumps push out, as a share of the lump's size. */
const LUMPINESS = 0.07;
/** The share of the lump's height cut off flat at the foot. */
const FLAT_FOOT = 0.12;
/** Where the thumb dent sits on top, from the middle, in metres. */
const DENT_AT = { x: 0.012, z: -0.014 } as const;
/** How wide and how deep the thumb dent is, in metres. */
const DENT_RADIUS = 0.038;
const DENT_DEPTH = 0.03;
/** How dark the dent's floor is, as a share taken off the colour. */
const DENT_SHADE = 0.4;
/** How dark the damp foot is, as a share of the colour. The top is the full colour. */
const FOOT_SHADE = 0.62;
/** How far each normal is bent towards straight up, so the shady side never turns black. */
const NORMAL_UP_BEND = 0.3;
/** How shiny the wet surface is. Lower is shinier. */
const ROUGHNESS = 0.42;

/** One clay lump, resting on y = 0, with a colour at each corner. Draw it with a white material that uses vertex colours. The same every time. */
export function createClayGeometry(): THREE.BufferGeometry {
  const random = createRandom(53);
  const ball = new THREE.IcosahedronGeometry(1, 3);
  ball.deleteAttribute("normal");
  ball.deleteAttribute("uv");
  const geometry = mergeVertices(ball);
  ball.dispose();

  const lumps = Array.from({ length: 4 }, () => ({
    towards: new THREE.Vector3(random() * 2 - 1, random() * 0.6, random() * 2 - 1).normalize(),
    height: (0.5 + random() * 0.5) * LUMPINESS,
  }));
  const [width, height, length] = SIZE;
  const positions = geometry.getAttribute("position");
  const dents = new Float32Array(positions.count);
  const corner = new THREE.Vector3();
  for (let i = 0; i < positions.count; i += 1) {
    corner.fromBufferAttribute(positions, i).normalize();
    let radius = 1;
    for (const lump of lumps) radius += lump.height * Math.max(0, corner.dot(lump.towards)) ** 2;
    const x = (corner.x * radius * width) / 2;
    const z = (corner.z * radius * length) / 2;
    // Squash to size, with a fuller belly low down, the way soft clay settles.
    let y = ((corner.y * radius + 1) / 2) * height;
    y = Math.max(y, height * FLAT_FOOT);
    // The thumb dent: only the upper surface is pressed down.
    const fromDent = Math.hypot(x - DENT_AT.x, z - DENT_AT.z) / DENT_RADIUS;
    const dent = Math.exp(-(fromDent * fromDent)) * THREE.MathUtils.smoothstep(corner.y, 0.35, 0.8);
    dents[i] = dent;
    positions.setXYZ(i, x, y - dent * DENT_DEPTH, z);
  }

  geometry.computeBoundingBox();
  const box = geometry.boundingBox ?? new THREE.Box3();
  geometry.translate(0, -box.min.y, 0);
  geometry.computeVertexNormals();
  paintCorners(geometry, dents);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Colours each corner, darker at the damp foot and in the dent, and bends each normal towards straight up. */
function paintCorners(geometry: THREE.BufferGeometry, dents: Float32Array): void {
  const positions = geometry.getAttribute("position");
  const normals = geometry.getAttribute("normal");
  const top = geometry.boundingBox?.max.y ?? 1;
  const colours = new Float32Array(positions.count * 3);
  const base = new THREE.Color(CLAY_COLOUR);
  const colour = new THREE.Color();
  const normal = new THREE.Vector3();
  for (let i = 0; i < positions.count; i += 1) {
    // How high the corner sits, from 0 at the foot to 1 at the top. The foot darkens fast, like damp clay.
    const rise = THREE.MathUtils.smoothstep(positions.getY(i) / top, 0, 0.55);
    const shade = (FOOT_SHADE + (1 - FOOT_SHADE) * rise) * (1 - DENT_SHADE * (dents[i] ?? 0));
    colour
      .copy(base)
      .multiplyScalar(shade)
      .toArray(colours, i * 3);
    normal.fromBufferAttribute(normals, i);
    normal.y += NORMAL_UP_BEND;
    normal.normalize();
    normals.setXYZ(i, normal.x, normal.y, normal.z);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
}

/** Makes a material from a colour and options. The caller disposes it. */
type MakeMaterial = (colour: number, options?: THREE.MeshStandardMaterialParameters) => THREE.Material;
/** Hands a geometry to the caller to dispose, and returns it. */
type Track = <T extends { dispose(): void }>(resource: T) => T;

/** One clay, as parts to lie in a pile. `material` makes a material from a colour, and `track` hands the geometry to the caller to dispose. */
export function clayPileParts(material: MakeMaterial, track: Track): readonly { geometry: THREE.BufferGeometry; material: THREE.Material }[] {
  return [{ geometry: track(createClayGeometry()), material: material(0xffffff, { vertexColors: true, flatShading: false, roughness: ROUGHNESS }) }];
}

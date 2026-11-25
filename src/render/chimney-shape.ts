// The shape of a chimney's stones: part of the draft "chimney" asset in asset-manifest.json, built in code. Added by chimney ticket 01.
// chimney-meshes.ts draws these shapes, one mesh per construction stage.
// A chimney is hand-stacked rubble like the fireplace under it, laid with the same walls and stones from fireplace-shape.ts.
// It stands straight up on the fireplace's cap stone, from CHIMNEY_BASE_METRES to its top, which chimney-height.ts works out
// from the roof over it. Rough courses of stone rise to a cap like the fireplace's: two small stones at the sides, a black
// opening between them, and a flat cap stone over all three.
// Its pivot is the middle of its fireplace's square, on the deck, facing the way the fireplace faces. Sizes are in metres.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createRandom, type Random } from "../sim/random";
import { CHIMNEY_BASE_METRES, CHIMNEY_MIDDLE } from "./chimney-height";
import { block, SOOT_COLOUR, stone, wall, WALL_NORMAL_UP_BEND, type Box } from "./fireplace-shape";

/** One stage of construction: its shape, with a colour on each face, and where its middle sits in the chimney. */
export interface ChimneyStageShape {
  /** Draw it with a white material that uses vertex colours. Its corners are measured from `middle`. */
  readonly geometry: THREE.BufferGeometry;
  readonly middle: readonly [number, number, number];
}

/** Half the chimney's width across the fireplace, and half its depth front to back, in metres. */
const HALF_WIDTH = 0.19;
const HALF_DEPTH = 0.18;
/** How tall the cap is, from the foot of its two small stones to the top of the cap stone, in metres. */
const CAP_HEIGHT = 0.17;
/** A course of stone is about this tall, in metres. Each course lays a row of stones per this much height. */
const ROW_METRES = 0.15;
/** Construction lays this many courses, then the cap: one stage for each stone a chimney costs. */
export const CHIMNEY_COURSES = 7;

/** Builds the chimney's stages for a top `top` metres above the deck, in the order construction lays them: the courses, then the cap. */
export function createChimneyStageShapes(top: number): ChimneyStageShape[] {
  const random = createRandom(5381);
  const capFoot = top - CAP_HEIGHT;
  const courseHeight = (capFoot - CHIMNEY_BASE_METRES) / CHIMNEY_COURSES;
  const rows = Math.max(1, Math.round(courseHeight / ROW_METRES));
  const stages: THREE.BufferGeometry[][] = [];
  for (let course = 0; course < CHIMNEY_COURSES; course += 1) {
    const y0 = CHIMNEY_BASE_METRES + course * courseHeight;
    stages.push(wall(around(y0, y0 + courseHeight, 0), "x", rows, random));
  }
  stages.push(cap(capFoot, random));
  return stages.map((parts) => {
    const merged = mergeGeometries(parts);
    for (const part of parts) part.dispose();
    merged.computeBoundingBox();
    const centre = (merged.boundingBox ?? new THREE.Box3()).getCenter(new THREE.Vector3());
    merged.translate(-centre.x, -centre.y, -centre.z);
    merged.computeBoundingSphere();
    return { geometry: merged, middle: [centre.x, centre.y, centre.z] as const };
  });
}

/** The box the chimney fills from `y0` to `y1`, made `inset` metres narrower on every side. */
function around(y0: number, y1: number, inset: number): Box {
  return [
    [CHIMNEY_MIDDLE.x - HALF_WIDTH + inset, y0, CHIMNEY_MIDDLE.z - HALF_DEPTH + inset],
    [CHIMNEY_MIDDLE.x + HALF_WIDTH - inset, y1, CHIMNEY_MIDDLE.z + HALF_DEPTH - inset],
  ];
}

/** The cap from `foot` up: two small stones at the sides, a black opening between them, and a flat cap stone over all three. */
function cap(foot: number, random: Random): THREE.BufferGeometry[] {
  const wallStone = { lumpiness: 0.14, flatTop: 0.15, normalUpBend: WALL_NORMAL_UP_BEND, boxiness: 0.65 };
  const { x, z } = CHIMNEY_MIDDLE;
  const post = foot + 0.09;
  return [
    block(
      [
        [x - 0.1, foot, z - 0.1],
        [x + 0.1, post, z + 0.1],
      ],
      SOOT_COLOUR,
    ),
    stone(
      [
        [x - HALF_WIDTH, foot, z - HALF_DEPTH],
        [x - 0.09, post, z + HALF_DEPTH],
      ],
      random,
      wallStone,
    ),
    stone(
      [
        [x + 0.09, foot, z - HALF_DEPTH],
        [x + HALF_WIDTH, post, z + HALF_DEPTH],
      ],
      random,
      wallStone,
    ),
    stone(around(post - 0.01, foot + CAP_HEIGHT, -0.05), random, { lumpiness: 0.1, flatTop: 0.25, normalUpBend: 0.5, boxiness: 0.7 }),
  ];
}

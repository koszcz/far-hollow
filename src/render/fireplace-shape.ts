// The shape of the fireplace's stones: part of the approved "fireplace" asset in asset-manifest.json, built in code.
// fireplace-meshes.ts draws these shapes, one mesh per construction stage.
// The fireplace is hand-stacked rubble: lumpy river stones, made like the approved "stone" in stone-shape.ts, laid in
// rough courses with dark mortar showing between them. Flagstones make the hearth floor, a back wall and two side walls
// stand round it, a rough slab lies across their tops, and a chimney rises from the back, narrowing as it goes up,
// under a cap stone held up on two small stones. The inside of the fire box, the underside of the slab, and the hearth
// are black with soot.
// Its opening faces +z when it faces the default way. The pivot is the middle of its footprint, on the deck. Sizes are in metres.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createRandom, type Random } from "../sim/random";
import { createLumpyStoneGeometry } from "./stone-shape";

/** One stage of construction: its shape, with a colour on each face, and where its middle sits in the fireplace. */
export interface FireplaceStageShape {
  /** Draw it with a white material that uses vertex colours. Its corners are measured from `middle`. */
  readonly geometry: THREE.BufferGeometry;
  readonly middle: readonly [number, number, number];
}

/** A box in the fireplace, from its low corner to its high corner. */
type Box = readonly [readonly [number, number, number], readonly [number, number, number]];

/** Warm greys, like the stone in a pile, so the blue sky light does not turn them lilac. */
const STONE_COLOURS = [0xa29f98, 0x93918b, 0xa8a297, 0x8c8983] as const;
/** The dark mortar seen between the stones. */
const MORTAR_COLOUR = 0x4d4945;
/** The black of soot, and of the flue under the chimney's cap. */
const SOOT_COLOUR = 0x1f1c1a;
/** How long the stones in a course are, in metres, at least and at most. */
const SHORTEST_STONE = 0.15;
const LONGEST_STONE = 0.29;
/** How much each stone overlaps its neighbours, as a share of its length and height, so only thin seams of mortar show. */
const STONE_OVERLAP = 1.22;
/** How far each stone stands proud of the mortar on each face of a wall, in metres. */
const STONE_PROUD = 0.025;
/** How far the mortar core sits back from each face of a wall, in metres, so the stones hide most of it. */
const MORTAR_INSET = 0.03;
/** Wall stones bend their normals up less than pile stones, so the sides of the walls show shade. */
const WALL_NORMAL_UP_BEND = 0.3;

/** The fire box: the space round the fire that soot blackens. Faces inside it darken more the deeper and higher they sit. */
const FIRE_BOX: Box = [
  [-0.25, -0.01, -0.2],
  [0.25, 0.63, 0.42],
];
/** The front of the slab above the opening, smudged by smoke. */
const SMOKE_SMUDGE: Box = [
  [-0.26, 0.58, 0.36],
  [0.26, 0.72, 0.45],
];

/** Builds the 12 stages in the order construction lays them: the hearth floor, two courses of walls, the slab, then the chimney. */
export function createFireplaceStageShapes(): FireplaceStageShape[] {
  const random = createRandom(4127);
  const back = (y0: number, y1: number): Box => [
    [-0.45, y0, -0.43],
    [0.45, y1, -0.17],
  ];
  const side = (x0: number, x1: number, y0: number, y1: number): Box => [
    [x0, y0, -0.17],
    [x1, y1, 0.38],
  ];
  const stages: THREE.BufferGeometry[][] = [
    hearthFloor(random),
    wall(back(0, 0.3), "x", 2, random),
    wall(side(-0.45, -0.23, 0, 0.3), "z", 2, random),
    wall(side(0.23, 0.45, 0, 0.3), "z", 2, random),
    wall(back(0.3, 0.6), "x", 2, random),
    wall(side(-0.45, -0.23, 0.3, 0.6), "z", 2, random),
    wall(side(0.23, 0.45, 0.3, 0.6), "z", 2, random),
    [
      stone(
        [
          [-0.49, 0.6, -0.46],
          [0.49, 0.75, 0.41],
        ],
        random,
        { lumpiness: 0.1, flatTop: 0.18, normalUpBend: 0.5, boxiness: 0.7 },
      ),
    ],
    wall(
      [
        [-0.3, 0.75, -0.43],
        [0.3, 0.99, 0.02],
      ],
      "x",
      2,
      random,
    ),
    wall(
      [
        [-0.22, 0.99, -0.41],
        [0.22, 1.28, -0.03],
      ],
      "x",
      2,
      random,
    ),
    wall(
      [
        [-0.19, 1.28, -0.39],
        [0.19, 1.56, -0.05],
      ],
      "x",
      2,
      random,
    ),
    chimneyCap(random),
  ];
  return stages.map((parts) => {
    const merged = mergeGeometries(parts);
    for (const part of parts) part.dispose();
    blacken(merged);
    merged.computeBoundingBox();
    const centre = (merged.boundingBox ?? new THREE.Box3()).getCenter(new THREE.Vector3());
    merged.translate(-centre.x, -centre.y, -centre.z);
    merged.computeBoundingSphere();
    return { geometry: merged, middle: [centre.x, centre.y, centre.z] as const };
  });
}

/** Four flagstones over a dark bed, filling the floor between the walls. */
function hearthFloor(random: Random): THREE.BufferGeometry[] {
  const parts = [
    block(
      [
        [-0.23, 0, -0.17],
        [0.23, 0.03, 0.38],
      ],
      MORTAR_COLOUR,
    ),
  ];
  for (const [x0, x1] of [
    [-0.23, 0.005],
    [-0.005, 0.23],
  ] as const) {
    for (const [z0, z1] of [
      [-0.17, 0.11],
      [0.1, 0.38],
    ] as const) {
      parts.push(
        stone(
          [
            [x0, 0, z0],
            [x1, 0.06, z1],
          ],
          random,
          { lumpiness: 0.08, flatTop: 0.3, normalUpBend: 0.7, boxiness: 0.6 },
        ),
      );
    }
  }
  return parts;
}

/**
 * One course of wall: rows of stones of random lengths over a core of mortar. Each stone runs right through the wall,
 * standing a little proud of both faces. `along` is the axis the wall runs along.
 */
function wall(box: Box, along: "x" | "z", rows: number, random: Random): THREE.BufferGeometry[] {
  const [low, high] = box;
  const parts = [block(shrink(box, MORTAR_INSET), MORTAR_COLOUR)];
  const axis = along === "x" ? 0 : 2;
  const start = low[axis];
  const end = high[axis];
  const rowHeight = (high[1] - low[1]) / rows;
  for (let row = 0; row < rows; row += 1) {
    const y0 = low[1] + row * rowHeight;
    for (const [from, to] of stoneSpans(start, end, random)) {
      const middle = (from + to) / 2;
      const half = ((to - from) * STONE_OVERLAP) / 2;
      const stoneLow: [number, number, number] = [low[0] - STONE_PROUD, y0, low[2] - STONE_PROUD];
      const stoneHigh: [number, number, number] = [high[0] + STONE_PROUD, y0 + rowHeight * STONE_OVERLAP, high[2] + STONE_PROUD];
      stoneLow[axis] = middle - half;
      stoneHigh[axis] = middle + half;
      parts.push(stone([stoneLow, stoneHigh], random, { lumpiness: 0.16, flatTop: 0.12, normalUpBend: WALL_NORMAL_UP_BEND, boxiness: 0.65 }));
    }
  }
  return parts;
}

/** Cuts the length from `start` to `end` into stones of random lengths. A piece too short for a stone joins the one before. */
function stoneSpans(start: number, end: number, random: Random): [number, number][] {
  const spans: [number, number][] = [];
  let at = start;
  while (end - at > 0.001) {
    let to = Math.min(end, at + SHORTEST_STONE + random() * (LONGEST_STONE - SHORTEST_STONE));
    if (end - to < SHORTEST_STONE * 0.7) to = end;
    spans.push([at, to]);
    at = to;
  }
  return spans;
}

/** The top of the chimney: two small stones at the sides, a black flue between them, and a flat cap stone over all three. */
function chimneyCap(random: Random): THREE.BufferGeometry[] {
  const wallStone = { lumpiness: 0.14, flatTop: 0.15, normalUpBend: WALL_NORMAL_UP_BEND, boxiness: 0.65 };
  return [
    block(
      [
        [-0.11, 1.56, -0.32],
        [0.11, 1.645, -0.12],
      ],
      SOOT_COLOUR,
    ),
    stone(
      [
        [-0.2, 1.56, -0.4],
        [-0.09, 1.65, -0.04],
      ],
      random,
      wallStone,
    ),
    stone(
      [
        [0.09, 1.56, -0.4],
        [0.2, 1.65, -0.04],
      ],
      random,
      wallStone,
    ),
    stone(
      [
        [-0.26, 1.64, -0.45],
        [0.26, 1.73, 0.01],
      ],
      random,
      { lumpiness: 0.1, flatTop: 0.25, normalUpBend: 0.5, boxiness: 0.7 },
    ),
  ];
}

/** A lumpy stone filling `box`, in one of the warm greys. */
function stone(
  box: Box,
  random: Random,
  cut: { readonly lumpiness: number; readonly flatTop: number; readonly normalUpBend: number; readonly boxiness: number },
): THREE.BufferGeometry {
  const [low, high] = box;
  const colour = STONE_COLOURS[Math.floor(random() * STONE_COLOURS.length)] ?? STONE_COLOURS[0];
  const geometry = createLumpyStoneGeometry({
    seed: Math.floor(random() * 1_000_000),
    size: [high[0] - low[0], high[1] - low[1], high[2] - low[2]],
    colour,
    fitSize: true,
    ...cut,
  });
  geometry.translate((low[0] + high[0]) / 2, low[1], (low[2] + high[2]) / 2);
  return geometry;
}

/** `box` made smaller by `inset` on every side but the top and bottom. */
function shrink(box: Box, inset: number): Box {
  const [low, high] = box;
  return [
    [low[0] + inset, low[1], low[2] + inset],
    [high[0] - inset, high[1], high[2] - inset],
  ];
}

/** A plain box of one colour filling `box`, with the same attributes as a stone so they merge. */
function block(box: Box, colour: number): THREE.BufferGeometry {
  const [low, high] = box;
  const indexed = new THREE.BoxGeometry(high[0] - low[0], high[1] - low[1], high[2] - low[2]);
  const geometry = indexed.toNonIndexed();
  indexed.dispose();
  geometry.deleteAttribute("uv");
  geometry.translate((low[0] + high[0]) / 2, (low[1] + high[1]) / 2, (low[2] + high[2]) / 2);
  const shade = new THREE.Color(colour);
  const colours = new Float32Array(geometry.getAttribute("position").count * 3);
  for (let i = 0; i < colours.length; i += 3) shade.toArray(colours, i);
  geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  return geometry;
}

/** Darkens the faces inside the fire box with soot, deeper and higher ones most, and smudges the slab above the opening. */
function blacken(geometry: THREE.BufferGeometry): void {
  const positions = geometry.getAttribute("position");
  const colours = geometry.getAttribute("color");
  const soot = new THREE.Color(SOOT_COLOUR);
  const middle = new THREE.Vector3();
  const corner = new THREE.Vector3();
  const colour = new THREE.Color();
  for (let i = 0; i < positions.count; i += 3) {
    middle.set(0, 0, 0);
    for (let c = i; c < i + 3; c += 1) middle.add(corner.fromBufferAttribute(positions, c));
    middle.divideScalar(3);
    const blackness = Math.max(sootIn(FIRE_BOX, middle, 0.55, 0.9), sootIn(SMOKE_SMUDGE, middle, 0.35, 0.35));
    if (blackness <= 0) continue;
    for (let c = i; c < i + 3; c += 1) {
      colour.fromBufferAttribute(colours, c).lerp(soot, blackness);
      colours.setXYZ(c, colour.r, colour.g, colour.b);
    }
  }
  colours.needsUpdate = true;
}

/** How black soot makes a face at `point` in `box`: `front` at its front edge, rising to `back` at its back and top. */
function sootIn(box: Box, point: THREE.Vector3, front: number, back: number): number {
  const [low, high] = box;
  if (point.x < low[0] || point.x > high[0] || point.y < low[1] || point.y > high[1] || point.z < low[2] || point.z > high[2]) return 0;
  const depth = (high[2] - point.z) / (high[2] - low[2]);
  const rise = (point.y - low[1]) / (high[1] - low[1]);
  return front + (back - front) * Math.min(1, Math.max(depth, rise));
}

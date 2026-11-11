// The code-built "rolled-bedroll" (approved) in asset-manifest.json: the bedroll rolled up, lying on the ground.
// It is the laid "bedroll" rolled up, in the same colours: green canvas outside, with the red blanket inside.
// Each end shows the spiral of the rolled layers. The loose end of the canvas lies along the front as a
// hemmed flap. Two leather straps with brass buckles cinch the roll, and the roll sags a little under its
// own weight. The roll lies along x. The pivot is the middle of its underside, on the ground.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const CANVAS_COLOUR = 0x4f6b3a;
const HEM_COLOUR = 0x3a5029;
const BLANKET_COLOUR = 0x8a3b2e;
const STRAP_COLOUR = 0x5a3a22;
const BUCKLE_COLOUR = 0xb08d3c;
const ROLL_RADIUS_METRES = 0.14;
const ROLL_LENGTH_METRES = 0.68;
/** The roll is squashed a little by its own weight. */
const ROLL_SQUASH = 0.88;
/** The ends of the roll round off over this length, in metres. */
const END_ROUNDING_METRES = 0.04;
/** At its ends the roll narrows to this share of its radius. */
const END_RADIUS = 0.9;
const STRAP_WIDTH_METRES = 0.04;
/** The straps sit this far from the middle of the roll, in metres. */
const STRAP_OFFSET_METRES = 0.21;
/** Under a strap the canvas is pulled in to this share of the roll's radius. */
const CINCH_RADIUS = 0.94;
/** The canvas bulges back to full size this far from the middle of a strap, in metres. */
const CINCH_REACH_METRES = 0.05;
const STRAP_RADIUS = 0.98;
/** The loose flap lies over the roll from this angle to the next, in radians. 0 faces +z, π/2 faces up. */
const FLAP_START = -0.2;
const FLAP_END = 0.55;
const FLAP_RADIUS = 1.012;
const HEM_WIDTH = 0.06;
const SPIRAL_TURNS = 3;
const RADIAL_SEGMENTS = 18;

export interface RolledBedrollShape {
  readonly parts: readonly { readonly geometry: THREE.BufferGeometry; readonly material: THREE.Material }[];
  dispose(): void;
}

/** The roll's radius, as a share of ROLL_RADIUS_METRES, at a distance `x` along it from the middle. */
function radiusAt(x: number): number {
  let share = 1;
  const fromEnd = ROLL_LENGTH_METRES / 2 - Math.abs(x);
  if (fromEnd < END_ROUNDING_METRES) {
    share = END_RADIUS + (1 - END_RADIUS) * Math.sqrt(Math.max(fromEnd, 0) / END_ROUNDING_METRES);
  }
  for (const strap of [-STRAP_OFFSET_METRES, STRAP_OFFSET_METRES]) {
    const away = Math.abs(x - strap);
    if (away < CINCH_REACH_METRES) {
      const pull = (Math.cos((Math.PI * away) / CINCH_REACH_METRES) + 1) / 2;
      share = Math.min(share, 1 - (1 - CINCH_RADIUS) * pull);
    }
  }
  return share;
}

/** Squashes a geometry built around the x axis, and sets it on the ground. */
function setOnGround(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  geometry.scale(1, ROLL_SQUASH, 1);
  geometry.translate(0, ROLL_RADIUS_METRES * ROLL_SQUASH, 0);
  return geometry;
}

/**
 * A surface that follows the roll's outline along x, `scale` times its radius.
 * `from` and `to` are angles round the roll. 0 faces +z, π/2 faces up.
 */
function rollSurface(scale: number, from = 0, to = Math.PI * 2): THREE.BufferGeometry {
  const steps = 80;
  const outline: THREE.Vector2[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = -ROLL_LENGTH_METRES / 2 + (ROLL_LENGTH_METRES * i) / steps;
    outline.push(new THREE.Vector2(ROLL_RADIUS_METRES * radiusAt(x) * scale, x));
  }
  const segments = Math.max(2, Math.round((RADIAL_SEGMENTS * (to - from)) / (Math.PI * 2)));
  const geometry = new THREE.LatheGeometry(outline, segments, from, to - from);
  // The lathe turns round y. Lay it along x, keeping angle 0 facing +z and π/2 facing up.
  geometry.rotateZ(Math.PI / 2);
  return setOnGround(geometry);
}

/** The ends of the roll: a disc of red blanket at each end. */
function endGeometry(): THREE.BufferGeometry {
  const ends = [-1, 1].map((side) => {
    const disc = new THREE.CircleGeometry(ROLL_RADIUS_METRES * END_RADIUS, RADIAL_SEGMENTS);
    disc.rotateY((side * Math.PI) / 2);
    disc.translate((side * ROLL_LENGTH_METRES) / 2, 0, 0);
    return disc;
  });
  return setOnGround(mergeGeometries(ends));
}

/** The canvas spiralling through the blanket, drawn on each end of the roll. */
function spiralGeometry(): THREE.BufferGeometry {
  const ends = [-1, 1].map((side) => {
    const points: THREE.Vector3[] = [];
    const steps = 72;
    const inner = ROLL_RADIUS_METRES * 0.12;
    const outer = ROLL_RADIUS_METRES * END_RADIUS * 0.96;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = t * SPIRAL_TURNS * Math.PI * 2;
      const radius = inner + (outer - inner) * t;
      points.push(new THREE.Vector3((side * ROLL_LENGTH_METRES) / 2 + side * 0.002, Math.sin(angle) * radius, Math.cos(angle) * radius));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), steps * 2, 0.006, 4);
  });
  return setOnGround(mergeGeometries(ends));
}

function strapGeometry(): THREE.BufferGeometry {
  const straps = [-STRAP_OFFSET_METRES, STRAP_OFFSET_METRES].map((x) => {
    const radius = ROLL_RADIUS_METRES * STRAP_RADIUS;
    const strap = new THREE.CylinderGeometry(radius, radius, STRAP_WIDTH_METRES, RADIAL_SEGMENTS);
    strap.rotateZ(Math.PI / 2);
    strap.translate(x, 0, 0);
    return strap;
  });
  return setOnGround(mergeGeometries(straps));
}

/** A brass buckle on the top front of each strap. */
function buckleGeometry(): THREE.BufferGeometry {
  const angle = 0.9;
  const radius = ROLL_RADIUS_METRES * STRAP_RADIUS + 0.004;
  const buckles = [-STRAP_OFFSET_METRES, STRAP_OFFSET_METRES].map((x) => {
    const buckle = new THREE.BoxGeometry(STRAP_WIDTH_METRES * 1.35, 0.01, 0.034);
    buckle.rotateX(Math.PI / 2 - angle);
    buckle.translate(x, Math.sin(angle) * radius, Math.cos(angle) * radius);
    return buckle;
  });
  return setOnGround(mergeGeometries(buckles));
}

export function createRolledBedrollShape(): RolledBedrollShape {
  const material = (color: number, options: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true, ...options });
  const parts = [
    { geometry: rollSurface(1), material: material(CANVAS_COLOUR) },
    { geometry: rollSurface(FLAP_RADIUS, FLAP_START, FLAP_END), material: material(CANVAS_COLOUR, { side: THREE.DoubleSide }) },
    { geometry: rollSurface(FLAP_RADIUS + 0.003, FLAP_END - HEM_WIDTH, FLAP_END), material: material(HEM_COLOUR) },
    { geometry: endGeometry(), material: material(BLANKET_COLOUR) },
    { geometry: spiralGeometry(), material: material(HEM_COLOUR) },
    { geometry: strapGeometry(), material: material(STRAP_COLOUR, { roughness: 0.7 }) },
    { geometry: buckleGeometry(), material: material(BUCKLE_COLOUR, { roughness: 0.4, metalness: 0.7 }) },
  ];
  return {
    parts,
    dispose() {
      for (const { geometry, material: drawnWith } of parts) {
        geometry.dispose();
        drawnWith.dispose();
      }
    },
  };
}

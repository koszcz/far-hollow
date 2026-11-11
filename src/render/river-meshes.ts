// Draws the code-built "river" listed in asset-manifest.json. The owner approved it.
// It has two parts:
// - Clear, rippling low-poly water, with faint sparkles and flow streaks that show the current.
// - A sandy pebble bank along each side, which runs from under the shallows out onto the grass.
import * as THREE from "three";
import type { Terrain, Valley } from "../sim/valley";

/** The water's one colour. The riverbed shows through it. */
const WATER_COLOUR = 0x3f8f9c;
/** How solid the water looks where it is deepest. */
const DEEP_WATER_OPACITY = 0.85;
/** How solid the water looks at the bank, where it is only a film. */
const SHALLOW_WATER_OPACITY = 0.3;
/** The water reaches full opacity this share of the way from the bank to the middle. */
const FULL_OPACITY_SHARE = 0.6;

/** The water reaches this far past the river's width. The player cannot walk closer than about this, so no one stands in it. */
const WATER_OVERLAP_METRES = 1.5;
/**
 * The flat water sits this far above the lower of its two banks, so it meets the ground right at its edge.
 * The riverbed's banks slope gently, so a higher water level would spill wider than the water's edge.
 */
const WATER_ABOVE_BANK_METRES = 0.15;
/** Distance between cross-sections of the water, along the river. Small enough for smooth bends. */
const WATER_STEP_METRES = 5;
/** Points across the water in each cross-section, from bank to bank. */
const WATER_POINTS_ACROSS = 9;

/** Height of the ripples on the water surface, from the middle to a crest. */
const RIPPLE_HEIGHT_METRES = 0.18;
/** Distance between ripple crests along the river. */
const RIPPLE_LENGTH_METRES = 7;
/** How fast the ripples and the middle of the current move downstream. Water near the banks moves slower. */
const FLOW_SPEED_METRES_PER_SECOND = 1.2;

/** Colour of the flow streaks. */
const STREAK_COLOUR = 0xe4f2f0;
/** Share of the open water that has a sparkle spot at all. */
const SPARKLE_SHARE = 0.12;
/** How bright a sparkle is at its peak. */
const SPARKLE_BRIGHTNESS = 0.7;

/** The pebble bank starts this far inside the water's edge, so pebbles show through the shallows. */
const BANK_UNDER_WATER_METRES = 2;
/** The pebble bank reaches at most this far past the water's edge, onto the grass. Its edge wanders in and out. */
const BANK_MAX_REACH_METRES = 2;
/** Points across each pebble bank, and the distance between its cross-sections. Close enough to follow the ground's creases. */
const BANK_POINTS_ACROSS = 6;
const BANK_STEP_METRES = 1.25;
/** The bank sits this far above the ground. Polygon offset also draws it over the ground. */
const BANK_ABOVE_GROUND_METRES = 0.04;
/** Two sand colours, close to the dirt patches in the ground texture. */
const SAND_COLOURS = [0x8a7650, 0x7c6946] as const;
/** Pebble colours: greys and browns. */
const PEBBLE_COLOURS = [0x7d7a72, 0x6b665c, 0x8f8878, 0x75644a] as const;
/** Width of the grid each pebble sits in. Pebbles are a little smaller than this. */
const PEBBLE_SPACING_METRES = 0.3;

export interface RiverMeshes {
  readonly group: THREE.Group;
  /** Moves the ripples, streaks, and sparkles. Daylight runs from 0 (night) to 1 (full day). */
  update(nowSeconds: number, daylight: number): void;
  dispose(): void;
}

export function createRiverMeshes(valley: Valley): RiverMeshes {
  const halfWidth = valley.river.width / 2 + WATER_OVERLAP_METRES;
  const water = createWaterGeometry(sampleRiver(valley, WATER_STEP_METRES, halfWidth), halfWidth);
  const bankGeometry = createBankGeometry(valley.terrain, sampleRiver(valley, BANK_STEP_METRES, halfWidth), halfWidth);

  const uniforms = {
    riverTime: { value: 0 },
    riverDaylight: { value: 1 },
    riverHalfWidth: { value: halfWidth },
    riverFlowSpeed: { value: FLOW_SPEED_METRES_PER_SECOND },
    riverStreakColour: { value: new THREE.Color(STREAK_COLOUR) },
    riverSparkleShare: { value: SPARKLE_SHARE },
    riverSparkleBrightness: { value: SPARKLE_BRIGHTNESS },
    riverBankReach: { value: BANK_MAX_REACH_METRES },
    riverSandColours: { value: SAND_COLOURS.map((hex) => new THREE.Color(hex)) },
    riverPebbleColours: { value: PEBBLE_COLOURS.map((hex) => new THREE.Color(hex)) },
    riverPebbleSpacing: { value: PEBBLE_SPACING_METRES },
  };
  const addRiverCoord = (shader: THREE.WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${RIVER_VERTEX_HEAD}`)
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRiverCoord = riverCoord;");
  };

  const waterMaterial = new THREE.MeshStandardMaterial({
    color: WATER_COLOUR,
    vertexColors: true,
    transparent: true,
    flatShading: true,
    roughness: 0.12,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });
  waterMaterial.onBeforeCompile = (shader) => {
    addRiverCoord(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${RIVER_FRAGMENT_HEAD}`)
      .replace("#include <color_fragment>", `#include <color_fragment>\n${WATER_STREAK_CHUNK}`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\n${WATER_SPARKLE_CHUNK}`);
  };

  const bankMaterial = new THREE.MeshStandardMaterial({
    roughness: 0.9,
    flatShading: true,
    // The two banks run outward in opposite directions, so one of them is wound face-down. Draw both faces.
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  bankMaterial.onBeforeCompile = (shader) => {
    addRiverCoord(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${RIVER_FRAGMENT_HEAD}\n${BANK_FRAGMENT_HEAD}`)
      .replace("#include <color_fragment>", `#include <color_fragment>\n${BANK_COLOUR_CHUNK}`)
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>\nroughnessFactor = bankRoughness;`);
  };

  const group = new THREE.Group();
  group.add(new THREE.Mesh(bankGeometry, bankMaterial));
  group.add(new THREE.Mesh(water.geometry, waterMaterial));

  return {
    group,
    update(nowSeconds, daylight) {
      water.placeCorners(nowSeconds);
      uniforms.riverTime.value = nowSeconds;
      uniforms.riverDaylight.value = daylight;
    },
    dispose() {
      water.geometry.dispose();
      waterMaterial.dispose();
      bankGeometry.dispose();
      bankMaterial.dispose();
    },
  };
}

/** One cross-section of the river: its middle, the direction square to the flow, and the still water height there. */
interface RiverFrame {
  readonly x: number;
  readonly z: number;
  readonly sideX: number;
  readonly sideZ: number;
  /** Distance from the river's upstream end, in metres. */
  readonly along: number;
  readonly surface: number;
}

/** Cross-sections at about this spacing along a smooth curve through the river's path. */
function sampleRiver(valley: Valley, stepMetres: number, halfWidth: number): RiverFrame[] {
  const curve = new THREE.CatmullRomCurve3(valley.river.path.map((point) => new THREE.Vector3(point.x, 0, point.z)));
  const length = curve.getLength();
  const steps = Math.max(1, Math.round(length / stepMetres));
  const centre = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const frames: RiverFrame[] = [];
  for (let step = 0; step <= steps; step += 1) {
    const fraction = step / steps;
    curve.getPointAt(fraction, centre);
    curve.getTangentAt(fraction, tangent);
    const sideLength = Math.hypot(tangent.x, tangent.z) || 1;
    const sideX = -tangent.z / sideLength;
    const sideZ = tangent.x / sideLength;
    const lowerBank = Math.min(
      drawnGroundHeightAt(valley.terrain, centre.x - sideX * halfWidth, centre.z - sideZ * halfWidth),
      drawnGroundHeightAt(valley.terrain, centre.x + sideX * halfWidth, centre.z + sideZ * halfWidth),
    );
    frames.push({ x: centre.x, z: centre.z, sideX, sideZ, along: fraction * length, surface: lowerBank + WATER_ABOVE_BANK_METRES });
  }
  return frames;
}

interface WaterGeometry {
  readonly geometry: THREE.BufferGeometry;
  /** Raises and lowers the ripples for this moment. */
  placeCorners(nowSeconds: number): void;
}

/**
 * A strip of clear water from bank to bank, built from separate flat triangles,
 * so each facet catches the sun on its own and glints as the ripples pass.
 * The water is more see-through towards its edges, so the pebble bank shows through the shallows.
 * Each corner also carries its place on the river (metres along, metres across), which the shader uses for its effects.
 */
function createWaterGeometry(frames: readonly RiverFrame[], halfWidth: number): WaterGeometry {
  const acrossOffsets: number[] = [];
  for (let column = 0; column < WATER_POINTS_ACROSS; column += 1) {
    acrossOffsets.push(((column / (WATER_POINTS_ACROSS - 1)) * 2 - 1) * halfWidth);
  }
  const across = acrossOffsets.length;

  // A grid of points: one row per cross-section, one column per offset across the river.
  const gridX: number[] = [];
  const gridZ: number[] = [];
  /** The still height of each point. Ripples are added to this. */
  const restHeights: number[] = [];
  const alongRiver: number[] = [];
  /** How much each point ripples: 1 in the middle, 0 at the edge. */
  const rippleStrength: number[] = [];
  /** How solid the water looks at each point, from its depth. */
  const opacity: number[] = [];

  for (const frame of frames) {
    for (const offset of acrossOffsets) {
      const x = frame.x + frame.sideX * offset;
      const z = frame.z + frame.sideZ * offset;
      const share = Math.abs(offset) / halfWidth;
      gridX.push(x);
      gridZ.push(z);
      restHeights.push(frame.surface);
      alongRiver.push(frame.along);
      rippleStrength.push(1 - share ** 2);
      const deepness = THREE.MathUtils.clamp((1 - share) / FULL_OPACITY_SHARE, 0, 1);
      opacity.push(THREE.MathUtils.lerp(SHALLOW_WATER_OPACITY, DEEP_WATER_OPACITY, deepness));
    }
  }

  // Two triangles per grid square. Each triangle has its own three corners, so it shades flat.
  /** Which grid point each triangle corner sits on. */
  const cornerPoints: number[] = [];
  /** White tinted by the material's water colour, with each corner's opacity. */
  const colours: number[] = [];
  /** Each corner's place on the river: metres along, then signed metres across from the middle. */
  const riverCoords: number[] = [];
  const pushTriangle = (a: number, b: number, c: number) => {
    for (const point of [a, b, c]) {
      cornerPoints.push(point);
      colours.push(1, 1, 1, opacity[point] ?? DEEP_WATER_OPACITY);
      riverCoords.push(alongRiver[point] ?? 0, acrossOffsets[point % across] ?? 0);
    }
  };
  for (let step = 1; step < frames.length; step += 1) {
    const row = step * across;
    const previousRow = row - across;
    for (let column = 0; column < across - 1; column += 1) {
      const a = previousRow + column;
      const b = row + column;
      // Alternate the diagonal so the facets zigzag instead of all leaning one way.
      if ((step + column) % 2 === 0) {
        pushTriangle(a, b, a + 1);
        pushTriangle(a + 1, b, b + 1);
      } else {
        pushTriangle(a, b, b + 1);
        pushTriangle(a, b + 1, a + 1);
      }
    }
  }

  const positions = new Float32Array(cornerPoints.length * 3);
  const geometry = new THREE.BufferGeometry();
  const positionAttribute = new THREE.BufferAttribute(positions, 3);
  positionAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("position", positionAttribute);
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colours, 4));
  geometry.setAttribute("riverCoord", new THREE.Float32BufferAttribute(riverCoords, 2));

  const heights = new Float32Array(restHeights.length);
  const waveNumber = (Math.PI * 2) / RIPPLE_LENGTH_METRES;
  function placeCorners(nowSeconds: number): void {
    const drift = nowSeconds * FLOW_SPEED_METRES_PER_SECOND;
    for (let point = 0; point < heights.length; point += 1) {
      const along = (alongRiver[point] ?? 0) - drift;
      const x = gridX[point] ?? 0;
      const z = gridZ[point] ?? 0;
      // Two crossing waves, so the facets catch the light unevenly instead of in neat stripes.
      const ripple = Math.sin(along * waveNumber + x * 0.9) * 0.6 + Math.sin(along * waveNumber * 0.57 - z * 0.7 - x * 1.3) * 0.4;
      heights[point] = (restHeights[point] ?? 0) + ripple * RIPPLE_HEIGHT_METRES * (rippleStrength[point] ?? 0);
    }
    cornerPoints.forEach((point, corner) => {
      positions[corner * 3] = gridX[point] ?? 0;
      positions[corner * 3 + 1] = heights[point] ?? 0;
      positions[corner * 3 + 2] = gridZ[point] ?? 0;
    });
    positionAttribute.needsUpdate = true;
  }
  placeCorners(0);
  geometry.computeBoundingSphere();

  return { geometry, placeCorners };
}

/**
 * Two strips that lie on the ground, one along each bank. Each runs from under the shallows out past the water's edge.
 * The shader paints sand and pebbles on them and cuts their outer edge into an uneven line.
 */
function createBankGeometry(terrain: Terrain, frames: readonly RiverFrame[], halfWidth: number): THREE.BufferGeometry {
  const inner = halfWidth - BANK_UNDER_WATER_METRES;
  const outer = halfWidth + BANK_MAX_REACH_METRES;
  const positions: number[] = [];
  const riverCoords: number[] = [];
  const indices: number[] = [];
  for (const side of [-1, 1]) {
    const first = positions.length / 3;
    for (const frame of frames) {
      for (let column = 0; column < BANK_POINTS_ACROSS; column += 1) {
        const offset = side * THREE.MathUtils.lerp(inner, outer, column / (BANK_POINTS_ACROSS - 1));
        const x = frame.x + frame.sideX * offset;
        const z = frame.z + frame.sideZ * offset;
        positions.push(x, drawnGroundHeightAt(terrain, x, z) + BANK_ABOVE_GROUND_METRES, z);
        riverCoords.push(frame.along, offset);
      }
    }
    for (let step = 1; step < frames.length; step += 1) {
      const row = first + step * BANK_POINTS_ACROSS;
      const previousRow = row - BANK_POINTS_ACROSS;
      for (let column = 0; column < BANK_POINTS_ACROSS - 1; column += 1) {
        const a = previousRow + column;
        const b = row + column;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("riverCoord", new THREE.Float32BufferAttribute(riverCoords, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Ground height at a spot, matching the triangles the terrain mesh in valley-meshes.ts is drawn with.
 * The valley's own terrainHeightAt blends all four corners of a grid square, which can sit a little above
 * or below the drawn triangles. Following the drawn triangles keeps the bank and the water's edge on the ground.
 */
function drawnGroundHeightAt(terrain: Terrain, x: number, z: number): number {
  const last = terrain.pointsPerSide - 1;
  const half = (last * terrain.spacing) / 2;
  const column = THREE.MathUtils.clamp((x + half) / terrain.spacing, 0, last);
  const row = THREE.MathUtils.clamp((z + half) / terrain.spacing, 0, last);
  const column0 = Math.min(Math.floor(column), last - 1);
  const row0 = Math.min(Math.floor(row), last - 1);
  const across = column - column0;
  const down = row - row0;
  const height = (r: number, c: number) => terrain.heights[r * terrain.pointsPerSide + c] ?? 0;
  // Each grid square is drawn as two triangles split along the diagonal from (row0 + 1, column0) to (row0, column0 + 1).
  if (across + down <= 1) {
    const corner = height(row0, column0);
    return corner + across * (height(row0, column0 + 1) - corner) + down * (height(row0 + 1, column0) - corner);
  }
  const corner = height(row0 + 1, column0 + 1);
  return corner + (1 - across) * (height(row0 + 1, column0) - corner) + (1 - down) * (height(row0, column0 + 1) - corner);
}

const RIVER_VERTEX_HEAD = /* glsl */ `
attribute vec2 riverCoord;
varying vec2 vRiverCoord;
`;

const RIVER_FRAGMENT_HEAD = /* glsl */ `
varying vec2 vRiverCoord;
uniform float riverTime;
uniform float riverDaylight;
uniform float riverHalfWidth;
uniform float riverFlowSpeed;
uniform vec3 riverStreakColour;
uniform float riverSparkleShare;
uniform float riverSparkleBrightness;
uniform float riverBankReach;
uniform vec3 riverSandColours[2];
uniform vec3 riverPebbleColours[4];
uniform float riverPebbleSpacing;

float riverHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Smooth random values between 0 and 1, changing over about one unit.
float riverNoise(vec2 p) {
  vec2 cell = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(riverHash(cell), riverHash(cell + vec2(1.0, 0.0)), u.x),
    mix(riverHash(cell + vec2(0.0, 1.0)), riverHash(cell + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

// Thin streaks running along the river, carried downstream at this speed.
float riverStreaks(float along, float across, float speed, float seed) {
  float carried = along - riverTime * speed;
  float lines = riverNoise(vec2(carried * 0.12 + seed, across * 1.8));
  float comings = riverNoise(vec2(carried * 0.05 - seed, riverTime * 0.07 + seed));
  return smoothstep(0.72, 0.9, lines) * smoothstep(0.35, 0.7, comings);
}
`;

// Runs after the water colour and opacity are known. Paints faint streaks that drift with the current.
const WATER_STREAK_CHUNK = /* glsl */ `
{
  float share = abs(vRiverCoord.y) / riverHalfWidth;
  // Two layers of streaks: fast ones in the middle and slow ones near the banks.
  float fast = riverStreaks(vRiverCoord.x, vRiverCoord.y, riverFlowSpeed, 0.0);
  float slow = riverStreaks(vRiverCoord.x, vRiverCoord.y, riverFlowSpeed * 0.45, 17.0);
  float streak = mix(fast, slow, smoothstep(0.3, 0.8, share)) * (1.0 - smoothstep(0.6, 0.85, share));
  diffuseColor.rgb = mix(diffuseColor.rgb, riverStreakColour, streak * 0.35);
  diffuseColor.a = max(diffuseColor.a, streak * 0.5);
}
`;

// Runs where the material adds its own glow. Adds a few faint, tiny sparkles that twinkle on the open water, by day only.
const WATER_SPARKLE_CHUNK = /* glsl */ `
{
  if (abs(vRiverCoord.y) < riverHalfWidth * 0.7) {
    vec2 spot = vec2(vRiverCoord.x - riverTime * riverFlowSpeed, vRiverCoord.y) / 0.7;
    vec2 cell = floor(spot);
    float chance = riverHash(cell);
    vec2 centreOffset = fract(spot) - (0.3 + 0.4 * vec2(riverHash(cell + 3.1), riverHash(cell + 7.7)));
    float fleck = 1.0 - smoothstep(0.03, 0.09, length(centreOffset));
    float twinkle = pow(max(0.0, sin(riverTime * 1.8 + chance * 40.0)), 40.0);
    float sparkle = fleck * twinkle * step(1.0 - riverSparkleShare, chance) * riverDaylight;
    totalEmissiveRadiance += vec3(sparkle * riverSparkleBrightness);
  }
}
`;

const BANK_FRAGMENT_HEAD = /* glsl */ `
float bankRoughness = 0.9;
`;

// Paints sand and pebbles on the bank, darker and glossier where wet, and cuts its outer edge into an uneven line.
const BANK_COLOUR_CHUNK = /* glsl */ `
{
  float along = vRiverCoord.x;
  float across = vRiverCoord.y;
  float fromMiddle = abs(across);
  float side = sign(across);
  float beyondWater = fromMiddle - riverHalfWidth;

  // The bank's outer edge wanders in broad curves, with small bites taken out of it.
  float broad = riverNoise(vec2(along * 0.12 + side * 13.0, 0.5));
  float bites = riverNoise(vec2(along * 1.6 + side * 7.0, 2.5));
  float reach = riverBankReach * (0.25 + 0.75 * broad) + 0.25 * (bites - 0.5);
  if (beyondWater > reach) discard;

  // Sand, mottled between two colours.
  vec2 spot = vec2(along, across);
  vec3 colour = mix(riverSandColours[0], riverSandColours[1], riverNoise(spot * 0.9));
  colour *= 0.92 + 0.16 * riverHash(floor(spot * 18.0));

  // Pebbles: each grid cell may hold one, placed and sized at random. Check the cell and its neighbours,
  // since a pebble may spill over its cell's edge.
  vec2 grid = spot / riverPebbleSpacing;
  vec2 home = floor(grid);
  float nearest = 10.0;
  float pick = 0.0;
  for (int dx = -1; dx <= 1; dx++) {
    for (int dz = -1; dz <= 1; dz++) {
      vec2 cell = home + vec2(float(dx), float(dz));
      vec2 centre = cell + 0.2 + 0.6 * vec2(riverHash(cell + 5.3), riverHash(cell + 9.1));
      float radius = 0.22 + 0.2 * riverHash(cell + 2.7);
      float howFar = length((grid - centre) * vec2(1.0, 1.3)) / radius;
      if (howFar < nearest) {
        nearest = howFar;
        pick = riverHash(cell + 11.9);
      }
    }
  }
  // More pebbles near the water, fewer out on the grass side.
  float crowding = mix(0.65, 0.2, smoothstep(-1.0, riverBankReach, beyondWater));
  if (nearest < 1.0 && pick < crowding) {
    vec3 pebble = riverPebbleColours[int(floor(pick / crowding * 3.999))];
    // A darker rim gives each pebble a little roundness.
    colour = pebble * mix(1.05, 0.7, smoothstep(0.55, 1.0, nearest));
  }

  // Ground under or just beside the water is wet: darker and a little glossy.
  float wet = 1.0 - smoothstep(-0.2, 0.4, beyondWater);
  colour *= mix(1.0, 0.7, wet);
  bankRoughness = mix(0.9, 0.45, wet);

  diffuseColor.rgb = colour;
}
`;

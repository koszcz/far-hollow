// Draws the code-built "river" listed in asset-manifest.json: clear, rippling low-poly water,
// pending the owner's approval. On top of the water it draws sparkles on the ripples, flow streaks
// that show the current, froth lapping at the shoreline, and a strip of wet, darker ground along each bank.
import * as THREE from "three";
import type { Terrain, Valley } from "../sim/valley";

/** The water's one colour. The riverbed shows through it. */
const WATER_COLOUR = 0x3f8f9c;
/** How solid the water looks where it is deepest. */
const DEEP_WATER_OPACITY = 0.85;
/** How solid the water looks at the bank, where it is only a film. */
const SHALLOW_WATER_OPACITY = 0.3;
/** Water at least this deep has the full deep opacity. */
const FULL_OPACITY_DEPTH_METRES = 1.4;

/** The riverbed is cut 2 m deep. The water fills most of it. */
const WATER_LEVEL_ABOVE_BED_METRES = 1.5;
/** The water reaches this far past the river's width. The player cannot walk closer than about this, so no one stands in it. */
const WATER_OVERLAP_METRES = 1.5;
/** The water's outer edge slopes down to sit just above the bank, so no edge of the surface floats in the air. */
const SHORE_ABOVE_GROUND_METRES = 0.05;
/** Distance between cross-sections of the water strip, along the river. Small enough for smooth bends. */
const WATER_STEP_METRES = 5;
/** Points across the water in each cross-section, from bank to bank. */
const WATER_POINTS_ACROSS = 9;

/** Height of the ripples on the water surface, from the middle to a crest. */
const RIPPLE_HEIGHT_METRES = 0.18;
/** Distance between ripple crests along the river. */
const RIPPLE_LENGTH_METRES = 7;
/** How fast the ripples and the middle of the current move downstream. Water near the banks moves slower. */
const FLOW_SPEED_METRES_PER_SECOND = 1.2;

/** Width of the wet, darker ground beyond the water's edge. */
const WET_BANK_WIDTH_METRES = 1.2;
/** The wet strip sits this far above the ground, so it never sinks into it. */
const WET_BANK_ABOVE_GROUND_METRES = 0.1;
/** Wet ground is a little glossy, but much less than water, so it never glares white. */
const WET_BANK_ROUGHNESS = 0.55;
/** Colour of wet ground: the grass colour, darkened. */
const WET_BANK_COLOUR = 0x34481f;
/** How dark the wet strip is at the water's edge. It fades to nothing at its outer edge. */
const WET_BANK_OPACITY = 0.6;

/** Colour of the froth at the shoreline and of the flow streaks. */
const FROTH_COLOUR = 0xe4f2f0;
/** Widest reach of the shoreline froth into the water. */
const FROTH_WIDTH_METRES = 0.9;
/** How solid the froth looks at its thickest. */
const FROTH_OPACITY = 0.6;
/** How fast the froth reaches in and pulls back, in radians per second. Slow, so it reads as lapping, not flicker. */
const FROTH_LAP_SPEED = 0.6;

/** Share of the water's open surface that has a sparkle cell lit at all. */
const SPARKLE_SHARE = 0.12;
/** How bright a sparkle is at its peak. */
const SPARKLE_BRIGHTNESS = 0.7;

export interface RiverMeshes {
  readonly group: THREE.Group;
  /** Moves the ripples, streaks, sparkles, and froth. Daylight runs from 0 (night) to 1 (full day). */
  update(nowSeconds: number, daylight: number): void;
  dispose(): void;
}

export function createRiverMeshes(valley: Valley): RiverMeshes {
  const water = createWaterGeometry(valley);
  const uniforms = {
    riverTime: { value: 0 },
    riverDaylight: { value: 1 },
    riverHalfWidth: { value: water.halfWidth },
    riverFlowSpeed: { value: FLOW_SPEED_METRES_PER_SECOND },
    riverWetWidth: { value: WET_BANK_WIDTH_METRES },
    riverWetColour: { value: new THREE.Color(WET_BANK_COLOUR) },
    riverWetOpacity: { value: WET_BANK_OPACITY },
    riverWetRoughness: { value: WET_BANK_ROUGHNESS },
    riverFrothColour: { value: new THREE.Color(FROTH_COLOUR) },
    riverFrothWidth: { value: FROTH_WIDTH_METRES },
    riverFrothOpacity: { value: FROTH_OPACITY },
    riverFrothLapSpeed: { value: FROTH_LAP_SPEED },
    riverShoreline: { value: water.shoreline },
    riverSparkleShare: { value: SPARKLE_SHARE },
    riverSparkleBrightness: { value: SPARKLE_BRIGHTNESS },
  };
  const material = new THREE.MeshStandardMaterial({
    color: WATER_COLOUR,
    vertexColors: true,
    transparent: true,
    flatShading: true,
    roughness: 0.12,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${RIVER_VERTEX_HEAD}`)
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRiverCoord = riverCoord;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${RIVER_FRAGMENT_HEAD}`)
      .replace("#include <color_fragment>", `#include <color_fragment>\n${RIVER_SURFACE_CHUNK}`)
      .replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\nif (abs(vRiverCoord.y) > riverHalfWidth) roughnessFactor = riverWetRoughness;",
      )
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\n${RIVER_SPARKLE_CHUNK}`);
  };

  const group = new THREE.Group();
  group.add(new THREE.Mesh(water.geometry, material));

  return {
    group,
    update(nowSeconds, daylight) {
      water.placeCorners(nowSeconds);
      uniforms.riverTime.value = nowSeconds;
      uniforms.riverDaylight.value = daylight;
    },
    dispose() {
      water.geometry.dispose();
      material.dispose();
    },
  };
}

interface WaterGeometry {
  readonly geometry: THREE.BufferGeometry;
  /** Distance from the middle of the river to the water's edge. */
  readonly halfWidth: number;
  /** Distance from the middle of the river to where the flat water ends and its edge slopes down under the bank. */
  readonly shoreline: number;
  /** Raises and lowers the ripples for this moment. */
  placeCorners(nowSeconds: number): void;
}

/**
 * A strip of clear water along a smooth curve through the river's path, with a strip of wet bank on each side.
 * It is built from separate flat triangles, so each facet catches the sun on its own and glints as the ripples pass.
 * The water is more see-through where it is shallow, so the riverbed shows through near the banks.
 * Each corner also carries its place on the river (metres along, metres across), which the shader uses for its effects.
 */
function createWaterGeometry(valley: Valley): WaterGeometry {
  const { path, width } = valley.river;
  const halfWidth = width / 2 + WATER_OVERLAP_METRES;
  const curve = new THREE.CatmullRomCurve3(path.map((point) => new THREE.Vector3(point.x, 0, point.z)));
  const steps = Math.max(1, Math.round(curve.getLength() / WATER_STEP_METRES));

  // Across each cross-section: the outer edge of the wet bank, the water from bank to bank, then the other wet bank.
  const acrossOffsets: number[] = [-(halfWidth + WET_BANK_WIDTH_METRES)];
  for (let column = 0; column < WATER_POINTS_ACROSS; column += 1) {
    acrossOffsets.push(((column / (WATER_POINTS_ACROSS - 1)) * 2 - 1) * halfWidth);
  }
  acrossOffsets.push(halfWidth + WET_BANK_WIDTH_METRES);
  const across = acrossOffsets.length;

  // A grid of points: one row per cross-section, one column per offset across the river.
  const gridX: number[] = [];
  const gridZ: number[] = [];
  /** The still height of each point. Ripples are added to this. */
  const restHeights: number[] = [];
  /** Distance of each point along the river, in metres. */
  const alongRiver: number[] = [];
  /** How much each point ripples: 1 in the middle, 0 at and beyond the bank. */
  const rippleStrength: number[] = [];
  /** How solid the water looks at each point, from its depth. The shader sets the wet bank's own opacity. */
  const opacity: number[] = [];

  const centre = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  for (let step = 0; step <= steps; step += 1) {
    const fraction = step / steps;
    curve.getPointAt(fraction, centre);
    curve.getTangentAt(fraction, tangent);
    // The cross-section runs square to the river's flow at this point.
    const sideLength = Math.hypot(tangent.x, tangent.z) || 1;
    const sideX = -tangent.z / sideLength;
    const sideZ = tangent.x / sideLength;
    const surface = drawnGroundHeightAt(valley.terrain, centre.x, centre.z) + WATER_LEVEL_ABOVE_BED_METRES;
    for (const offset of acrossOffsets) {
      const x = centre.x + sideX * offset;
      const z = centre.z + sideZ * offset;
      const ground = drawnGroundHeightAt(valley.terrain, x, z);
      const share = Math.abs(offset) / halfWidth;
      let rest = surface;
      if (share > 1.001) rest = ground + WET_BANK_ABOVE_GROUND_METRES;
      else if (share > 0.999) rest = Math.min(surface, ground + SHORE_ABOVE_GROUND_METRES);
      gridX.push(x);
      gridZ.push(z);
      restHeights.push(rest);
      alongRiver.push(fraction * steps * WATER_STEP_METRES);
      rippleStrength.push(share > 0.999 ? 0 : 1 - share ** 2);
      const depth = THREE.MathUtils.clamp((rest - ground) / FULL_OPACITY_DEPTH_METRES, 0, 1);
      opacity.push(THREE.MathUtils.lerp(SHALLOW_WATER_OPACITY, DEEP_WATER_OPACITY, depth));
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
  for (let step = 1; step <= steps; step += 1) {
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

  const shoreline = halfWidth * (1 - 2 / (WATER_POINTS_ACROSS - 1));
  return { geometry, halfWidth, shoreline, placeCorners };
}

/**
 * Ground height at a spot, matching the triangles the terrain mesh in valley-meshes.ts is drawn with.
 * The valley's own terrainHeightAt blends all four corners of a grid square, which can sit a little above
 * or below the drawn triangles. Following the drawn triangles keeps the wet bank from floating or sinking.
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
uniform float riverWetWidth;
uniform vec3 riverWetColour;
uniform float riverWetOpacity;
uniform float riverWetRoughness;
uniform vec3 riverFrothColour;
uniform float riverFrothWidth;
uniform float riverFrothOpacity;
uniform float riverFrothLapSpeed;
uniform float riverShoreline;
uniform float riverSparkleShare;
uniform float riverSparkleBrightness;

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

// Runs after the water colour and opacity are known. Paints the wet bank, flow streaks, and shoreline froth.
const RIVER_SURFACE_CHUNK = /* glsl */ `
{
  float along = vRiverCoord.x;
  float across = vRiverCoord.y;
  float fromMiddle = abs(across);
  if (fromMiddle > riverHalfWidth) {
    float outward = (fromMiddle - riverHalfWidth) / riverWetWidth;
    diffuseColor = vec4(riverWetColour, riverWetOpacity * (1.0 - smoothstep(0.0, 1.0, outward)));
  } else {
    float share = fromMiddle / riverHalfWidth;
    // Two layers of streaks: fast ones in the middle and slow ones near the banks.
    float fast = riverStreaks(along, across, riverFlowSpeed, 0.0);
    float slow = riverStreaks(along, across, riverFlowSpeed * 0.45, 17.0);
    float streak = mix(fast, slow, smoothstep(0.3, 0.8, share)) * (1.0 - smoothstep(0.75, 0.95, share));
    diffuseColor.rgb = mix(diffuseColor.rgb, riverFrothColour, streak * 0.35);
    diffuseColor.a = max(diffuseColor.a, streak * 0.5);

    // Soft, uneven froth along the shoreline, where the flat water meets the bank. It slowly reaches in and pulls back.
    // It stays on the flat water, not on the edge that slopes down under the bank, so the ground never cuts it up.
    float side = sign(across);
    float lap = 0.65 + 0.35 * sin(riverTime * riverFrothLapSpeed + along * 0.15 + side * 2.0);
    float uneven = riverNoise(vec2(along * 0.3, riverTime * 0.12 + side * 9.0));
    float reach = riverFrothWidth * lap * (0.5 + 0.5 * uneven);
    float froth = smoothstep(riverShoreline - reach, riverShoreline - reach * 0.2, fromMiddle)
      * (1.0 - smoothstep(riverShoreline + 0.1, riverShoreline + 0.5, fromMiddle));
    diffuseColor.rgb = mix(diffuseColor.rgb, riverFrothColour, froth * riverFrothOpacity);
    diffuseColor.a = max(diffuseColor.a, froth * riverFrothOpacity);
  }
}
`;

// Runs where the material adds its own glow. Adds a few faint, tiny sparkles that twinkle on the open water, by day only.
const RIVER_SPARKLE_CHUNK = /* glsl */ `
{
  float fromMiddle = abs(vRiverCoord.y);
  if (fromMiddle < riverShoreline - riverFrothWidth) {
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

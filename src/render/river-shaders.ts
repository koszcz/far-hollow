// The GLSL chunks that paint the river: the water's streaks and sparkles, the ice, and the pebble bank.
// river-meshes.ts splices them into the water and bank materials.
export const RIVER_VERTEX_HEAD = /* glsl */ `
attribute vec2 riverCoord;
varying vec2 vRiverCoord;
`;

export const RIVER_FRAGMENT_HEAD = /* glsl */ `
varying vec2 vRiverCoord;
uniform float riverTime;
uniform float riverDaylight;
uniform float riverFrozen;
uniform vec3 riverIceDeep;
uniform vec3 riverIceEdge;
uniform vec3 riverFrost;
uniform float riverCrackPiece;
uniform float riverLongCrackPiece;
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

// How far this point is from the nearest edge between random pieces, in units of one piece. 0 on an edge.
float riverPieceEdge(vec2 p) {
  vec2 cell = floor(p);
  vec2 f = fract(p);
  float nearest = 8.0;
  float second = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbour = vec2(float(x), float(y));
      vec2 seed = neighbour + vec2(riverHash(cell + neighbour), riverHash(cell + neighbour + 19.3)) - f;
      float distance = dot(seed, seed);
      if (distance < nearest) {
        second = nearest;
        nearest = distance;
      } else if (distance < second) {
        second = distance;
      }
    }
  }
  return sqrt(second) - sqrt(nearest);
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
export const WATER_STREAK_CHUNK = /* glsl */ `
{
  float share = abs(vRiverCoord.y) / riverHalfWidth;
  // Two layers of streaks: fast ones in the middle and slow ones near the banks.
  float fast = riverStreaks(vRiverCoord.x, vRiverCoord.y, riverFlowSpeed, 0.0);
  float slow = riverStreaks(vRiverCoord.x, vRiverCoord.y, riverFlowSpeed * 0.45, 17.0);
  float streak = mix(fast, slow, smoothstep(0.3, 0.8, share)) * (1.0 - smoothstep(0.6, 0.85, share));
  streak *= 1.0 - riverFrozen;
  diffuseColor.rgb = mix(diffuseColor.rgb, riverStreakColour, streak * 0.35);
  diffuseColor.a = max(diffuseColor.a, streak * 0.5);
  // Ice looks solid, though thin ice at the edges still shows a little of the bank.
  diffuseColor.a = mix(diffuseColor.a, 0.55 + 0.45 * diffuseColor.a, riverFrozen);
}
`;

// Runs after the streaks. Paints the ice while the river is frozen: blue to pale across, frost, cracks, bubbles, and a rim.
export const ICE_CHUNK = /* glsl */ `
if (riverFrozen > 0.5) {
  vec2 spot = vRiverCoord;
  float share = abs(spot.y) / riverHalfWidth;
  // Deeper blue in the middle, paler towards the banks, with a broad wander so the line is not straight.
  float paleness = smoothstep(0.15, 0.85, share + (riverNoise(spot * 0.12) - 0.5) * 0.35);
  vec3 ice = mix(riverIceDeep, riverIceEdge, paleness);
  // Soft frost patches, large and small.
  float frost = riverNoise(spot * 0.35) * 0.65 + riverNoise(spot * 1.3 + 5.0) * 0.35;
  ice = mix(ice, riverFrost, smoothstep(0.5, 0.85, frost) * 0.55);
  // A thin network of cracks, plus a few long ones. Their lines wobble a little.
  vec2 wobble = vec2(riverNoise(spot * 0.9), riverNoise(spot * 0.9 + 9.0)) * 0.25;
  float crack = 1.0 - smoothstep(0.02, 0.06, riverPieceEdge(spot / riverCrackPiece + wobble));
  crack *= smoothstep(0.35, 0.6, riverNoise(spot * 0.25 + 3.0));
  float longCrack = 1.0 - smoothstep(0.01, 0.03, riverPieceEdge(spot / riverLongCrackPiece + wobble * 0.5));
  ice = mix(ice, riverFrost, max(crack * 0.6, longCrack * 0.8));
  // A few small bubbles caught in the ice.
  vec2 bubbleSpot = spot / 0.45;
  vec2 bubbleCell = floor(bubbleSpot);
  vec2 bubbleOffset = fract(bubbleSpot) - (0.3 + 0.4 * vec2(riverHash(bubbleCell + 2.3), riverHash(bubbleCell + 8.1)));
  float bubble = (1.0 - smoothstep(0.05, 0.09, length(bubbleOffset))) * step(0.93, riverHash(bubbleCell + 4.7));
  ice = mix(ice, riverFrost, bubble * 0.7 * (1.0 - paleness * 0.6));
  // A bright frost rim where the ice meets the bank. Its inner edge wanders.
  float rim = smoothstep(0.84, 0.94, share + (riverNoise(spot * 0.6 + 11.0) - 0.5) * 0.12);
  ice = mix(ice, riverFrost, rim * 0.85);
  diffuseColor.rgb = ice;
  // Frost is opaque, so the rim hides the bank beneath it.
  diffuseColor.a = max(diffuseColor.a, rim * 0.9);
}
`;

// Runs where the material adds its own glow. Adds a few faint, tiny sparkles that twinkle on the open water, by day only.
export const WATER_SPARKLE_CHUNK = /* glsl */ `
{
  if (abs(vRiverCoord.y) < riverHalfWidth * 0.7) {
    vec2 spot = vec2(vRiverCoord.x - riverTime * riverFlowSpeed, vRiverCoord.y) / 0.7;
    vec2 cell = floor(spot);
    float chance = riverHash(cell);
    vec2 centreOffset = fract(spot) - (0.3 + 0.4 * vec2(riverHash(cell + 3.1), riverHash(cell + 7.7)));
    float fleck = 1.0 - smoothstep(0.03, 0.09, length(centreOffset));
    float twinkle = pow(max(0.0, sin(riverTime * 1.8 + chance * 40.0)), 40.0);
    float sparkle = fleck * twinkle * step(1.0 - riverSparkleShare, chance) * riverDaylight * (1.0 - riverFrozen);
    totalEmissiveRadiance += vec3(sparkle * riverSparkleBrightness);
  }
}
`;

export const BANK_FRAGMENT_HEAD = /* glsl */ `
float bankRoughness = 0.9;
`;

// Paints sand and pebbles on the bank, darker and glossier where wet, and cuts its outer edge into an uneven line.
export const BANK_COLOUR_CHUNK = /* glsl */ `
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

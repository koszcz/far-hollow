// Draws the valley's ground with the code-built "terrain" listed in asset-manifest.json (approved).
// The ground shows three ground types, forest floor, clearing, and river bank, blended softly by a baked map.
// The painted textures and the map come from ground-texture.ts. The river is drawn in river-meshes.ts.
// Trees, stumps, and logs are drawn in forest-meshes.ts.
import * as THREE from "three";
import type { Valley } from "../sim/valley";
import { bakeGroundTypeWeights, createGroundTypeTextures, GROUND_TEXTURE_TILE_METRES, rebakeGroundTypeWeights, texelsCovering } from "./ground-texture";
import type { GroundRect } from "../sim/structure-kind";
import type { DrawnGround } from "./drawn-ground";

/** Spots across each side of the baked ground-type map. About 1 m apart in a 1 km valley, close enough to ring each tree. */
const GROUND_TYPE_MAP_TEXELS = 1024;

/**
 * The ground's average colour, halfway between brown forest floor and green clearing.
 * The sky light uses it as the colour bounced up from the ground.
 */
export const GROUND_COLOUR = 0x62683a;
export interface ValleyMeshes {
  readonly group: THREE.Group;
  /** The terrain mesh, so clicks can find the spot on the ground under the pointer. */
  readonly ground: THREE.Mesh;
  /** Bakes the ground types again in these areas, after the ground changed there. */
  redrawGround(areas: readonly GroundRect[]): void;
  dispose(): void;
}

/** The ground's types come from `drawnGround`, so they follow the trees that stand for good. */
export function createValleyMeshes(valley: Valley, drawnGround: DrawnGround): ValleyMeshes {
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  function track<T extends { dispose(): void }>(item: T): T {
    disposables.push(item);
    return item;
  }

  // Terrain: one mesh whose corners follow the valley's height grid.
  const segments = valley.terrain.pointsPerSide - 1;
  const groundGeometry = track(new THREE.PlaneGeometry(valley.size, valley.size, segments, segments));
  // After this turn, vertex 0 sits at x = -size / 2, z = -size / 2, matching row 0, column 0 of the height grid.
  groundGeometry.rotateX(-Math.PI / 2);
  const groundPositions = groundGeometry.getAttribute("position");
  valley.terrain.heights.forEach((height, index) => {
    groundPositions.setY(index, height);
  });
  groundGeometry.computeVertexNormals();
  const { material: groundMaterial, weights } = createGroundMaterial(valley, drawnGround, track);
  track(groundMaterial);
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  group.add(ground);
  /** Whether the baked map has gone to the graphics card once. Until then, the whole map goes, not only the rows that changed. */
  let uploaded = false;
  weights.onUpdate = () => {
    uploaded = true;
  };

  return {
    group,
    ground,
    redrawGround(areas) {
      if (areas.length === 0) return;
      const data = weights.image.data as Uint8Array;
      const texels = GROUND_TYPE_MAP_TEXELS;
      for (const area of areas) {
        const block = texelsCovering(valley.size, texels, area);
        rebakeGroundTypeWeights(data, drawnGround.currentMap(), texels, block);
        // Send only the changed rows, so a change costs little to draw.
        if (uploaded) {
          for (let row = block.minRow; row <= block.maxRow; row += 1) {
            weights.addUpdateRange((row * texels + block.minColumn) * 4, (block.maxColumn - block.minColumn + 1) * 4);
          }
        }
      }
      weights.needsUpdate = true;
    },
    dispose() {
      for (const item of disposables) item.dispose();
    },
  };
}

/**
 * A material that blends the three ground-type textures. The baked map says how much of each shows at every spot,
 * and adds large light and dark patches so the repeating textures do not show a pattern.
 * Ground types come from `drawnGround`. Returns the baked map too, so it can be baked again where the ground changes.
 */
function createGroundMaterial(
  valley: Valley,
  drawnGround: DrawnGround,
  track: <T extends { dispose(): void }>(item: T) => T,
): { material: THREE.MeshStandardMaterial; weights: THREE.DataTexture } {
  const textures = createGroundTypeTextures();
  const repeat = valley.size / GROUND_TEXTURE_TILE_METRES;
  for (const texture of Object.values(textures)) {
    track(texture);
    texture.repeat.set(repeat, repeat);
  }
  const texels = GROUND_TYPE_MAP_TEXELS;
  const weights = track(new THREE.DataTexture(bakeGroundTypeWeights(drawnGround.currentMap(), texels), texels, texels));
  weights.magFilter = THREE.LinearFilter;
  weights.minFilter = THREE.LinearFilter;
  weights.needsUpdate = true;

  // The clearing texture is the material's own map, so three.js sets up the repeating texture coordinates for all three.
  // Smooth shading, so the slopes do not show every triangle.
  const material = new THREE.MeshStandardMaterial({ map: textures.clearing });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.forestFloorMap = { value: textures.forestFloor };
    shader.uniforms.riverBankMap = { value: textures.riverBank };
    shader.uniforms.groundTypeWeights = { value: weights };
    shader.uniforms.valleySize = { value: valley.size };
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nuniform float valleySize;\nvarying vec2 vGroundTypeUv;").replace(
      "#include <begin_vertex>",
      // Row 0 of the baked map is the edge at z = -size / 2, which is texture coordinate 0.
      "#include <begin_vertex>\nvGroundTypeUv = position.xz / valleySize + 0.5;",
    );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform sampler2D forestFloorMap;\nuniform sampler2D riverBankMap;\nuniform sampler2D groundTypeWeights;\nvarying vec2 vGroundTypeUv;",
      )
      .replace(
        "#include <map_fragment>",
        [
          // Red is forest floor and blue is river bank. Clearing fills the rest. See bakeGroundTypeWeights.
          "vec4 groundMap = texture2D( groundTypeWeights, vGroundTypeUv );",
          "vec3 groundWeights = vec3( groundMap.r, max( 1.0 - groundMap.r - groundMap.b, 0.0 ), groundMap.b );",
          "groundWeights /= max( groundWeights.r + groundWeights.g + groundWeights.b, 0.001 );",
          // A second, larger and turned copy of each texture, mixed in by patches, hides the repeat.
          "vec2 largeUv = mat2( 0.8, -0.6, 0.6, 0.8 ) * vMapUv * 0.43 + vec2( 0.31, 0.67 );",
          "vec4 forestFloorColour = mix( texture2D( forestFloorMap, vMapUv ), texture2D( forestFloorMap, largeUv ), groundMap.a );",
          "vec4 clearingColour = mix( texture2D( map, vMapUv ), texture2D( map, largeUv ), groundMap.a );",
          "vec4 riverBankColour = mix( texture2D( riverBankMap, vMapUv ), texture2D( riverBankMap, largeUv ), groundMap.a );",
          "vec4 groundColour = forestFloorColour * groundWeights.r + clearingColour * groundWeights.g + riverBankColour * groundWeights.b;",
          // Green holds large light and dark patches across the valley.
          // Darker patches are also a little warmer and drier, lighter ones a little fresher.
          "groundColour.rgb *= mix( vec3( 0.84, 0.8, 0.7 ), vec3( 1.1, 1.14, 1.12 ), groundMap.g );",
          "diffuseColor *= groundColour;",
        ].join("\n"),
      );
  };
  return { material, weights };
}

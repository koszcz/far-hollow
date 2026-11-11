// Draws the valley's ground with the code-built "terrain" listed in asset-manifest.json (a draft).
// The ground shows three ground types, forest floor, clearing, and river bank, blended softly by a baked map.
// The painted textures and the map come from ground-texture.ts. The river is drawn in river-meshes.ts.
// Trees, stumps, and logs are drawn in forest-meshes.ts.
import * as THREE from "three";
import type { Valley } from "../sim/valley";
import { createGroundMap } from "../sim/ground-types";
import { bakeGroundTypeWeights, createGroundTypeTextures, GROUND_TEXTURE_TILE_METRES } from "./ground-texture";

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
  dispose(): void;
}

export function createValleyMeshes(valley: Valley): ValleyMeshes {
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
  const groundMaterial = track(createGroundMaterial(valley, track));
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  group.add(ground);

  return {
    group,
    ground,
    dispose() {
      for (const item of disposables) item.dispose();
    },
  };
}

/**
 * A material that blends the three ground-type textures. The baked map says how much of each shows at every spot.
 * Ground types come from the valley's starting trees, so felling a tree never changes the ground.
 */
function createGroundMaterial(valley: Valley, track: <T extends { dispose(): void }>(item: T) => T): THREE.MeshStandardMaterial {
  const textures = createGroundTypeTextures();
  const repeat = valley.size / GROUND_TEXTURE_TILE_METRES;
  for (const texture of Object.values(textures)) {
    track(texture);
    texture.repeat.set(repeat, repeat);
  }
  const texels = GROUND_TYPE_MAP_TEXELS;
  const weights = track(new THREE.DataTexture(bakeGroundTypeWeights(createGroundMap(valley), texels), texels, texels));
  weights.magFilter = THREE.LinearFilter;
  weights.minFilter = THREE.LinearFilter;
  weights.needsUpdate = true;

  // The clearing texture is the material's own map, so three.js sets up the repeating texture coordinates for all three.
  const material = new THREE.MeshStandardMaterial({ map: textures.clearing, flatShading: true });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.forestFloorMap = { value: textures.forestFloor };
    shader.uniforms.riverBankMap = { value: textures.riverBank };
    shader.uniforms.groundTypeWeights = { value: weights };
    shader.uniforms.valleySize = { value: valley.size };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float valleySize;\nvarying vec2 vGroundTypeUv;")
      .replace(
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
          "vec3 groundWeights = texture2D( groundTypeWeights, vGroundTypeUv ).rgb;",
          "groundWeights /= max( groundWeights.r + groundWeights.g + groundWeights.b, 0.001 );",
          "vec4 groundColour = texture2D( forestFloorMap, vMapUv ) * groundWeights.r",
          "  + texture2D( map, vMapUv ) * groundWeights.g",
          "  + texture2D( riverBankMap, vMapUv ) * groundWeights.b;",
          "diffuseColor *= groundColour;",
        ].join("\n"),
      );
  };
  return material;
}

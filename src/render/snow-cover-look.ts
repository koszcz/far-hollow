// Builds the code-built "snow-cover" listed in asset-manifest.json (draft): snow lying on the ground, on tree crowns, and on roofs.
// It is no shape of its own. It whitens the faces of other assets' materials that look up at the sky:
// - The ground ("terrain") turns white, a little less on steep slopes.
// - Tree crowns ("trees" and "far-trees") get white tops on the faces that look up, the sides stay green.
// - Roofs ("roof") get a white tint on their sloping planks. The undersides, seen from inside, stay bare.
// Every material shows the same depth of snow, from game logic, so the whole valley whitens and melts together.
import * as THREE from "three";

/** The colour of lying snow. It is a little blue, so it reads as cold even in full sun. */
const SNOW_COLOUR = new THREE.Color(0xeef3f8);

/**
 * Which faces snow lies on, by how far they look up at the sky: 0 is a wall, 1 is flat ground.
 * Faces up to `bareBelow` stay bare, faces from `fullFrom` up are fully white at full depth, and faces between blend.
 * `share` is how white the faces get at full depth, from 0 to 1.
 */
export interface SnowFaces {
  readonly bareBelow: number;
  readonly fullFrom: number;
  readonly share: number;
}

/** Ground is white nearly everywhere, but steep banks show through. */
export const GROUND_SNOW: SnowFaces = { bareBelow: 0.6, fullFrom: 0.85, share: 0.92 };
/** Tree crowns are white only on top, so the tiers of a pine still show green beneath. */
export const CROWN_SNOW: SnowFaces = { bareBelow: 0.2, fullFrom: 0.55, share: 0.85 };
/** Roofs slope, so even their steeper planks hold snow. */
export const ROOF_SNOW: SnowFaces = { bareBelow: 0.3, fullFrom: 0.6, share: 0.85 };

export interface SnowCoverLook {
  /** Makes `material` show snow on the faces `faces` says, and returns it. Patch its shader for anything else first. */
  cover<M extends THREE.Material>(material: M, faces: SnowFaces): M;
  /** Sets how deep the snow lies for this frame, from 0 (none) to 1 (full). */
  update(depth: number): void;
}

/** One depth of snow for every material it covers. */
export function createSnowCoverLook(): SnowCoverLook {
  const depth = { value: 0 };
  return {
    cover(material, faces) {
      const before = material.onBeforeCompile.bind(material);
      const beforeKey = material.customProgramCacheKey();
      material.onBeforeCompile = (shader, renderer) => {
        before(shader, renderer);
        shader.uniforms.snowDepth = depth;
        shader.vertexShader = shader.vertexShader
          .replace("#include <common>", "#include <common>\nvarying vec3 vSnowWorld;")
          .replace(
            "#include <project_vertex>",
            [
              "#include <project_vertex>",
              "vec4 snowWorld = vec4( transformed, 1.0 );",
              "#ifdef USE_INSTANCING",
              "snowWorld = instanceMatrix * snowWorld;",
              "#endif",
              "vSnowWorld = ( modelMatrix * snowWorld ).xyz;",
            ].join("\n"),
          );
        shader.fragmentShader = shader.fragmentShader
          .replace("#include <common>", "#include <common>\nuniform float snowDepth;\nvarying vec3 vSnowWorld;")
          .replace(
            "#include <color_fragment>",
            [
              "#include <color_fragment>",
              // The face's own slope, from how the world position changes across it, so flat-shaded faces each get one share.
              "vec3 snowFace = normalize( cross( dFdx( vSnowWorld ), dFdy( vSnowWorld ) ) );",
              `float snowShare = snowDepth * ${faces.share.toFixed(3)} * smoothstep( ${faces.bareBelow.toFixed(3)}, ${faces.fullFrom.toFixed(3)}, snowFace.y );`,
              `diffuseColor.rgb = mix( diffuseColor.rgb, vec3( ${SNOW_COLOUR.r.toFixed(3)}, ${SNOW_COLOUR.g.toFixed(3)}, ${SNOW_COLOUR.b.toFixed(3)} ), snowShare );`,
            ].join("\n"),
          );
      };
      // three.js shares compiled shaders between materials with the same key, so the key must show the snow too.
      material.customProgramCacheKey = () => `${beforeKey}|snow-${faces.bareBelow}-${faces.fullFrom}-${faces.share}`;
      material.needsUpdate = true;
      return material;
    },
    update(value) {
      depth.value = value;
    },
  };
}

// Fades undergrowth out at the edge of where it is drawn, in the vertex shader, so plants never pop in or out.
// Each plant shrinks toward its foot as it nears the edge of the grown area around the camera's focus, and as it nears
// the furthest distance from the camera that undergrowth is drawn at. Sway from wind-sway.ts applies after this, so a
// shrinking plant also sways less.
import type * as THREE from "three";

/** Undergrowth is drawn out to this distance from where the camera looks, in metres. */
export const UNDERGROWTH_DRAW_METRES = 80;
/** Plants start shrinking this far from where the camera looks, and are gone at the draw distance, in metres. */
const FADE_START_METRES = 64;
/**
 * Plants also shrink away between these distances from the camera, in metres, so a camera zoomed far out skips plants
 * smaller than a pixel or two.
 */
const EYE_FADE_START_METRES = 120;
export const EYE_DRAW_METRES = 160;

/**
 * Makes plants drawn with `material` shrink at the edge of the drawn area around `focus`, where the camera looks on the
 * ground (x east, y south). Call it before wind-sway.ts sways the material, since this replaces the material's shader changes.
 */
export function fadeAtEdges(material: THREE.Material, focus: { readonly value: THREE.Vector2 }): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.undergrowthFocus = focus;
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nuniform vec2 undergrowthFocus;").replace(
      "#include <begin_vertex>",
      [
        "#include <begin_vertex>",
        "#ifdef USE_INSTANCING",
        // Shrink each plant towards its foot as it nears the edge of the drawn area.
        "vec2 undergrowthSpot = ( modelMatrix * instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xz;",
        `transformed *= 1.0 - smoothstep( ${FADE_START_METRES.toFixed(1)}, ${UNDERGROWTH_DRAW_METRES.toFixed(1)}, distance( undergrowthSpot, undergrowthFocus ) );`,
        // Shrink it as it nears the furthest distance from the camera that undergrowth is drawn at.
        "vec3 undergrowthFoot = ( modelMatrix * instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;",
        `transformed *= 1.0 - smoothstep( ${EYE_FADE_START_METRES.toFixed(1)}, ${EYE_DRAW_METRES.toFixed(1)}, distance( undergrowthFoot, cameraPosition ) );`,
        "#endif",
      ].join("\n"),
    );
  };
}

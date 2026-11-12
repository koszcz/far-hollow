// Trees between the camera and the player fade out, so the player stays in view in a dense forest.
// The fade is a screen-door pattern: each faded tree drops a share of its pixels. It needs no sorting, unlike real
// transparency, and it works per instance inside the tree batches. Shadows still come from the whole tree.
import * as THREE from "three";
import type { Vec3 } from "../sim/entities";

/** A tree fades fully when its trunk stands this close to the line from the camera to the player, in metres. */
export const SEE_THROUGH_INNER_METRES = 2.5;
/** A tree starts to fade when its trunk stands this close to that line, in metres. */
export const SEE_THROUGH_OUTER_METRES = 5;
/** The share of a fully faded tree's pixels that still draw, so the player can tell where the trees are. */
export const SEE_THROUGH_LEFT_SHOWING = 0.2;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * How much a tree standing at `foot` fades, from 0 (solid) to 1 (fully faded).
 * It measures, seen from above, how far the foot is from the line between the camera and the player.
 * Trees beyond the player, seen from the camera, do not fade, except those right next to the player.
 * The tree shader works this out the same way.
 */
export function seeThroughAmount(foot: Readonly<Vec3>, eye: Readonly<Vec3>, player: Readonly<Vec3>): number {
  const lineX = player.x - eye.x;
  const lineZ = player.z - eye.z;
  const lengthSquared = lineX * lineX + lineZ * lineZ;
  const along = lengthSquared === 0 ? 1 : Math.min(1, Math.max(0, ((foot.x - eye.x) * lineX + (foot.z - eye.z) * lineZ) / lengthSquared));
  const away = Math.hypot(foot.x - (eye.x + lineX * along), foot.z - (eye.z + lineZ * along));
  return 1 - smoothstep(SEE_THROUGH_INNER_METRES, SEE_THROUGH_OUTER_METRES, away);
}

export interface TreeSeeThrough {
  /** Sets where the player is drawn this frame. The camera's position comes from the camera itself. */
  setPlayer(player: Readonly<Vec3> | null): void;
}

/** Makes trees drawn with `materials` fade when they stand between the camera and the player. */
export function addTreeSeeThrough(materials: readonly THREE.Material[]): TreeSeeThrough {
  const playerUniform = { value: new THREE.Vector3() };
  /** 0 while there is no player, so no tree fades. */
  const enabledUniform = { value: 0 };
  for (const material of materials) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.seeThroughPlayer = playerUniform;
      shader.uniforms.seeThroughEnabled = enabledUniform;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform vec3 seeThroughPlayer;\nuniform float seeThroughEnabled;\nvarying float seeThroughFade;")
        .replace(
          "#include <begin_vertex>",
          [
            "#include <begin_vertex>",
            "#ifdef USE_INSTANCING",
            "vec2 seeThroughFoot = ( modelMatrix * instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xz;",
            "#else",
            "vec2 seeThroughFoot = ( modelMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xz;",
            "#endif",
            "vec2 seeThroughLine = seeThroughPlayer.xz - cameraPosition.xz;",
            "float seeThroughLength = dot( seeThroughLine, seeThroughLine );",
            "float seeThroughAlong = seeThroughLength == 0.0 ? 1.0 : clamp( dot( seeThroughFoot - cameraPosition.xz, seeThroughLine ) / seeThroughLength, 0.0, 1.0 );",
            "float seeThroughAway = distance( seeThroughFoot, cameraPosition.xz + seeThroughLine * seeThroughAlong );",
            `seeThroughFade = seeThroughEnabled * ( 1.0 - smoothstep( ${SEE_THROUGH_INNER_METRES.toFixed(2)}, ${SEE_THROUGH_OUTER_METRES.toFixed(2)}, seeThroughAway ) );`,
          ].join("\n"),
        );
      shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nvarying float seeThroughFade;").replace(
        "#include <clipping_planes_fragment>",
        [
          "#include <clipping_planes_fragment>",
          // A 4 by 4 ordered pattern decides which pixels drop, so a faded tree looks evenly see-through.
          "ivec2 seeThroughCell = ivec2( mod( gl_FragCoord.xy, 4.0 ) );",
          "int seeThroughIndex = seeThroughCell.x + seeThroughCell.y * 4;",
          "float seeThroughPattern[16] = float[16]( 0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0 );",
          "float seeThroughThreshold = ( seeThroughPattern[ seeThroughIndex ] + 0.5 ) / 16.0;",
          `if ( seeThroughFade * ${(1 - SEE_THROUGH_LEFT_SHOWING).toFixed(2)} > seeThroughThreshold ) discard;`,
        ].join("\n"),
      );
    };
    material.needsUpdate = true;
  }
  return {
    setPlayer(player) {
      enabledUniform.value = player === null ? 0 : 1;
      if (player !== null) playerUniform.value.set(player.x, player.y, player.z);
    },
  };
}

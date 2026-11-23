// Sways plants and treetops in the wind from wind.ts. It bends each shape away from the wind in the vertex shader,
// more the higher a point stands above the shape's foot, so the foot stays put. Gusts roll across the valley downwind,
// and each plant flutters a little on its own. Only the drawn shape sways. Shadows, clicks, and game logic never see it.
import type * as THREE from "three";
import type { Wind } from "./wind";

/** How one kind of shape sways. */
export interface SwayLook {
  /** A point this high above the shape's foot, in metres, moves `swayMetres` in a wind of full strength. */
  readonly reachMetres: number;
  /** How far a point at `reachMetres` moves in a wind of full strength, in metres. Higher points move more, lower ones less. */
  readonly swayMetres: number;
}

/** Full trees bend only in their crowns. Their trunks stay still. */
export const TREE_SWAY: SwayLook = { reachMetres: 10, swayMetres: 0.5 };
/** Young trees bend their whole thin trunk. */
export const YOUNG_TREE_SWAY: SwayLook = { reachMetres: 4, swayMetres: 0.35 };
export const SAPLING_SWAY: SwayLook = { reachMetres: 1, swayMetres: 0.12 };
/** Grass, ferns, and flowers. */
export const UNDERGROWTH_SWAY: SwayLook = { reachMetres: 0.4, swayMetres: 0.12 };

/** How fast a gust rolls across the valley, in metres per second, and how far apart gusts are, in metres. */
const GUST_SPEED_METRES_PER_SECOND = 4;
const GUST_SPACING_METRES = 40;
/** How much a gust adds to the wind's lean, and how much each plant flutters on its own, as shares of the lean. */
const GUST_SHARE = 0.35;
const FLUTTER_SHARE = 0.25;
/** How fast each plant flutters, in waves per second, at full strength. It flutters slower in a calm. */
const FLUTTER_WAVES_PER_SECOND = 0.6;

export interface WindSway {
  /** Makes shapes drawn with `material` sway like `look`, and returns the material. Patch its shader for anything else first. */
  sway<M extends THREE.Material>(material: M, look: SwayLook): M;
  /** Sets the wind for this frame. `nowSeconds` is a steady real-time clock, for the gusts and flutter. */
  update(wind: Wind, nowSeconds: number): void;
}

/** One wind for every material it sways, so the whole valley sways together. */
export function createWindSway(): WindSway {
  const time = { value: 0 };
  const strength = { value: 0 };
  const direction = { value: { x: 1, y: 0 } };
  return {
    sway(material, look) {
      const reach = { value: look.reachMetres };
      const metres = { value: look.swayMetres };
      const before = material.onBeforeCompile.bind(material);
      const beforeKey = material.customProgramCacheKey();
      material.onBeforeCompile = (shader, renderer) => {
        before(shader, renderer);
        Object.assign(shader.uniforms, { windTime: time, windStrength: strength, windDirection: direction, windReach: reach, windSwayMetres: metres });
        shader.vertexShader = shader.vertexShader
          .replace("#include <common>", `#include <common>\n${SWAY_UNIFORMS}`)
          .replace("#include <project_vertex>", `${SWAY_VERTEX}\n#include <project_vertex>`);
      };
      // three.js shares compiled shaders between materials with the same key, so the key must show the sway too.
      material.customProgramCacheKey = () => `${beforeKey}|wind-sway`;
      material.needsUpdate = true;
      return material;
    },
    update(wind, nowSeconds) {
      time.value = nowSeconds;
      strength.value = wind.strength;
      direction.value = { x: wind.direction.x, y: wind.direction.z };
    },
  };
}

const SWAY_UNIFORMS = [
  "uniform float windTime;",
  "uniform float windStrength;",
  "uniform vec2 windDirection;",
  "uniform float windReach;",
  "uniform float windSwayMetres;",
].join("\n");

const SWAY_VERTEX = [
  "#ifdef USE_INSTANCING",
  "mat4 windModel = modelMatrix * instanceMatrix;",
  "#else",
  "mat4 windModel = modelMatrix;",
  "#endif",
  "vec3 windFoot = ( windModel * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;",
  "float windHeight = max( ( windModel * vec4( transformed, 1.0 ) ).y - windFoot.y, 0.0 ) / windReach;",
  // A gust is a slow wave that rolls downwind across the valley.
  `float windGust = sin( ( dot( windFoot.xz, windDirection ) - windTime * ${GUST_SPEED_METRES_PER_SECOND.toFixed(1)} ) * ${((Math.PI * 2) / GUST_SPACING_METRES).toFixed(4)} );`,
  // Each plant flutters at its own phase, from where it stands.
  `float windFlutter = sin( windTime * ${(FLUTTER_WAVES_PER_SECOND * Math.PI * 2).toFixed(4)} * ( 0.5 + windStrength ) + dot( windFoot.xz, vec2( 1.7, 2.3 ) ) );`,
  `float windLean = windStrength * ( 1.0 + ${GUST_SHARE.toFixed(2)} * windGust + ${FLUTTER_SHARE.toFixed(2)} * windFlutter );`,
  "vec3 windOffset = vec3( windDirection.x, 0.0, windDirection.y ) * windSwayMetres * windHeight * windHeight * windLean;",
  // The offset is in the world. The shape's own turn and size are undone, so it moves the same way for every plant.
  "transformed += inverse( mat3( windModel ) ) * windOffset;",
].join("\n");

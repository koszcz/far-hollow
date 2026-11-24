// Sways plants and treetops in the wind from wind.ts. It bends each shape away from the wind in the vertex shader,
// more the higher a point stands above the height where the bend starts, so everything below that stays put. Gusts roll
// across the valley downwind, and each plant flutters a little on its own. Only the drawn shape sways. Shadows, clicks,
// and game logic never see it.
import type * as THREE from "three";
import type { Wind } from "./wind";

/** How one kind of shape sways. */
export interface SwayLook {
  /** The bend starts this high above the shape's foot, in metres. Everything below it stays still. */
  readonly rootMetres: number;
  /** A point this high above the shape's foot, in metres, moves `swayMetres` in a wind of full strength. */
  readonly reachMetres: number;
  /** How far a point at `reachMetres` moves in a wind of full strength, in metres. Higher points move more, lower ones less. */
  readonly swayMetres: number;
  /** How fast the shape flutters, as a share of the speed grass flutters at. Big shapes are heavy and flutter slower. */
  readonly flutterSpeed: number;
}

/**
 * Full trees bend only in their crowns, from about where the crowns start. Their trunks stay still. The crowns of the
 * eight tree types start 1 to 4.4 m up, so the crowns' foot barely moves and stays joined to the trunk.
 * Trees are heavy, so they flutter at half the speed of grass.
 */
export const TREE_SWAY: SwayLook = { rootMetres: 3, reachMetres: 10, swayMetres: 0.7, flutterSpeed: 0.5 };
/** Young trees bend their whole thin trunk. */
export const YOUNG_TREE_SWAY: SwayLook = { rootMetres: 0, reachMetres: 4, swayMetres: 0.35, flutterSpeed: 1 };
export const SAPLING_SWAY: SwayLook = { rootMetres: 0, reachMetres: 1, swayMetres: 0.12, flutterSpeed: 1 };
/** Grass, ferns, and flowers. */
export const UNDERGROWTH_SWAY: SwayLook = { rootMetres: 0, reachMetres: 0.4, swayMetres: 0.12, flutterSpeed: 1 };

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
      const root = { value: look.rootMetres };
      const reach = { value: look.reachMetres };
      const metres = { value: look.swayMetres };
      const flutterSpeed = { value: look.flutterSpeed };
      const before = material.onBeforeCompile.bind(material);
      const beforeKey = material.customProgramCacheKey();
      material.onBeforeCompile = (shader, renderer) => {
        before(shader, renderer);
        Object.assign(shader.uniforms, {
          windTime: time,
          windStrength: strength,
          windDirection: direction,
          windRoot: root,
          windReach: reach,
          windSwayMetres: metres,
          windFlutterSpeed: flutterSpeed,
        });
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
  "uniform float windRoot;",
  "uniform float windReach;",
  "uniform float windSwayMetres;",
  "uniform float windFlutterSpeed;",
].join("\n");

const SWAY_VERTEX = [
  "#ifdef USE_INSTANCING",
  "mat4 windModel = modelMatrix * instanceMatrix;",
  "#else",
  "mat4 windModel = modelMatrix;",
  "#endif",
  "vec3 windFoot = ( windModel * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;",
  "float windHeight = max( ( windModel * vec4( transformed, 1.0 ) ).y - windFoot.y - windRoot, 0.0 ) / ( windReach - windRoot );",
  // A gust is a slow wave that rolls downwind across the valley.
  `float windGust = sin( ( dot( windFoot.xz, windDirection ) - windTime * ${GUST_SPEED_METRES_PER_SECOND.toFixed(1)} ) * ${((Math.PI * 2) / GUST_SPACING_METRES).toFixed(4)} );`,
  // Each plant flutters at its own phase, from where it stands.
  `float windFlutter = sin( windTime * ${(FLUTTER_WAVES_PER_SECOND * Math.PI * 2).toFixed(4)} * windFlutterSpeed * ( 0.5 + windStrength ) + dot( windFoot.xz, vec2( 1.7, 2.3 ) ) );`,
  `float windLean = windStrength * ( 1.0 + ${GUST_SHARE.toFixed(2)} * windGust + ${FLUTTER_SHARE.toFixed(2)} * windFlutter );`,
  "vec3 windOffset = vec3( windDirection.x, 0.0, windDirection.y ) * windSwayMetres * windHeight * windHeight * windLean;",
  // The offset is in the world. The shape's own turn and size are undone, so it moves the same way for every plant.
  "transformed += inverse( mat3( windModel ) ) * windOffset;",
].join("\n");

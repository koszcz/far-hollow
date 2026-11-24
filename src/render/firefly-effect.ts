// Builds the code-built "fireflies" listed in asset-manifest.json (approved): small glowing dots that drift and blink over
// clearings and the river bank near the player at night. fireflies.ts decides where each one is and how brightly it glows.
// - Each firefly is one point: a small hot core inside a wide soft halo, like a tiny lantern. Its light adds to what is
//   behind it. Its colour is yellow-green at full glow and warms towards amber as the flash fades.
// - A far firefly never shrinks below a few pixels, so it still reads as a glow and not as a star.
// - A firefly lights nothing around it. It is only a dot, so the ground under it stays dark.
// - The fog does not dim them, so a firefly across a clearing still glows at night.
import * as THREE from "three";
import { isRaining, type EntityStore } from "../sim/entities";
import type { GroundPoint } from "../sim/ground-point";
import type { Random } from "../sim/random";
import { createFireflySwarm, FIREFLY_COUNT, type FireflyGround } from "./fireflies";

/** A firefly's colour at full glow: a pale yellow-green. */
const FIREFLY_COLOUR = new THREE.Color(0xd8ff6a);
/** A firefly's colour as its flash fades out: a warm amber. */
const FADING_COLOUR = new THREE.Color(0xffb84a);
/** How wide one firefly's sprite is, halo included, in metres. The hot core is about a sixth of it. */
const SPRITE_METRES = 0.9;
/** The smallest a firefly's sprite is drawn on screen, in CSS pixels, however far away it is. */
const MIN_SPRITE_PIXELS = 10;
/** How many texels wide the sprite's texture is. */
const SPRITE_TEXELS = 64;

export interface FireflyEffect {
  readonly group: THREE.Group;
  /** Moves the fireflies to where they are at `nowSeconds`, near `player`. `daylight` runs from 0 (night) to 1 (full day). */
  update(nowSeconds: number, player: GroundPoint, daylight: number): void;
  dispose(): void;
}

/**
 * Draws the fireflies. Rendering only reads the rain. It never changes it.
 * The game leaves `random` unset, so fireflies start in new places each time it loads. The showcase fixes it.
 */
export function createFireflyEffect(entities: EntityStore, ground: FireflyGround, random: Random = Math.random): FireflyEffect {
  const swarm = createFireflySwarm(ground, random);
  const group = new THREE.Group();
  group.name = "fireflies";

  const positions = new Float32Array(FIREFLY_COUNT * 3);
  const colours = new Float32Array(FIREFLY_COUNT * 3);
  const geometry = new THREE.BufferGeometry();
  const positionAttribute = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage);
  const colourAttribute = new THREE.BufferAttribute(colours, 3).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("position", positionAttribute);
  geometry.setAttribute("color", colourAttribute);
  const sprite = createGlowSprite();
  const material = new THREE.PointsMaterial({
    size: SPRITE_METRES,
    sizeAttenuation: true,
    map: sprite,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    // Tone mapping would grey the glow at night.
    toneMapped: false,
  });
  // Keep far fireflies a few pixels wide. Three.js shrinks points with distance and has no floor of its own.
  material.onBeforeCompile = (shader) => {
    shader.uniforms.minPointSize = { value: MIN_SPRITE_PIXELS * window.devicePixelRatio };
    shader.vertexShader = `uniform float minPointSize;\n${shader.vertexShader}`.replace(
      "#include <logdepthbuf_vertex>",
      "gl_PointSize = max( gl_PointSize, minPointSize );\n#include <logdepthbuf_vertex>",
    );
  };
  const points = new THREE.Points(geometry, material);
  const colour = new THREE.Color();
  // The fireflies move every frame around the player, so their bounds are never up to date.
  points.frustumCulled = false;
  group.add(points);

  return {
    group,
    update(nowSeconds, player, daylight) {
      const fireflies = swarm.update(nowSeconds, player, daylight, isRaining(entities));
      group.visible = fireflies.length > 0;
      geometry.setDrawRange(0, fireflies.length);
      fireflies.forEach((firefly, index) => {
        positions.set([firefly.x, firefly.y, firefly.z], index * 3);
        // Added light fades to nothing, so a darker colour is a dimmer firefly. A dimmer firefly is also warmer.
        colour.lerpColors(FADING_COLOUR, FIREFLY_COLOUR, firefly.glow).multiplyScalar(firefly.glow);
        colours.set([colour.r, colour.g, colour.b], index * 3);
      });
      positionAttribute.needsUpdate = true;
      colourAttribute.needsUpdate = true;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      sprite.dispose();
    },
  };
}

/** A round glow: a small solid white core that falls off into a wide soft halo, clear at the edge. */
function createGlowSprite(): THREE.DataTexture {
  const data = new Uint8Array(SPRITE_TEXELS * SPRITE_TEXELS * 4);
  for (let row = 0; row < SPRITE_TEXELS; row += 1)
    for (let column = 0; column < SPRITE_TEXELS; column += 1) {
      const u = ((column + 0.5) / SPRITE_TEXELS) * 2 - 1;
      const v = ((row + 0.5) / SPRITE_TEXELS) * 2 - 1;
      const fromMiddle = Math.min(Math.hypot(u, v), 1);
      const core = 1 - THREE.MathUtils.smoothstep(fromMiddle, 0.06, 0.16);
      const halo = 0.55 * (1 - fromMiddle) ** 3 + 0.25 * Math.exp(-((fromMiddle / 0.22) ** 2));
      const light = Math.round(Math.min(core + halo, 1) * 255);
      // Full alpha: additive blending multiplies by alpha too, which would square the light and lose the halo.
      data.set([light, light, light, 255], (row * SPRITE_TEXELS + column) * 4);
    }
  const texture = new THREE.DataTexture(data, SPRITE_TEXELS, SPRITE_TEXELS);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

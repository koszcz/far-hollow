// Builds the code-built "fireflies" listed in asset-manifest.json (draft): small glowing dots that drift and blink over
// clearings and the river bank near the player at night. fireflies.ts decides where each one is and how brightly it glows.
// - Each firefly is one point: a bright yellow-green core inside a soft halo. Its light adds to what is behind it.
// - A firefly lights nothing around it. It is only a dot, so the ground under it stays dark.
// - The fog does not dim them, so a firefly across a clearing still glows at night.
import * as THREE from "three";
import { rainEntities, type EntityStore } from "../sim/entities";
import type { Random } from "../sim/random";
import { createFireflySwarm, FIREFLY_COUNT, type FireflyGround } from "./fireflies";

const FIREFLY_COLOUR = new THREE.Color(0xd4ff5a);
/** How wide one firefly's sprite is, halo included, in metres. The bright core is about a third of it. */
const SPRITE_METRES = 0.6;
/** How many texels wide the sprite's texture is. */
const SPRITE_TEXELS = 32;

export interface FireflyEffect {
  readonly group: THREE.Group;
  /** Moves the fireflies to where they are at `nowSeconds`, near `player`. `daylight` runs from 0 (night) to 1 (full day). */
  update(nowSeconds: number, player: { readonly x: number; readonly z: number }, daylight: number): void;
  dispose(): void;
}

/**
 * Draws the fireflies. Rendering only reads the rain. It never changes it.
 * The game leaves `random` unset, so fireflies start in new places each time it loads. The showcase fixes it.
 */
export function createFireflyEffect(entities: EntityStore, ground: FireflyGround, random: Random = Math.random): FireflyEffect {
  const weather = rainEntities(entities);
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
  const points = new THREE.Points(geometry, material);
  // The fireflies move every frame around the player, so their bounds are never up to date.
  points.frustumCulled = false;
  group.add(points);

  return {
    group,
    update(nowSeconds, player, daylight) {
      const fireflies = swarm.update(nowSeconds, player, daylight, weather.first?.rain.falling === true);
      group.visible = fireflies.length > 0;
      geometry.setDrawRange(0, fireflies.length);
      fireflies.forEach((firefly, index) => {
        positions.set([firefly.x, firefly.y, firefly.z], index * 3);
        // Added light fades to nothing, so a darker colour is a dimmer firefly.
        colours.set([FIREFLY_COLOUR.r * firefly.glow, FIREFLY_COLOUR.g * firefly.glow, FIREFLY_COLOUR.b * firefly.glow], index * 3);
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

/** A round glow: a solid white core that falls off into a soft halo, clear at the edge. */
function createGlowSprite(): THREE.DataTexture {
  const data = new Uint8Array(SPRITE_TEXELS * SPRITE_TEXELS * 4);
  for (let row = 0; row < SPRITE_TEXELS; row += 1)
    for (let column = 0; column < SPRITE_TEXELS; column += 1) {
      const u = ((column + 0.5) / SPRITE_TEXELS) * 2 - 1;
      const v = ((row + 0.5) / SPRITE_TEXELS) * 2 - 1;
      const fromMiddle = Math.min(Math.hypot(u, v), 1);
      const core = 1 - THREE.MathUtils.smoothstep(fromMiddle, 0.15, 0.35);
      const halo = 0.5 * (1 - fromMiddle) ** 2;
      const light = Math.round(Math.min(core + halo, 1) * 255);
      data.set([light, light, light, light], (row * SPRITE_TEXELS + column) * 4);
    }
  const texture = new THREE.DataTexture(data, SPRITE_TEXELS, SPRITE_TEXELS);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

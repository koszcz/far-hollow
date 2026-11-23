// Draws the draft "window-glow" asset in asset-manifest.json, built in code: the warm glow in an open window at night.
// A window glows when it has no shutters or open shutters, and a lit campfire, fireplace, or torch is in its room
// (firelitWindows in sim/window-glow.ts). The glow faces away from the lit room, so it shows from outside.
// - A warm panel fills the opening, so the room behind it reads as lit.
// - A soft halo, a little larger than the opening, spreads from the outer face of the wall.
// The glow fades in at dusk and out at dawn with the daylight. It casts no shadow, lights nothing, and is never picked.
import * as THREE from "three";
import type { Entity, EntityStore } from "../sim/entities";
import { quarterTurnsToRadians } from "../sim/quarter-turns";
import { firelitWindows } from "../sim/window-glow";
import { COURSE_RADIUS_METRES, WINDOW_OPENING, WINDOW_OPENING_WIDTH_METRES } from "./edge-piece-meshes";

/** The warm colour of firelight seen through a window. */
const GLOW_COLOUR = 0xffa24a;
/** How strong the panel in the opening is at full night, from 0 to 1. */
const PANEL_OPACITY = 0.55;
/** How strong the halo is at full night, from 0 to 1. */
const HALO_OPACITY = 0.45;
/** How much larger the halo is than the opening, across and up. */
const HALO_SCALE = 1.8;
/** The halo stands this far out from the middle of the wall, in metres: just past the logs' outer face. */
const HALO_OUT_METRES = COURSE_RADIUS_METRES + 0.02;
/** How many pixels across the halo's soft texture is. */
const HALO_TEXTURE_PIXELS = 32;

const OPENING_HEIGHT_METRES = WINDOW_OPENING.top - WINDOW_OPENING.bottom;
const OPENING_MIDDLE_Y = (WINDOW_OPENING.bottom + WINDOW_OPENING.top) / 2;

/** How strongly a firelit window glows at this much daylight, from 0 (by day) to 1 (at night). */
export function windowGlowStrength(daylight: number): number {
  return Math.min(1, Math.max(0, 1 - daylight));
}

export interface WindowGlowMeshes {
  readonly group: THREE.Group;
  /** Shows the glow in every firelit window, as strong as `daylight`, from 0 (night) to 1 (full day), allows. */
  update(daylight: number): void;
  dispose(): void;
}

export function createWindowGlowMeshes(entities: EntityStore): WindowGlowMeshes {
  const group = new THREE.Group();
  const halo = haloTexture();
  const glowLook = (opacity: number, map: THREE.Texture | null = null) =>
    new THREE.MeshBasicMaterial({ color: GLOW_COLOUR, map, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
  const panelMaterial = glowLook(PANEL_OPACITY);
  const haloMaterial = glowLook(HALO_OPACITY, halo);
  const panelGeometry = new THREE.PlaneGeometry(WINDOW_OPENING_WIDTH_METRES, OPENING_HEIGHT_METRES).translate(0, OPENING_MIDDLE_Y, 0);
  const haloGeometry = new THREE.PlaneGeometry(WINDOW_OPENING_WIDTH_METRES * HALO_SCALE, OPENING_HEIGHT_METRES * HALO_SCALE).translate(
    0,
    OPENING_MIDDLE_Y,
    HALO_OUT_METRES,
  );

  const drawn = new Map<Entity, THREE.Group>();
  function draw(window: Entity): THREE.Group {
    const existing = drawn.get(window);
    if (existing !== undefined) return existing;
    const root = new THREE.Group();
    root.add(new THREE.Mesh(panelGeometry, panelMaterial), new THREE.Mesh(haloGeometry, haloMaterial));
    group.add(root);
    drawn.set(window, root);
    return root;
  }

  return {
    group,
    update(daylight) {
      const strength = windowGlowStrength(daylight);
      const lit = new Set<Entity>();
      // By day no window glows, so the rooms are not worked out at all.
      if (strength > 0) {
        panelMaterial.opacity = PANEL_OPACITY * strength;
        haloMaterial.opacity = HALO_OPACITY * strength;
        for (const { window, outward } of firelitWindows(entities)) {
          const root = draw(window);
          root.position.set(window.position.x, window.position.y, window.position.z);
          root.rotation.y = quarterTurnsToRadians(outward);
          lit.add(window);
        }
      }
      for (const [window, root] of drawn) {
        if (lit.has(window)) continue;
        group.remove(root);
        drawn.delete(window);
      }
    },
    dispose() {
      for (const item of [panelGeometry, haloGeometry, panelMaterial, haloMaterial, halo]) item.dispose();
    },
  };
}

/** A soft white blot that fades to nothing at its edges, for the halo. */
function haloTexture(): THREE.DataTexture {
  const size = HALO_TEXTURE_PIXELS;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      // 0 in the middle, 1 at the nearest edge, so the blot keeps the window's upright shape.
      const across = Math.abs((x + 0.5) / size - 0.5) * 2;
      const up = Math.abs((y + 0.5) / size - 0.5) * 2;
      const fade = 1 - THREE.MathUtils.smoothstep(Math.hypot(across, up), 0.25, 1);
      const value = Math.round(255 * fade);
      pixels.set([value, value, value, value], (y * size + x) * 4);
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

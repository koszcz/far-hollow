// Draws the approved "window-glow" asset in asset-manifest.json, built in code: the warm glow in an open window at night.
// A window glows when it has no shutters or open shutters, and a lit campfire, fireplace, or torch is in its room
// (firelitWindows in sim/window-glow.ts). The glow faces away from the lit room, so it shows from outside.
// - A warm panel fills the opening. It is brightest at the sill and dimmer at the top, as if the fire burns low in the room.
// - A soft halo, about twice the size of the opening, spreads from the outer face of the wall.
// Both breathe with a slow, soft flicker, out of step from window to window, like firelight on the walls inside.
// The glow fades in at dusk and out at dawn with the daylight. It casts no shadow, lights nothing, and is never picked.
// When its window fades out, the glow fades with it.
import * as THREE from "three";
import type { Entity, EntityStore } from "../sim/entities";
import { quarterTurnsToRadians } from "../sim/quarter-turns";
import { firelitWindows, type FirelitWindow } from "../sim/window-glow";
import { NO_CUTAWAY, type CabinCutaway } from "./cabin-cutaway";
import { COURSE_RADIUS_METRES } from "./log-courses";
import { createCutawayFades, cutawayOpacity } from "./cutaway-fade";
import { WINDOW_OPENING, WINDOW_OPENING_WIDTH_METRES } from "./window-shape";

/** The warm colour of firelight seen through a window. */
const GLOW_COLOUR = 0xffa24a;
/** How strong the panel in the opening is at full night, from 0 to 1. */
const PANEL_OPACITY = 0.6;
/** How bright the top of the panel is, as a share of its sill, from 0 to 1. */
const PANEL_TOP_SHARE = 0.45;
/** How many pixels tall the panel's gradient texture is. */
const PANEL_TEXTURE_PIXELS = 16;
/** How strong the halo is at full night, from 0 to 1. */
const HALO_OPACITY = 0.6;
/** How much larger the halo is than the opening, across and up. */
const HALO_SCALE = 2.3;
/** The halo stands this far out from the middle of the wall, in metres: just past the logs' outer face. */
const HALO_OUT_METRES = COURSE_RADIUS_METRES + 0.02;
/** How many pixels across the halo's soft texture is. */
const HALO_TEXTURE_PIXELS = 32;
/** How fast the firelight flickers, in radians of its slowest wave per second. */
const FLICKER_PER_SECOND = 2.6;
/** How much the firelight flickers, as a share of its strength, up and down. */
const FLICKER_AMOUNT = 0.16;

const OPENING_HEIGHT_METRES = WINDOW_OPENING.top - WINDOW_OPENING.bottom;
const OPENING_MIDDLE_Y = (WINDOW_OPENING.bottom + WINDOW_OPENING.top) / 2;

/** How strongly a firelit window glows at this much daylight, from 0 (by day) to 1 (at night). */
export function windowGlowStrength(daylight: number): number {
  return Math.min(1, Math.max(0, 1 - daylight));
}

/**
 * How bright the firelight in a window is at `nowSeconds`, as a share of its strength: about 1, rising and falling by up to
 * FLICKER_AMOUNT. Three slow waves that never line up make the flicker wander, with no jump. `seed` sets windows apart.
 */
export function windowGlowFlicker(nowSeconds: number, seed: number): number {
  const t = nowSeconds * FLICKER_PER_SECOND + seed;
  return 1 + FLICKER_AMOUNT * (Math.sin(t) * 0.5 + Math.sin(t * 2.3 + 1.3) * 0.3 + Math.sin(t * 4.1 + 2.9) * 0.2);
}

/** A seed for a window's flicker, from where it stands, so windows side by side flicker apart. */
function flickerSeed(position: { readonly x: number; readonly z: number }): number {
  return (position.x * 12.9898 + position.z * 78.233) % (Math.PI * 2);
}

export interface WindowGlowMeshes {
  readonly group: THREE.Group;
  /**
   * Shows the glow in every firelit window, as strong as `daylight`, from 0 (night) to 1 (full day), allows, flickering at
   * `nowSeconds`. A window that fades where `cutaway` says fades its glow too. Without it, nothing fades.
   */
  update(view: { readonly daylight: number; readonly nowSeconds: number; readonly cutaway?: CabinCutaway }): void;
  dispose(): void;
}

/** A drawn glow: its panel and halo, placed in a window, with materials of its own so it flickers on its own. */
interface Drawn {
  readonly root: THREE.Group;
  readonly panel: THREE.MeshBasicMaterial;
  readonly halo: THREE.MeshBasicMaterial;
  readonly seed: number;
}

/** `findFirelit` finds the windows that glow. Tests pass their own. */
export function createWindowGlowMeshes(
  entities: EntityStore,
  findFirelit: (entities: EntityStore) => readonly FirelitWindow[] = firelitWindows,
): WindowGlowMeshes {
  const group = new THREE.Group();
  const haloMap = haloTexture();
  const panelMap = panelTexture();
  const glowMaterial = (map: THREE.Texture) =>
    new THREE.MeshBasicMaterial({ color: GLOW_COLOUR, map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const panelGeometry = new THREE.PlaneGeometry(WINDOW_OPENING_WIDTH_METRES, OPENING_HEIGHT_METRES).translate(0, OPENING_MIDDLE_Y, 0);
  const haloGeometry = new THREE.PlaneGeometry(WINDOW_OPENING_WIDTH_METRES * HALO_SCALE, OPENING_HEIGHT_METRES * HALO_SCALE).translate(
    0,
    OPENING_MIDDLE_Y,
    HALO_OUT_METRES,
  );

  const drawn = new Map<Entity, Drawn>();
  const fades = createCutawayFades();
  function draw(window: Entity & { position: { x: number; z: number } }): Drawn {
    const existing = drawn.get(window);
    if (existing !== undefined) return existing;
    const root = new THREE.Group();
    const item = { root, panel: glowMaterial(panelMap), halo: glowMaterial(haloMap), seed: flickerSeed(window.position) };
    root.add(new THREE.Mesh(panelGeometry, item.panel), new THREE.Mesh(haloGeometry, item.halo));
    group.add(root);
    drawn.set(window, item);
    return item;
  }
  function forget(window: Entity, item: Drawn): void {
    group.remove(item.root);
    item.panel.dispose();
    item.halo.dispose();
    drawn.delete(window);
    fades.forget(window);
  }

  return {
    group,
    update({ daylight, nowSeconds, cutaway = NO_CUTAWAY }) {
      const strength = windowGlowStrength(daylight);
      const lit = new Set<Entity>();
      // By day no window glows, so the rooms are not worked out at all.
      if (strength > 0) {
        for (const { window, outward } of findFirelit(entities)) {
          const item = draw(window);
          item.root.position.set(window.position.x, window.position.y, window.position.z);
          item.root.rotation.y = quarterTurnsToRadians(outward);
          const turns = window.facing?.turns ?? 0;
          const fade = cutawayOpacity(fades.level(window, cutaway.fades(window.position, turns), nowSeconds));
          const share = strength * fade * windowGlowFlicker(nowSeconds, item.seed);
          item.panel.opacity = Math.min(1, PANEL_OPACITY * share);
          item.halo.opacity = Math.min(1, HALO_OPACITY * share);
          lit.add(window);
        }
      }
      for (const [window, item] of drawn) if (!lit.has(window)) forget(window, item);
    },
    dispose() {
      for (const [window, item] of drawn) forget(window, item);
      for (const item of [panelGeometry, haloGeometry, haloMap, panelMap]) item.dispose();
    },
  };
}

/** A white strip, brightest at the bottom and PANEL_TOP_SHARE as bright at the top, for the panel. */
function panelTexture(): THREE.DataTexture {
  const size = PANEL_TEXTURE_PIXELS;
  const pixels = new Uint8Array(size * 4);
  for (let y = 0; y < size; y += 1) {
    // Row 0 is the bottom of the texture.
    const up = THREE.MathUtils.smoothstep((y + 0.5) / size, 0, 1);
    const value = Math.round(255 * (1 - (1 - PANEL_TOP_SHARE) * up));
    pixels.set([value, value, value, 255], y * 4);
  }
  const texture = new THREE.DataTexture(pixels, 1, size);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
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

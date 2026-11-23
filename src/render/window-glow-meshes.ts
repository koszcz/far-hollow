// Draws the draft "window-glow" asset in asset-manifest.json, built in code: the warm glow in an open window at night.
// A window glows when it has no shutters or open shutters, and a lit campfire, fireplace, or torch is in its room
// (firelitWindows in sim/window-glow.ts). The glow faces away from the lit room, so it shows from outside.
// - A warm panel fills the opening, so the room behind it reads as lit.
// - A soft halo, a little larger than the opening, spreads from the outer face of the wall.
// The glow fades in at dusk and out at dawn with the daylight. It casts no shadow, lights nothing, and is never picked.
// When its window fades out between the camera and the player, the glow fades with it.
import * as THREE from "three";
import type { Entity, EntityStore, Vec3 } from "../sim/entities";
import { quarterTurnsToRadians } from "../sim/quarter-turns";
import { firelitWindows, type FirelitWindow } from "../sim/window-glow";
import { isBetweenCameraAndPlayer } from "./edge-piece-meshes";
import { COURSE_RADIUS_METRES } from "./log-courses";
import { FADED_OPACITY } from "./structure-look";
import { WINDOW_OPENING, WINDOW_OPENING_WIDTH_METRES } from "./window-shape";

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
  /**
   * Shows the glow in every firelit window, as strong as `daylight`, from 0 (night) to 1 (full day), allows.
   * A window between `camera` and the player standing at `player` fades out, and so does its glow. Without them, nothing fades.
   */
  update(daylight: number, view?: { camera: Vec3; player: Vec3 }): void;
  dispose(): void;
}

/** The materials of one look of the glow: the panel and the halo. */
interface GlowLook {
  readonly panel: THREE.MeshBasicMaterial;
  readonly halo: THREE.MeshBasicMaterial;
}

/** A drawn glow: its panel and halo meshes, placed in a window. */
interface Drawn {
  readonly root: THREE.Group;
  readonly panel: THREE.Mesh;
  readonly halo: THREE.Mesh;
}

/** `findFirelit` finds the windows that glow. Tests pass their own. */
export function createWindowGlowMeshes(
  entities: EntityStore,
  findFirelit: (entities: EntityStore) => readonly FirelitWindow[] = firelitWindows,
): WindowGlowMeshes {
  const group = new THREE.Group();
  const haloMap = haloTexture();
  const glowMaterial = (map: THREE.Texture | null = null) =>
    new THREE.MeshBasicMaterial({ color: GLOW_COLOUR, map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const clear: GlowLook = { panel: glowMaterial(), halo: glowMaterial(haloMap) };
  const faded: GlowLook = { panel: glowMaterial(), halo: glowMaterial(haloMap) };
  const panelGeometry = new THREE.PlaneGeometry(WINDOW_OPENING_WIDTH_METRES, OPENING_HEIGHT_METRES).translate(0, OPENING_MIDDLE_Y, 0);
  const haloGeometry = new THREE.PlaneGeometry(WINDOW_OPENING_WIDTH_METRES * HALO_SCALE, OPENING_HEIGHT_METRES * HALO_SCALE).translate(
    0,
    OPENING_MIDDLE_Y,
    HALO_OUT_METRES,
  );

  const drawn = new Map<Entity, Drawn>();
  function draw(window: Entity): Drawn {
    const existing = drawn.get(window);
    if (existing !== undefined) return existing;
    const root = new THREE.Group();
    const item = { root, panel: new THREE.Mesh(panelGeometry, clear.panel), halo: new THREE.Mesh(haloGeometry, clear.halo) };
    root.add(item.panel, item.halo);
    group.add(root);
    drawn.set(window, item);
    return item;
  }

  return {
    group,
    update(daylight, view) {
      const strength = windowGlowStrength(daylight);
      const lit = new Set<Entity>();
      // By day no window glows, so the rooms are not worked out at all.
      if (strength > 0) {
        clear.panel.opacity = PANEL_OPACITY * strength;
        clear.halo.opacity = HALO_OPACITY * strength;
        faded.panel.opacity = clear.panel.opacity * FADED_OPACITY;
        faded.halo.opacity = clear.halo.opacity * FADED_OPACITY;
        for (const { window, outward } of findFirelit(entities)) {
          const item = draw(window);
          item.root.position.set(window.position.x, window.position.y, window.position.z);
          item.root.rotation.y = quarterTurnsToRadians(outward);
          const turns = window.facing?.turns ?? 0;
          const look = view !== undefined && isBetweenCameraAndPlayer(window.position, turns, view.camera, view.player) ? faded : clear;
          item.panel.material = look.panel;
          item.halo.material = look.halo;
          lit.add(window);
        }
      }
      for (const [window, item] of drawn) {
        if (lit.has(window)) continue;
        group.remove(item.root);
        drawn.delete(window);
      }
    },
    dispose() {
      for (const item of [panelGeometry, haloGeometry, clear.panel, clear.halo, faded.panel, faded.halo, haloMap]) item.dispose();
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

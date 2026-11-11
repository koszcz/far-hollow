// Builds the code-built "pot" listed in asset-manifest.json (approved): a cast-iron pot with a rolled rim,
// two side lugs, and a wire handle that leans back. Soot darkens it toward the base.
// It shows empty, full of water, or full and steaming. While it steams, small bubbles rise and burst on the water,
// and soft pale puffs rise, swell, and fade, in a loop.
// campfire-meshes.ts sets one on each campfire that has a pot on it.
import * as THREE from "three";

/** The iron toward the rim, and the soot-darkened iron at the base. */
const POT_COLOUR = 0x7a7c80;
const SOOT_COLOUR = 0x26241f;
const WATER_COLOUR = 0x4f7489;
const BUBBLE_COLOUR = 0xd7e4eb;
const STEAM_COLOUR = 0xf2f2f2;
/** Sides of the pot. More sides make it rounder and cost more. */
const POT_SIDES = 14;
/** The outer radius at the rim, in metres. */
const POT_RADIUS_METRES = 0.14;
/** The height from the base to the top of the rim, in metres. */
const POT_HEIGHT_METRES = 0.166;
/** The water sits this high above the base, in metres, and fills the pot this wide. */
const WATER_HEIGHT_METRES = 0.13;
const WATER_RADIUS_METRES = 0.126;
/** The lugs stick out from the sides at this height, and the handle hinges on them. */
const LUG_HEIGHT_METRES = 0.135;
const HANDLE_RADIUS_METRES = 0.152;
const HANDLE_THICKNESS_METRES = 0.006;
/** The handle leans back from upright by this much, in radians, as if dropped after lifting. */
const HANDLE_LEAN_RADIANS = 0.45;
const BUBBLES = 6;
const BUBBLE_RADIUS_METRES = 0.012;
/** Each bubble grows and bursts once in this many seconds. */
const BUBBLE_LOOP_SECONDS = 0.7;
const STEAM_PUFFS = 8;
const STEAM_PUFF_RADIUS_METRES = 0.035;
/** Each steam puff rises this high above the rim over one loop, in metres. */
const STEAM_RISE_METRES = 0.5;
const STEAM_LOOP_SECONDS = 3;
/** How see-through steam is at its thickest, from 0 (invisible) to 1 (solid). */
const STEAM_OPACITY = 0.32;

/**
 * The pot's side seen in cross-section, as (radius, height) points in metres.
 * It runs from the middle of the base out and up the outside, over the rolled rim, and back down the inside.
 */
const POT_PROFILE: readonly [number, number][] = [
  [0, 0],
  [0.1, 0],
  [0.117, 0.01],
  [0.127, 0.045],
  [0.136, 0.12],
  [0.14, 0.15],
  [0.149, 0.154],
  [0.151, 0.161],
  [0.145, POT_HEIGHT_METRES],
  [0.135, 0.162],
  [0.131, 0.15],
  [0.122, 0.06],
  [0.11, 0.018],
  [0, 0.018],
];

/** How a pot looks: empty, full of water, or full and steaming while it boils. */
export type PotLook = "empty" | "full" | "steaming";

export interface PotMesh {
  /** The pot, with the middle of its base at the origin. */
  readonly group: THREE.Group;
  /** Shows the pot empty, full, or steaming. Bubbles and steam move with `nowSeconds`. */
  show(look: PotLook, nowSeconds: number): void;
}

export interface PotMaker {
  make(): PotMesh;
  dispose(): void;
}

/** Makes pots that share their shapes and materials. */
export function createPotMaker(): PotMaker {
  const bodyGeometry = createBodyGeometry();
  const lugGeometry = new THREE.BoxGeometry(0.03, 0.022, 0.018);
  const waterGeometry = new THREE.CircleGeometry(WATER_RADIUS_METRES, POT_SIDES * 2).rotateX(-Math.PI / 2);
  waterGeometry.translate(0, WATER_HEIGHT_METRES, 0);
  // The handle is a half ring from one lug to the other. It hinges on the line through the lugs.
  const handleGeometry = new THREE.TorusGeometry(HANDLE_RADIUS_METRES, HANDLE_THICKNESS_METRES, 4, 16, Math.PI);
  const bubbleGeometry = new THREE.SphereGeometry(BUBBLE_RADIUS_METRES, 6, 4).scale(1, 0.6, 1);
  const puffGeometry = new THREE.IcosahedronGeometry(STEAM_PUFF_RADIUS_METRES, 1);
  const potMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, metalness: 0.1, roughness: 0.6, side: THREE.DoubleSide });
  const handleMaterial = new THREE.MeshStandardMaterial({ color: POT_COLOUR, flatShading: true, metalness: 0.1, roughness: 0.6 });
  const waterMaterial = new THREE.MeshStandardMaterial({ color: WATER_COLOUR, flatShading: true, roughness: 0.4 });
  const bubbleMaterial = new THREE.MeshStandardMaterial({ color: BUBBLE_COLOUR, roughness: 0.2 });
  const steamMaterials: THREE.MeshBasicMaterial[] = [];

  return {
    make() {
      const group = new THREE.Group();
      const body = new THREE.Mesh(bodyGeometry, potMaterial);
      const lugs = [-1, 1].map((side) => {
        const lug = new THREE.Mesh(lugGeometry, handleMaterial);
        lug.position.set(side * (POT_RADIUS_METRES + 0.004), LUG_HEIGHT_METRES, 0);
        return lug;
      });
      const handle = new THREE.Mesh(handleGeometry, handleMaterial);
      handle.position.y = LUG_HEIGHT_METRES;
      handle.rotation.x = -HANDLE_LEAN_RADIANS;
      group.add(body, ...lugs, handle);
      for (const mesh of group.children) mesh.castShadow = true;

      const water = new THREE.Mesh(waterGeometry, waterMaterial);
      group.add(water);
      const bubbles: { mesh: THREE.Mesh; angle: number; out: number }[] = [];
      for (let i = 0; i < BUBBLES; i += 1) {
        const mesh = new THREE.Mesh(bubbleGeometry, bubbleMaterial);
        group.add(mesh);
        // Spread the bubbles around the water by a golden-angle spiral, so they do not line up.
        bubbles.push({ mesh, angle: i * 2.4, out: WATER_RADIUS_METRES * (0.25 + 0.6 * ((i * 0.37) % 1)) });
      }
      const puffs: { mesh: THREE.Mesh; material: THREE.MeshBasicMaterial }[] = [];
      for (let i = 0; i < STEAM_PUFFS; i += 1) {
        // Each puff fades on its own, so each gets its own material.
        const material = new THREE.MeshBasicMaterial({ color: STEAM_COLOUR, transparent: true, depthWrite: false });
        steamMaterials.push(material);
        const mesh = new THREE.Mesh(puffGeometry, material);
        group.add(mesh);
        puffs.push({ mesh, material });
      }

      return {
        group,
        show(look, nowSeconds) {
          const steaming = look === "steaming";
          water.visible = look !== "empty";
          // Boiling water rocks a little on its surface.
          water.position.y = steaming ? Math.sin(nowSeconds * 11) * 0.0015 : 0;
          bubbles.forEach(({ mesh, angle, out }, index) => {
            mesh.visible = steaming;
            if (!steaming) return;
            // Each bubble is a share of a loop behind the one before. It swells from nothing and bursts back to nothing,
            // so the loop has no jump. Each new loop moves the bubble to a fresh spot.
            const loops = nowSeconds / BUBBLE_LOOP_SECONDS + index / BUBBLES;
            const share = loops % 1;
            const spot = angle + Math.floor(loops) * 1.7;
            mesh.position.set(Math.cos(spot) * out, WATER_HEIGHT_METRES + water.position.y, Math.sin(spot) * out);
            mesh.scale.setScalar(Math.sin(share * Math.PI));
          });
          puffs.forEach(({ mesh, material }, index) => {
            mesh.visible = steaming;
            if (!steaming) return;
            // Each puff is a share of a loop behind the one before, so the steam rises in a steady stream.
            // It starts small and clear over the water, then swells and curls as it rises, and fades out before the loop restarts.
            const share = (nowSeconds / STEAM_LOOP_SECONDS + index / STEAM_PUFFS) % 1;
            const startAngle = index * 2.4;
            const startOut = WATER_RADIUS_METRES * 0.5;
            const curl = startAngle + share * 2.2;
            const out = startOut * (1 - share * 0.6);
            mesh.position.set(
              Math.cos(curl) * out + share * 0.06,
              WATER_HEIGHT_METRES + share * STEAM_RISE_METRES,
              Math.sin(curl) * out,
            );
            mesh.scale.setScalar(0.5 + share * 2.2);
            material.opacity = STEAM_OPACITY * Math.sin(share * Math.PI) ** 1.5;
          });
        },
      };
    },
    dispose() {
      const items = [bodyGeometry, lugGeometry, waterGeometry, handleGeometry, bubbleGeometry, puffGeometry];
      const materials = [potMaterial, handleMaterial, waterMaterial, bubbleMaterial, ...steamMaterials];
      for (const item of [...items, ...materials]) item.dispose();
    },
  };
}

/** Turns the pot's profile into a round body, with soot shading the iron toward the base. */
function createBodyGeometry(): THREE.BufferGeometry {
  const points = POT_PROFILE.map(([radius, height]) => new THREE.Vector2(radius, height));
  const geometry = new THREE.LatheGeometry(points, POT_SIDES);
  const iron = new THREE.Color(POT_COLOUR);
  const soot = new THREE.Color(SOOT_COLOUR);
  const position = geometry.getAttribute("position");
  const colours = new Float32Array(position.count * 3);
  const colour = new THREE.Color();
  for (let i = 0; i < position.count; i += 1) {
    // Soot is thickest at the base and gone by two fifths of the way up.
    const share = Math.min(1, position.getY(i) / (POT_HEIGHT_METRES * 0.4));
    colour.copy(soot).lerp(iron, share);
    colour.toArray(colours, i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  return geometry;
}

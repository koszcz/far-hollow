// Builds the code-built "pot" listed in asset-manifest.json (draft): a dark metal pot with a wire handle.
// It shows empty, full of water, or full and steaming. Steam is a few pale puffs that rise, swell, and fade, in a loop.
// campfire-meshes.ts sets one on each campfire that has a pot on it.
import * as THREE from "three";

const POT_COLOUR = 0x3b3d40;
const WATER_COLOUR = 0x5b7f95;
const STEAM_COLOUR = 0xf2f2f2;
const POT_RADIUS_METRES = 0.14;
const POT_HEIGHT_METRES = 0.16;
/** The water sits this far below the rim. */
const WATER_BELOW_RIM_METRES = 0.03;
const HANDLE_THICKNESS_METRES = 0.006;
const STEAM_PUFFS = 5;
/** Each steam puff rises this high above the rim over one loop, in metres. */
const STEAM_RISE_METRES = 0.45;
const STEAM_LOOP_SECONDS = 2.4;
const STEAM_OPACITY = 0.45;

/** How a pot looks: empty, full of water, or full and steaming while it boils. */
export type PotLook = "empty" | "full" | "steaming";

export interface PotMesh {
  /** The pot, with the middle of its base at the origin. */
  readonly group: THREE.Group;
  /** Shows the pot empty, full, or steaming. Steam moves with `nowSeconds`. */
  show(look: PotLook, nowSeconds: number): void;
}

export interface PotMaker {
  make(): PotMesh;
  dispose(): void;
}

/** Makes pots that share their shapes and materials. */
export function createPotMaker(): PotMaker {
  const bodyGeometry = new THREE.CylinderGeometry(POT_RADIUS_METRES, POT_RADIUS_METRES * 0.85, POT_HEIGHT_METRES, 12, 1, true);
  bodyGeometry.translate(0, POT_HEIGHT_METRES / 2, 0);
  const baseGeometry = new THREE.CircleGeometry(POT_RADIUS_METRES * 0.85, 12).rotateX(-Math.PI / 2);
  const waterGeometry = new THREE.CircleGeometry(POT_RADIUS_METRES * 0.97, 12).rotateX(-Math.PI / 2);
  waterGeometry.translate(0, POT_HEIGHT_METRES - WATER_BELOW_RIM_METRES, 0);
  // The handle is a half ring standing over the pot, from one side of the rim to the other.
  const handleGeometry = new THREE.TorusGeometry(POT_RADIUS_METRES, HANDLE_THICKNESS_METRES, 4, 12, Math.PI);
  handleGeometry.translate(0, POT_HEIGHT_METRES, 0);
  const puffGeometry = new THREE.IcosahedronGeometry(0.05, 0);
  const potMaterial = new THREE.MeshStandardMaterial({ color: POT_COLOUR, flatShading: true, metalness: 0.4, roughness: 0.6, side: THREE.DoubleSide });
  const waterMaterial = new THREE.MeshStandardMaterial({ color: WATER_COLOUR, flatShading: true, roughness: 0.2 });
  const steamMaterials: THREE.MeshBasicMaterial[] = [];

  return {
    make() {
      const group = new THREE.Group();
      group.add(new THREE.Mesh(bodyGeometry, potMaterial), new THREE.Mesh(baseGeometry, potMaterial), new THREE.Mesh(handleGeometry, potMaterial));
      for (const mesh of group.children) mesh.castShadow = true;
      const water = new THREE.Mesh(waterGeometry, waterMaterial);
      group.add(water);
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
          water.visible = look !== "empty";
          puffs.forEach(({ mesh, material }, index) => {
            mesh.visible = look === "steaming";
            if (!mesh.visible) return;
            // Each puff is a share of a loop behind the one before, so the steam rises in a steady stream.
            const share = (nowSeconds / STEAM_LOOP_SECONDS + index / STEAM_PUFFS) % 1;
            const drift = Math.sin(index * 2.1 + share * 3) * 0.04;
            mesh.position.set(drift, POT_HEIGHT_METRES + share * STEAM_RISE_METRES, Math.cos(index * 1.3) * 0.03);
            mesh.scale.setScalar(0.6 + share * 1.4);
            material.opacity = STEAM_OPACITY * Math.sin(share * Math.PI);
          });
        },
      };
    },
    dispose() {
      for (const item of [bodyGeometry, baseGeometry, waterGeometry, handleGeometry, puffGeometry, potMaterial, waterMaterial, ...steamMaterials]) {
        item.dispose();
      }
    },
  };
}

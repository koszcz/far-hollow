// Loads the "player" asset in asset-manifest.json: barbarian.glb, KayKit's Barbarian (CC0), with its animation clips.
// The owner approved the asset. player-mesh.ts dresses it, poses it, and draws it.
import type * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const PLAYER_MODEL_PATH = "assets/player/barbarian.glb";

/** The loaded Barbarian and every animation clip that comes with it. The player mesh copies it, so it is never drawn itself. */
export interface PlayerModel {
  readonly scene: THREE.Group;
  readonly clips: readonly THREE.AnimationClip[];
}

export async function loadPlayerModel(): Promise<PlayerModel> {
  const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}${PLAYER_MODEL_PATH}`);
  return { scene: gltf.scene, clips: gltf.animations };
}

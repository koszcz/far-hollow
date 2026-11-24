// Runs the draft "carry-in-hands-animation" asset in asset-manifest.json: while the player fetches a plank or a stone for a
// blueprint, they carry it in front of them in both hands, at waist height. Added by fetch materials ticket 01.
// The carried plank is the plank shape from the approved "pile" asset in pile-meshes.ts. The carried stone is the first
// stone shape of the approved "stone" asset in stone-shape.ts. Over walking or any body motion, only the arms move, so the
// legs keep walking. The axe goes on the back. Its moment is what the hands carry.
import * as THREE from "three";
import type { HeldMaterial } from "../../sim/entities";
import type { BuildPose } from "../player-build-pose";
import { createStoneGeometry } from "../stone-shape";
import type { PlayerMotion, PlayerRig } from "./player-motion";

/** Both wrists go here, in metres from the player's feet: in front of the belly, a little apart. The body stays as the clip holds it. */
const CARRY_POSE: BuildPose = {
  hipsDrop: 0,
  hipsBack: 0,
  hipsLean: 0,
  chestLean: 0,
  headTilt: 0,
  reach: 1,
  hands: { forward: 0.34, height: 0.92, spread: 0.17 },
};
/** The plank in a pile: a flat board of pale sawn wood, 0.8 m long. See pile-meshes.ts. */
const PLANK_SIZE_METRES = { length: 0.8, thickness: 0.025, width: 0.1 } as const;
const PLANK_COLOUR = 0xd9b07a;
/** How far in front of the wrists the middle of the carried thing rides, in metres, so the hands hold its near side. */
const AHEAD_OF_HANDS_METRES = 0.05;
/** How much bigger the stone is in the hands than true size, so it shows beside the big hands, like the pot. */
const STONE_IN_HANDS_SCALE = 1.4;

export function createCarryInHandsMotion(rig: PlayerRig): PlayerMotion<HeldMaterial> {
  const { group, leftArm, rightArm } = rig;
  let held: HeldMaterial | undefined;
  const plankGeometry = new THREE.BoxGeometry(PLANK_SIZE_METRES.length, PLANK_SIZE_METRES.thickness, PLANK_SIZE_METRES.width);
  const stoneGeometry = createStoneGeometry(0);
  // The plank lies across the body, along x, so each hand holds one side of its middle.
  const plank = new THREE.Mesh(plankGeometry, rig.material(PLANK_COLOUR, { flatShading: true }));
  const stone = new THREE.Mesh(stoneGeometry, rig.material(0xffffff, { vertexColors: true, roughness: 0.9 }));
  stone.scale.setScalar(STONE_IN_HANDS_SCALE);
  const holder = new THREE.Group();
  for (const prop of [plank, stone]) {
    prop.castShadow = true;
    prop.position.z = AHEAD_OF_HANDS_METRES;
    holder.add(prop);
  }
  holder.visible = false;
  group.add(holder);
  const left = new THREE.Vector3();
  const right = new THREE.Vector3();

  return {
    layer: "upperBody",
    axeOnBack: true,
    get playing() {
      return held !== undefined;
    },
    update(moment) {
      const changed = (moment === undefined) !== (held === undefined);
      held = moment;
      if (!changed) return undefined;
      return { kind: moment === undefined ? "hidden" : "shown" };
    },
    /** Brings both hands together in front of the belly, on top of the clip and any body motion. */
    pose() {
      if (held === undefined) return;
      rig.applyPose(CARRY_POSE, rig.bones.arms);
    },
    /** Shows the plank or stone between the hands. */
    placeProps() {
      holder.visible = held !== undefined;
      if (held === undefined) return;
      plank.visible = held === "plank";
      stone.visible = held === "stone";
      group.updateWorldMatrix(true, true);
      group.worldToLocal(leftArm.end.getWorldPosition(left));
      group.worldToLocal(rightArm.end.getWorldPosition(right));
      holder.position.addVectors(left, right).multiplyScalar(0.5);
    },
    dispose() {
      plankGeometry.dispose();
      stoneGeometry.dispose();
    },
  };
}

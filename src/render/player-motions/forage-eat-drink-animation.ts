// Runs the approved "forage-eat-drink-animation" asset in asset-manifest.json: foraging a berry bush, eating, drinking
// from the river, filling the pot, and drinking from the pot, posed in code by player-eat-drink-pose.ts. The pot in the
// hands is the approved "pot", built by pot-shape.ts. The axe goes on the back. Over walking or any body motion, only
// the arms and head move, so the legs keep walking and the body keeps working.
import * as THREE from "three";
import { eatDrinkPoseAt, upperBodyOf, type EatDrinkMotion } from "../player-eat-drink-pose";
import { createPotMaker, POT_HEIGHT_METRES } from "../pot-shape";
import type { PlayerMotion, PlayerRig } from "./player-motion";

/**
 * How far in front of the hands the middle of a held pot rides, in metres. The arms are short, so the hands hold the
 * near side of the rim rather than the lugs, and the pot stays clear of the body.
 */
const POT_AHEAD_OF_HANDS_METRES = 0.14;
/** How much bigger the pot is in the hands than true size, so it shows beside the big head, like the saw. */
const POT_IN_HAND_SCALE = 1.5;

/** Its moment is which motion plays, and the seconds since it began. */
export function createEatDrinkMotion(rig: PlayerRig): PlayerMotion<EatDrinkMotion> {
  const { group, leftArm, rightArm } = rig;
  /** Which forage, eat, or drink motion plays, and how far into it, while one plays. */
  let eating: EatDrinkMotion | undefined;
  // The pot rides between the hands while filling it or drinking from it. The holder sits at the hands and tips the pot
  // about the line through them. The pot rides just ahead of the hands, its rim level with them.
  const potMaker = createPotMaker();
  const potInHands = potMaker.make();
  const potHolder = new THREE.Group();
  potInHands.group.position.set(0, -POT_HEIGHT_METRES, POT_AHEAD_OF_HANDS_METRES);
  potHolder.add(potInHands.group);
  potHolder.visible = false;
  potHolder.scale.setScalar(POT_IN_HAND_SCALE);
  group.add(potHolder);
  const potLeft = new THREE.Vector3();
  const potRight = new THREE.Vector3();

  return {
    layer: "upperBody",
    axeOnBack: true,
    get playing() {
      return eating !== undefined;
    },
    update(moment) {
      const changed = (moment === undefined) !== (eating === undefined);
      eating = moment === undefined ? undefined : { ...moment };
      if (!changed) return undefined;
      return { kind: moment === undefined ? "hidden" : "shown" };
    },
    /** Reaches into a bush, eats, or drinks, on top of the clip and any body motion. */
    pose() {
      if (eating === undefined) return;
      const { body, arms } = eatDrinkPoseAt(eating.kind, eating.seconds);
      // A hand steadying a log on the shoulder stays there, so only the left hand moves.
      rig.applyPose(rig.bodyMoves ? upperBodyOf(body) : body, rig.carrying ? [leftArm] : arms === "right" ? [rightArm] : rig.bones.arms);
    },
    /** Shows the pot between the hands while filling it or drinking from it, tipped as the motion says. */
    placeProps() {
      const pot = eating === undefined ? undefined : eatDrinkPoseAt(eating.kind, eating.seconds).pot;
      potHolder.visible = pot !== undefined;
      if (pot === undefined) return;
      potInHands.show(pot.look, performance.now() / 1000);
      group.updateWorldMatrix(true, true);
      group.worldToLocal(leftArm.end.getWorldPosition(potLeft));
      group.worldToLocal(rightArm.end.getWorldPosition(potRight));
      potHolder.position.addVectors(potLeft, potRight).multiplyScalar(0.5);
      // Turning about +x tips the rim toward +z, the way the player faces.
      potHolder.rotation.set(pot.tilt, 0, 0);
    },
    dispose() {
      potMaker.dispose();
    },
  };
}

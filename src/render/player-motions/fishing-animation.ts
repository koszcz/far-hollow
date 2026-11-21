// Runs the approved "fishing-animation" asset in asset-manifest.json. Posed in code by player-fish-pose.ts, the player
// casts the approved "fishing-rod", built by fishing-rod-model.ts, waits for the float to dip, then lifts out a raw fish
// from "fishing-piles" and catches it in the left hand. fishing-tackle.ts bends the rod and draws the line and the
// float. The axe goes on the back.
import * as THREE from "three";
import { FISH_LENGTH_METRES, rawFishParts } from "../fishing-pile-shapes";
import { createFishingRod } from "../fishing-rod-model";
import { createFishingFloat, createFishingLine, createRodBend } from "../fishing-tackle";
import { FISH_ENTER_SECONDS, fishPoseAt } from "../player-fish-pose";
import { createBodyWorkMotion, type PlayerMotion, type PlayerRig } from "./player-motion";

/**
 * The moment fishing moves on to. `nowSeconds` is a steady real-time clock. `sinceCast` is the seconds since the latest
 * cast began, and `toBite` the seconds until a fish bites. The line reaches the water `floatForward` metres in front of
 * the player's feet and `floatHeight` metres above them.
 */
export interface Fishing {
  readonly nowSeconds: number;
  readonly sinceCast: number;
  readonly toBite: number;
  readonly floatForward: number;
  readonly floatHeight: number;
}

/** How thick the fishing line is drawn, as a radius, in metres. It is thicker than true so it shows from the camera. */
const FISHING_LINE_RADIUS_METRES = 0.004;
/** How much larger than true the caught fish is drawn, so it shows from the camera as it swings in on the line. */
const CAUGHT_FISH_SCALE = 1.6;
/** How far the float rides above the hook while the line is out of the water, in metres. */
const FLOAT_ABOVE_HOOK_METRES = 0.25;
const FISHING_LINE_COLOUR = 0xe8e2cc;
const FISH_HANG = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);

export function createFishingMotion(rig: PlayerRig): PlayerMotion<Fishing> {
  const { group, leftArm, rightArm } = rig;
  const motion = createBodyWorkMotion<Fishing>(rig, {
    startOf: (at) => at.nowSeconds,
    poseAt: (at, since) => fishPoseAt(at.sinceCast, at.toBite, at.nowSeconds - since).body,
    leaveSeconds: FISH_ENTER_SECONDS,
  });
  const geometries: THREE.BufferGeometry[] = [];

  // The fishing rod rides in the right hand while fishing, its butt at the wrist. The line runs from its tip.
  const rod = createFishingRod();
  rod.group.visible = false;
  group.add(rod.group);
  const rodBend = createRodBend(rod);
  const fishingLine = createFishingLine(FISHING_LINE_RADIUS_METRES, rig.material(FISHING_LINE_COLOUR, { roughness: 0.8 }));
  fishingLine.mesh.visible = false;
  group.add(fishingLine.mesh);
  const linePoints = Array.from({ length: fishingLine.pointCount }, () => new THREE.Vector3());
  const fishingFloat = createFishingFloat();
  fishingFloat.group.visible = false;
  group.add(fishingFloat.group);
  // The caught fish hangs head up from the end of the line, hooked by the mouth. The inner group puts the snout at the
  // outer group's origin, so the outer group turns the fish about the hook.
  const caughtFish = new THREE.Group();
  const caughtFishBody = new THREE.Group();
  caughtFishBody.position.z = -FISH_LENGTH_METRES / 2;
  caughtFish.add(caughtFishBody);
  const keepGeometry = <T extends { dispose(): void }>(made: T): T => {
    if (made instanceof THREE.BufferGeometry) geometries.push(made);
    return made;
  };
  for (const part of rawFishParts((colour) => rig.material(colour), keepGeometry)) {
    const mesh = new THREE.Mesh(part.geometry, part.material);
    mesh.castShadow = true;
    caughtFishBody.add(mesh);
  }
  caughtFish.visible = false;
  caughtFish.scale.setScalar(CAUGHT_FISH_SCALE);
  group.add(caughtFish);

  const rodTip = new THREE.Vector3();
  const lineEnd = new THREE.Vector3();
  const lineHang = new THREE.Vector3();
  const lineFloat = new THREE.Vector3();
  const leftHand = new THREE.Vector3();
  const lineSpot = new THREE.Vector3();
  const fishTwist = new THREE.Quaternion();
  const fishKick = new THREE.Quaternion();

  /** The point `t` of the way along the line drawn now, from the tip to the end. */
  function pointOnLine(t: number, out: THREE.Vector3): THREE.Vector3 {
    const at = Math.min(Math.max(t, 0), 1) * (linePoints.length - 1);
    const index = Math.min(Math.floor(at), linePoints.length - 2);
    const from = linePoints[index];
    const to = linePoints[index + 1];
    return from === undefined || to === undefined ? out.copy(lineEnd) : out.lerpVectors(from, to, at - index);
  }

  return {
    layer: "body",
    axeOnBack: true,
    get playing() {
      return motion.playing;
    },
    update: motion.update,
    pose: motion.pose,
    /**
     * Shows the fishing rod in the right hand while fishing, lifted and bent as the pose says, with the line, the float,
     * and any fish on it. Everything is placed in the player's own space, where the player faces +z and their right is -x.
     */
    placeProps() {
      const fishingSince = motion.since;
      const fishingNow = fishingSince === undefined ? undefined : motion.at;
      rod.group.visible = fishingNow !== undefined;
      fishingLine.mesh.visible = fishingNow !== undefined;
      fishingFloat.group.visible = fishingNow !== undefined;
      caughtFish.visible = false;
      if (fishingNow === undefined || fishingSince === undefined) return;
      const fishPose = fishPoseAt(fishingNow.sinceCast, fishingNow.toBite, fishingNow.nowSeconds - fishingSince);
      group.updateWorldMatrix(true, true);
      group.worldToLocal(rightArm.end.getWorldPosition(rod.group.position));
      group.worldToLocal(leftArm.end.getWorldPosition(leftHand));
      // The rod lifts from level about -x, which turns +z towards +y, then leans out to the right about +z.
      rod.group.rotation.set(-fishPose.rodLift, 0, fishPose.rodLean, "ZYX");
      rod.group.updateMatrix();
      rodBend.bend(fishPose.rodBend);
      rodTip.copy(rodBend.tip).applyMatrix4(rod.group.matrix);

      // Drawn in, the line hangs below the tip, streaming back as the rod swings. Cast out, it reaches the float on the
      // water, flying in an arc on the way. The left hand can take hold of its end.
      lineHang
        .set(0, -(1 - fishPose.lineTrail * 0.8), -fishPose.lineTrail)
        .normalize()
        .multiplyScalar(fishPose.lineHang)
        .add(rodTip);
      lineHang.z += fishPose.fishSwing;
      lineFloat.set(rodTip.x, fishingNow.floatHeight, fishingNow.floatForward);
      lineEnd.lerpVectors(lineHang, lineFloat, fishPose.lineOut);
      lineEnd.y += fishPose.lineArc;
      lineEnd.lerp(leftHand, fishPose.lineInHand);
      // The line sags in the middle, most of all when it lies slack out to the water.
      const last = linePoints.length - 1;
      linePoints.forEach((point, index) => {
        const t = index / last;
        point.lerpVectors(rodTip, lineEnd, t);
        point.y -= fishPose.lineSag * 4 * t * (1 - t);
      });
      fishingLine.setPoints(linePoints);

      // The float sits on the water at the end of the line, or rides up the line above the hook once the line leaves it.
      const lineLength = rodTip.distanceTo(lineEnd) || 1;
      pointOnLine(1 - Math.min(0.9, (FLOAT_ABOVE_HOOK_METRES * fishPose.floatUp) / lineLength), lineSpot);
      fishingFloat.group.position.copy(lineSpot);
      fishingFloat.group.position.y -= fishPose.floatDip * (1 - fishPose.floatUp);

      if (fishPose.fishShown) {
        caughtFish.visible = true;
        caughtFish.position.copy(lineEnd);
        // The fish hangs head up from the hook, twisting about the line and kicking its tail out to the side.
        fishTwist.setFromAxisAngle(AXIS_Y, fishPose.fishThrash);
        fishKick.setFromAxisAngle(AXIS_Z, fishPose.fishThrash * 0.5);
        caughtFish.quaternion.copy(fishTwist).multiply(fishKick).multiply(FISH_HANG);
      }
    },
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      rod.dispose();
      rodBend.dispose();
      fishingLine.dispose();
      fishingFloat.dispose();
    },
  };
}

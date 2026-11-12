// Builds the "player-build-animation" asset in asset-manifest.json: the player crouches, sets a piece low in front with
// both hands, presses it home, and stands up again. It is posed in code on top of whichever KayKit clip plays,
// so it has no clip of its own. The owner approved the asset.
import * as THREE from "three";

/** Seconds one crouch-set-press-rise cycle takes. */
export const CROUCH_CYCLE_SECONDS = 2.4;

/**
 * Where each phase of one cycle ends, as shares of the cycle. The player crouches and reaches down until
 * `CROUCH_REACHED_SHARE`, holds the piece above its place until `CROUCH_HOLD_SHARE`, presses it home by
 * `CROUCH_PRESSED_SHARE`, lets the jolt die away by `CROUCH_SETTLED_SHARE`, then stands up for the rest of the cycle.
 */
export const CROUCH_REACHED_SHARE = 0.38;
export const CROUCH_HOLD_SHARE = 0.46;
export const CROUCH_PRESSED_SHARE = 0.56;
export const CROUCH_SETTLED_SHARE = 0.68;

/** One key pose of the build. Distances are metres from the player's feet, angles are radians. */
export interface BuildPose {
  /** How far the hips sink below where the clip holds them. */
  readonly hipsDrop: number;
  /** How far the hips move back, against the way the player faces, to balance the lean. */
  readonly hipsBack: number;
  /** How far the hips tip forward. */
  readonly hipsLean: number;
  /** How far the chest tips forward on top of the hips. */
  readonly chestLean: number;
  /** How far the head tips forward on top of the chest. Negative lifts the chin to watch the hands. */
  readonly headTilt: number;
  /** How far the wrists move from where the clip holds them toward `hands`: 0 not at all, 1 all the way. */
  readonly reach: number;
  /** Where both wrists go: `forward` in front of the feet, `height` above the ground, `spread` out from the middle. */
  readonly hands: { readonly forward: number; readonly height: number; readonly spread: number };
}

/** Crouched with both hands holding the piece just above its place. */
const BUILD_REACH_POSE: BuildPose = {
  hipsDrop: 0.09,
  hipsBack: 0.04,
  hipsLean: 0.25,
  chestLean: 0.45,
  headTilt: -0.25,
  reach: 1,
  hands: { forward: 0.44, height: 0.3, spread: 0.13 },
};

/** Lower and further over, both hands pressing the piece down into its place. */
const BUILD_PRESS_POSE: BuildPose = {
  hipsDrop: 0.11,
  hipsBack: 0.05,
  hipsLean: 0.3,
  chestLean: 0.58,
  headTilt: -0.3,
  reach: 1,
  hands: { forward: 0.46, height: 0.2, spread: 0.12 },
};

/** Standing as the clip holds the player, with the hands where `from` left them. */
function standing(from: BuildPose): BuildPose {
  return { hipsDrop: 0, hipsBack: 0, hipsLean: 0, chestLean: 0, headTilt: 0, reach: 0, hands: from.hands };
}

/** How far the hands bounce back up after pressing the piece home, in metres, before the jolt dies away. */
const BUILD_JOLT_METRES = 0.03;

const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

function blend(a: BuildPose, b: BuildPose, t: number): BuildPose {
  return {
    hipsDrop: lerp(a.hipsDrop, b.hipsDrop, t),
    hipsBack: lerp(a.hipsBack, b.hipsBack, t),
    hipsLean: lerp(a.hipsLean, b.hipsLean, t),
    chestLean: lerp(a.chestLean, b.chestLean, t),
    headTilt: lerp(a.headTilt, b.headTilt, t),
    reach: lerp(a.reach, b.reach, t),
    hands: {
      forward: lerp(a.hands.forward, b.hands.forward, t),
      height: lerp(a.hands.height, b.hands.height, t),
      spread: lerp(a.hands.spread, b.hands.spread, t),
    },
  };
}

/** The build pose `seconds` after building began. The cycle starts and ends standing, so it loops without a jump. */
export function buildPoseAt(seconds: number): BuildPose {
  const share = (((seconds / CROUCH_CYCLE_SECONDS) % 1) + 1) % 1;
  if (share < CROUCH_REACHED_SHARE) return blend(standing(BUILD_REACH_POSE), BUILD_REACH_POSE, easeInOut(share / CROUCH_REACHED_SHARE));
  if (share < CROUCH_HOLD_SHARE) return BUILD_REACH_POSE;
  if (share < CROUCH_PRESSED_SHARE) {
    // The press speeds up into contact.
    const t = (share - CROUCH_HOLD_SHARE) / (CROUCH_PRESSED_SHARE - CROUCH_HOLD_SHARE);
    return blend(BUILD_REACH_POSE, BUILD_PRESS_POSE, t * t);
  }
  if (share < CROUCH_SETTLED_SHARE) {
    // The impact jolt: the hands bounce a little and settle.
    const t = (share - CROUCH_PRESSED_SHARE) / (CROUCH_SETTLED_SHARE - CROUCH_PRESSED_SHARE);
    const jolt = (1 - t) ** 2 * Math.sin(t * Math.PI * 3);
    const hands = BUILD_PRESS_POSE.hands;
    return { ...BUILD_PRESS_POSE, hands: { ...hands, height: hands.height + BUILD_JOLT_METRES * jolt } };
  }
  const t = (share - CROUCH_SETTLED_SHARE) / (1 - CROUCH_SETTLED_SHARE);
  return blend(BUILD_PRESS_POSE, standing(BUILD_PRESS_POSE), easeInOut(t));
}

/** Scales every movement of a pose by `weight`, from 0 (standing as the clip holds the player) to 1 (the full pose). */
export function scaleBuildPose(pose: BuildPose, weight: number): BuildPose {
  return blend(standing(pose), pose, weight);
}

/** Where the knees point while crouching, from the player's feet, in metres: forward and a little out. */
const KNEE_POLE = { x: 0.25, y: 0.3, z: 1 };
/** Where the elbows point while reaching, from the player's feet, in metres: out to the side and up. */
const ELBOW_POLE = { x: 0.6, y: 0.9, z: 0 };

export interface BuildBones {
  readonly hips: THREE.Object3D;
  readonly chest: THREE.Object3D;
  readonly head: THREE.Object3D;
  readonly legs: readonly Limb[];
  readonly arms: readonly Limb[];
}

/** A two-bone limb. `side` is +1 for the left, which is +x because the player faces +z, and -1 for the right. */
export interface Limb {
  readonly upper: THREE.Object3D;
  readonly lower: THREE.Object3D;
  /** The bone at the far end: the foot or the wrist. */
  readonly end: THREE.Object3D;
  readonly side: 1 | -1;
}

const scratch = {
  a: new THREE.Vector3(),
  b: new THREE.Vector3(),
  c: new THREE.Vector3(),
  d: new THREE.Vector3(),
  q: new THREE.Quaternion(),
  p: new THREE.Quaternion(),
};

/** Turns `bone` by `angle` radians about `axis`, given in world space. */
function turnInWorld(bone: THREE.Object3D, axis: THREE.Vector3, angle: number): void {
  const parentTurn = bone.parent === null ? scratch.p.identity() : bone.parent.getWorldQuaternion(scratch.p);
  const turn = scratch.q.setFromAxisAngle(axis, angle);
  // local' = parent⁻¹ · turn · parent · local
  bone.quaternion.premultiply(parentTurn).premultiply(turn).premultiply(parentTurn.invert());
  bone.updateWorldMatrix(false, true);
}

/** Turns `bone` so the world direction `from` comes to point along the world direction `to`. */
function turnToward(bone: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3): void {
  const parentTurn = bone.parent === null ? scratch.p.identity() : bone.parent.getWorldQuaternion(scratch.p);
  const turn = scratch.q.setFromUnitVectors(from.normalize(), to.normalize());
  bone.quaternion.premultiply(parentTurn).premultiply(turn).premultiply(parentTurn.invert());
  bone.updateWorldMatrix(false, true);
}

/** Bends a two-bone limb so its end bone reaches `target`, with the middle joint bending toward `pole`. Both are world points. */
function reach(limb: Limb, target: THREE.Vector3, pole: THREE.Vector3): void {
  const root = limb.upper.getWorldPosition(new THREE.Vector3());
  const joint = limb.lower.getWorldPosition(new THREE.Vector3());
  const end = limb.end.getWorldPosition(new THREE.Vector3());
  const upperLength = joint.distanceTo(root);
  const lowerLength = end.distanceTo(joint);
  const toTarget = target.clone().sub(root);
  const distance = THREE.MathUtils.clamp(toTarget.length(), Math.abs(upperLength - lowerLength) + 1e-4, upperLength + lowerLength - 1e-4);
  const along = toTarget.normalize();
  const bendSide = pole.clone().sub(root);
  bendSide.sub(along.clone().multiplyScalar(bendSide.dot(along))).normalize();
  // The law of cosines gives the angle at the root between the target and the upper bone.
  const cosRoot = (upperLength ** 2 + distance ** 2 - lowerLength ** 2) / (2 * upperLength * distance);
  const sinRoot = Math.sqrt(Math.max(0, 1 - cosRoot ** 2));
  const jointWanted = root
    .clone()
    .addScaledVector(along, cosRoot * upperLength)
    .addScaledVector(bendSide, sinRoot * upperLength);
  turnToward(limb.upper, joint.sub(root), jointWanted.clone().sub(root));
  const jointNow = limb.lower.getWorldPosition(scratch.a);
  const endNow = limb.end.getWorldPosition(scratch.b);
  const wanted = root.addScaledVector(along, distance);
  turnToward(limb.lower, endNow.sub(jointNow), wanted.sub(jointNow));
}

/**
 * Poses the player crouching to build, on top of the pose the clip left. `group` stands at the player's feet and faces +z.
 * `arms` picks which arms reach, so a hand steadying a log on the shoulder can stay there.
 */
export function applyBuildPose(group: THREE.Object3D, bones: BuildBones, pose: BuildPose, arms: readonly Limb[] = bones.arms): void {
  if (pose.reach === 0 && pose.hipsDrop === 0 && pose.hipsLean === 0 && pose.chestLean === 0 && pose.headTilt === 0) return;
  group.updateWorldMatrix(true, true);
  const local = (x: number, y: number, z: number): THREE.Vector3 => group.localToWorld(new THREE.Vector3(x, y, z));
  const groupTurn = group.getWorldQuaternion(new THREE.Quaternion());
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(groupTurn);

  // Remember where the clip put the feet and wrists, and how the feet were turned.
  const feet = bones.legs.map((leg) => ({
    at: leg.end.getWorldPosition(new THREE.Vector3()),
    turn: leg.end.getWorldQuaternion(new THREE.Quaternion()),
  }));
  const wrists = arms.map((arm) => arm.end.getWorldPosition(new THREE.Vector3()));

  // The hips sink and move back, then the hips and chest tip forward. Bending about +x tips the head toward +z.
  const hipsAt = bones.hips.getWorldPosition(new THREE.Vector3());
  const hipsShift = local(0, -pose.hipsDrop, -pose.hipsBack).sub(local(0, 0, 0));
  const hipsParent = bones.hips.parent;
  if (hipsParent !== null) {
    bones.hips.position.copy(hipsParent.worldToLocal(hipsAt.add(hipsShift)));
    bones.hips.updateWorldMatrix(false, true);
  }
  turnInWorld(bones.hips, right, pose.hipsLean);
  turnInWorld(bones.chest, right, pose.chestLean);
  turnInWorld(bones.head, right, pose.headTilt);

  // Each foot stays planted where the clip put it, turned the same way, and the knee bends forward.
  bones.legs.forEach((leg, index) => {
    const foot = feet[index];
    if (foot === undefined) return;
    reach(leg, foot.at, local(KNEE_POLE.x * leg.side, KNEE_POLE.y, KNEE_POLE.z));
    const parentTurn = leg.end.parent?.getWorldQuaternion(new THREE.Quaternion()) ?? new THREE.Quaternion();
    leg.end.quaternion.copy(parentTurn.invert().multiply(foot.turn));
    leg.end.updateWorldMatrix(false, true);
  });

  // Each wrist moves from where the clip held it toward its place by the piece.
  arms.forEach((arm, index) => {
    const from = wrists[index];
    if (from === undefined || pose.reach === 0) return;
    const to = local(pose.hands.spread * arm.side, pose.hands.height, pose.hands.forward);
    reach(arm, from.lerp(to, pose.reach), local(ELBOW_POLE.x * arm.side, ELBOW_POLE.y, ELBOW_POLE.z));
  });
}

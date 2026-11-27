// Draws the player as the "player" asset in asset-manifest.json: KayKit's Barbarian, loaded by player-model.ts, without
// its hood, cape, shield, mug, and big axe, and with a light brown knit beanie built here. The owner approved the asset.
// Its moves are KayKit clips from the same file: "walk-animation" is Running_A, "chop-animation" is 2H_Melee_Attack_Slice,
// and "split-animation" is 2H_Melee_Attack_Chop. The owner approved all three.
// While sleeping, "sleep-animation", timed by sleep-animation.ts, plays the Lie_Down and Lie_Idle clips, rolls onto the back into Death_A_Pose and
// breathes slowly, then rolls back and plays Lie_StandUp. The owner approved it.
// While sitting on a stool, the approved "sit-animation", timed by sit-animation.ts, plays the Sit_Chair_Down, Sit_Chair_Idle, and Sit_Chair_StandUp clips.
// Reaching to pick something up or put it down, "pick-up-animation", plays KayKit's PickUp clip for a reach to the
// ground and its Interact clip for a reach at waist height, timed so the hand gets to the thing when game logic hands it over.
// player-reach-pose.ts steers one hand to the thing and blends into and out of the reach. The owner approved it.
// Each motion posed in code, such as fishing or crafting by hand, lives in its own module in player-motions/, with its
// props. The player mesh lends each one a rig and runs them in the order of player-motions/motion-list.ts.
// The backpack on the back is the approved "backpack" asset, built by backpack-shape.ts.
// The carried log is the approved "logs" asset, loaded by log-shape.ts. A carried debarked log is the approved "debarked-log" asset, built by debarked-log-shape.ts.
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { CarriedLog, ReachHeight } from "../sim/entities";
import { HAND_AT_SECONDS, REACH_SECONDS } from "../sim/hand-reach";
import { BACKPACK_DEPTH, createBackpack, type Backpack } from "./backpack-shape";
import { applyBuildPose, scaleBuildPose, type BuildBones, type BuildPose } from "./player-build-pose";
import { createDebarkedLogGeometry } from "./debarked-log-shape";
import { smoothstep } from "./easing";
import type { Leaving } from "./work-motion";
import { reachPoseAt } from "./player-reach-pose";
import { LOG_COLOUR, LOG_CUT_COLOUR, type LogShape } from "./log-shape";
import { sleepBodyAt, sleepBreathAt } from "./sleep-animation";
import type { SitBody } from "./sit-animation";
import type { PlayerModel } from "./player-model";
import {
  CARRY_CLIP,
  CHOP_CLIP,
  IDLE_CLIP,
  LIE_DOWN_CLIP,
  LIE_IDLE_CLIP,
  ON_BACK_CLIP,
  REACH_CLIPS,
  SIT_CLIPS,
  SPLIT_CLIP,
  STAND_UP_CLIP,
  WALK_CLIP,
} from "./player-clip-names";
import { createBeanie } from "./player-beanie";
import { contactSeconds, createShowClip } from "./player-clip-show";
import { createClipPoseMemory } from "./player-clip-pose";
import { createReachBlend } from "./player-reach-blend";
import type { PlayerMesh } from "./player-mesh-type";
import { CHOP_SWINGS_PER_SECOND, MODEL_SCALE, SPLIT_STRIKES_PER_SECOND, STRIDE_METRES } from "./player-timing";
import { createPlayerMotions } from "./player-motions/motion-list";
import { freeArms, type PlayerMotion, type PlayerRig } from "./player-motions/player-motion";

/** GLTFLoader drops the dots from node names, so "handslot.r" in the file is "handslotr" here. */
const HIDDEN_PARTS = ["1H_Axe_Offhand", "Barbarian_Round_Shield", "2H_Axe", "Mug", "Barbarian_Hat", "Barbarian_Cape"];
const AXE_PART = "1H_Axe";

/** How far the chest turns up on a full slow breath while asleep, in radians about the chest's own x axis. */
const SLEEP_BREATH_RADIANS = 0.035;
/** The carried log rests here on the player's right shoulder, from the player's feet, in metres. The player faces +z, so the right side is -x. */
const SHOULDER_LOG_SPOT = new THREE.Vector3(-0.3, 1.0, 0);
/**
 * While the right hand steadies the log, the axe hangs on the outside of the backpack, from the player's feet, in metres.
 * Its depth is measured from the backpack once the player is built.
 */
const AXE_ON_BACK_HEIGHT = 0.95;
const AXE_ON_BACK_SIDE = 0.05;
/** How far out from the backpack the axe hangs, in metres. */
const AXE_OFF_BACKPACK = 0.04;
/** How the right arm turns up to steady the log, in radians about the upper arm's own axes. */
const CARRY_UPPER_ARM = new THREE.Euler(-1.3, 0, 1.3);
const CARRY_FOREARM = new THREE.Euler(0, 0, 0);
const CARRY_UPPER_ARM_TURN = new THREE.Quaternion().setFromEuler(CARRY_UPPER_ARM);
const CARRY_FOREARM_TURN = new THREE.Quaternion().setFromEuler(CARRY_FOREARM);

/** playerModel is the loaded Barbarian, from loadPlayerModel. logShape is the loaded log, from loadLogShape. */
export function createPlayerMesh(playerModel: PlayerModel, logShape: LogShape): PlayerMesh {
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const group = new THREE.Group();
  const model = cloneSkinned(playerModel.scene);
  model.scale.setScalar(MODEL_SCALE);
  model.traverse((object) => {
    if (HIDDEN_PARTS.includes(object.name)) object.visible = false;
    object.castShadow = true;
  });
  group.add(model);

  const bone = (name: string): THREE.Object3D => {
    const found = model.getObjectByName(name);
    if (found === undefined) throw new Error(`The player model has no "${name}"`);
    return found;
  };
  const headBone = bone("head");
  const chestBone = bone("chest");
  const rightUpperArm = bone("upperarmr");
  const rightForearm = bone("lowerarmr");
  const rightHandSlot = bone("handslotr");
  const limb = (side: "l" | "r", upper: string, lower: string, end: string) => ({
    upper: bone(upper + side),
    lower: bone(lower + side),
    end: bone(end + side),
    side: side === "l" ? (1 as const) : (-1 as const),
  });
  const leftArm = limb("l", "upperarm", "lowerarm", "wrist");
  const rightArm = limb("r", "upperarm", "lowerarm", "wrist");
  const buildBones: BuildBones = {
    hips: bone("hips"),
    chest: chestBone,
    head: headBone,
    legs: [limb("l", "upperleg", "lowerleg", "foot"), limb("r", "upperleg", "lowerleg", "foot")],
    arms: [leftArm, rightArm],
  };
  const axe = bone(AXE_PART);
  const axeInHand = { position: axe.position.clone(), quaternion: axe.quaternion.clone(), scale: axe.scale.clone() };
  let axeIsOnBack = false;

  const mixer = new THREE.AnimationMixer(model);
  const clip = (name: string): THREE.AnimationAction => {
    const found = playerModel.clips.find((candidate) => candidate.name === name);
    if (found === undefined) throw new Error(`The player model has no "${name}" clip`);
    return mixer.clipAction(found);
  };
  const idle = clip(IDLE_CLIP);
  const walk = clip(WALK_CLIP);
  const chop = clip(CHOP_CLIP);
  const split = clip(SPLIT_CLIP);
  const carry = clip(CARRY_CLIP);
  const sleepClips = { lieDown: clip(LIE_DOWN_CLIP), lieIdle: clip(LIE_IDLE_CLIP), standUp: clip(STAND_UP_CLIP) };
  const sitClips = { sitDown: clip(SIT_CLIPS.sitDown), sitIdle: clip(SIT_CLIPS.sitIdle), standUp: clip(SIT_CLIPS.standUp) };
  const reachClips = { low: clip(REACH_CLIPS.low), waist: clip(REACH_CLIPS.waist) };
  const onBackClip = clip(ON_BACK_CLIP);
  const showClip = createShowClip(mixer);

  /**
   * The moment in each reach clip when a hand gets to the thing: the lowest a wrist goes in the clip to the ground,
   * and the furthest forward a wrist goes in the clip at waist height. The player faces +z.
   */
  const reachContact: Record<ReachHeight, { seconds: number; arm: typeof leftArm }> = {
    low: contactSeconds(showClip, group, [leftArm, rightArm], reachClips.low, (wrist) => -wrist.y),
    waist: contactSeconds(showClip, group, [leftArm, rightArm], reachClips.waist, (wrist) => wrist.z),
  };

  // Stand in the idle pose, then fit the beanie to the head as it is now, and fix it to the head bone.
  showClip(idle, 0.4);
  group.updateMatrixWorld(true);
  addBeanie();
  const torso = new THREE.Box3().setFromObject(bone("Barbarian_Body"), true);
  const backpack: Backpack = createBackpack(torso);
  group.add(backpack.group);
  chestBone.attach(backpack.group);
  const axeOnBackSpot = new THREE.Vector3(AXE_ON_BACK_SIDE, AXE_ON_BACK_HEIGHT, torso.min.z - BACKPACK_DEPTH - AXE_OFF_BACKPACK);

  // The forest owns the log shape and disposes it, so the player does not.
  const shoulderBark = material(LOG_COLOUR, { flatShading: true });
  const shoulderCut = material(LOG_CUT_COLOUR, { flatShading: true });
  const logMaterials = [shoulderBark, shoulderCut];
  // The debarked log is the player's own copy of the shape, painted pale, so the player disposes it.
  const debarkedLogGeometry = createDebarkedLogGeometry(logShape.geometry);
  geometries.push(debarkedLogGeometry);
  const debarkedLogMaterial = material(0xffffff, { flatShading: true, vertexColors: true });
  const shoulderLog: THREE.Mesh = new THREE.Mesh(logShape.geometry, logMaterials);
  shoulderLog.castShadow = true;
  shoulderLog.position.copy(SHOULDER_LOG_SPOT);
  shoulderLog.visible = false;
  showClip(carry, 0);
  group.updateMatrixWorld(true);
  group.add(shoulderLog);
  chestBone.attach(shoulderLog);
  // Work out where the axe hangs on the chest in this same standing carry pose, once. Placing it later, from whatever
  // pose the chest is in at that moment, left it floating off the back when the player picked up a log mid-stride.
  const axeOnBackRest = new THREE.Object3D();
  axeOnBackRest.position.copy(axeOnBackSpot);
  axeOnBackRest.rotation.set(0, 0, 0.5);
  axeOnBackRest.scale.setScalar(MODEL_SCALE);
  group.add(axeOnBackRest);
  chestBone.attach(axeOnBackRest);
  chestBone.remove(axeOnBackRest);
  const axeOnBack = { position: axeOnBackRest.position.clone(), quaternion: axeOnBackRest.quaternion.clone(), scale: axeOnBackRest.scale.clone() };

  let carrying = false;
  let carriedKind: CarriedLog | undefined;
  let walkedMetres: number | undefined;
  let choppingAt: number | undefined;
  let splittingAt: number | undefined;
  /** Seconds since the player reached the bedroll, while sleeping. */
  let sleepingAt: number | undefined;
  /** Which sitting clip shows, and how far into it, while the player sits on a stool or stands up from one. */
  let sittingBody: SitBody | undefined;
  /** How far the player is through a reach, while reaching. */
  let reaching: { height: ReachHeight; seconds: number; distance?: number } | undefined;
  /** While standing up after a work motion stops. */
  let standingUp: Leaving | undefined;

  /** What the player mesh lends each motion in the motion list. */
  const rig: PlayerRig = {
    group,
    bones: buildBones,
    leftArm,
    rightArm,
    logShape,
    material,
    applyPose(pose, arms) {
      rememberClipPose(...buildPosedBones);
      applyBuildPose(group, buildBones, pose, arms);
    },
    get carrying() {
      return carrying;
    },
    get walkedMetres() {
      return walkedMetres;
    },
    strideMetres: STRIDE_METRES,
    get bodyMoves() {
      return walkedMetres !== undefined || choppingAt !== undefined || splittingAt !== undefined || bodyMotions.some((motion) => motion.playing);
    },
  };
  const motions = createPlayerMotions(rig);
  /** Every motion in the list, in its order. */
  const motionList: readonly PlayerMotion<unknown>[] = Object.values(motions);
  const bodyMotions = motionList.filter((motion) => motion.layer === "body");
  const upperBodyMotions = motionList.filter((motion) => motion.layer === "upperBody");

  function material(color: THREE.ColorRepresentation, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
    const made = new THREE.MeshStandardMaterial({ color, roughness: 1, ...extra });
    materials.push(made);
    return made;
  }

  /** Fits a knit beanie to the head as it is now, and fixes it to the head bone. */
  function addBeanie(): void {
    const beanie = createBeanie(model, bone("Barbarian_Head"), material, geometries);
    group.add(beanie);
    headBone.attach(beanie);
  }

  /** Moves the axe to the right hand, or to the back while the right hand steadies the log. */
  function placeAxe(onBack: boolean): void {
    if (onBack === axeIsOnBack) return;
    axeIsOnBack = onBack;
    const spot = onBack ? axeOnBack : axeInHand;
    (onBack ? chestBone : rightHandSlot).add(axe);
    axe.position.copy(spot.position);
    axe.quaternion.copy(spot.quaternion);
    axe.scale.copy(spot.scale);
  }

  const clipPose = createClipPoseMemory();
  const rememberClipPose = (...bones: THREE.Object3D[]): void => {
    clipPose.remember(...bones);
  };
  const buildPosedBones = [
    buildBones.hips,
    buildBones.chest,
    buildBones.head,
    ...[...buildBones.legs, ...buildBones.arms].flatMap((part) => [part.upper, part.lower, part.end]),
  ];

  /** Puts the axe in the right hand, or on the back while the hands are busy with a log or with a motion that wants it there. */
  function updateAxe(): void {
    const swinging = choppingAt !== undefined || splittingAt !== undefined;
    const handsBusy =
      carrying ||
      reaching !== undefined ||
      motionList.some((motion) => motion.playing && motion.axeOnBack) ||
      sleepingAt !== undefined ||
      sittingBody !== undefined;
    placeAxe(!swinging && handsBusy);
  }

  /** Shows the clip for what the player is doing now. */
  function pose(): void {
    // The mixer skips a bone whose clip value has not changed since it last wrote it.
    // Undo the carry turn first, so the turn never piles up on itself.
    clipPose.restore();
    posePlayingClip();
    if (carrying) {
      // The right arm turns up so the hand steadies the log on the shoulder, whatever the legs do.
      rememberClipPose(rightUpperArm, rightForearm);
      rightUpperArm.quaternion.multiply(CARRY_UPPER_ARM_TURN);
      rightForearm.quaternion.multiply(CARRY_FOREARM_TURN);
    }
    poseBreathing();
    poseBody();
    // An upper body motion, such as eating, poses the arms and head over whatever body motion plays.
    for (const motion of upperBodyMotions) motion.pose?.();
    poseReaching();
    reachBlend.apply(reaching?.seconds ?? 0, rememberClipPose);
    // Props go on last, once every pose is applied, so they follow the hands.
    for (const motion of motionList) motion.placeProps();
  }

  /** Every bone of the model, for blending whole poses. */
  const skeletonBones: THREE.Object3D[] = [];
  model.traverse((object) => {
    if (object instanceof THREE.Bone) skeletonBones.push(object);
  });
  const reachBlend = createReachBlend(skeletonBones);

  /** Bends deeper and steers the reaching hand to the thing, on top of the reach clip. */
  function poseReaching(): void {
    if (reaching === undefined) return;
    const reachPose = reachPoseAt(reaching.height, reaching.seconds, reaching.distance);
    // A hand steadying a log on the shoulder stays there, so the left hand reaches instead.
    const arm = carrying ? leftArm : reachContact[reaching.height].arm;
    rememberClipPose(...buildPosedBones);
    applyBuildPose(group, buildBones, reachPose, [arm]);
  }

  /**
   * Moves a motion on to `at`, or stops it when `at` is undefined. Starting a work motion ends any standing back up.
   * Stopping one stands the player back up the way that motion does.
   */
  function updateMotion<At>(motion: Pick<PlayerMotion<At>, "update">, at: At | undefined): void {
    const change = motion.update(at, performance.now() / 1000);
    if (change?.kind === "started") standingUp = undefined;
    if (change?.kind === "stopped") standingUp = change.leaving;
    if (change !== undefined) updateAxe();
    pose();
  }

  /** Poses the body for the first body motion playing, or stands back up for a moment after a work motion stops. */
  function poseBody(): void {
    const playing = bodyMotions.find((motion) => motion.playing);
    if (playing !== undefined) {
      playing.pose?.();
      return;
    }
    const pose = standingUpPose();
    // A hand steadying a log on the shoulder stays there, so only the left hand moves.
    if (pose !== undefined) rig.applyPose(pose, freeArms(rig));
  }

  /** The pose while standing back up after a work motion stops, or undefined once the player stands. */
  function standingUpPose(): BuildPose | undefined {
    if (standingUp === undefined) return undefined;
    const done = (performance.now() / 1000 - standingUp.at) / standingUp.seconds;
    // Standing up eases out only over the idle clip. Walking or swinging takes over the whole body at once.
    const idleNow = walkedMetres === undefined && choppingAt === undefined && splittingAt === undefined;
    if (done >= 1 || !idleNow) {
      standingUp = undefined;
      return undefined;
    }
    return scaleBuildPose(standingUp.pose, 1 - smoothstep(done));
  }

  const breathTurn = new THREE.Quaternion();
  const chestAxis = new THREE.Vector3(1, 0, 0);
  /** Asleep on the back, the chest rises and falls slowly, so the still back-lying pose reads as sleep. */
  function poseBreathing(): void {
    if (sleepingAt === undefined) return;
    const onBack = sleepBodyAt(sleepingAt).onBack;
    if (onBack <= 0) return;
    rememberClipPose(chestBone);
    chestBone.quaternion.multiply(breathTurn.setFromAxisAngle(chestAxis, -SLEEP_BREATH_RADIANS * onBack * sleepBreathAt(sleepingAt)));
  }

  function posePlayingClip(): void {
    if (sleepingAt !== undefined) {
      const body = sleepBodyAt(sleepingAt);
      const action = sleepClips[body.clip];
      // Lying down and standing up play once, so they hold their last frame rather than start again.
      const last = action.getClip().duration - 0.001;
      // Asleep, the body rolls from the side-lying clip onto its back.
      showClip(action, body.clip === "lieIdle" ? body.clipSeconds : Math.min(body.clipSeconds, last), {
        action: onBackClip,
        seconds: 0,
        weight: body.onBack,
      });
      return;
    }
    if (sittingBody !== undefined) {
      const action = sitClips[sittingBody.clip];
      // Sitting down and standing up play once, so they hold their last frame rather than start again.
      const last = action.getClip().duration - 0.001;
      showClip(action, sittingBody.clip === "sitIdle" ? sittingBody.clipSeconds : Math.min(sittingBody.clipSeconds, last));
      return;
    }
    if (choppingAt !== undefined) {
      showClip(chop, choppingAt * CHOP_SWINGS_PER_SECOND * chop.getClip().duration);
      return;
    }
    if (splittingAt !== undefined) {
      showClip(split, splittingAt * SPLIT_STRIKES_PER_SECOND * split.getClip().duration);
      return;
    }
    if (reaching !== undefined) {
      showClip(reachClips[reaching.height], reachClipSeconds(reaching.height, reaching.seconds));
      return;
    }
    if (walkedMetres !== undefined) {
      showClip(walk, (walkedMetres / STRIDE_METRES) * walk.getClip().duration);
    } else {
      // Standing still, the player breathes on a steady clock of its own.
      showClip(carrying ? carry : idle, carrying ? 0 : performance.now() / 1000);
    }
  }
  /**
   * Where in its clip a reach `seconds` in is. The clip is stretched or squeezed on each side of the hand's moment,
   * so the hand gets to the thing at HAND_AT_SECONDS and the player stands again at REACH_SECONDS.
   */
  function reachClipSeconds(height: ReachHeight, seconds: number): number {
    const contact = reachContact[height].seconds;
    // A reach plays once, so the clip holds its last frame rather than start again.
    const last = reachClips[height].getClip().duration - 0.001;
    if (seconds <= HAND_AT_SECONDS) return (Math.max(0, seconds) / HAND_AT_SECONDS) * contact;
    const after = Math.min(1, (seconds - HAND_AT_SECONDS) / (REACH_SECONDS - HAND_AT_SECONDS));
    return contact + after * (last - contact);
  }
  pose();

  return {
    group,
    setHeading(radians) {
      group.rotation.y = radians;
    },
    setCarryingLog(kind) {
      if (kind === carriedKind) return;
      carriedKind = kind;
      // A debarked log is the same shape, painted pale. See debarked-log-shape.ts.
      const debarked = kind === "debarkedLog";
      shoulderLog.geometry = debarked ? debarkedLogGeometry : logShape.geometry;
      shoulderLog.material = debarked ? debarkedLogMaterial : logMaterials;
      const carryingNow = kind !== undefined;
      if (carryingNow === carrying) return;
      carrying = carryingNow;
      shoulderLog.visible = carrying;
      updateAxe();
      pose();
    },
    setWalking(walked) {
      walkedMetres = walked;
      pose();
    },
    setChopping(nowSeconds) {
      choppingAt = nowSeconds;
      if (nowSeconds !== undefined) splittingAt = undefined;
      updateAxe();
      pose();
    },
    setSplitting(nowSeconds) {
      splittingAt = nowSeconds;
      if (nowSeconds !== undefined) choppingAt = undefined;
      updateAxe();
      pose();
    },
    setMotion(id, moment) {
      const motion: PlayerMotion<unknown> = motions[id];
      updateMotion(motion, moment);
    },
    setReaching(reach) {
      const changed = (reach === undefined) !== (reaching === undefined);
      // A reach that starts, starts again, or ends blends from the pose shown now.
      const startsAgain = reach !== undefined && reaching !== undefined && (reach.seconds < reaching.seconds || reach.height !== reaching.height);
      if (changed || startsAgain) reachBlend.start(reach === undefined ? performance.now() / 1000 : undefined);
      reaching = reach;
      if (changed) updateAxe();
      pose();
    },
    setSleeping(seconds) {
      const changed = (seconds === undefined) !== (sleepingAt === undefined);
      sleepingAt = seconds;
      if (changed) updateAxe();
      pose();
    },
    ropeHold() {
      return motions["sled-drag-animation"].ropeHold();
    },
    setSitting(body) {
      const changed = (body === undefined) !== (sittingBody === undefined);
      sittingBody = body;
      if (changed) updateAxe();
      pose();
    },
    torchFlame(target) {
      return motions.torch.torchFlame(target);
    },
    dispose() {
      mixer.stopAllAction();
      mixer.uncacheRoot(model);
      for (const motion of motionList) motion.dispose();
      for (const geometry of geometries) geometry.dispose();
      for (const made of materials) made.dispose();
      backpack.dispose();
    },
  };
}

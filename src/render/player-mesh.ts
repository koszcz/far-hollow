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
// While dragging a sled, the approved "sled-drag-animation", posed in code by player-sled-drag-pose.ts, leans the player
// forward over the walk or idle clip, with the left hand holding the rope low behind the hip. ropeHold() says where the
// approved "sled-rope" starts.
// While the player holds a lit torch, the draft "torch", built by torch-shape.ts, rides upright in the left hand through
// every motion, with a small "fire-effect" flame on its head. scene-renderer.ts lights the ground from torchFlame().
// The backpack on the back is the approved "backpack" asset, built by backpack-shape.ts.
// The carried log is the approved "logs" asset, loaded by log-shape.ts. A carried debarked log is the approved "debarked-log" asset, built by debarked-log-shape.ts.
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { CarriedLog, ReachHeight } from "../sim/entities";
import { HAND_AT_SECONDS, REACH_SECONDS } from "../sim/hand-reach";
import { BACKPACK_DEPTH, createBackpack, type Backpack } from "./backpack-shape";
import { applyBuildPose, scaleBuildPose, type BuildBones, type BuildPose } from "./player-build-pose";
import { createDebarkedLogGeometry } from "./debarked-log-shape";
import { sledDragPoseAt } from "./player-sled-drag-pose";
import type { RopeHold } from "./sled-rope";
import { smoothstep } from "./easing";
import type { Leaving } from "./work-motion";
import { blendLeftAt, REACH_BLEND_IN_SECONDS, REACH_BLEND_OUT_SECONDS, reachPoseAt } from "./player-reach-pose";
import { LOG_COLOUR, LOG_CUT_COLOUR, type LogShape } from "./log-shape";
import { sleepBodyAt, sleepBreathAt } from "./sleep-animation";
import type { SitBody } from "./sit-animation";
import type { PlayerModel } from "./player-model";
import { createFireMaker } from "./fire-effect";
import { createTorchFlame, createTorchShape, TORCH_FLAME_HEIGHT_METRES } from "./torch-shape";
import { createPlayerMotions, type MotionId, type MotionMoment } from "./player-motions/motion-list";
import { freeArms, type PlayerMotion, type PlayerRig } from "./player-motions/player-motion";

/**
 * The lit torch rides in the left hand, gripped this far up from its butt, in metres. It leans this far forward and this far
 * out from the body, in radians, so the flame stays clear of the head. Part of the draft "torch" asset.
 */
const TORCH_GRIP_METRES = 0.14;
const TORCH_LEAN_FORWARD = 0.25;
const TORCH_LEAN_OUT = 0.2;

/** The Barbarian is modelled about 2.4 units tall with his hood. This scale makes him about 1.85 m tall in it. */
const MODEL_SCALE = 0.78;
/** GLTFLoader drops the dots from node names, so "handslot.r" in the file is "handslotr" here. */
const HIDDEN_PARTS = ["1H_Axe_Offhand", "Barbarian_Round_Shield", "2H_Axe", "Mug", "Barbarian_Hat", "Barbarian_Cape"];
const AXE_PART = "1H_Axe";
const BEANIE_COLOUR = 0xb08a5e;
const BEANIE_CUFF_COLOUR = 0x96714a;

const IDLE_CLIP = "Idle";
const WALK_CLIP = "Running_A";
const CHOP_CLIP = "2H_Melee_Attack_Slice";
const SPLIT_CLIP = "2H_Melee_Attack_Chop";
const LIE_DOWN_CLIP = "Lie_Down";
const LIE_IDLE_CLIP = "Lie_Idle";
const STAND_UP_CLIP = "Lie_StandUp";
/** The clip that lies the body flat on its back. KayKit made it as a death pose. Here it is the sleeping pose. */
const ON_BACK_CLIP = "Death_A_Pose";
/** How far the chest turns up on a full slow breath while asleep, in radians about the chest's own x axis. */
const SLEEP_BREATH_RADIANS = 0.035;
/** The clips for sitting down on a stool, resting there, and standing up: the approved "sit-animation". */
const SIT_CLIPS = { sitDown: "Sit_Chair_Down", sitIdle: "Sit_Chair_Idle", standUp: "Sit_Chair_StandUp" } as const;
/** The clips for reaching to the ground, and out at waist height. */
const REACH_CLIPS: Readonly<Record<ReachHeight, string>> = { low: "PickUp", waist: "Interact" };
/** The clip that holds both arms still while the right hand steadies a log on the shoulder. */
const CARRY_CLIP = "Walking_B";

/** Seconds each clip lasts, as KayKit made them. The game plays each at its own speed. */
const CHOP_CLIP_SECONDS = 1.1;
const SPLIT_CLIP_SECONDS = 1.6333;

/**
 * Metres walked in one full loop of the walk clip, left foot and right foot. Each foot moves 0.6 model units against
 * the hips while it is planted, so the feet stay put on the ground when the clip keeps pace with this.
 */
export const STRIDE_METRES = 1.2 * MODEL_SCALE;

/** How many times a second the player swings the axe at a tree: once per loop of the chop clip. */
export const CHOP_SWINGS_PER_SECOND = 1 / CHOP_CLIP_SECONDS;
/**
 * Moments in each chopping swing, as shares of one swing: the axe is drawn back over the left side by
 * `CHOP_RAISED_SHARE`, starts across at `CHOP_SWING_SHARE`, and strikes the trunk at `CHOP_STRIKE_SHARE`.
 */
export const CHOP_RAISED_SHARE = 0.28;
export const CHOP_SWING_SHARE = 0.31;
export const CHOP_STRIKE_SHARE = 0.38;
/** How many times a second the player strikes down at a log when splitting: once per loop of the split clip. */
export const SPLIT_STRIKES_PER_SECOND = 1 / SPLIT_CLIP_SECONDS;

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

export interface PlayerMesh {
  /** Place this at the player's feet. */
  readonly group: THREE.Group;
  /** Turns the player to face along a direction on the ground, in radians from the +z axis toward +x. */
  setHeading(radians: number): void;
  /** Shows the log or debarked log on the player's shoulder, or hides it when given undefined. */
  setCarryingLog(carrying: CarriedLog | undefined): void;
  /** Moves the legs and arms in step. Pass the total metres walked so far, or undefined to stand still. */
  setWalking(walkedMetres: number | undefined): void;
  /** Swings the player as if chopping. Pass undefined to stand upright. `nowSeconds` is a steady real-time clock. */
  setChopping(nowSeconds: number | undefined): void;
  /** Lifts the axe overhead and drops it as if splitting a log. Pass undefined to stand upright. `nowSeconds` is a steady real-time clock. */
  setSplitting(nowSeconds: number | undefined): void;
  /**
   * Lies the player down to sleep, and gets them up again, as sleep-animation.ts times it. Pass the seconds since the
   * player reached the bedroll, or undefined while not sleeping.
   */
  setSleeping(seconds: number | undefined): void;
  /**
   * Sits the player down on a stool, rests there, or stands them up, as sit-animation.ts times it.
   * Pass which clip shows and how far into it, or undefined while not sitting.
   */
  setSitting(body: SitBody | undefined): void;
  /**
   * Bends down, or reaches out at waist height, to pick something up or put it down. Pass the seconds since the reach
   * began, from 0 to REACH_SECONDS, or undefined while not reaching. The hand gets to the thing at HAND_AT_SECONDS.
   * `distance` is how far the thing is in front of the player's feet, in metres, if known. The hand reaches toward it.
   */
  setReaching(reach: { height: ReachHeight; seconds: number; distance?: number } | undefined): void;
  /** Leans the player forward to drag a sled by a rope in the left hand, or stands them upright at once. */
  setDragging(dragging: boolean): void;
  /**
   * Moves the motion `id`, from the list in player-motions/motion-list.ts, on to `moment`, or stops it when `moment` is
   * undefined. Each motion's module says what its moment is.
   */
  setMotion<Id extends MotionId>(id: Id, moment: MotionMoment<Id> | undefined): void;
  /** Where the player holds the sled's rope, as world points, while dragging. Undefined while not dragging. */
  ropeHold(): RopeHold | undefined;
  /**
   * Shows a lit torch in the player's left hand, its flame burning at `nowSeconds`, a steady real-time clock.
   * Pass undefined to hide it. The player keeps it through every motion.
   */
  setLitTorch(nowSeconds: number | undefined): void;
  /**
   * Copies where the lit torch's flame is, as a world point, into `target.position`, and how high it is above the player's feet
   * into `target.aboveGroundMetres`. Returns false, and copies nothing, while no torch shows.
   */
  torchFlame(target: { readonly position: THREE.Vector3; aboveGroundMetres: number }): boolean;
  dispose(): void;
}

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
  let playing: THREE.AnimationAction[] = [];
  /**
   * Shows `action` frozen `seconds` into its clip. With `blend`, mixes in a second clip, frozen at its own seconds,
   * by `blend.weight`, from 0 (none of it) to 1 (all of it).
   */
  function showClip(action: THREE.AnimationAction, seconds: number, blend?: { action: THREE.AnimationAction; seconds: number; weight: number }): void {
    const wanted = blend !== undefined && blend.weight > 0 ? [action, blend.action] : [action];
    for (const shown of playing) if (!wanted.includes(shown)) shown.stop();
    for (const shown of wanted) if (!playing.includes(shown)) shown.play();
    playing = wanted;
    const freeze = (shown: THREE.AnimationAction, at: number, weight: number) => {
      const duration = shown.getClip().duration;
      shown.time = ((at % duration) + duration) % duration;
      shown.setEffectiveWeight(weight);
    };
    const weight = blend !== undefined && blend.weight > 0 ? Math.min(1, blend.weight) : 0;
    freeze(action, seconds, 1 - weight);
    if (blend !== undefined && weight > 0) freeze(blend.action, blend.seconds, weight);
    mixer.update(0);
  }

  /**
   * The moment in each reach clip when a hand gets to the thing: the lowest a wrist goes in the clip to the ground,
   * and the furthest forward a wrist goes in the clip at waist height. The player faces +z.
   */
  const reachContact: Record<ReachHeight, { seconds: number; arm: typeof leftArm }> = {
    low: contactSeconds(reachClips.low, (wrist) => -wrist.y),
    waist: contactSeconds(reachClips.waist, (wrist) => wrist.z),
  };
  /** The moment in a clip when a wrist scores best, and the arm that wrist belongs to: the arm that reaches. */
  function contactSeconds(action: THREE.AnimationAction, score: (wrist: THREE.Vector3) => number): { seconds: number; arm: typeof leftArm } {
    const wrist = new THREE.Vector3();
    const duration = action.getClip().duration;
    let best = { seconds: duration / 2, arm: rightArm, score: -Infinity };
    for (let seconds = 0; seconds < duration; seconds += 1 / 60) {
      showClip(action, seconds);
      group.updateMatrixWorld(true);
      for (const arm of [leftArm, rightArm]) {
        const scored = score(group.worldToLocal(arm.end.getWorldPosition(wrist)));
        if (scored > best.score) best = { seconds, arm, score: scored };
      }
    }
    return { seconds: best.seconds, arm: best.arm };
  }

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
  /**
   * The pose the player held when a reach started, started again, or ended, which fades into the pose now.
   * While reaching, the blend runs on the reach's own clock. Afterwards, it runs on the performance clock from `endedAt`.
   */
  let reachBlend: { from: Map<THREE.Object3D, { position: THREE.Vector3; quaternion: THREE.Quaternion }>; endedAt?: number } | undefined;
  /** While standing up after a work motion stops. */
  let leavingBuild: Leaving | undefined;
  /** Whether the player drags a sled. */
  let dragging = false;

  // The lit torch rides in the left hand, upright, placed from the wrist each time the player is posed.
  const torchShape = createTorchShape();
  const torchFireMaker = createFireMaker();
  const torchInHand = new THREE.Group();
  /** Where the player's feet are in the world, worked out again each time torchFlame runs. */
  const feet = new THREE.Vector3();
  for (const part of torchShape.parts) torchInHand.add(new THREE.Mesh(part.geometry, part.material));
  const torchFire = createTorchFlame(torchFireMaker);
  torchInHand.add(torchFire.group);
  torchInHand.visible = false;
  group.add(torchInHand);
  /** When the lit torch shows, the steady clock time its flame burns at. Undefined while the player holds no lit torch. */
  let torchAt: number | undefined;

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
    get bodyMoves() {
      return walkedMetres !== undefined || choppingAt !== undefined || splittingAt !== undefined || dragging || bodyMotions.some((motion) => motion.playing);
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

  /** A knit beanie with a folded cuff and a bobble, sized to the head and riding on the head bone. */
  function addBeanie(): void {
    const head = bone("Barbarian_Head");
    const box = new THREE.Box3().setFromObject(head, true);
    const size = box.getSize(new THREE.Vector3());
    const middle = box.getCenter(new THREE.Vector3());
    // The skinned head's own box stops short of the crown, so take the crown from the whole posed model.
    const crown = new THREE.Box3().setFromObject(model, true).max.y;
    const radius = (Math.max(size.x, size.z) / 2) * 0.86;
    const knit = material(BEANIE_COLOUR);
    const beanie = new THREE.Group();
    const domeShape = new THREE.SphereGeometry(radius, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const cuffShape = new THREE.CylinderGeometry(radius * 1.04, radius * 1.04, radius * 0.32, 24);
    const bobbleShape = new THREE.SphereGeometry(radius * 0.2, 12, 8);
    geometries.push(domeShape, cuffShape, bobbleShape);
    const dome = new THREE.Mesh(domeShape, knit);
    dome.scale.set(1, 0.85, 1);
    const cuff = new THREE.Mesh(cuffShape, material(BEANIE_CUFF_COLOUR));
    cuff.position.y = radius * 0.1;
    const bobble = new THREE.Mesh(bobbleShape, knit);
    bobble.position.y = radius * 0.9;
    for (const part of [dome, cuff, bobble]) {
      part.castShadow = true;
      beanie.add(part);
    }
    // The cuff sits across the forehead, just above the brows. The box was measured from the group, so place it there first.
    beanie.position.set(middle.x, crown - radius * 1.05, middle.z);
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

  /** Each bone turned or moved by code, as the clip last posed it. The mixer does not put these back itself. */
  const posedByCode = new Map<THREE.Object3D, { position: THREE.Vector3; quaternion: THREE.Quaternion }>();
  function rememberClipPose(...bones: THREE.Object3D[]): void {
    for (const posed of bones) {
      if (!posedByCode.has(posed)) posedByCode.set(posed, { position: posed.position.clone(), quaternion: posed.quaternion.clone() });
    }
  }
  /** Puts every bone code turned or moved back as the clip posed it. */
  function restoreClipPose(): void {
    for (const [posed, clipPose] of posedByCode) {
      posed.position.copy(clipPose.position);
      posed.quaternion.copy(clipPose.quaternion);
    }
    posedByCode.clear();
  }
  const buildPosedBones = [
    buildBones.hips,
    buildBones.chest,
    buildBones.head,
    ...[...buildBones.legs, ...buildBones.arms].flatMap((part) => [part.upper, part.lower, part.end]),
  ];

  /** Puts the axe in the right hand, or on the back while the hands are busy with a log or with building. */
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
    restoreClipPose();
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
    blendFromReach();
    placeTorch();
    for (const motion of motionList) motion.placeProps();
  }

  const torchHand = new THREE.Vector3();
  const TORCH_TILT = new THREE.Quaternion().setFromEuler(new THREE.Euler(TORCH_LEAN_FORWARD, 0, -TORCH_LEAN_OUT));
  const torchUp = new THREE.Vector3();
  /** Shows the lit torch in the left hand, gripped near its butt and leaning a little forward and out, with its flame burning. */
  function placeTorch(): void {
    torchInHand.visible = torchAt !== undefined;
    if (torchAt === undefined) return;
    group.updateWorldMatrix(true, true);
    group.worldToLocal(leftArm.end.getWorldPosition(torchHand));
    torchInHand.quaternion.copy(TORCH_TILT);
    torchUp.set(0, 1, 0).applyQuaternion(TORCH_TILT);
    torchInHand.position.copy(torchHand).addScaledVector(torchUp, -TORCH_GRIP_METRES);
    torchFire.animate(torchAt, 1, 0.7);
  }

  /** Every bone of the model, for blending whole poses. */
  const skeletonBones: THREE.Object3D[] = [];
  model.traverse((object) => {
    if (object instanceof THREE.Bone) skeletonBones.push(object);
  });
  /** Starts a blend from the pose shown now. Pass `endedAt` when the reach has ended. */
  function startReachBlend(endedAt?: number): void {
    const from = new Map<THREE.Object3D, { position: THREE.Vector3; quaternion: THREE.Quaternion }>();
    for (const posed of skeletonBones) from.set(posed, { position: posed.position.clone(), quaternion: posed.quaternion.clone() });
    reachBlend = endedAt === undefined ? { from } : { from, endedAt };
  }
  /** Fades the pose a reach started from, or ended in, into the pose now, so the player never jumps between frames. */
  function blendFromReach(): void {
    if (reachBlend === undefined) return;
    const left =
      reachBlend.endedAt === undefined
        ? blendLeftAt(reaching?.seconds ?? 0, REACH_BLEND_IN_SECONDS)
        : blendLeftAt(performance.now() / 1000 - reachBlend.endedAt, REACH_BLEND_OUT_SECONDS);
    if (left <= 0) {
      reachBlend = undefined;
      return;
    }
    rememberClipPose(...skeletonBones);
    for (const [posed, was] of reachBlend.from) {
      posed.position.lerp(was.position, left);
      posed.quaternion.slerp(was.quaternion, left);
    }
  }

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
   * Moves a work motion on to `at`, or stops it when `at` is undefined. Starting one ends any standing back up.
   * Stopping one stands the player back up the way that motion does.
   */
  function updateWork<At>(motion: Pick<PlayerMotion<At>, "update">, at: At | undefined): void {
    const change = motion.update(at, performance.now() / 1000);
    if (change?.kind === "started") leavingBuild = undefined;
    if (change?.kind === "stopped") leavingBuild = change.leaving;
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
    if (dragging) {
      // Only the left hand takes the rope. The right arm keeps the clip's swing, or steadies a log on the shoulder.
      // The walk clip takes two steps to each stride, and each step heaves into the pull.
      rememberClipPose(...buildPosedBones);
      const steps = walkedMetres === undefined ? undefined : (walkedMetres / STRIDE_METRES) * 2;
      applyBuildPose(group, buildBones, sledDragPoseAt(steps), [leftArm]);
      return;
    }
    const pose = standingUpPose();
    // A hand steadying a log on the shoulder stays there, so only the left hand moves.
    if (pose !== undefined) rig.applyPose(pose, freeArms(rig));
  }

  /** The pose while standing back up after a work motion stops, or undefined once the player stands. */
  function standingUpPose(): BuildPose | undefined {
    if (leavingBuild === undefined) return undefined;
    const done = (performance.now() / 1000 - leavingBuild.at) / leavingBuild.seconds;
    // Standing up eases out only over the idle clip. Walking or swinging takes over the whole body at once.
    const idleNow = walkedMetres === undefined && choppingAt === undefined && splittingAt === undefined;
    if (done >= 1 || !idleNow) {
      leavingBuild = undefined;
      return undefined;
    }
    return scaleBuildPose(leavingBuild.pose, 1 - smoothstep(done));
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
      updateWork(motion, moment);
    },
    setReaching(reach) {
      const changed = (reach === undefined) !== (reaching === undefined);
      // A reach that starts, starts again, or ends blends from the pose shown now.
      const startsAgain = reach !== undefined && reaching !== undefined && (reach.seconds < reaching.seconds || reach.height !== reaching.height);
      if (changed || startsAgain) startReachBlend(reach === undefined ? performance.now() / 1000 : undefined);
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
    setDragging(draggingNow) {
      if (draggingNow === dragging) return;
      dragging = draggingNow;
      pose();
    },
    ropeHold() {
      if (!dragging) return undefined;
      group.updateWorldMatrix(true, true);
      const hand = leftArm.end.getWorldPosition(new THREE.Vector3());
      return { hand: { x: hand.x, y: hand.y, z: hand.z }, walking: walkedMetres !== undefined };
    },
    setSitting(body) {
      const changed = (body === undefined) !== (sittingBody === undefined);
      sittingBody = body;
      if (changed) updateAxe();
      pose();
    },
    setLitTorch(nowSeconds) {
      torchAt = nowSeconds;
      placeTorch();
    },
    torchFlame(target) {
      if (torchAt === undefined) return false;
      torchInHand.updateWorldMatrix(true, false);
      target.position.set(0, TORCH_FLAME_HEIGHT_METRES, 0);
      torchInHand.localToWorld(target.position);
      target.aboveGroundMetres = target.position.y - feet.setFromMatrixPosition(group.matrixWorld).y;
      return true;
    },
    dispose() {
      torchShape.dispose();
      torchFireMaker.dispose();
      mixer.stopAllAction();
      mixer.uncacheRoot(model);
      for (const motion of motionList) motion.dispose();
      for (const geometry of geometries) geometry.dispose();
      for (const made of materials) made.dispose();
      backpack.dispose();
    },
  };
}

// Draws the player as the "player" asset in asset-manifest.json: KayKit's Barbarian, loaded by player-model.ts, without
// its hood, cape, shield, mug, and big axe, and with a light brown knit beanie built here. The owner approved the asset.
// Its moves are KayKit clips from the same file: "walk-animation" is Running_A, "chop-animation" is 2H_Melee_Attack_Slice,
// and "split-animation" is 2H_Melee_Attack_Chop. The owner approved all three.
// While building, "player-build-animation", posed in code by player-build-pose.ts, crouches the player over the clip. The owner approved it.
// The carried log is the approved "logs" asset, loaded by log-shape.ts. A carried debarked log is the approved "debarked-log" asset, built by debarked-log-shape.ts.
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { CarriedLog } from "../sim/entities";
import { applyBuildPose, buildPoseAt, scaleBuildPose, type BuildBones } from "./player-build-pose";
import { createDebarkedLogGeometry } from "./debarked-log-shape";
import { LOG_COLOUR, LOG_CUT_COLOUR, type LogShape } from "./log-shape";
import type { PlayerModel } from "./player-model";

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

/** Seconds the player takes to stand up when building stops partway through a crouch. */
const BUILD_LEAVE_SECONDS = 0.3;

/** The carried log rests here on the player's right shoulder, from the player's feet, in metres. The player faces +z, so the right side is -x. */
const SHOULDER_LOG_SPOT = new THREE.Vector3(-0.3, 1.0, 0);
/** While the right hand steadies the log, the axe hangs here on the back, from the player's feet, in metres. */
const AXE_ON_BACK_SPOT = new THREE.Vector3(0.05, 0.95, -0.3);
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
  /** Crouches the player to set pieces in place. Pass undefined to stand upright. `nowSeconds` is a steady real-time clock. */
  setBuilding(nowSeconds: number | undefined): void;
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
  const buildBones: BuildBones = {
    hips: bone("hips"),
    chest: chestBone,
    head: headBone,
    legs: [limb("l", "upperleg", "lowerleg", "foot"), limb("r", "upperleg", "lowerleg", "foot")],
    arms: [leftArm, limb("r", "upperarm", "lowerarm", "wrist")],
  };
  const axe = bone(AXE_PART);
  const axeInHand = { position: axe.position.clone(), quaternion: axe.quaternion.clone(), scale: axe.scale.clone() };
  let axeOnBack = false;

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
  let playing: THREE.AnimationAction | undefined;
  /** Shows `action` frozen `seconds` into its clip. */
  function showClip(action: THREE.AnimationAction, seconds: number): void {
    if (playing !== action) {
      playing?.stop();
      action.play();
      playing = action;
    }
    const duration = action.getClip().duration;
    action.time = ((seconds % duration) + duration) % duration;
    mixer.update(0);
  }

  // Stand in the idle pose, then fit the beanie to the head as it is now, and fix it to the head bone.
  showClip(idle, 0.4);
  group.updateMatrixWorld(true);
  addBeanie();

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

  let carrying = false;
  let carriedKind: CarriedLog | undefined;
  let walkedMetres: number | undefined;
  let choppingAt: number | undefined;
  let splittingAt: number | undefined;
  /** The clock time building began, or undefined while not building. */
  let buildingSince: number | undefined;
  /** The clock time it is now, while building. */
  let buildingAt = 0;
  /** While standing up after building stops: when it stopped, on the performance clock in seconds, and the pose then. */
  let leavingBuild: { at: number; pose: ReturnType<typeof buildPoseAt> } | undefined;

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
    if (onBack === axeOnBack) return;
    axeOnBack = onBack;
    if (!onBack) {
      rightHandSlot.add(axe);
      axe.position.copy(axeInHand.position);
      axe.quaternion.copy(axeInHand.quaternion);
      axe.scale.copy(axeInHand.scale);
      return;
    }
    // The axe hangs from the chest as the clip holds it, not as a crouch or a carry turn has moved it.
    restoreClipPose();
    group.updateMatrixWorld(true);
    group.add(axe);
    axe.position.copy(AXE_ON_BACK_SPOT);
    axe.rotation.set(0, 0, 0.5);
    axe.scale.setScalar(MODEL_SCALE);
    chestBone.attach(axe);
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
    placeAxe(!swinging && (carrying || buildingSince !== undefined));
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
    poseBuilding();
  }

  /** Crouches over the clip while building, or stands back up for a moment after building stops. */
  function poseBuilding(): void {
    let pose: ReturnType<typeof buildPoseAt> | undefined;
    if (buildingSince !== undefined) {
      pose = buildPoseAt(buildingAt - buildingSince);
    } else if (leavingBuild !== undefined) {
      const done = (performance.now() / 1000 - leavingBuild.at) / BUILD_LEAVE_SECONDS;
      // Standing up eases out only over the idle clip. Walking or swinging takes over the whole body at once.
      const idleNow = walkedMetres === undefined && choppingAt === undefined && splittingAt === undefined;
      if (done >= 1 || !idleNow) {
        leavingBuild = undefined;
        return;
      }
      pose = scaleBuildPose(leavingBuild.pose, 1 - done * done * (3 - 2 * done));
    }
    if (pose === undefined) return;
    rememberClipPose(...buildPosedBones);
    // A hand steadying a log on the shoulder stays there, so only the left hand reaches.
    applyBuildPose(group, buildBones, pose, carrying ? [leftArm] : buildBones.arms);
  }

  function posePlayingClip(): void {
    if (choppingAt !== undefined) {
      showClip(chop, choppingAt * CHOP_SWINGS_PER_SECOND * chop.getClip().duration);
      return;
    }
    if (splittingAt !== undefined) {
      showClip(split, splittingAt * SPLIT_STRIKES_PER_SECOND * split.getClip().duration);
      return;
    }
    if (walkedMetres !== undefined) {
      showClip(walk, (walkedMetres / STRIDE_METRES) * walk.getClip().duration);
    } else {
      // Standing still, the player breathes on a steady clock of its own.
      showClip(carrying ? carry : idle, carrying ? 0 : performance.now() / 1000);
    }
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
    setBuilding(nowSeconds) {
      if (nowSeconds === undefined) {
        if (buildingSince !== undefined) {
          leavingBuild = { at: performance.now() / 1000, pose: buildPoseAt(buildingAt - buildingSince) };
          buildingSince = undefined;
          updateAxe();
        }
      } else {
        if (buildingSince === undefined) {
          buildingSince = nowSeconds;
          leavingBuild = undefined;
          updateAxe();
        }
        buildingAt = nowSeconds;
      }
      pose();
    },
    dispose() {
      mixer.stopAllAction();
      mixer.uncacheRoot(model);
      for (const geometry of geometries) geometry.dispose();
      for (const made of materials) made.dispose();
    },
  };
}

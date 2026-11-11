// Draws the player with the code-built shape listed in asset-manifest.json as "player": a woodcutter with adult proportions,
// knees and elbows, a plaid work shirt, a knit cap, a beard, and an axe. The owner approved the asset.
// The walk cycle is the code-built "walk-animation". The owner approved the asset.
// The chopping swing is the code-built "chop-animation". The owner approved the asset. The splitting strike is the code-built "split-animation". The carried log is the approved "logs" asset, loaded by log-shape.ts.
import * as THREE from "three";
import { LOG_COLOUR, LOG_CUT_COLOUR, type LogShape } from "./log-shape";

const SHIRT_COLOUR = "#7d3b31";
const SHIRT_STRIPE_COLOUR = "#2b2523";
const TROUSER_COLOUR = 0x4f4a3d;
const BOOT_COLOUR = 0x3a2c22;
const BELT_COLOUR = 0x2a1f18;
const SKIN_COLOUR = 0xc99a7a;
const BEARD_COLOUR = 0x4a3426;
const CAP_COLOUR = 0x3e4245;
const EYE_COLOUR = 0x1e1612;
const AXE_HANDLE_COLOUR = 0x8a6a45;
const AXE_HEAD_COLOUR = 0x8f969c;

/** Height of the hip joints above the feet, in metres. The player stands about 1.8 m tall. */
const HIP_HEIGHT_METRES = 0.9;
const HIP_SPREAD_METRES = 0.095;
const THIGH_LENGTH_METRES = 0.42;
const SHIN_LENGTH_METRES = 0.4;
/** Height of the shoulder joints above the feet, in metres. */
const SHOULDER_HEIGHT_METRES = 1.44;
const SHOULDER_SPREAD_METRES = 0.2;
const UPPER_ARM_LENGTH_METRES = 0.3;
const FOREARM_LENGTH_METRES = 0.27;
/** Middle of the head, in metres above the feet. */
const HEAD_MIDDLE_METRES = 1.68;

/** The carried log rests here on the player's right shoulder, from the player's feet. The player faces +z, so the right side is -x. */
const SHOULDER_LOG_SPOT = { x: -0.22, y: 1.62, z: 0 };
/** Metres walked in one full stride, left foot and right foot. */
export const STRIDE_METRES = 1.5;
/** How far ahead of the hip a foot lands, in metres. A foot stays on the ground for half the stride. */
const FOOT_LANDS_AHEAD_METRES = 0.3;
/** How far behind the hip a foot leaves the ground, in metres. The heel lifts onto the toe to reach this far. */
const FOOT_LEAVES_BEHIND_METRES = STRIDE_METRES / 2 - FOOT_LANDS_AHEAD_METRES;
/** How high a swinging foot lifts at its highest, in metres. */
const STEP_LIFT_METRES = 0.12;
/** How far the hips drop as each foot lands, in metres. They are highest as one leg passes the other. */
const WALK_BOB_METRES = 0.04;
/** Height of the ankle above the sole, in metres. */
const ANKLE_HEIGHT_METRES = HIP_HEIGHT_METRES - THIGH_LENGTH_METRES - SHIN_LENGTH_METRES;
/** How far the toe reaches in front of the ankle, and the heel behind it, in metres. A tipped foot reaches this far down. */
const TOE_REACH_METRES = 0.16;
const HEEL_REACH_METRES = 0.08;
/** How far the arms swing while walking, in radians. */
const ARM_SWING_RADIANS = 0.38;
/** How far the elbows bend as an arm swings forward, in radians. They lag behind the shoulder by `ELBOW_LAG_RADIANS` of the stride. */
const ELBOW_SWING_RADIANS = 0.45;
const ELBOW_LAG_RADIANS = 0.6;
/** How far the hips and the shoulders turn against each other while walking, in radians. */
const HIP_TWIST_RADIANS = 0.08;
const SHOULDER_TWIST_RADIANS = 0.14;
/** How far the body tips over the foot carrying the weight, in radians. */
const WEIGHT_SWAY_RADIANS = 0.025;
/** How far the player leans forward while walking, in radians. */
const WALK_LEAN_RADIANS = 0.06;
/** Upper-arm and elbow angles that hold the axe out in front, for chopping and splitting. Negative turns forward. */
const WORK_UPPER_ARM_RADIANS = -1.05;
const WORK_ELBOW_RADIANS = -0.35;
/** Upper-arm and elbow angles that steady the log on the right shoulder. */
const CARRY_UPPER_ARM_RADIANS = -1.4;
const CARRY_ELBOW_RADIANS = -2.1;

/** How many times a second the player swings the axe. */
export const CHOP_SWINGS_PER_SECOND = 1.25;
/**
 * Each chopping swing is a side swing at waist height, like felling with an axe. Its parts, as shares of one swing:
 * lift the axe back over the right shoulder until `CHOP_RAISED_SHARE`, hold it there until `CHOP_SWING_SHARE`,
 * swing it across into the trunk at `CHOP_STRIKE_SHARE`, then jolt with the impact until the swing ends.
 */
export const CHOP_RAISED_SHARE = 0.5;
export const CHOP_SWING_SHARE = 0.58;
export const CHOP_STRIKE_SHARE = 0.78;
/**
 * The chopping pose at the strike and with the axe raised. Angles are in radians. The handle's angles are against the
 * chest: yaw turns toward the player's left, pitch tips up. `grip` is the point the handle swings about, in metres
 * from the feet, in the chest's own frame.
 */
const CHOP_STRIKE_POSE = { chestYaw: 0.15, hipYaw: 0.05, lean: 0.05, handleYaw: -0.2, handlePitch: -0.4, grip: new THREE.Vector3(0, 1.2, -0.12) };
const CHOP_RAISED_POSE = { chestYaw: -0.9, hipYaw: -0.25, lean: -0.05, handleYaw: -1.3, handlePitch: 0.6, grip: new THREE.Vector3(-0.12, 1.42, 0.2) };
/** How far the handle rebounds off the trunk at the strike, in radians, and how far the body rocks back, in radians. */
const CHOP_REBOUND_RADIANS = 0.1;
const CHOP_REBOUND_LEAN_RADIANS = 0.05;
/** Where the hands hold the handle, in metres from the grip point. The right hand slides up the handle as the axe rises. */
const CHOP_LEFT_HAND_METRES = 0.25;
const CHOP_RIGHT_HAND_STRIKE_METRES = 0.33;
const CHOP_RIGHT_HAND_RAISED_METRES = 0.5;
/** How far the feet stand apart while chopping, as a turn of each leg outward, in radians. */
const CHOP_STANCE_RADIANS = 0.1;
/** The axe's handle runs from its knob to its head. Its middle is this far along the handle from the knob, in metres. */
const AXE_KNOB_TO_MIDDLE_METRES = 0.39;
/** How many times a second the player strikes down at a log when splitting. Slower than chopping, because each strike is a full overhead lift. */
export const SPLIT_STRIKES_PER_SECOND = 0.8;
/** Share of each splitting strike spent lifting the axe overhead. The rest is the fast drop onto the log. */
const SPLIT_LIFT_SHARE = 0.7;
/** How far the player leans back with the axe overhead, in radians. */
const SPLIT_LIFT_LEAN_RADIANS = 0.4;
/** How far the player bends forward at the end of the strike, in radians. */
const SPLIT_STRIKE_LEAN_RADIANS = 0.55;
/** How far the player dips at the knees as the axe lands, in metres. */
const SPLIT_STRIKE_DIP_METRES = 0.18;

export interface PlayerMesh {
  /** Place this at the player's feet. */
  readonly group: THREE.Group;
  /** Turns the player to face along a direction on the ground, in radians from the +z axis toward +x. */
  setHeading(radians: number): void;
  /** Shows or hides the log on the player's shoulder. */
  setCarryingLog(carrying: boolean): void;
  /** Swings the legs and arms in step. Pass the total metres walked so far, or undefined to stand still. */
  setWalking(walkedMetres: number | undefined): void;
  /** Swings the player as if chopping. Pass undefined to stand upright. `nowSeconds` is a steady real-time clock. */
  setChopping(nowSeconds: number | undefined): void;
  /** Lifts the axe overhead and drops it as if splitting a log. Pass undefined to stand upright. `nowSeconds` is a steady real-time clock. */
  setSplitting(nowSeconds: number | undefined): void;
  dispose(): void;
}

/** A limb in two parts: the joint that swings it, and the joint halfway down that bends it. */
interface Limb {
  readonly root: THREE.Group;
  readonly bend: THREE.Group;
}

/** A leg also has an ankle, which tips the boot. */
interface Leg extends Limb {
  readonly ankle: THREE.Group;
}

/** logShape is the loaded log, from loadLogShape. The player carries it on the shoulder. */
export function createPlayerMesh(logShape: LogShape): PlayerMesh {
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];
  function material(color: THREE.ColorRepresentation, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
    const made = new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });
    materials.push(made);
    return made;
  }
  /** Adds a part. Its centre sits at `at` inside `parent`, stretched by `scale` along each axis. */
  function part(
    parent: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    at: [number, number, number],
    made: THREE.Material,
    scale: [number, number, number] = [1, 1, 1],
  ): THREE.Mesh {
    geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, made);
    mesh.position.set(...at);
    mesh.scale.set(...scale);
    parent.add(mesh);
    return mesh;
  }
  const ball = (radius: number) => new THREE.SphereGeometry(radius, 14, 10);
  /** A tapered tube hanging down from its top end. */
  const hangingTube = (radiusTop: number, radiusBottom: number, length: number) =>
    new THREE.CylinderGeometry(radiusTop, radiusBottom, length, 12).translate(0, -length / 2, 0);
  /** A body of revolution around the vertical axis. Each point is [radius, height] in metres, bottom to top. */
  const turned = (profile: [number, number][]) =>
    new THREE.LatheGeometry(profile.map(([radius, height]) => new THREE.Vector2(radius, height)), 16);

  const shirtTexture = createPlaidTexture();
  textures.push(shirtTexture);
  const shirt = material(0xffffff, { map: shirtTexture });
  const trousers = material(TROUSER_COLOUR);
  const boots = material(BOOT_COLOUR, { roughness: 0.7 });
  const skin = material(SKIN_COLOUR, { roughness: 0.75 });
  const beard = material(BEARD_COLOUR);
  const cap = material(CAP_COLOUR);

  const group = new THREE.Group();
  // The body leans inside the group, so the group can stay at the player's feet.
  const body = new THREE.Group();
  group.add(body);
  // The chest, shoulders, and arms turn on their own about the spine, against the hips, while walking.
  const chest = new THREE.Group();
  body.add(chest);

  /** Builds a limb: an upper tube from the root joint, then a lower tube from the bend joint. */
  function limb(
    at: [number, number, number],
    upper: { length: number; top: number; bottom: number },
    lower: { length: number; top: number; bottom: number },
    made: THREE.Material,
    parent: THREE.Group,
  ): Limb {
    const root = new THREE.Group();
    root.position.set(...at);
    part(root, ball(upper.top), [0, 0, 0], made);
    part(root, hangingTube(upper.top, upper.bottom, upper.length), [0, 0, 0], made);
    const bend = new THREE.Group();
    bend.position.set(0, -upper.length, 0);
    part(bend, ball(upper.bottom), [0, 0, 0], made);
    part(bend, hangingTube(lower.top, lower.bottom, lower.length), [0, 0, 0], made);
    root.add(bend);
    parent.add(root);
    return { root, bend };
  }

  // Legs: thigh, knee, shin, and a laced work boot that points forward.
  const legs = [HIP_SPREAD_METRES, -HIP_SPREAD_METRES].map((x) => {
    const leg = limb(
      [x, HIP_HEIGHT_METRES, 0],
      { length: THIGH_LENGTH_METRES, top: 0.09, bottom: 0.062 },
      { length: SHIN_LENGTH_METRES, top: 0.058, bottom: 0.045 },
      trousers,
      body,
    );
    part(leg.bend, hangingTube(0.058, 0.058, 0.1), [0, -SHIN_LENGTH_METRES + 0.08, 0], boots);
    const ankle = new THREE.Group();
    ankle.position.set(0, -SHIN_LENGTH_METRES, 0);
    leg.bend.add(ankle);
    part(ankle, ball(0.07), [0, -0.025, 0.045], boots, [0.8, 0.75, 1.75]);
    return { ...leg, ankle };
  }) as [Leg, Leg];

  // Hips in work trousers, then the shirted torso, flattened front to back: broad chest, narrower waist.
  const flat: [number, number, number] = [1, 1, 0.62];
  part(body, turned([[0.05, 0.8], [0.15, 0.83], [0.185, 0.9], [0.18, 0.98], [0, 0.98]]), [0, 0, 0], trousers, flat);
  part(body, new THREE.CylinderGeometry(0.185, 0.185, 0.05, 16), [0, 0.965, 0], material(BELT_COLOUR, { roughness: 0.6 }), [1, 1, 0.64]);
  part(
    chest,
    turned([[0, 0.93], [0.178, 0.94], [0.17, 1.06], [0.2, 1.24], [0.215, 1.38], [0.19, 1.47], [0.11, 1.52], [0.06, 1.54], [0, 1.54]]),
    [0, 0, 0],
    shirt,
    flat,
  );

  // Neck and head: a beard along the jaw, a nose, ears, eyes, and a knit cap with a folded brim.
  part(body, hangingTube(0.052, 0.058, 0.1), [0, 1.6, 0], skin);
  part(body, ball(0.105), [0, HEAD_MIDDLE_METRES, 0], skin, [0.88, 1.15, 1]);
  part(body, ball(0.09), [0, HEAD_MIDDLE_METRES - 0.075, 0.025], beard, [1.02, 0.78, 0.92]);
  part(body, ball(0.07), [0, HEAD_MIDDLE_METRES - 0.03, 0.06], beard, [1.15, 0.45, 0.6]);
  part(body, new THREE.ConeGeometry(0.018, 0.045, 8).rotateX(Math.PI / 2), [0, HEAD_MIDDLE_METRES + 0.005, 0.115], skin);
  for (const x of [0.093, -0.093]) part(body, ball(0.022), [x, HEAD_MIDDLE_METRES + 0.005, -0.005], skin, [0.5, 1.2, 0.9]);
  const eyes = material(EYE_COLOUR, { roughness: 0.3 });
  for (const x of [0.036, -0.036]) part(body, ball(0.011), [x, HEAD_MIDDLE_METRES + 0.03, 0.093], eyes);
  part(body, new THREE.SphereGeometry(0.106, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2), [0, HEAD_MIDDLE_METRES + 0.045, -0.005], cap, [0.92, 1.05, 1.02]);
  part(body, new THREE.CylinderGeometry(0.1, 0.1, 0.05, 14), [0, HEAD_MIDDLE_METRES + 0.055, -0.005], cap, [0.97, 1, 1.07]);

  // Arms: shirt sleeves down to the wrist, then bare hands.
  const [leftArm, rightArm] = [SHOULDER_SPREAD_METRES, -SHOULDER_SPREAD_METRES].map((x) => {
    const arm = limb(
      [x, SHOULDER_HEIGHT_METRES, 0],
      { length: UPPER_ARM_LENGTH_METRES, top: 0.062, bottom: 0.045 },
      { length: FOREARM_LENGTH_METRES, top: 0.045, bottom: 0.036 },
      shirt,
      chest,
    );
    part(arm.bend, ball(0.042), [0, -FOREARM_LENGTH_METRES - 0.045, 0], skin, [0.75, 1.25, 0.95]);
    return arm;
  }) as [Limb, Limb];

  // The axe: a slightly tapered handle with a steel head. It starts in the right hand, with the blade facing forward.
  const axe = new THREE.Group();
  part(axe, new THREE.CylinderGeometry(0.018, 0.022, 0.78, 8), [0, 0, 0], material(AXE_HANDLE_COLOUR, { roughness: 0.7 }));
  const steel = material(AXE_HEAD_COLOUR, { metalness: 0.7, roughness: 0.35 });
  part(axe, new THREE.BoxGeometry(0.035, 0.08, 0.07), [0, -0.33, 0], steel);
  part(axe, new THREE.CylinderGeometry(0.075, 0.075, 0.018, 3, 1, false, -Math.PI / 6, Math.PI * 2).rotateZ(Math.PI / 2), [0, -0.33, 0.08], steel, [1, 1.35, 1]);
  const axeInHand = { parent: rightArm.bend, position: new THREE.Vector3(0, -FOREARM_LENGTH_METRES - 0.3, 0.01), rotation: 0 };
  // While the right hand steadies the log, the axe hangs on the back, blade down.
  const axeOnBack = { parent: chest, position: new THREE.Vector3(0.06, 1.15, -0.16), rotation: 0.5 };
  function holdAxe(place: typeof axeInHand): void {
    place.parent.add(axe);
    axe.position.copy(place.position);
    axe.rotation.set(0, 0, place.rotation);
  }
  holdAxe(axeInHand);

  // The forest owns the log shape and disposes it, so the player does not.
  const shoulderLog = new THREE.Mesh(logShape.geometry, [material(LOG_COLOUR, { flatShading: true }), material(LOG_CUT_COLOUR, { flatShading: true })]);
  shoulderLog.position.set(SHOULDER_LOG_SPOT.x, SHOULDER_LOG_SPOT.y, SHOULDER_LOG_SPOT.z);
  shoulderLog.visible = false;
  chest.add(shoulderLog);

  let carrying = false;
  let walkedMetres: number | undefined;
  let working = false;
  /** The clock time while chopping, or undefined. */
  let choppingAt: number | undefined;

  /** Sets the arm and leg angles for what the player is doing now. */
  function poseLimbs(): void {
    const walking = walkedMetres !== undefined && !working;
    // One full turn of `stride` is one full stride. The left foot lands at the start of the turn, the right foot halfway.
    const stride = walking ? ((walkedMetres ?? 0) / STRIDE_METRES) * Math.PI * 2 : 0;
    /** How far back the left leg is, from -1 (forward) to 1 (back). */
    const legBack = (at: number): number => (walking ? -Math.cos(at) : 0);
    const swing = legBack(stride);
    // Chopping and splitting own the body's lean and height. Walking owns them otherwise.
    chest.rotation.y = 0;
    body.rotation.y = 0;
    body.rotation.z = 0;
    if (!working) {
      body.rotation.x = walking ? WALK_LEAN_RADIANS : 0;
      body.position.y = walking ? -WALK_BOB_METRES * (1 + Math.cos(stride * 2)) * 0.5 : 0;
    }
    legs.forEach((leg, index) => {
      leg.root.rotation.set(0, 0, 0);
      if (!walking) {
        leg.bend.rotation.x = 0.05;
        leg.ankle.rotation.x = -0.05;
        return;
      }
      placeFoot(leg, (stride / (Math.PI * 2) + (index === 0 ? 0 : 0.5)) % 1);
    });
    if (choppingAt !== undefined) {
      poseChop(choppingAt);
      return;
    }
    if (working) {
      leftArm.root.rotation.set(WORK_UPPER_ARM_RADIANS, 0, -0.4);
      rightArm.root.rotation.set(WORK_UPPER_ARM_RADIANS, 0, 0.4);
      leftArm.bend.rotation.x = WORK_ELBOW_RADIANS;
      rightArm.bend.rotation.x = WORK_ELBOW_RADIANS;
      return;
    }
    if (walking) {
      // The hips turn with the leg in front. The shoulders turn the other way, with the arm in front.
      body.rotation.y = swing * HIP_TWIST_RADIANS;
      chest.rotation.y = -swing * (HIP_TWIST_RADIANS + SHOULDER_TWIST_RADIANS);
      // The body tips over whichever foot is on the ground. The left foot is down for the first half of the stride.
      body.rotation.z = -Math.sin(stride) * WEIGHT_SWAY_RADIANS;
    }
    // Arms swing against the legs. Each elbow bends as its arm swings forward, a little after the shoulder.
    const elbow = (side: 1 | -1): number => -0.15 - Math.max(0, -side * legBack(stride - ELBOW_LAG_RADIANS)) * ELBOW_SWING_RADIANS;
    leftArm.root.rotation.set(-swing * ARM_SWING_RADIANS, 0, 0.08);
    leftArm.bend.rotation.x = elbow(-1);
    if (carrying) {
      rightArm.root.rotation.set(CARRY_UPPER_ARM_RADIANS, 0, 0);
      rightArm.bend.rotation.x = CARRY_ELBOW_RADIANS;
      return;
    }
    rightArm.root.rotation.set(swing * ARM_SWING_RADIANS, 0, -0.08);
    rightArm.bend.rotation.x = elbow(1);
  }
  /**
   * Bends a leg so its foot is where it should be `step` of the way through a stride, from 0 to 1. The foot lands ahead
   * of the hip at 0, stays put on the ground while the body passes over it, and leaves the ground behind the hip at 0.5.
   * Then it lifts and swings forward to land again.
   */
  function placeFoot(leg: Leg, step: number): void {
    const stepLength = FOOT_LANDS_AHEAD_METRES + FOOT_LEAVES_BEHIND_METRES;
    let ahead: number;
    let lift = 0;
    if (step < 0.5) {
      ahead = FOOT_LANDS_AHEAD_METRES - stepLength * (step / 0.5);
    } else {
      const swung = (step - 0.5) / 0.5;
      ahead = -FOOT_LEAVES_BEHIND_METRES + stepLength * easeInOut(swung);
      lift = Math.sin(swung * Math.PI) * STEP_LIFT_METRES;
    }
    // Where the ankle should be, from the hip, on the ground. Then turned into the leaning body's own frame.
    const lean = body.rotation.x;
    const hipUp = body.position.y + HIP_HEIGHT_METRES * Math.cos(lean);
    const hipAhead = HIP_HEIGHT_METRES * Math.sin(lean);
    const down = hipUp - ANKLE_HEIGHT_METRES - lift;
    const forward = ahead - hipAhead;
    const bodyDown = down * Math.cos(lean) + forward * Math.sin(lean);
    const bodyForward = -down * Math.sin(lean) + forward * Math.cos(lean);
    // Two-joint reach: the thigh points part way to the ankle, and the knee bends forward to make up the rest.
    const legLength = THIGH_LENGTH_METRES + SHIN_LENGTH_METRES;
    const wanted = Math.hypot(bodyDown, bodyForward);
    const reach = Math.min(wanted, legLength - 0.001);
    const towardAnkle = Math.atan2(-bodyForward, bodyDown);
    const thighOffset = Math.acos(
      (THIGH_LENGTH_METRES ** 2 + reach ** 2 - SHIN_LENGTH_METRES ** 2) / (2 * THIGH_LENGTH_METRES * reach),
    );
    const kneeInside = Math.acos(
      (THIGH_LENGTH_METRES ** 2 + SHIN_LENGTH_METRES ** 2 - reach ** 2) / (2 * THIGH_LENGTH_METRES * SHIN_LENGTH_METRES),
    );
    leg.root.rotation.x = towardAnkle - thighOffset;
    leg.bend.rotation.x = Math.PI - kneeInside;
    // The boot stays flat on the ground. When the leg cannot reach, the foot tips: onto the toe behind, onto the heel in front.
    const shortfall = wanted - reach;
    const tip = ahead < 0 ? Math.asin(Math.min(1, shortfall / TOE_REACH_METRES)) : -Math.asin(Math.min(1, shortfall / HEEL_REACH_METRES));
    leg.ankle.rotation.x = -(leg.root.rotation.x + leg.bend.rotation.x) - lean + tip;
  }

  const shoulders = { left: new THREE.Vector3(SHOULDER_SPREAD_METRES, SHOULDER_HEIGHT_METRES, 0), right: new THREE.Vector3(-SHOULDER_SPREAD_METRES, SHOULDER_HEIGHT_METRES, 0) };
  const elbowsPoint = { left: new THREE.Vector3(0.4, -1, -0.2).normalize(), right: new THREE.Vector3(-0.4, -1, -0.2).normalize() };
  const grip = new THREE.Vector3();
  const handle = new THREE.Vector3();
  const bladeFaces = new THREE.Vector3();
  const hand = new THREE.Vector3();
  const axeTurn = new THREE.Matrix4();
  const axisX = new THREE.Vector3();
  const axisY = new THREE.Vector3();

  /** Poses the body, arms, and axe `nowSeconds` into the chopping swing. */
  function poseChop(nowSeconds: number): void {
    const phase = (nowSeconds * CHOP_SWINGS_PER_SECOND) % 1;
    // `raised` runs from 0 at the strike to 1 with the axe raised. `rebound` shakes off the impact and dies away.
    let raised = 0;
    let rebound = 0;
    if (phase < CHOP_RAISED_SHARE) raised = easeInOut(phase / CHOP_RAISED_SHARE);
    else if (phase < CHOP_SWING_SHARE) raised = 1;
    else if (phase < CHOP_STRIKE_SHARE) raised = 1 - ((phase - CHOP_SWING_SHARE) / (CHOP_STRIKE_SHARE - CHOP_SWING_SHARE)) ** 2;
    else {
      const after = (phase - CHOP_STRIKE_SHARE) / (1 - CHOP_STRIKE_SHARE);
      rebound = (1 - after) ** 2 * Math.sin(after * Math.PI * 3);
    }
    const blend = (key: "chestYaw" | "hipYaw" | "lean" | "handleYaw" | "handlePitch"): number =>
      CHOP_STRIKE_POSE[key] + (CHOP_RAISED_POSE[key] - CHOP_STRIKE_POSE[key]) * raised;

    // The hips turn a little and the chest a lot, winding up against the feet, which stay planted apart.
    const hipYaw = blend("hipYaw");
    body.rotation.set(blend("lean") - rebound * CHOP_REBOUND_LEAN_RADIANS, hipYaw, 0);
    body.position.y = 0;
    chest.rotation.y = blend("chestYaw") - rebound * CHOP_REBOUND_RADIANS * 0.5;
    legs.forEach((leg, index) => leg.root.rotation.set(0, -hipYaw, index === 0 ? CHOP_STANCE_RADIANS : -CHOP_STANCE_RADIANS));

    // The handle swings about the grip point. The blade leads, facing the way the head moves.
    const yaw = blend("handleYaw") - rebound * CHOP_REBOUND_RADIANS;
    const pitch = blend("handlePitch");
    grip.lerpVectors(CHOP_STRIKE_POSE.grip, CHOP_RAISED_POSE.grip, raised);
    handle.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    bladeFaces.set(Math.cos(yaw), 0, -Math.sin(yaw));
    bladeFaces.addScaledVector(handle, -bladeFaces.dot(handle)).normalize();
    // The axe's own -y runs from knob to head, and its blade faces its +z.
    axisY.copy(handle).negate();
    axisX.crossVectors(axisY, bladeFaces);
    axeTurn.makeBasis(axisX, axisY, bladeFaces);
    axe.quaternion.setFromRotationMatrix(axeTurn);
    axe.position.copy(grip).addScaledVector(handle, CHOP_LEFT_HAND_METRES - 0.05 + AXE_KNOB_TO_MIDDLE_METRES);

    // Both hands hold the handle: the left near the knob, the right further up.
    reachFor(leftArm, shoulders.left, hand.copy(grip).addScaledVector(handle, CHOP_LEFT_HAND_METRES), elbowsPoint.left);
    const rightHandMetres = CHOP_RIGHT_HAND_STRIKE_METRES + (CHOP_RIGHT_HAND_RAISED_METRES - CHOP_RIGHT_HAND_STRIKE_METRES) * raised;
    reachFor(rightArm, shoulders.right, hand.copy(grip).addScaledVector(handle, rightHandMetres), elbowsPoint.right);
  }

  const armTurn = new THREE.Matrix4();
  const toHand = new THREE.Vector3();
  const elbowSide = new THREE.Vector3();
  const upperArm = new THREE.Vector3();
  const forearm = new THREE.Vector3();
  const bendSide = new THREE.Vector3();
  const across = new THREE.Vector3();
  /** Turns and bends an arm so its hand reaches `target`, in the chest's frame, with the elbow out toward `elbowPoints`. */
  function reachFor(arm: Limb, shoulder: THREE.Vector3, target: THREE.Vector3, elbowPoints: THREE.Vector3): void {
    const upperLength = UPPER_ARM_LENGTH_METRES;
    // The middle of the hand sits a little past the wrist.
    const lowerLength = FOREARM_LENGTH_METRES + 0.045;
    toHand.subVectors(target, shoulder);
    const reach = Math.min(toHand.length(), upperLength + lowerLength - 0.001);
    toHand.normalize();
    // Two-joint reach: the upper arm points part way to the hand, toward the elbow side, and the elbow bends to make up the rest.
    const offset = Math.acos(THREE.MathUtils.clamp((upperLength ** 2 + reach ** 2 - lowerLength ** 2) / (2 * upperLength * reach), -1, 1));
    elbowSide.copy(elbowPoints).addScaledVector(toHand, -elbowPoints.dot(toHand)).normalize();
    upperArm.copy(toHand).multiplyScalar(Math.cos(offset)).addScaledVector(elbowSide, Math.sin(offset));
    // The forearm runs from the elbow to the hand.
    forearm.copy(toHand).multiplyScalar(reach).addScaledVector(upperArm, -upperLength).normalize();
    // The arm hangs along its -y and its elbow bends toward its +z.
    bendSide.copy(forearm).addScaledVector(upperArm, -forearm.dot(upperArm));
    if (bendSide.lengthSq() < 1e-8) bendSide.copy(elbowSide).negate();
    bendSide.normalize();
    axisY.copy(upperArm).negate();
    across.crossVectors(axisY, bendSide);
    armTurn.makeBasis(across, axisY, bendSide);
    arm.root.quaternion.setFromRotationMatrix(armTurn);
    arm.bend.rotation.set(Math.atan2(-forearm.dot(bendSide), forearm.dot(upperArm)), 0, 0);
  }
  poseLimbs();

  return {
    group,
    setHeading(radians) {
      group.rotation.y = radians;
    },
    setCarryingLog(carryingNow) {
      if (carryingNow === carrying) return;
      carrying = carryingNow;
      shoulderLog.visible = carrying;
      if (choppingAt === undefined) holdAxe(carrying ? axeOnBack : axeInHand);
      poseLimbs();
    },
    setWalking(walked) {
      walkedMetres = walked;
      poseLimbs();
    },
    setChopping(nowSeconds) {
      const wasChopping = choppingAt !== undefined;
      choppingAt = nowSeconds;
      working = nowSeconds !== undefined;
      // While chopping, both hands hold the axe, so it hangs from the chest instead of the right hand.
      if (working && !wasChopping) chest.add(axe);
      if (!working && wasChopping) holdAxe(carrying ? axeOnBack : axeInHand);
      body.position.y = 0;
      if (!working) body.rotation.x = 0;
      poseLimbs();
    },
    setSplitting(nowSeconds) {
      if (choppingAt !== undefined) {
        choppingAt = undefined;
        holdAxe(carrying ? axeOnBack : axeInHand);
      }
      working = nowSeconds !== undefined;
      poseLimbs();
      if (nowSeconds === undefined) {
        body.rotation.x = 0;
        body.position.y = 0;
        return;
      }
      // Unlike the steady to-and-fro of chopping, splitting is a slow lift overhead, then a sharp drop with a dip at the knees.
      const phase = (nowSeconds * SPLIT_STRIKES_PER_SECOND) % 1;
      if (phase < SPLIT_LIFT_SHARE) {
        // Rise from the end of the last strike to leaning back with the axe overhead, easing in and out.
        const lift = easeInOut(phase / SPLIT_LIFT_SHARE);
        body.rotation.x = SPLIT_STRIKE_LEAN_RADIANS + (-SPLIT_LIFT_LEAN_RADIANS - SPLIT_STRIKE_LEAN_RADIANS) * lift;
        body.position.y = -SPLIT_STRIKE_DIP_METRES * (1 - lift);
      } else {
        // Drop fast, speeding up into the log.
        const strike = ((phase - SPLIT_LIFT_SHARE) / (1 - SPLIT_LIFT_SHARE)) ** 2;
        body.rotation.x = -SPLIT_LIFT_LEAN_RADIANS + (SPLIT_STRIKE_LEAN_RADIANS + SPLIT_LIFT_LEAN_RADIANS) * strike;
        body.position.y = -SPLIT_STRIKE_DIP_METRES * strike;
      }
    },
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const made of materials) made.dispose();
      for (const texture of textures) texture.dispose();
    },
  };
}

/** A muted red-and-black work-shirt plaid, drawn once on a canvas. */
function createPlaidTexture(): THREE.CanvasTexture {
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("Cannot draw the shirt plaid: no 2D canvas");
  context.fillStyle = SHIRT_COLOUR;
  context.fillRect(0, 0, size, size);
  context.fillStyle = SHIRT_STRIPE_COLOUR;
  context.globalAlpha = 0.6;
  context.fillRect(0, 8, size, 8);
  context.fillRect(8, 0, 8, size);
  context.globalAlpha = 0.3;
  context.fillRect(0, 24, size, 2);
  context.fillRect(24, 0, 2, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  return texture;
}

/** Eases a value from 0 to 1 so it starts and ends slowly. */
function easeInOut(t: number): number {
  return t * t * (3 - 2 * t);
}

// Draws the player with the code-built shape listed in asset-manifest.json as "player": a woodcutter with adult proportions,
// knees and elbows, a plaid work shirt, a knit cap, a beard, and an axe. The owner approved the asset.
// The chopping swing is the code-built "chop-animation". The splitting strike is the code-built "split-animation". The carried log is the code-built "logs" shape.
import * as THREE from "three";
import { createLogGeometry, LOG_COLOUR } from "./log-shape";

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
const STRIDE_METRES = 1.5;
/** How far the thighs swing while walking, in radians. */
const LEG_SWING_RADIANS = 0.5;
/** How far a knee bends as its leg swings back, per radian of swing. */
const KNEE_BEND_PER_SWING = 1.3;
/** How far the arms swing while walking, in radians. */
const ARM_SWING_RADIANS = 0.4;
/** Upper-arm and elbow angles that hold the axe out in front, for chopping and splitting. Negative turns forward. */
const WORK_UPPER_ARM_RADIANS = -1.05;
const WORK_ELBOW_RADIANS = -0.35;
/** Upper-arm and elbow angles that steady the log on the right shoulder. */
const CARRY_UPPER_ARM_RADIANS = -1.4;
const CARRY_ELBOW_RADIANS = -2.1;

/** How many times a second the player swings the axe. */
export const CHOP_SWINGS_PER_SECOND = 1.25;
/** How far the player leans into each swing, in radians. */
const CHOP_LEAN_RADIANS = 0.35;
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

export function createPlayerMesh(): PlayerMesh {
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

  /** Builds a limb: an upper tube from the root joint, then a lower tube from the bend joint. */
  function limb(
    at: [number, number, number],
    upper: { length: number; top: number; bottom: number },
    lower: { length: number; top: number; bottom: number },
    made: THREE.Material,
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
    body.add(root);
    return { root, bend };
  }

  // Legs: thigh, knee, shin, and a laced work boot that points forward.
  const legs = [HIP_SPREAD_METRES, -HIP_SPREAD_METRES].map((x) => {
    const leg = limb(
      [x, HIP_HEIGHT_METRES, 0],
      { length: THIGH_LENGTH_METRES, top: 0.09, bottom: 0.062 },
      { length: SHIN_LENGTH_METRES, top: 0.058, bottom: 0.045 },
      trousers,
    );
    part(leg.bend, hangingTube(0.058, 0.058, 0.1), [0, -SHIN_LENGTH_METRES + 0.08, 0], boots);
    part(leg.bend, ball(0.07), [0, -SHIN_LENGTH_METRES - 0.025, 0.045], boots, [0.8, 0.75, 1.75]);
    return leg;
  }) as [Limb, Limb];

  // Hips in work trousers, then the shirted torso, flattened front to back: broad chest, narrower waist.
  const flat: [number, number, number] = [1, 1, 0.62];
  part(body, turned([[0.05, 0.8], [0.15, 0.83], [0.185, 0.9], [0.18, 0.98], [0, 0.98]]), [0, 0, 0], trousers, flat);
  part(body, new THREE.CylinderGeometry(0.185, 0.185, 0.05, 16), [0, 0.965, 0], material(BELT_COLOUR, { roughness: 0.6 }), [1, 1, 0.64]);
  part(
    body,
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
  const axeOnBack = { parent: body, position: new THREE.Vector3(0.06, 1.15, -0.16), rotation: 0.5 };
  function holdAxe(place: typeof axeInHand): void {
    place.parent.add(axe);
    axe.position.copy(place.position);
    axe.rotation.set(0, 0, place.rotation);
  }
  holdAxe(axeInHand);

  const logGeometry = createLogGeometry();
  geometries.push(logGeometry);
  const shoulderLog = new THREE.Mesh(logGeometry, material(LOG_COLOUR, { flatShading: true }));
  shoulderLog.position.set(SHOULDER_LOG_SPOT.x, SHOULDER_LOG_SPOT.y, SHOULDER_LOG_SPOT.z);
  shoulderLog.visible = false;
  body.add(shoulderLog);

  let carrying = false;
  let walkedMetres: number | undefined;
  let working = false;

  /** Sets the arm and leg angles for what the player is doing now. */
  function poseLimbs(): void {
    const swing = walkedMetres === undefined || working ? 0 : Math.sin((walkedMetres / STRIDE_METRES) * Math.PI * 2);
    // A positive angle swings a leg back. The knee bends only while its leg is behind the body.
    legs.forEach((leg, index) => {
      const angle = (index === 0 ? swing : -swing) * LEG_SWING_RADIANS;
      leg.root.rotation.x = angle;
      leg.bend.rotation.x = Math.max(0, angle) * KNEE_BEND_PER_SWING + 0.05;
    });
    if (working) {
      leftArm.root.rotation.set(WORK_UPPER_ARM_RADIANS, 0, -0.4);
      rightArm.root.rotation.set(WORK_UPPER_ARM_RADIANS, 0, 0.4);
      leftArm.bend.rotation.x = WORK_ELBOW_RADIANS;
      rightArm.bend.rotation.x = WORK_ELBOW_RADIANS;
      return;
    }
    // Arms swing against the legs, with elbows bending a little more on the forward swing.
    const leftAngle = -swing * ARM_SWING_RADIANS;
    leftArm.root.rotation.set(leftAngle, 0, 0.08);
    leftArm.bend.rotation.x = -0.15 + Math.min(0, leftAngle) * 0.6;
    if (carrying) {
      rightArm.root.rotation.set(CARRY_UPPER_ARM_RADIANS, 0, 0);
      rightArm.bend.rotation.x = CARRY_ELBOW_RADIANS;
      return;
    }
    const rightAngle = swing * ARM_SWING_RADIANS;
    rightArm.root.rotation.set(rightAngle, 0, -0.08);
    rightArm.bend.rotation.x = -0.15 + Math.min(0, rightAngle) * 0.6;
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
      holdAxe(carrying ? axeOnBack : axeInHand);
      poseLimbs();
    },
    setWalking(walked) {
      walkedMetres = walked;
      poseLimbs();
    },
    setChopping(nowSeconds) {
      body.position.y = 0;
      working = nowSeconds !== undefined;
      poseLimbs();
      if (nowSeconds === undefined) {
        body.rotation.x = 0;
        return;
      }
      // Lean back to raise the axe, then forward into the strike.
      body.rotation.x = Math.sin(nowSeconds * CHOP_SWINGS_PER_SECOND * Math.PI * 2) * CHOP_LEAN_RADIANS;
    },
    setSplitting(nowSeconds) {
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

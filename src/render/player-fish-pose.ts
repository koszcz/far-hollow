// Builds the "fishing-animation" asset in asset-manifest.json. Added by fishing ticket 02. The owner approved it.
// The rod has no reel, so the player fishes the way people fish with a fixed line on a pole. They flick the rod back
// over the right shoulder, pause while the line straightens behind them, then drive it forward and stop it sharply
// so the line rolls out and lands on the water. They wait with the rod held out while the float bobs. When a fish
// bites, the float dips and the rod tip jerks down. The player snaps the rod up to set the hook, lifts the fish out of
// the water, swings it in on the line, and catches it in the left hand. Then they cast again.
// It is posed in code on top of the idle clip with the build pose's bones, so it has no clip of its own.
// The rod is the approved "fishing-rod", built by fishing-rod-model.ts. fishing-tackle.ts bends the rod and draws the
// line and the float. player-mesh.ts places them all from this pose.
import { scaleBuildPose, type BuildPose, type HandSpot } from "./player-build-pose";

/** Seconds a cast takes: swing the rod back, pause, drive it forward, and let the line land. */
export const FISH_CAST_SECONDS = 1.4;
/** Seconds from the bite to the fish in the left hand. It ends as the fish goes in the backpack. */
export const FISH_REEL_SECONDS = 1.6;
/** Seconds the player takes to lift the rod from standing when fishing starts, and to lower it when fishing stops. */
export const FISH_ENTER_SECONDS = 0.35;

/**
 * Where in a cast each phase ends, as shares of the cast. The player swings the rod back until `FISH_SWUNG_BACK_SHARE`,
 * pauses until `FISH_HOLD_SHARE`, drives it forward until `FISH_WHIPPED_SHARE`, and the line lands by `FISH_LANDED_SHARE`.
 * The rest of the cast settles into the wait.
 */
export const FISH_SWUNG_BACK_SHARE = 0.38;
export const FISH_HOLD_SHARE = 0.48;
export const FISH_WHIPPED_SHARE = 0.6;
export const FISH_LANDED_SHARE = 0.9;

/**
 * Where in the reel each phase ends, as shares of the reel. The float dips until `FISH_BITE_SHARE`. The player snaps the
 * rod up until `FISH_STRUCK_SHARE`. The fish clears the water by `FISH_OUT_OF_WATER_SHARE`. The rod is up by
 * `FISH_LIFTED_SHARE`, and the left hand catches the fish by the end.
 */
export const FISH_BITE_SHARE = 0.12;
export const FISH_STRUCK_SHARE = 0.24;
export const FISH_OUT_OF_WATER_SHARE = 0.4;
export const FISH_LIFTED_SHARE = 0.68;

/** Seconds one bob of the rod tip takes while the player waits. */
const BOB_SECONDS = 2.2;
/** How far the rod lifts and dips on each bob, in radians. */
const BOB_RADIANS = 0.04;
/** Seconds one bob of the float takes, and how far it rises and sinks, in metres. */
const FLOAT_BOB_SECONDS = 1.7;
const FLOAT_BOB_METRES = 0.006;
/** How far the float sinks when the fish bites, in metres. */
const FLOAT_DIP_METRES = 0.06;
/** How far up the rod the left hand grips, from the right hand at the butt, in metres. */
const LEFT_HAND_UP_ROD_METRES = 0.2;
/** How far the line hangs below the tip while it is drawn in, in metres: short for casting, long to swing the fish in. */
const LINE_HANG_CAST_METRES = 0.45;
const LINE_HANG_REEL_METRES = 1.65;
/** How far the slack line sags in the middle while the player waits, in metres. */
const LINE_SAG_WAIT_METRES = 0.22;
/** How high the end of the line flies above its straight path as it rolls out, in metres. */
const LINE_ARC_METRES = 0.5;
/** How far the caught fish swings forward and back on the line as it comes in, in metres. */
const FISH_SWING_METRES = 0.28;
/** How far the caught fish twists and kicks while it thrashes, in radians, and how many times a second. */
const FISH_THRASH_RADIANS = 0.55;
const FISH_THRASH_PER_SECOND = 3.2;
/** How far the rod tip bends while the fish fights, in radians, and how much the bend shakes as the fish thrashes. */
const ROD_BEND_FISH_RADIANS = 0.55;
const ROD_BEND_SHAKE_RADIANS = 0.06;
/** How far the rod tip lags behind as the rod drives forward, then springs past, in radians. */
const ROD_BEND_WHIP_RADIANS = 0.3;
const ROD_BEND_SPRING_RADIANS = 0.18;

/** The fishing pose at one moment: the body, and how the rod, line, float, and fish lie. Lengths are metres. */
export interface FishingPose {
  readonly body: BuildPose;
  /** How far the rod points up from level, in radians. Past a right angle, it leans back over the shoulder. */
  readonly rodLift: number;
  /** How far the rod leans out to the player's right, in radians, so it passes beside the head. */
  readonly rodLean: number;
  /** How far the rod tip bends, in radians. Positive bends it away from the way the rod lifts: down while it points ahead. */
  readonly rodBend: number;
  /** How far the line reaches, from 0 (hanging from the tip) to 1 (out to the float on the water). */
  readonly lineOut: number;
  /** How far the line hangs below the tip while it is drawn in. */
  readonly lineHang: number;
  /** How far the drawn-in line streams back behind the tip, from 0 (hanging straight down) to 1 (straight back). */
  readonly lineTrail: number;
  /** How high the end of the line flies above its straight path as it rolls out over the water. */
  readonly lineArc: number;
  /** How far the line sags in the middle. */
  readonly lineSag: number;
  /** How far the end of the line has moved to the left hand, from 0 to 1. */
  readonly lineInHand: number;
  /** How far the float rides up the line above the hook, from 0 (on the water at the end) to 1 (hanging on the line). */
  readonly floatUp: number;
  /** How far the float sinks below where it floats. Negative lifts it. */
  readonly floatDip: number;
  /** Whether the caught fish hangs from the end of the line. */
  readonly fishShown: boolean;
  /** How far the fish twists and kicks on the line, in radians. */
  readonly fishThrash: number;
  /** How far the fish swings forward on the line, the way the player faces. Negative swings it back. */
  readonly fishSwing: number;
}

/** One key moment: where the right hand holds the butt, how the rod lies, and how the body leans. Angles are radians. */
interface Key {
  readonly hand: HandSpot;
  readonly rodLift: number;
  readonly rodLean: number;
  /** How far the hips move back, putting the weight on the back foot. Negative moves them forward. */
  readonly hipsBack: number;
  readonly hipsLean: number;
  readonly chestLean: number;
  readonly headTilt: number;
  /** How far the left hand has let go of the rod for `CATCH_HAND`, from 0 to 1. */
  readonly leftOff: number;
}

/** Where the left hand catches the fish: in front of the chest, a little left of the middle. */
const CATCH_HAND: HandSpot = { forward: 0.44, height: 1.0, spread: 0.06 };

/** Waiting: the rod held out over the water, the hands at the chest, the eyes on the float. */
const WAIT: Key = {
  hand: { forward: 0.34, height: 1.0, spread: 0.1 },
  rodLift: 0.55,
  rodLean: 0.08,
  hipsBack: 0,
  hipsLean: 0,
  chestLean: 0.05,
  headTilt: 0.08,
  leftOff: 0,
};
/** Swung back: the hands up by the right ear, the rod leaning back past the shoulder, the weight on the back foot. */
const SWUNG_BACK: Key = {
  hand: { forward: 0.1, height: 1.48, spread: 0.16 },
  rodLift: 1.95,
  rodLean: 0.35,
  hipsBack: 0.04,
  hipsLean: -0.05,
  chestLean: -0.14,
  headTilt: -0.12,
  leftOff: 0,
};
/** Driven forward: the arms out, the rod stopped low over the water, the weight on the front foot. */
const WHIPPED: Key = {
  hand: { forward: 0.48, height: 1.1, spread: 0.08 },
  rodLift: 0.5,
  rodLean: 0.05,
  hipsBack: -0.04,
  hipsLean: 0.06,
  chestLean: 0.16,
  headTilt: 0.12,
  leftOff: 0,
};
/** The bite: the rod tip jerked down, the hands pulled forward a little. */
const BITE: Key = { ...WAIT, hand: { forward: 0.38, height: 0.97, spread: 0.1 }, rodLift: 0.45 };
/** Struck: the rod snapped up to set the hook, the body rocked back against the fish. */
const STRUCK: Key = {
  hand: { forward: 0.26, height: 1.18, spread: 0.1 },
  rodLift: 1.05,
  rodLean: 0.1,
  hipsBack: 0.04,
  hipsLean: -0.04,
  chestLean: -0.1,
  headTilt: -0.02,
  leftOff: 0,
};
/** Lifted: the rod high, the hands drawn back and up, the fish swinging in. */
const LIFTED: Key = {
  hand: { forward: 0.22, height: 1.3, spread: 0.12 },
  rodLift: 1.25,
  rodLean: 0.15,
  hipsBack: 0.05,
  hipsLean: -0.04,
  chestLean: -0.14,
  headTilt: -0.15,
  leftOff: 0,
};
/** Caught: the rod still up in the right hand, the fish in the left. Each cast starts here. */
const CAUGHT: Key = {
  hand: { forward: 0.24, height: 1.26, spread: 0.14 },
  rodLift: 1.2,
  rodLean: 0.2,
  hipsBack: 0.02,
  hipsLean: 0,
  chestLean: -0.04,
  headTilt: 0.05,
  leftOff: 1,
};

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const easeOut = (t: number): number => t * (2 - t);
const smoothstep = (t: number): number => t * t * (3 - 2 * t);
const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));
/** How far through the span from `from` to `to` the value `share` is, from 0 to 1. */
const within = (share: number, from: number, to: number): number => clamp01((share - from) / (to - from));

function blendKeys(a: Key, b: Key, t: number): Key {
  return {
    hand: { forward: lerp(a.hand.forward, b.hand.forward, t), height: lerp(a.hand.height, b.hand.height, t), spread: lerp(a.hand.spread, b.hand.spread, t) },
    rodLift: lerp(a.rodLift, b.rodLift, t),
    rodLean: lerp(a.rodLean, b.rodLean, t),
    hipsBack: lerp(a.hipsBack, b.hipsBack, t),
    hipsLean: lerp(a.hipsLean, b.hipsLean, t),
    chestLean: lerp(a.chestLean, b.chestLean, t),
    headTilt: lerp(a.headTilt, b.headTilt, t),
    leftOff: lerp(a.leftOff, b.leftOff, t),
  };
}

/**
 * The body for a key. The right hand holds the butt. The left hand grips the rod a little further up it, or lets go to
 * catch the fish. A left-hand spot's `spread` is towards the player's left, so the rod's lean to the right counts against it.
 */
function bodyFor(key: Key): BuildPose {
  const up = LEFT_HAND_UP_ROD_METRES;
  const onRod: HandSpot = {
    forward: key.hand.forward + up * Math.cos(key.rodLift),
    height: key.hand.height + up * Math.cos(key.rodLean) * Math.sin(key.rodLift),
    spread: -key.hand.spread - up * Math.sin(key.rodLean) * Math.sin(key.rodLift),
  };
  return {
    hipsDrop: 0,
    hipsBack: key.hipsBack,
    hipsLean: key.hipsLean,
    chestLean: key.chestLean,
    headTilt: key.headTilt,
    reach: 1,
    rightHand: key.hand,
    hands: {
      forward: lerp(onRod.forward, CATCH_HAND.forward, key.leftOff),
      height: lerp(onRod.height, CATCH_HAND.height, key.leftOff),
      spread: lerp(onRod.spread, CATCH_HAND.spread, key.leftOff),
    },
  };
}

/** Everything but the body, as it lies while the player waits with the line out. */
interface Gear {
  readonly rodBend: number;
  readonly lineOut: number;
  readonly lineHang: number;
  readonly lineTrail: number;
  readonly lineArc: number;
  readonly lineSag: number;
  readonly lineInHand: number;
  readonly floatUp: number;
  readonly floatDip: number;
  readonly fishShown: boolean;
  readonly fishThrash: number;
  readonly fishSwing: number;
}

function poseOf(key: Key, gear: Gear): FishingPose {
  return { body: bodyFor(key), rodLift: key.rodLift, rodLean: key.rodLean, ...gear };
}

/**
 * The fishing pose `sinceCast` seconds after the latest cast began, with `toBite` seconds left until a fish bites.
 * `sinceStart` is the seconds since the player started fishing, for lifting the rod from standing.
 * Each cast starts from the caught pose, so the reel flows into the next cast without a jump.
 */
export function fishPoseAt(sinceCast: number, toBite: number, sinceStart = Infinity): FishingPose {
  const pose = poseInCast(Math.max(0, sinceCast), Math.max(0, toBite));
  if (sinceStart >= FISH_ENTER_SECONDS) return pose;
  return { ...pose, body: scaleBuildPose(pose.body, smoothstep(clamp01(sinceStart / FISH_ENTER_SECONDS))) };
}

function poseInCast(sinceCast: number, toBite: number): FishingPose {
  if (toBite < FISH_REEL_SECONDS) return poseInReel(sinceCast, 1 - toBite / FISH_REEL_SECONDS);
  const share = sinceCast / FISH_CAST_SECONDS;
  if (share >= 1) return poseOf(waitKey(sinceCast), waitGear(sinceCast));
  // The left hand lets go of the line it held the fish by, and goes back to the rod.
  const letGo = smoothstep(within(share, 0, FISH_SWUNG_BACK_SHARE * 0.6));
  const drawnIn: Gear = {
    rodBend: 0,
    lineOut: 0,
    lineHang: lerp(LINE_HANG_REEL_METRES, LINE_HANG_CAST_METRES, letGo),
    lineTrail: 0,
    lineArc: 0,
    lineSag: 0.02,
    lineInHand: 1 - letGo,
    floatUp: 1,
    floatDip: 0,
    fishShown: false,
    fishThrash: 0,
    fishSwing: 0,
  };
  if (share < FISH_SWUNG_BACK_SHARE) {
    // The back cast: the rod rises past the shoulder. Its tip lags, bending a little forward, and the line streams back.
    const t = share / FISH_SWUNG_BACK_SHARE;
    const key = blendKeys(CAUGHT, SWUNG_BACK, easeInOut(t));
    return poseOf(key, { ...drawnIn, rodBend: lerp(0.12, 0, t) + 0.1 * Math.sin(Math.PI * t), lineTrail: 0.6 * smoothstep(t) });
  }
  if (share < FISH_HOLD_SHARE) {
    // The pause: the rod drifts back a touch while the line straightens out behind.
    const t = (share - FISH_SWUNG_BACK_SHARE) / (FISH_HOLD_SHARE - FISH_SWUNG_BACK_SHARE);
    const key = { ...SWUNG_BACK, rodLift: SWUNG_BACK.rodLift + 0.05 * Math.sin((Math.PI / 2) * t) };
    return poseOf(key, { ...drawnIn, lineTrail: lerp(0.6, 1, smoothstep(t)) });
  }
  if (share < FISH_WHIPPED_SHARE) {
    // The forward cast speeds up all the way to the stop. The tip lags behind and the line follows it over.
    const t = (share - FISH_HOLD_SHARE) / (FISH_WHIPPED_SHARE - FISH_HOLD_SHARE);
    const back = { ...SWUNG_BACK, rodLift: SWUNG_BACK.rodLift + 0.05 };
    const key = blendKeys(back, WHIPPED, t * t);
    return poseOf(key, { ...drawnIn, rodBend: -ROD_BEND_WHIP_RADIANS * Math.sin(Math.PI * t), lineTrail: 1 - smoothstep(t) });
  }
  // The rod stops, its tip springs past and shakes still, the line rolls out over the water and lands, and the
  // body settles into the wait.
  const t = (share - FISH_WHIPPED_SHARE) / (1 - FISH_WHIPPED_SHARE);
  const flight = easeOut(within(share, FISH_WHIPPED_SHARE, FISH_LANDED_SHARE));
  const key = blendKeys(WHIPPED, waitKey(sinceCast), easeInOut(t));
  const wait = waitGear(sinceCast);
  return poseOf(key, {
    ...wait,
    rodBend: ROD_BEND_SPRING_RADIANS * (1 - t) ** 2 * Math.sin(t * Math.PI * 3),
    lineOut: flight,
    lineHang: LINE_HANG_CAST_METRES,
    lineArc: LINE_ARC_METRES * Math.sin(Math.PI * flight),
    lineSag: lerp(0.02, wait.lineSag, smoothstep(within(share, FISH_LANDED_SHARE * 0.95, 1))),
    floatUp: 1 - smoothstep(within(flight, 0.85, 1)),
  });
}

/** The reel, `share` of the way from the bite to the fish in the left hand. */
function poseInReel(sinceCast: number, share: number): FishingPose {
  const wait = waitGear(sinceCast);
  // The fish thrashes from the strike until the left hand holds it, and the rod shakes with it.
  const thrash = Math.sin(sinceCast * Math.PI * 2 * FISH_THRASH_PER_SECOND);
  const fighting = within(share, FISH_BITE_SHARE, FISH_STRUCK_SHARE) * (1 - smoothstep(within(share, FISH_LIFTED_SHARE, 1)));
  // Out of the water, the fish swings in on the line and its swing dies away as the hand takes it.
  const swing = within(share, FISH_OUT_OF_WATER_SHARE, 1);
  const fishSwing = FISH_SWING_METRES * (1 - swing) ** 2 * Math.sin(swing * Math.PI * 3);
  const base: Gear = {
    ...wait,
    lineHang: LINE_HANG_REEL_METRES,
    fishThrash: FISH_THRASH_RADIANS * thrash * (1 - 0.7 * smoothstep(within(share, FISH_LIFTED_SHARE, 1))),
    fishSwing,
  };
  if (share < FISH_BITE_SHARE) {
    // The bite: the float bobs twice and goes under, and the rod tip jerks down with it.
    const t = share / FISH_BITE_SHARE;
    const key = blendKeys(waitKey(sinceCast), BITE, t * t);
    return poseOf(key, {
      ...base,
      rodBend: 0.25 * t * t,
      floatDip: wait.floatDip + FLOAT_DIP_METRES * (t * t + 0.3 * Math.sin(t * Math.PI * 4) * (1 - t)),
      fishThrash: 0,
    });
  }
  const shake = ROD_BEND_SHAKE_RADIANS * thrash * fighting;
  if (share < FISH_STRUCK_SHARE) {
    // The strike: the player snaps the rod up to set the hook. The rod bends hard against the fish.
    const t = (share - FISH_BITE_SHARE) / (FISH_STRUCK_SHARE - FISH_BITE_SHARE);
    const key = blendKeys(BITE, STRUCK, t * t);
    return poseOf(key, {
      ...base,
      rodBend: lerp(0.25, ROD_BEND_FISH_RADIANS, t) + shake,
      lineSag: lerp(wait.lineSag, 0, smoothstep(t)),
      floatDip: wait.floatDip + FLOAT_DIP_METRES * (1 + t),
      fishThrash: 0,
    });
  }
  // The lift: the rod rises, drawing the fish out of the water. The float comes up the line with it.
  const out = smoothstep(within(share, FISH_STRUCK_SHARE, FISH_LIFTED_SHARE));
  const surfaced = smoothstep(within(share, FISH_STRUCK_SHARE, FISH_OUT_OF_WATER_SHARE));
  const gear: Gear = {
    ...base,
    lineOut: 1 - out,
    lineSag: 0,
    floatUp: surfaced,
    floatDip: (wait.floatDip + FLOAT_DIP_METRES * 2) * (1 - surfaced),
    fishShown: true,
  };
  if (share < FISH_LIFTED_SHARE) {
    const t = (share - FISH_STRUCK_SHARE) / (FISH_LIFTED_SHARE - FISH_STRUCK_SHARE);
    const key = blendKeys(STRUCK, LIFTED, easeInOut(t));
    return poseOf(key, { ...gear, rodBend: lerp(ROD_BEND_FISH_RADIANS, 0.35, t) + shake });
  }
  // The catch: the left hand lets go of the rod and takes the fish as it swings in. The rod eases as the hand takes the weight.
  const t = (share - FISH_LIFTED_SHARE) / (1 - FISH_LIFTED_SHARE);
  const key = blendKeys(LIFTED, CAUGHT, easeInOut(t));
  return poseOf(key, { ...gear, rodBend: lerp(0.35, 0.12, smoothstep(t)) + shake, lineSag: 0.02 * t, lineInHand: smoothstep(t) });
}

/** The wait, with the rod tip bobbing gently. */
function waitKey(sinceCast: number): Key {
  const bob = Math.sin(((sinceCast - FISH_CAST_SECONDS) / BOB_SECONDS) * Math.PI * 2) * BOB_RADIANS;
  return { ...WAIT, rodLift: WAIT.rodLift + bob };
}

/** The line out on the water, slack, with the float bobbing on it. */
function waitGear(sinceCast: number): Gear {
  return {
    rodBend: 0,
    lineOut: 1,
    lineHang: LINE_HANG_CAST_METRES,
    lineTrail: 0,
    lineArc: 0,
    lineSag: LINE_SAG_WAIT_METRES,
    lineInHand: 0,
    floatUp: 0,
    floatDip: FLOAT_BOB_METRES * Math.sin((sinceCast / FLOAT_BOB_SECONDS) * Math.PI * 2),
    fishShown: false,
    fishThrash: 0,
    fishSwing: 0,
  };
}

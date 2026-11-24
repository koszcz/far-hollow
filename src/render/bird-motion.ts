// Moves the "birds" listed in asset-manifest.json (approved). bird-shape.ts poses a bird from the BirdPose these functions return.
// How a real songbird moves:
// - It flies in bursts. A few quick wing beats lift it, then it tucks its wings for a moment and dips, then beats again.
// - Each beat has a fast downstroke with the wing spread, and a slower upstroke with the outer wing bent back and down.
// - It tucks its legs up in flight. To land, it raises its wings, spreads them to brake, and puts its legs down.
// - On the ground, it pecks by tipping forward at the hips while its feet stay put. Its head jabs down fast and comes up slower.
//   Between pecks it looks to one side, or makes a small hop on the spot.
// Every function here is pure. bird-life.ts calls them for the birds in the game, and the asset showcase calls them for its loop.
import { easeInOut, smoothstep } from "./easing";

/**
 * How a bird is posed. Every value blends in a straight line, so any two poses blend without a jump.
 * - flap: how far the wings are raised, from -1 (down) to 1 (up).
 * - tipBend: how far the outer half of each wing bends, from -1 (back and down, on the upstroke) to 0 (straight).
 * - fold: how far the wings fold back along the body, from 0 (spread) to 1 (folded).
 * - legsDown: from 0 (tucked up under the body, in flight) to 1 (down, standing).
 * - peck: how far the bird tips forward at the hips, from about -0.3 (leaning back) to 1 (beak at the ground).
 * - headTurn: how far the head turns, from -1 (to its right) to 1 (to its left).
 * - lift: how far the whole bird rises above where it is placed, in metres at its real size.
 */
export interface BirdPose {
  readonly flap: number;
  readonly tipBend: number;
  readonly fold: number;
  readonly legsDown: number;
  readonly peck: number;
  readonly headTurn: number;
  readonly lift: number;
}

/** Standing on the ground with its wings folded and its head up. */
export const GROUND_REST_POSE: BirdPose = { flap: 0, tipBend: 0, fold: 1, legsDown: 1, peck: 0, headTurn: 0, lift: 0 };
/** About to touch down: wings raised and spread to brake, legs down, body leaning back. Take-off starts from here too. */
export const LANDING_POSE: BirdPose = { flap: 0.8, tipBend: 0, fold: 0, legsDown: 1, peck: -0.3, headTurn: 0, lift: 0 };

/** One wing beat: the downstroke takes this share of it, the upstroke the rest. */
export const DOWNSTROKE_SHARE = 0.4;
/** A burst of flight is this many wing beats, then a glide with the wings tucked for GLIDE_SECONDS. */
const BEATS_PER_BURST = 3;
const GLIDE_SECONDS = 0.35;
/** At the start and end of the glide, the wings fold and spread over this many seconds. */
const TUCK_SECONDS = 0.08;
/** How far the bird rises in a burst of beats, and dips in the glide that follows, in metres. */
const BURST_RISE_METRES = 0.05;
const GLIDE_DIP_METRES = 0.06;
/** How far the body bobs against each beat, in metres: up as the wings go down. */
const BEAT_BOB_METRES = 0.003;

/** A take-off blends from the pose on the ground into flight over this many seconds. */
export const TAKE_OFF_SECONDS = 0.25;
/** A landing bird blends into LANDING_POSE over this many seconds before it touches down. */
export const LANDING_SECONDS = 0.35;
/** After it touches down, a bird settles from LANDING_POSE into its pecking over this many seconds. */
const SETTLE_SECONDS = 0.3;

/** A peck, in seconds: a short lean back, a fast jab down, a hold at the ground, and a slower return. */
const PECK = { lean: 0.12, jab: 0.07, hold: 0.06, back: 0.15 };
const PECK_LEAN = -0.15;
/** What a bird does after each peck, in turn: look to its left, hop, look to its right, then stay still. */
const AFTER_PECK = ["lookLeft", "hop", "lookRight", "still"] as const;
/** The look or hop after a peck starts this many seconds into the peck's period. */
const AFTER_PECK_STARTS_SECONDS = 0.5;
/** A look: the head turns over `turn` seconds, holds, and turns back over `turn` seconds. */
const LOOK = { turn: 0.1, hold: 0.3 };
/** A hop: in the air for `air` seconds, then one small bounce a fifth as high for `bounce` seconds. */
const HOP = { air: 0.18, bounce: 0.06, metres: 0.025 };
/** The shortest pecking period that fits a peck and the look or hop after it, in seconds. */
export const SHORTEST_PECK_PERIOD_SECONDS = AFTER_PECK_STARTS_SECONDS + 2 * LOOK.turn + LOOK.hold + 0.1;

/** Blends from pose `a` (share 0) to pose `b` (share 1). */
export function blendPoses(a: BirdPose, b: BirdPose, share: number): BirdPose {
  const mix = (from: number, to: number): number => from + (to - from) * share;
  return {
    flap: mix(a.flap, b.flap),
    tipBend: mix(a.tipBend, b.tipBend),
    fold: mix(a.fold, b.fold),
    legsDown: mix(a.legsDown, b.legsDown),
    peck: mix(a.peck, b.peck),
    headTurn: mix(a.headTurn, b.headTurn),
    lift: mix(a.lift, b.lift),
  };
}

const clamp01 = (t: number): number => Math.min(Math.max(t, 0), 1);
/** Where `t` is in a phase from `start` that lasts `length`, from 0 to 1. */
const within = (t: number, start: number, length: number): number => clamp01((t - start) / length);

/** One wing beat, `share` of the way through it. It starts and ends with the wings up. */
function wingBeat(share: number): { flap: number; tipBend: number } {
  if (share < DOWNSTROKE_SHARE) return { flap: 1 - 2 * easeInOut(share / DOWNSTROKE_SHARE), tipBend: 0 };
  const t = (share - DOWNSTROKE_SHARE) / (1 - DOWNSTROKE_SHARE);
  return { flap: -1 + 2 * easeInOut(t), tipBend: -Math.sin(t * Math.PI) };
}

/**
 * A flying bird `seconds` into its flight, beating its wings `beatsPerSecond` times a second, starting `phase` (0 to 1)
 * of the way into a beat. When `bursts` is set, it flies in bursts of beats with a glide between them.
 */
export function flightPose(seconds: number, beatsPerSecond: number, phase: number, bursts: boolean): BirdPose {
  const flying = { fold: 0, legsDown: 0, peck: 0, headTurn: 0 };
  if (!bursts) {
    const beat = wingBeat((((seconds * beatsPerSecond + phase) % 1) + 1) % 1);
    return { ...flying, ...beat, lift: -beat.flap * BEAT_BOB_METRES };
  }
  const beatingSeconds = BEATS_PER_BURST / beatsPerSecond;
  const cycleSeconds = beatingSeconds + GLIDE_SECONDS;
  const into = (((seconds + phase * cycleSeconds) % cycleSeconds) + cycleSeconds) % cycleSeconds;
  if (into < beatingSeconds) {
    const beat = wingBeat((into * beatsPerSecond) % 1);
    const rise = BURST_RISE_METRES * Math.sin((into / beatingSeconds) * Math.PI);
    return { ...flying, ...beat, lift: rise - beat.flap * BEAT_BOB_METRES };
  }
  // The glide: the wings fold from the top of the last beat, stay tucked, and spread again for the next downstroke.
  const glide = into - beatingSeconds;
  const fold = smoothstep(within(glide, 0, TUCK_SECONDS)) * (1 - smoothstep(within(glide, GLIDE_SECONDS - TUCK_SECONDS, TUCK_SECONDS)));
  const dip = GLIDE_DIP_METRES * Math.sin((glide / GLIDE_SECONDS) * Math.PI);
  return { ...flying, flap: 1, tipBend: 0, fold, lift: -dip - BEAT_BOB_METRES };
}

/**
 * A flight that may start on the ground and may end with a landing. `startPose` is how the bird stood when it took off,
 * or undefined when the flight starts in the air. `secondsLeft` is how long until it touches down, or undefined when it
 * does not land.
 */
export function flightLegPose(flying: BirdPose, elapsed: number, startPose: BirdPose | undefined, secondsLeft: number | undefined): BirdPose {
  let pose = flying;
  if (startPose !== undefined) pose = blendPoses(startPose, pose, smoothstep(within(elapsed, 0, TAKE_OFF_SECONDS)));
  if (secondsLeft !== undefined) pose = blendPoses(pose, LANDING_POSE, smoothstep(1 - within(secondsLeft, 0, LANDING_SECONDS)));
  return pose;
}

/** How far the beak is down, `t` seconds into a peck. It is 0 before and after. */
function peckAt(t: number): number {
  const jabStarts = PECK.lean;
  const holdStarts = jabStarts + PECK.jab;
  const backStarts = holdStarts + PECK.hold;
  if (t < jabStarts) return PECK_LEAN * easeInOut(within(t, 0, PECK.lean));
  if (t < holdStarts) return PECK_LEAN + (1 - PECK_LEAN) * within(t, jabStarts, PECK.jab) ** 2;
  if (t < backStarts) return 1;
  return 1 - easeInOut(within(t, backStarts, PECK.back));
}

/** How far the head is turned, `t` seconds into a look. It is 0 before and after. */
function lookAt(t: number): number {
  return smoothstep(within(t, 0, LOOK.turn)) - smoothstep(within(t, LOOK.turn + LOOK.hold, LOOK.turn));
}

/** How high the bird is, in metres, `t` seconds into a hop. It is 0 before and after. */
function hopAt(t: number): number {
  if (t <= 0 || t >= HOP.air + HOP.bounce) return 0;
  if (t < HOP.air) return HOP.metres * Math.sin((t / HOP.air) * Math.PI);
  return (HOP.metres / 5) * Math.sin(((t - HOP.air) / HOP.bounce) * Math.PI);
}

/**
 * A bird on the ground `seconds` after it touched down. It pecks once every `periodSeconds`, starting `phase` (0 to 1) of
 * the way into a period, and settles from LANDING_POSE first.
 */
export function groundPose(seconds: number, periodSeconds: number, phase: number): BirdPose {
  const period = Math.max(periodSeconds, SHORTEST_PECK_PERIOD_SECONDS);
  const t = seconds + phase * period;
  const count = Math.floor(t / period);
  const into = t - count * period;
  const after = AFTER_PECK[count % AFTER_PECK.length];
  const afterInto = into - AFTER_PECK_STARTS_SECONDS;
  const look = after === "lookLeft" ? lookAt(afterInto) : after === "lookRight" ? -lookAt(afterInto) : 0;
  const cycle: BirdPose = { ...GROUND_REST_POSE, peck: peckAt(into), headTurn: look, lift: after === "hop" ? hopAt(afterInto) : 0 };
  return blendPoses(LANDING_POSE, cycle, smoothstep(within(seconds, 0, SETTLE_SECONDS)));
}

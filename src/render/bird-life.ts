// Decides where the birds are and what each one does. It draws nothing: bird-meshes.ts draws the birds.
// - Up to 3 flocks of 3 to 5 birds fly over the treetops, each on a straight line that passes near the player.
// - Up to 6 birds peck on the ground in clearings near the player. They fly in to land, and fly off when the player comes
//   within 6 m or the spot stops being a place a bird may land, such as when a fire is lit nearby.
// - A bird that flies off lands in another clearing or flies away over the trees.
// - Birds show only by day. In rain they leave within a few seconds, and they come back gradually after it stops.
//   Once they have faded out, in rain or at night, every bird is gone, so none flies on unseen.
// - A bird flying in to land checks its spot until it touches down. If the spot is refused, it goes elsewhere.
// Birds are only for looks. Game logic never sees them, they are never saved, and they start in new random places on
// every load, because the renderer passes in Math.random.
import { groundDistance, stepAlongHeading, headingToward, randomPointAround, type GroundPoint } from "../sim/ground-point";
import { randomBetween, type Random } from "../sim/random";
import { flightLegPose, flightPose, groundPose, SHORTEST_PECK_PERIOD_SECONDS, type BirdPose } from "./bird-motion";
import { createEasedShare } from "./eased-share";

/** The most flocks in the sky at once. */
export const MOST_FLOCKS = 3;
/** How many birds fly in one flock. */
export const FLOCK_SIZE = { min: 3, max: 5 };
/** The most birds on the ground near the player at once. */
export const MOST_GROUND_BIRDS = 6;
/** A bird on the ground flies off when the player comes this close, in metres. */
export const FLY_OFF_METRES = 6;
/** No bird lands this close to a lit fire, in metres. */
export const LIT_FIRE_GAP_METRES = 8;

/** Flocks fly this high above the ground, in metres, plus up to TREETOP_SPREAD_METRES more. Trees grow up to about 14 m. */
const TREETOP_METRES = 16;
const TREETOP_SPREAD_METRES = 6;
const FLOCK_METRES_PER_SECOND = 9;
/** A flock's line is this long, in metres, and passes this close to the player at most. */
const FLOCK_PATH_METRES = 220;
const FLOCK_PASS_METRES = 50;
/** Where each bird flies in its flock, as metres to the side, behind, and above the flock's middle. */
const FLOCK_SPREAD_METRES = 2.5;
/** Birds land this far from the player, in metres. Farther away they are too small to see. */
const GROUND_RADIUS_METRES = { min: 8, max: 20 };
/** How many spots a step tries when it looks for one where a bird may land. */
const LANDING_TRIES = 12;
const GROUND_BIRD_METRES_PER_SECOND = 7;
/** A landing bird starts this far away, in metres, and this high above the ground. */
const LANDING_FROM = { metres: 18, height: 9 };
/** A bird that flies away over the trees ends this far away, in metres, before it vanishes. */
const FLY_AWAY_METRES = 45;
/** A bird that flies off lands in another clearing this often. Otherwise it flies away over the trees. */
const LAND_AGAIN_SHARE = 0.5;
/** Below this much daylight, from 0 (night) to 1 (full day), no new birds come: it is too dark for them. */
const LEAST_DAYLIGHT = 0.15;
/** A new flock or a new bird on the ground arrives after a pause picked between these, in seconds. */
const ARRIVAL_PAUSE_SECONDS = { min: 1, max: 6 };
/** In rain, birds leave over this many seconds. After rain, they come back over this many. */
const RAIN_LEAVE_SECONDS = 3;
const RETURN_SECONDS = 90;
/** How many wing beats a flying bird makes per second. */
const FLAPS_PER_SECOND = { min: 5, max: 8 };
/** A bird on the ground pecks once in each of these periods, in seconds, and looks around or hops between pecks. */
const PECK_PERIOD_SECONDS = { min: SHORTEST_PECK_PERIOD_SECONDS, max: 2.6 };

/** What the birds need to know about the valley around them. */
export interface BirdSurroundings {
  /** How much daylight there is, from 0 (night) to 1 (full day). */
  readonly daylight: number;
  readonly raining: boolean;
  /** Where the player stands. Undefined before the player is placed. */
  readonly player: GroundPoint | undefined;
  /** Whether a bird may land on this spot. See birdMayLandAt. */
  readonly canLandAt: (spot: GroundPoint) => boolean;
  readonly groundHeightAt: (x: number, z: number) => number;
}

/** One bird as it is drawn now. Heading is in radians about the vertical axis, from +z toward +x. */
export interface DrawnBird {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly heading: number;
  readonly flying: boolean;
  /** How the bird holds its wings, legs, and head. See bird-motion.ts. */
  readonly pose: BirdPose;
}

export interface BirdLife {
  /** Moves every bird on by `seconds`. */
  step(seconds: number, surroundings: BirdSurroundings): void;
  /** How strongly birds show, from 0 (gone) to 1. It follows daylight and fades in rain. */
  visibility(): number;
  /** The birds in each flock in the sky. */
  flocks(): DrawnBird[][];
  /** The birds near the player that land, peck, or fly off. */
  groundBirds(): DrawnBird[];
}

/** The ground near a spot, as the landing rule sees it. */
export interface LandingGround {
  readonly isClearing: (spot: GroundPoint) => boolean;
  readonly isRiver: (spot: GroundPoint) => boolean;
  /** Whether the spot lies under something the player placed, such as a foundation. */
  readonly isUnderCamp: (spot: GroundPoint) => boolean;
  readonly litFires: readonly GroundPoint[];
}

/** Whether a bird may land here: in a clearing, not in the river, not on anything placed, and away from every lit fire. */
export function birdMayLandAt(ground: LandingGround, spot: GroundPoint): boolean {
  if (!ground.isClearing(spot) || ground.isRiver(spot) || ground.isUnderCamp(spot)) return false;
  return ground.litFires.every((fire) => groundDistance(fire, spot) > LIT_FIRE_GAP_METRES);
}

interface Point3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

interface Flock {
  readonly start: GroundPoint;
  readonly heading: number;
  readonly height: number;
  metres: number;
  readonly members: readonly { readonly side: number; readonly back: number; readonly up: number; readonly flapRate: number; readonly flapPhase: number }[];
}

/** A flight from one point to another, with a gentle arc. When it ends, the bird lands at `landsAt`, or vanishes. */
interface Flight {
  readonly kind: "flight";
  readonly from: Point3;
  readonly to: Point3;
  readonly seconds: number;
  elapsed: number;
  readonly landsAt: GroundPoint | undefined;
  /** Whether the bird is leaving. A leaving bird does not count toward the birds wanted on the ground. */
  readonly leaving: boolean;
  /** How the bird stood or flew when this flight began, so it blends into flight without a jump. */
  readonly startPose: BirdPose | undefined;
}

interface Pecking {
  readonly kind: "pecking";
  readonly spot: GroundPoint;
  readonly heading: number;
  elapsed: number;
}

interface GroundBird {
  state: Flight | Pecking;
  readonly flapRate: number;
  readonly flapPhase: number;
  readonly peckPeriod: number;
  readonly peckPhase: number;
}

/** Starts the birds. They take their places on the first step. `random` should differ on every load. */
export function createBirdLife(random: Random): BirdLife {
  const between = (range: { readonly min: number; readonly max: number }): number => randomBetween(random, range);
  let flocks: Flock[] = [];
  let groundBirds: GroundBird[] = [];
  // How much the weather lets birds show, from 0 (raining) to 1 (dry). It eases towards the weather.
  const dryWeather = createEasedShare({ riseSeconds: RETURN_SECONDS, fallSeconds: RAIN_LEAVE_SECONDS });
  let presence = 0;
  let started = false;
  let daylight = 0;
  let clock = 0;
  let nextFlockAt = 0;
  let nextGroundBirdAt = 0;
  let centre: GroundPoint = { x: 0, z: 0 };
  let groundHeightAt: (x: number, z: number) => number = () => 0;

  function newFlock(midway: boolean): Flock {
    const heading = random() * Math.PI * 2;
    const pass = (random() * 2 - 1) * FLOCK_PASS_METRES;
    // The line runs along `heading` and passes `pass` metres to the side of the player at its middle.
    const middle = stepAlongHeading(centre, heading + Math.PI / 2, pass);
    const start = stepAlongHeading(middle, heading, -FLOCK_PATH_METRES / 2);
    const size = Math.floor(between({ min: FLOCK_SIZE.min, max: FLOCK_SIZE.max + 1 }));
    return {
      start,
      heading,
      height: TREETOP_METRES + random() * TREETOP_SPREAD_METRES,
      metres: midway ? random() * FLOCK_PATH_METRES : 0,
      members: Array.from({ length: size }, (_, index) => ({
        side: (random() * 2 - 1) * FLOCK_SPREAD_METRES,
        back: index * 0.8 + random() * FLOCK_SPREAD_METRES,
        up: random() * 1.2,
        flapRate: between(FLAPS_PER_SECOND),
        flapPhase: random(),
      })),
    };
  }

  function groundBird(state: Flight | Pecking): GroundBird {
    return { state, flapRate: between(FLAPS_PER_SECOND), flapPhase: random(), peckPeriod: between(PECK_PERIOD_SECONDS), peckPhase: random() };
  }

  /** A spot near the player where a bird may land, away from `awayFrom`, or undefined when none was found. */
  function landingSpot(surroundings: BirdSurroundings, player: GroundPoint, awayFrom?: GroundPoint): GroundPoint | undefined {
    for (let i = 0; i < LANDING_TRIES; i += 1) {
      const spot = randomPointAround(player, GROUND_RADIUS_METRES, random);
      if (awayFrom !== undefined && groundDistance(spot, awayFrom) < GROUND_RADIUS_METRES.min) continue;
      if (surroundings.canLandAt(spot)) return spot;
    }
    return undefined;
  }

  function onGround(spot: GroundPoint): Point3 {
    return { x: spot.x, y: groundHeightAt(spot.x, spot.z), z: spot.z };
  }

  function flight(from: Point3, to: Point3, landsAt: GroundPoint | undefined, leaving: boolean, startPose?: BirdPose): Flight {
    const metres = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
    return { kind: "flight", from, to, seconds: Math.max(metres / GROUND_BIRD_METRES_PER_SECOND, 0.5), elapsed: 0, landsAt, leaving, startPose };
  }

  /** Where a bird on this flight is now: along the line from start to end, raised by a gentle arc. */
  function flightPoint(state: Flight): Point3 {
    const t = Math.min(state.elapsed / state.seconds, 1);
    const arc = Math.sin(t * Math.PI) * 1.5;
    return {
      x: state.from.x + (state.to.x - state.from.x) * t,
      y: state.from.y + (state.to.y - state.from.y) * t + arc,
      z: state.from.z + (state.to.z - state.from.z) * t,
    };
  }

  /** Sends a bird on the ground off: to another clearing, or away over the trees. */
  function flyOff(bird: GroundBird, surroundings: BirdSurroundings, player: GroundPoint, mayLandAgain: boolean): void {
    if (bird.state.kind !== "pecking") return;
    sendOff(bird, onGround(bird.state.spot), bird.state.spot, surroundings, player, mayLandAgain ? LAND_AGAIN_SHARE : 0, poseOf(bird));
  }

  /**
   * Sends a bird from `from` to another clearing, away from `leftSpot`, this share of the time, or away over the trees.
   * It flies away over the trees too when no other clearing is found.
   */
  function sendOff(
    bird: GroundBird,
    from: Point3,
    leftSpot: GroundPoint,
    surroundings: BirdSurroundings,
    player: GroundPoint,
    landAgainShare: number,
    startPose: BirdPose,
  ): void {
    const again = random() < landAgainShare ? landingSpot(surroundings, player, leftSpot) : undefined;
    if (again !== undefined) {
      bird.state = flight(from, onGround(again), again, false, startPose);
      return;
    }
    const away = stepAlongHeading(leftSpot, headingToward(player, leftSpot) + (random() - 0.5), FLY_AWAY_METRES);
    bird.state = flight(
      from,
      { x: away.x, y: groundHeightAt(away.x, away.z) + TREETOP_METRES + random() * TREETOP_SPREAD_METRES, z: away.z },
      undefined,
      true,
      startPose,
    );
  }

  function stepFlocks(seconds: number, wanted: number, first: boolean): void {
    for (const flock of flocks) flock.metres += FLOCK_METRES_PER_SECOND * seconds;
    flocks = flocks.filter((flock) => flock.metres < FLOCK_PATH_METRES);
    // Flocks above the wanted count fly on until their line ends.
    if (first) {
      while (flocks.length < wanted) flocks.push(newFlock(true));
    } else if (flocks.length < wanted && clock >= nextFlockAt) {
      flocks.push(newFlock(false));
      nextFlockAt = clock + between(ARRIVAL_PAUSE_SECONDS);
    }
  }

  function stepGroundBirds(seconds: number, surroundings: BirdSurroundings, wanted: number, first: boolean): void {
    const player = surroundings.player;
    for (const bird of groundBirds) {
      const state = bird.state;
      if (state.kind === "flight") {
        state.elapsed += seconds;
        // A spot can be refused while the bird flies to it, such as when a fire is lit nearby. It goes elsewhere.
        if (state.landsAt !== undefined && !surroundings.canLandAt(state.landsAt)) {
          sendOff(bird, flightPoint(state), state.landsAt, surroundings, player ?? centre, 1, poseOf(bird));
          continue;
        }
        if (state.elapsed >= state.seconds && state.landsAt !== undefined) {
          bird.state = { kind: "pecking", spot: state.landsAt, heading: headingToward(state.from, state.to), elapsed: 0 };
        }
        continue;
      }
      state.elapsed += seconds;
      if (player === undefined) continue;
      if (groundDistance(state.spot, player) <= FLY_OFF_METRES || !surroundings.canLandAt(state.spot)) {
        flyOff(bird, surroundings, player, true);
      }
    }
    groundBirds = groundBirds.filter((bird) => bird.state.kind === "pecking" || bird.state.elapsed < bird.state.seconds);
    if (player === undefined) return;

    // Birds above the wanted count, as in rain or at nightfall, fly away over the trees.
    let staying = groundBirds.filter((bird) => !(bird.state.kind === "flight" && bird.state.leaving));
    for (const bird of staying.slice(wanted)) flyOff(bird, surroundings, player, false);
    staying = staying.slice(0, wanted);
    // A leaving bird still counts toward the most on the ground, so there are never more than MOST_GROUND_BIRDS.
    const room = Math.min(wanted - staying.length, MOST_GROUND_BIRDS - groundBirds.length);
    if (room <= 0) return;
    if (first) {
      for (let i = 0; i < room; i += 1) {
        const spot = landingSpot(surroundings, player);
        if (spot !== undefined) groundBirds.push(groundBird({ kind: "pecking", spot, heading: random() * Math.PI * 2, elapsed: 0 }));
      }
    } else if (clock >= nextGroundBirdAt) {
      nextGroundBirdAt = clock + between(ARRIVAL_PAUSE_SECONDS);
      const spot = landingSpot(surroundings, player);
      if (spot === undefined) return;
      const from = stepAlongHeading(spot, random() * Math.PI * 2, LANDING_FROM.metres);
      groundBirds.push(groundBird(flight({ x: from.x, y: groundHeightAt(from.x, from.z) + LANDING_FROM.height, z: from.z }, onGround(spot), spot, false)));
    }
  }

  function drawnFlock(flock: Flock): DrawnBird[] {
    const middle = stepAlongHeading(flock.start, flock.heading, flock.metres);
    const ground = groundHeightAt(middle.x, middle.z);
    return flock.members.map((member) => {
      const behind = stepAlongHeading(middle, flock.heading, -member.back);
      const spot = stepAlongHeading(behind, flock.heading + Math.PI / 2, member.side);
      const pose = flightPose(clock, member.flapRate, member.flapPhase, true);
      return { x: spot.x, y: ground + flock.height + member.up, z: spot.z, heading: flock.heading, flying: true, pose };
    });
  }

  /** How a bird on the ground, or flying to or from it, holds itself now. It flies with steady beats, without bursts. */
  function poseOf(bird: GroundBird): BirdPose {
    const state = bird.state;
    if (state.kind === "pecking") return groundPose(state.elapsed, bird.peckPeriod, bird.peckPhase);
    const flying = flightPose(clock, bird.flapRate, bird.flapPhase, false);
    return flightLegPose(flying, state.elapsed, state.startPose, state.landsAt === undefined ? undefined : state.seconds - state.elapsed);
  }

  function drawnGroundBird(bird: GroundBird): DrawnBird {
    const state = bird.state;
    if (state.kind === "pecking") return { ...onGround(state.spot), heading: state.heading, flying: false, pose: poseOf(bird) };
    return { ...flightPoint(state), heading: headingToward(state.from, state.to), flying: true, pose: poseOf(bird) };
  }

  return {
    step(seconds, surroundings) {
      const first = !started;
      started = true;
      clock += seconds;
      daylight = surroundings.daylight;
      groundHeightAt = surroundings.groundHeightAt;
      if (surroundings.player !== undefined) centre = surroundings.player;
      // The first step shows the weather as it is, so a game loaded in clear weather starts with every bird in place.
      presence = dryWeather.toward(surroundings.raining ? 0 : 1, seconds);
      // Birds that have faded out are gone, so none flies on unseen and the next morning starts afresh.
      if (daylight * presence <= 0) {
        flocks = [];
        groundBirds = [];
      }
      // In the faint light at dusk no birds are wanted. Those still there fly off.
      const share = daylight >= LEAST_DAYLIGHT ? presence : 0;
      stepFlocks(seconds, Math.round(MOST_FLOCKS * share), first);
      stepGroundBirds(seconds, surroundings, Math.round(MOST_GROUND_BIRDS * share), first);
    },
    visibility: () => daylight * presence,
    flocks: () => flocks.map(drawnFlock),
    groundBirds: () => groundBirds.map(drawnGroundBird),
  };
}

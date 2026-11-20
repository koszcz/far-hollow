// Where the player is drawn while sawing planks, part of the "sawing-animation" in asset-manifest.json. The owner approved it.
// Game logic stops the player anywhere near the sawhorse. To saw, they step up beside its beam and face it, with the
// log lying along the beam in front of them. When sawing stops, they step back to where game logic has them.
// Game logic's record of where the player stands does not change.
import { quarterTurnsToRadians, type QuarterTurns } from "../sim/quarter-turns";
import type { GroundPoint } from "../sim/valley";
import { SAW_ENTER_SECONDS, SAW_STANCE_METRES } from "./player-saw-pose";

/** A spot on the ground and which way the player faces there, in radians from the +z axis toward +x. */
export interface StanceSpot {
  readonly x: number;
  readonly z: number;
  readonly heading: number;
}

/** A sawhorse: where its middle is, and which way it is turned. Its beam runs along x when it faces the default way. */
export interface SawhorseSpot {
  readonly position: GroundPoint;
  readonly turns: QuarterTurns;
}

/** Where the player stands to saw at `sawhorse`, coming from `from`: beside the beam on the side nearer them, facing it. */
export function sawingStance(sawhorse: SawhorseSpot, from: GroundPoint): StanceSpot {
  const turn = quarterTurnsToRadians(sawhorse.turns);
  // Across the beam, on the ground: the beam runs along (cos, -sin) after the turn.
  const acrossX = Math.sin(turn);
  const acrossZ = Math.cos(turn);
  const side = (from.x - sawhorse.position.x) * acrossX + (from.z - sawhorse.position.z) * acrossZ < 0 ? -1 : 1;
  const x = sawhorse.position.x + acrossX * side * SAW_STANCE_METRES;
  const z = sawhorse.position.z + acrossZ * side * SAW_STANCE_METRES;
  return { x, z, heading: Math.atan2(-acrossX * side, -acrossZ * side) };
}

const smoothstep = (t: number): number => {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped * clamped * (3 - 2 * clamped);
};

/** Turns from heading `a` to heading `b` by the short way round, `t` of the way. */
function blendHeading(a: number, b: number, t: number): number {
  const turn = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + turn * t;
}

/** A step between two spots, and when it began on the performance clock, in seconds. */
interface Step {
  readonly from: StanceSpot;
  readonly since: number;
}

/** Steps the drawn player up to a sawhorse to saw, and back to where game logic has them when sawing stops. */
export interface SawingStep {
  /**
   * Where to draw the player now, given the sawhorse they saw at, or undefined while not sawing, and where game logic
   * has them. Returns undefined once they stand where game logic has them, so normal drawing takes over.
   */
  drawnAt(nowSeconds: number, sawhorse: SawhorseSpot | undefined, logic: StanceSpot): StanceSpot | undefined;
}

/** Steps the drawn player up to the sawhorse when sawing starts, and back when it stops, each over SAW_ENTER_SECONDS. */
export function createSawingStep(): SawingStep {
  /** Stepping up to saw, or sawing. */
  let toSaw: (Step & { readonly sawhorse: SawhorseSpot }) | undefined;
  /** Stepping back after sawing stopped. */
  let back: Step | undefined;
  /** Where the player was drawn last, while this step drew them. */
  let last: StanceSpot | undefined;

  const between = (from: StanceSpot, to: StanceSpot, t: number): StanceSpot => {
    const eased = smoothstep(t);
    return { x: from.x + (to.x - from.x) * eased, z: from.z + (to.z - from.z) * eased, heading: blendHeading(from.heading, to.heading, eased) };
  };

  return {
    drawnAt(nowSeconds, sawhorse, logic) {
      if (sawhorse !== undefined) {
        back = undefined;
        if (toSaw?.sawhorse.position !== sawhorse.position) toSaw = { sawhorse, from: last ?? logic, since: nowSeconds };
        last = between(toSaw.from, sawingStance(sawhorse, toSaw.from), (nowSeconds - toSaw.since) / SAW_ENTER_SECONDS);
        return last;
      }
      toSaw = undefined;
      if (last === undefined) return undefined;
      back ??= { from: last, since: nowSeconds };
      const t = (nowSeconds - back.since) / SAW_ENTER_SECONDS;
      if (t >= 1) {
        back = undefined;
        last = undefined;
        return undefined;
      }
      last = between(back.from, logic, t);
      return last;
    },
  };
}

// Which way a structure faces, as whole quarter turns, and every rule about it. See docs/adr/0009.
import type { GroundPoint } from "./ground-point";

/** Which way a structure faces: how many quarter turns clockwise, seen from above, from 0 to 3. */
export type QuarterTurns = 0 | 1 | 2 | 3;

const QUARTER_TURN_RADIANS = Math.PI / 2;

/** Any whole number of quarter turns, wrapped into 0 to 3. Negative numbers turn back, so -1 gives 3. */
export function wrapQuarterTurns(turns: number): QuarterTurns {
  // Adding 0 turns a negative zero into a plain zero.
  return ((((turns % 4) + 4) % 4) + 0) as QuarterTurns;
}

/** `turns` turned clockwise by `steps` quarter turns, wrapping past 3 back to 0. A negative `steps` turns back. */
export function turnQuarters(turns: QuarterTurns, steps: number): QuarterTurns {
  return wrapQuarterTurns(turns + steps);
}

/** Whether `a` and `b` point opposite ways, a half turn apart. */
export function areOpposite(a: QuarterTurns, b: QuarterTurns): boolean {
  return wrapQuarterTurns(a - b) === 2;
}

/** Whether `a` and `b` point at right angles to each other, a quarter turn apart either way. */
export function areAtRightAngles(a: QuarterTurns, b: QuarterTurns): boolean {
  return wrapQuarterTurns(a - b) % 2 === 1;
}

/**
 * Whether an edge piece facing `turns`, such as a wall or a beam, runs along the x axis.
 * It does when it faces 0 or 2 quarter turns, and runs along z when it faces 1 or 3.
 */
export function runsAlongX(turns: QuarterTurns): boolean {
  return turns % 2 === 0;
}

/**
 * How far round a structure facing `turns` is drawn, in radians about the vertical axis.
 * Quarter turns go clockwise seen from above, so the radians are negative.
 */
export function quarterTurnsToRadians(turns: QuarterTurns): number {
  return -turns * QUARTER_TURN_RADIANS;
}

/** The quarter turn nearest a heading in radians, as `quarterTurnsToRadians` measures it. */
export function nearestQuarterTurns(radians: number): QuarterTurns {
  return wrapQuarterTurns(Math.round(-radians / QUARTER_TURN_RADIANS));
}

/**
 * Turns an offset from a structure's centre the way the structure faces.
 * It matches how the renderer turns a structure's shape by `quarterTurnsToRadians`, so the drawn shape and the game's rules line up.
 */
export function turnOffset(offset: GroundPoint, turns: QuarterTurns): GroundPoint {
  switch (turns) {
    case 0:
      return { x: offset.x, z: offset.z };
    case 1:
      return { x: -offset.z, z: offset.x };
    case 2:
      return { x: -offset.x, z: -offset.z };
    case 3:
      return { x: offset.z, z: -offset.x };
  }
}

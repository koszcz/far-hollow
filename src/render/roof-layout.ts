// Works out how each cabin roof section is drawn from the sections round it: how high it sits, and whether it is a
// straight section, a hip, or a valley. The game rules store only each section's turn (ADR 0006 drafts, ticket 09).
// A section facing `turns` slopes down the way `turnOffset` turns +z. Each slope rises from its own downhill wall: a
// section sits one rise higher for each section in front of it, in its own slope direction, that slopes the same way.
// Where two roofs that slope at right angles meet, the corner section changes shape on its own, like stair blocks do.
// An outside corner becomes a hip, where two slopes meet at a ridge. An inside corner becomes a valley, where they meet
// in a gutter. The rule looks only at a section's neighbours.
import { BUILD_GRID_METRES } from "../sim/build-grid";
import { turnOffset, type QuarterTurns } from "../sim/structure-kind";
import type { GroundPoint } from "../sim/valley";

/** The shape a roof section takes from its neighbours. */
export type RoofShape = "straight" | "hip" | "valley";

/** A roof section, finished or as a blueprint: the middle of its square, and which way it slopes down. */
export interface RoofSection {
  readonly position: GroundPoint;
  readonly turns: QuarterTurns;
}

/** How one roof section is drawn. */
export interface RoofPlace {
  readonly shape: RoofShape;
  /**
   * How far round the shape is drawn. A straight section is drawn sloping down to +z, then turned this far.
   * A hip or valley is drawn sloping down to +z and +x, then turned this far.
   */
  readonly drawTurns: QuarterTurns;
  /** How many rises the section sits above its walls: one for each section in front of it that slopes the same way. */
  readonly inFront: number;
  /** Whether the section lies a little higher, so its bark laps over its neighbours' beside it and does not flicker. */
  readonly lifted: boolean;
}

/** A section alone, sloping down to +z. */
export const ALONE: RoofPlace = { shape: "straight", drawTurns: 0, inFront: 0, lifted: false };

/** The grid square a point lies in, as whole-number column and row. */
export function gridCell(point: GroundPoint): { column: number; row: number } {
  return { column: Math.floor(point.x / BUILD_GRID_METRES + 0.25), row: Math.floor(point.z / BUILD_GRID_METRES + 0.25) };
}

/** The way a section facing `turns` slopes down, one grid square long. */
function downhill(turns: QuarterTurns): GroundPoint {
  return turnOffset({ x: 0, z: 1 }, turns);
}

function quarter(turns: number): QuarterTurns {
  return (((turns % 4) + 4) % 4) as QuarterTurns;
}

/** Whether two turns slope at right angles to each other. */
function isPerpendicular(a: QuarterTurns, b: QuarterTurns): boolean {
  return (a - b + 4) % 2 === 1;
}

/**
 * How far round a hip or valley is drawn, so that it slopes down both ways `a` and `b`, which are at right angles.
 * Drawn unturned, it slopes down to +z (turns 0) and +x (turns 3).
 */
function cornerTurns(a: QuarterTurns, b: QuarterTurns): QuarterTurns {
  return b === quarter(a + 3) ? a : b;
}

/** Where each section sits and what shape it takes, from the sections round it. */
export function roofPlaces<Section extends RoofSection>(sections: readonly Section[]): Map<Section, RoofPlace> {
  const key = (column: number, row: number) => `${column},${row}`;
  const byCell = new Map<string, Section>();
  for (const section of sections) {
    const { column, row } = gridCell(section.position);
    byCell.set(key(column, row), section);
  }
  const at = (column: number, row: number) => byCell.get(key(column, row));
  const places = new Map<Section, RoofPlace>();
  for (const section of sections) {
    const { column, row } = gridCell(section.position);
    const down = downhill(section.turns);
    const facesSameWay = (other: Section | undefined) => other !== undefined && other.turns === section.turns;
    let inFront = 0;
    while (facesSameWay(at(column + down.x * (inFront + 1), row + down.z * (inFront + 1)))) inFront += 1;
    // Neighbours beside it, across the slope, lie along z when it slopes along x.
    const lifted = Math.abs(down.x === 0 ? column : row) % 2 === 1;
    places.set(section, { ...shapeOf(section, column, row, at, facesSameWay), inFront, lifted });
  }
  return places;
}

/**
 * The shape of one section, from its neighbours uphill and downhill.
 * An uphill neighbour sloping at right angles makes it a hip, sloping both ways, unless the next section along the way
 * that neighbour slopes faces the same way as this one, so the run carries on. A downhill neighbour sloping at right
 * angles makes it a valley, sloping both ways, unless the section on the far side of it faces the same way as this one.
 */
function shapeOf<Section extends RoofSection>(
  section: Section,
  column: number,
  row: number,
  at: (column: number, row: number) => Section | undefined,
  facesSameWay: (other: Section | undefined) => boolean,
): Pick<RoofPlace, "shape" | "drawTurns"> {
  const down = downhill(section.turns);
  const behind = at(column - down.x, row - down.z);
  if (behind !== undefined && isPerpendicular(behind.turns, section.turns)) {
    const along = downhill(behind.turns);
    if (!facesSameWay(at(column + along.x, row + along.z))) return { shape: "hip", drawTurns: cornerTurns(section.turns, behind.turns) };
  }
  const ahead = at(column + down.x, row + down.z);
  if (ahead !== undefined && isPerpendicular(ahead.turns, section.turns)) {
    const along = downhill(ahead.turns);
    if (!facesSameWay(at(column - along.x, row - along.z))) return { shape: "valley", drawTurns: cornerTurns(section.turns, ahead.turns) };
  }
  return { shape: "straight", drawTurns: section.turns };
}

/**
 * How high a section's roof is at (x, z) across its own square, as drawn unturned, in rises above its lowest edge.
 * x and z run from -0.5 to 0.5 across the square. A rise is how much the roof climbs across one square.
 */
export function shapeTop(shape: RoofShape, x: number, z: number): number {
  const downZ = 0.5 - z;
  const downX = 0.5 - x;
  if (shape === "hip") return Math.min(downZ, downX);
  if (shape === "valley") return Math.max(downZ, downX);
  return downZ;
}

/** How high a section's roof is at a point in the world, in rises above the walls under it, without the lift of `lifted`. */
export function roofTopAt(place: RoofPlace, middle: GroundPoint, point: GroundPoint): number {
  const offset = { x: (point.x - middle.x) / BUILD_GRID_METRES, z: (point.z - middle.z) / BUILD_GRID_METRES };
  const drawn = turnOffset(offset, quarter(4 - place.drawTurns));
  return place.inFront + shapeTop(place.shape, drawn.x, drawn.z);
}

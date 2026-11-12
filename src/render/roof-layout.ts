// Works out how each cabin roof section is drawn from the sections round it: how high it sits, and whether it is a
// straight section or a valley. The game rules store only each section's turn (ADR 0006 drafts, tickets 09 and 11).
// A section facing `turns` slopes down the way `turnOffset` turns +z. Each slope rises from its own downhill wall: a
// section sits one rise higher for each section in front of it, in its own slope direction, that slopes the same way.
// Two rows that slope away from each other meet at a ridge. A run whose sections all slope the same way is a shed roof.
// No roof has a hip. Where the section past the end of a run slopes at right angles to it, one wing ends against another.
// The other wing's slope carries on over the run, and where both slopes start at the same height, a section becomes a
// valley, where the two slopes meet in a gutter. On a deep wing, the valleys run on up, one square further each rise.
// So at the corner of an L, the corner sections' own turns decide which wing runs through: the wing that slopes the same
// way as them. The other wing ends against it in valleys. Where the other wing is deeper, its slope starts higher and runs
// over the corner squares instead, and its ridge stands above the through-roof's. The rule looks only along a section's
// own run and the section just past its end.
import { BUILD_GRID_METRES } from "../sim/build-grid";
import { turnOffset, type QuarterTurns } from "../sim/structure-kind";
import type { GroundPoint } from "../sim/valley";

/** The shape a roof section takes from its neighbours. */
export type RoofShape = "straight" | "valley";

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
   * A valley is drawn sloping down to +z and +x, then turned this far.
   */
  readonly drawTurns: QuarterTurns;
  /**
   * How many rises the section sits above its walls: one for each section in front of it that slopes the same way.
   * A section that the higher slope of a wing ahead runs over counts that slope's rises instead.
   */
  readonly inFront: number;
  /** Whether the section lies a little higher, so its planks lap over its neighbours' beside it and do not flicker. */
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

/** Where each section sits and what shape it takes, from the sections round it. */
export function roofPlaces<Section extends RoofSection>(sections: readonly Section[]): Map<Section, RoofPlace> {
  const key = (column: number, row: number) => `${column},${row}`;
  const byCell = new Map<string, Section>();
  for (const section of sections) {
    const { column, row } = gridCell(section.position);
    byCell.set(key(column, row), section);
  }
  const at = (column: number, row: number) => byCell.get(key(column, row));
  /** How many sections in front of `section` slope the same way, one after another. */
  const inFrontOf = (section: Section) => {
    const { column, row } = gridCell(section.position);
    const down = downhill(section.turns);
    let count = 0;
    while (at(column + down.x * (count + 1), row + down.z * (count + 1))?.turns === section.turns) count += 1;
    return count;
  };
  const places = new Map<Section, RoofPlace>();
  for (const section of sections) {
    const { column, row } = gridCell(section.position);
    const down = downhill(section.turns);
    // Neighbours beside it, across the slope, lie along z when it slopes along x.
    const lifted = Math.abs(down.x === 0 ? column : row) % 2 === 1;
    const inFront = inFrontOf(section);
    // The first section past the end of this section's run, in its own slope direction.
    const end = at(column + down.x * (inFront + 1), row + down.z * (inFront + 1));
    if (end === undefined || !isPerpendicular(end.turns, section.turns)) {
      places.set(section, { shape: "straight", drawTurns: section.turns, inFront, lifted });
      continue;
    }
    // A wing that slopes at right angles ends the run. Its slope carries on over this square, and meets this section's own
    // slope there. Heights come in whole rises, so whichever slope starts higher covers the whole square.
    const endRises = inFrontOf(end);
    if (endRises < inFront) {
      places.set(section, { shape: "straight", drawTurns: section.turns, inFront, lifted });
    } else if (endRises > inFront) {
      places.set(section, { shape: "straight", drawTurns: end.turns, inFront: endRises, lifted });
    } else {
      // Both slopes start at the same height, and meet in a valley across the square. Drawn unturned, a valley slopes down
      // to +z (turns 0) and +x (turns 3).
      const drawTurns = end.turns === quarter(section.turns + 3) ? section.turns : end.turns;
      places.set(section, { shape: "valley", drawTurns, inFront, lifted });
    }
  }
  return places;
}

/**
 * How high a section's roof is at (x, z) across its own square, as drawn unturned, in rises above its lowest edge.
 * x and z run from -0.5 to 0.5 across the square. A rise is how much the roof climbs across one square.
 */
export function shapeTop(shape: RoofShape, x: number, z: number): number {
  const downZ = 0.5 - z;
  if (shape === "valley") return Math.max(downZ, 0.5 - x);
  return downZ;
}

/** How high a section's roof is at a point in the world, in rises above the walls under it, without the lift of `lifted`. */
export function roofTopAt(place: RoofPlace, middle: GroundPoint, point: GroundPoint): number {
  const offset = { x: (point.x - middle.x) / BUILD_GRID_METRES, z: (point.z - middle.z) / BUILD_GRID_METRES };
  const drawn = turnOffset(offset, quarter(4 - place.drawTurns));
  return place.inFront + shapeTop(place.shape, drawn.x, drawn.z);
}

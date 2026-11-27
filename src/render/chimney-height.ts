// How tall a chimney is drawn: part of the draft "chimney" asset in asset-manifest.json. Added by chimney ticket 01.
// The game rules do not store a chimney's height. Its top stands CHIMNEY_CLEARANCE_METRES above the roof surface at its spot,
// so a chimney under a higher roof section is taller. With no roof section over its square, it is as tall as it would be under
// a roof one rise high. Heights are in metres above the deck the fireplace stands on.
import { isOnGridSquare } from "../sim/build-grid";
import { type EntityStore, type Vec3 } from "../sim/entities";
import { blueprintEntities } from "../sim/entity-queries";
import { addGroundPoints, type GroundPoint } from "../sim/ground-point";
import { turnOffset, type QuarterTurns } from "../sim/quarter-turns";
import { cabinRoofOn } from "../sim/roofs";
import { roofTopAt, type RoofPlace } from "./roof-layout";
import { COVER_THICKNESS_METRES, FRAME_TOP_METRES, RAFTER_RADIUS_METRES, SECTION_RISE_METRES, type FrameLayout } from "./roof-parts";

/** The chimney's top stands this far above the roof surface at its middle, in metres. */
export const CHIMNEY_CLEARANCE_METRES = 0.8;
/** The chimney rises from the fireplace's cap stone, whose top is this high above the deck, in metres. */
export const CHIMNEY_BASE_METRES = 1.73;
/**
 * The middle of the chimney, across the ground, from the middle of its fireplace's square when it faces the default way, in metres.
 * It stands on the cap stone at the back of the fireplace, away from the opening.
 */
export const CHIMNEY_MIDDLE: GroundPoint = { x: 0, z: -0.22 };

/** The roof surface at the bottom of a roof's slope: the top of the planks along the low edge, above the deck, in metres. */
const ROOF_FOOT_METRES = FRAME_TOP_METRES + 2 * RAFTER_RADIUS_METRES + COVER_THICKNESS_METRES;

/** A roof section over a chimney's square: where it sits and what shape it takes, and the middle of its square. */
export interface RoofOver {
  readonly place: RoofPlace;
  readonly middle: GroundPoint;
}

/**
 * How high the top of a chimney stands above its deck, for a chimney whose middle is at `spot`, under `roof`.
 * With no roof section over it, it stands as high as under a roof whose surface there is one rise above its low edge.
 */
export function chimneyTopMetres(roof: RoofOver | undefined, spot: GroundPoint): number {
  const rises = roof === undefined ? 1 : roofTopAt(roof.place, roof.middle, spot);
  return ROOF_FOOT_METRES + rises * SECTION_RISE_METRES + CHIMNEY_CLEARANCE_METRES;
}

/** Where the middle of a chimney stands across the ground, for a fireplace at `position` facing `turns`. */
export function chimneyMiddleAt(position: GroundPoint, turns: QuarterTurns): GroundPoint {
  return addGroundPoints({ x: position.x, z: position.z }, turnOffset(CHIMNEY_MIDDLE, turns));
}

/**
 * How high the top of a chimney stands above its deck, for a fireplace at `position` facing `turns`.
 * A roof section over the square counts, finished or as a blueprint. `layout` says where each section sits.
 */
export function chimneyTopAt(entities: EntityStore, layout: FrameLayout, position: Vec3, turns: QuarterTurns): number {
  const square = { x: position.x, z: position.z };
  const roofed =
    cabinRoofOn(entities, square) !== undefined ||
    blueprintEntities(entities).entities.some(({ blueprint, position: at }) => blueprint.structure === "roof" && isOnGridSquare(square, at));
  return chimneyTopMetres(roofed ? { place: layout.placeAt(square), middle: square } : undefined, chimneyMiddleAt(position, turns));
}

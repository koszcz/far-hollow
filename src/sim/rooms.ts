// Rooms: foundation squares closed in on every side by log walls or door frames, with a roof over every square.
// Rooms are not stored. They are worked out from the finished pieces each time they are asked for,
// so finishing or taking down a piece changes them at once.
import { edgeMiddle, edgePieceOn, isSameEdge, squaresBeside } from "./edge-pieces";
import { isOnGridSquare, snapToGridSquare } from "./build-grid";
import { campfireEntities, doorEntities, fireplaceEntities, floorEntities, foundationEntities, type Entity, type EntityStore } from "./entities";
import { foundationOn } from "./foundations";
import { cabinRoofOn } from "./roofs";
import { SIDES } from "./structure-kind";
import type { GroundPoint } from "./ground-point";

/** The middles of the foundation squares in one room. */
export type Room = readonly GroundPoint[];

/** Every room in the valley. */
export function findRooms(entities: EntityStore): Room[] {
  const seen = new Set<Entity>();
  const rooms: Room[] = [];
  for (const foundation of foundationEntities(entities)) {
    if (seen.has(foundation)) continue;
    const region = regionFrom(entities, foundation.position);
    for (const square of region.foundations) seen.add(square);
    if (region.isRoom) rooms.push(region.squares);
  }
  return rooms;
}

/** The room that holds the grid square with this middle, or undefined if the square is not in a room. */
export function roomAround(entities: EntityStore, square: GroundPoint): Room | undefined {
  const start = foundationOn(entities, square);
  if (start === undefined) return undefined;
  const region = regionFrom(entities, start.position);
  return region.isRoom ? region.squares : undefined;
}

/** Whether a lit campfire on a foundation, or a lit fireplace, stands in this room, so it warms the whole room. */
export function isRoomHeated(entities: EntityStore, room: Room): boolean {
  for (const { campfire, onFoundation } of campfireEntities(entities)) {
    if (!campfire.lit || onFoundation === undefined) continue;
    if (room.some((square) => isOnGridSquare(square, onFoundation))) return true;
  }
  for (const { fireplace, position } of fireplaceEntities(entities)) {
    if (fireplace.lit && room.some((square) => isOnGridSquare(square, position))) return true;
  }
  return false;
}

/**
 * Whether this room is snug: every square has a finished floor, and every door frame on a square's edge has a finished door.
 * A room with no door frame is snug once every square has a floor. Blueprints do not count.
 */
export function isRoomSnug(entities: EntityStore, room: Room): boolean {
  const floors = floorEntities(entities).entities;
  const doors = doorEntities(entities).entities;
  return room.every(
    (square) =>
      floors.some((floor) => isOnGridSquare(square, floor.position)) &&
      SIDES.every((side) => {
        if (edgePieceOn(entities, square, side) !== "doorFrame") return true;
        const edge = edgeMiddle(square, side);
        return doors.some((door) => isSameEdge(door.position, edge));
      }),
  );
}

/** Whether this spot is on a square of a snug room. */
export function isInSnugRoom(entities: EntityStore, at: GroundPoint): boolean {
  const room = roomAround(entities, snapToGridSquare(at));
  return room !== undefined && isRoomSnug(entities, room);
}

/**
 * The foundation squares joined to the one at `start` through edges with no wall or door frame on them.
 * They make a room if no open edge leads off the foundations and every square has a roof.
 */
function regionFrom(entities: EntityStore, start: GroundPoint): { squares: GroundPoint[]; foundations: Set<Entity>; isRoom: boolean } {
  const first = foundationOn(entities, start);
  if (first === undefined) return { squares: [], foundations: new Set(), isRoom: false };
  const foundations = new Set<Entity>([first]);
  const squares: GroundPoint[] = [];
  const waiting = [first];
  let isRoom = true;
  for (let foundation = waiting.pop(); foundation !== undefined; foundation = waiting.pop()) {
    const square = { x: foundation.position.x, z: foundation.position.z };
    squares.push(square);
    if (cabinRoofOn(entities, square) === undefined) isRoom = false;
    for (const side of SIDES) {
      if (edgePieceOn(entities, square, side) !== undefined) continue;
      const [, beyond] = squaresBeside(edgeMiddle(square, side), side);
      const next = foundationOn(entities, beyond);
      if (next === undefined) {
        // An open edge with no foundation beyond it lets the heat out.
        isRoom = false;
        continue;
      }
      if (foundations.has(next)) continue;
      foundations.add(next);
      waiting.push(next);
    }
  }
  return { squares, foundations, isRoom };
}

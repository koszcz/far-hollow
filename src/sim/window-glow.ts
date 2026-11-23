// Which windows let firelight out. At night the renderer shows a warm glow in each of them, seen from outside.
// The glow is only for looks: game logic never reads it.
import { edgePieceEntities, plantedTorchEntities, playerEntities, type Entity, type EntityStore, type Vec3 } from "./entities";
import { squaresBeside } from "./edge-pieces";
import { isOnGridSquare } from "./build-grid";
import type { GroundPoint } from "./ground-point";
import { turnQuarters, type QuarterTurns } from "./quarter-turns";
import { isRoomHeated, roomAround, type Room } from "./rooms";
import { hasClosedShutters } from "./windows";

/** A window that lets firelight out, and the way its glow faces: away from the lit room, toward the outside. */
export interface FirelitWindow {
  readonly window: Entity & { position: Vec3 };
  readonly outward: QuarterTurns;
}

/**
 * Every finished window that is open, with no shutters or with open shutters, and has a lit campfire, fireplace, or torch
 * in the room on one of its sides. A torch counts planted or in the player's hand.
 */
export function firelitWindows(entities: EntityStore): FirelitWindow[] {
  const lit: FirelitWindow[] = [];
  for (const window of edgePieceEntities(entities)) {
    if (window.edgePiece !== "window" || hasClosedShutters(entities, window.position)) continue;
    const turns = window.facing?.turns ?? 0;
    const [behind, beyond] = squaresBeside(window.position, turns);
    if (isLitRoom(entities, roomAround(entities, behind))) lit.push({ window, outward: turns });
    else if (isLitRoom(entities, roomAround(entities, beyond))) lit.push({ window, outward: turnQuarters(turns, 2) });
  }
  return lit;
}

/** Whether a lit campfire, fireplace, or torch is in this room. */
function isLitRoom(entities: EntityStore, room: Room | undefined): boolean {
  if (room === undefined) return false;
  if (isRoomHeated(entities, room)) return true;
  const inRoom = (spot: GroundPoint) => room.some((square) => isOnGridSquare(square, spot));
  for (const torch of plantedTorchEntities(entities)) if (inRoom(torch.position)) return true;
  for (const player of playerEntities(entities)) if (player.litTorch !== undefined && inRoom(player.position)) return true;
  return false;
}

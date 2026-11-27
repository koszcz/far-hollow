import type { Command } from "./api-commands";
import type { GameClient } from "./api-client";
import type { GameView } from "./api-game-view";
import type { Refusal } from "./api-refusal";
import type { createBuilding } from "./building";
import type { createCampfires } from "./campfires";
import type { createDryingRacks } from "./drying-racks";
import type { EntityStore } from "./entities";
import type { Player } from "./game-player";
import { nearestInReach } from "./reach";
import { findRooms, isRoomHeated, isRoomSnug } from "./rooms";
import type { createSleds } from "./sleds";
import { describeThing } from "./thing-view";
import type { createWoodpiles } from "./woodpiles";

export interface GameClientDeps {
  entities: EntityStore;
  player: Player;
  building: ReturnType<typeof createBuilding>;
  campfires: ReturnType<typeof createCampfires>;
  woodpiles: ReturnType<typeof createWoodpiles>;
  sleds: ReturnType<typeof createSleds>;
  dryingRacks: ReturnType<typeof createDryingRacks>;
  /** The latest view, which the game updates after each step. */
  getView: () => GameView;
  refusal: (command: Command) => Refusal | null;
  /** The commands waiting for the next step. */
  pendingCommands: Command[];
  listeners: Set<() => void>;
}

/** What the UI uses of a game: it reads the view, asks about things, and sends commands. */
export function createGameClient(deps: GameClientDeps): GameClient {
  const { entities, player, building, campfires, woodpiles, sleds, dryingRacks, pendingCommands, listeners } = deps;
  return {
    getView: deps.getView,
    checkPlacement: (structure, at, turns) => building.checkPlacement(structure, at, turns),
    describeBlueprint: (blueprintId) => building.describe(blueprintId) ?? null,
    describeCampfire: (campfireId) => campfires.describe(campfireId) ?? null,
    describeWoodpile: (woodpileId) => woodpiles.describe(woodpileId) ?? null,
    describeSled: (sledId) => sleds.describe(sledId) ?? null,
    describeDryingRack: (rackId) => dryingRacks.describe(rackId) ?? null,
    describeThing: (id) => describeThing(entities, id) ?? null,
    nearestInReach: () => nearestInReach(entities, player.position),
    refusal: deps.refusal,
    describeRooms: () =>
      Object.freeze(
        findRooms(entities).map((room) =>
          Object.freeze({
            squares: Object.freeze(room.map((square) => Object.freeze({ ...square }))),
            heated: isRoomHeated(entities, room),
            snug: isRoomSnug(entities, room),
          }),
        ),
      ),
    send: (command) => {
      pendingCommands.push(command);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

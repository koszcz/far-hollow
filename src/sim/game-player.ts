import { addToBackpack, createStartingBackpack } from "./backpack";
import type { Entity, EntityStore } from "./entities";
import { createNeeds } from "./needs";
import { terrainHeightAt, type Valley } from "./valley";
import { TREE_WALK_BLOCK_RADIUS_METRES } from "./tree-size";
import { valleyForageSpots } from "./foraging";
import { playerStartSpot, type Walking } from "./walking";

/** The player entity, with the components every player has. */
export type Player = Entity & Required<Pick<Entity, "position" | "previousPosition" | "backpack" | "needs" | "respawnPoint">>;

/** Adds the valley's starting trees, sticks, berry bushes, and mushrooms. */
export function addValleyEntities(entities: EntityStore, valley: Valley): void {
  for (const tree of valley.trees) {
    entities.add({
      tree: true,
      position: { x: tree.x, y: terrainHeightAt(valley.terrain, tree.x, tree.z), z: tree.z },
      blocksWalking: { radius: TREE_WALK_BLOCK_RADIUS_METRES },
    });
  }
  for (const stick of valley.sticks) {
    entities.add({ stick: true, position: { x: stick.x, y: terrainHeightAt(valley.terrain, stick.x, stick.z), z: stick.z } });
  }
  for (const spot of valleyForageSpots(valley)) entities.add(spot);
}

/** How many stone a new playground game's backpack holds, so the player can try out stone without gathering it first. */
export const PLAYGROUND_STONE = 5;

/** Adds a new game's player near the river, with a starting backpack. In the playground, it also holds PLAYGROUND_STONE stone. */
export function addNewPlayer(entities: EntityStore, walking: Walking, valley: Valley, playground: boolean): Player {
  const backpack = createStartingBackpack();
  if (playground) addToBackpack(backpack, "stone", PLAYGROUND_STONE);
  const start = playerStartSpot(walking, valley);
  const startPosition = { x: start.x, y: terrainHeightAt(valley.terrain, start.x, start.z), z: start.z };
  return entities.add<Player>({
    player: true,
    position: startPosition,
    previousPosition: { ...startPosition },
    backpack,
    needs: createNeeds(),
    // Until the player has slept in a bed, they wake where they started after a collapse.
    respawnPoint: { x: start.x, z: start.z },
  });
}

/** Finds the player among restored entities. */
export function savedPlayer(entities: EntityStore): Player {
  const player = entities.with("player", "position", "previousPosition", "backpack", "needs", "respawnPoint").first;
  if (player === undefined) throw new Error("The saved game has no player");
  return player;
}

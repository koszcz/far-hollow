// Acting on a campfire, woodpile, or sled from out of reach: the player walks beside it first, then acts.
import type { Activity } from "./activity";
import type { PlainNotice } from "./api";
import type { Campfires } from "./campfires";
import { playerEntities, setComponent, type EntityStore, type TendTask } from "./entities";
import type { Sleds } from "./sleds";
import type { Woodpiles } from "./woodpiles";

export interface Tending extends Activity {
  /** True if the player stands still within reach of the command's campfire or woodpile, so it can be carried out now. */
  inReach(command: TendTask): boolean;
  /** Walks the player beside the command's campfire or woodpile. Once they stop there, the next step carries the command out. */
  walkThen(command: TendTask): void;
}

/** `act` carries out a command on a campfire or woodpile within reach. It may return a notice, such as a full backpack. */
export function createTending(
  entities: EntityStore,
  places: { readonly campfires: Campfires; readonly woodpiles: Woodpiles; readonly sleds: Sleds },
  act: (command: TendTask) => PlainNotice | undefined,
): Tending {
  const players = playerEntities(entities);
  const walkers = entities.with("player", "tendTask");

  /** The campfire, woodpile, or sled the work is on, by its entity id, with the module that can reach it and walk the player beside it. */
  function placeOf(command: TendTask): { readonly module: Pick<Campfires, "inReach" | "tend">; readonly id: number } {
    if ("campfireId" in command) return { module: places.campfires, id: command.campfireId };
    if ("woodpileId" in command) return { module: places.woodpiles, id: command.woodpileId };
    return { module: places.sleds, id: command.sledId };
  }

  return {
    inReach(command) {
      const place = placeOf(command);
      return place.module.inReach(place.id);
    },
    walkThen(command) {
      for (const player of players) {
        // A player already within reach but still walking stops here, so they act without walking past.
        entities.removeComponent(player, "walkPath");
        setComponent(entities, player, "tendTask", command);
      }
      const place = placeOf(command);
      place.module.tend(place.id);
    },
    cancel() {
      for (const player of [...walkers]) entities.removeComponent(player, "tendTask");
    },
    step() {
      let notice: PlainNotice | undefined;
      // Copy the list first, because players who arrive leave the query while it is being walked.
      for (const player of [...walkers]) {
        if (player.walkPath !== undefined) continue;
        const command = player.tendTask;
        entities.removeComponent(player, "tendTask");
        notice = act(command) ?? notice;
      }
      return notice;
    },
  };
}

// Acting on a campfire or woodpile from out of reach: the player walks beside it first, then acts.
import type { Activity } from "./activity";
import type { PlainNotice } from "./api";
import type { Campfires } from "./campfires";
import { playerEntities, setComponent, type EntityStore, type TendCommand } from "./entities";
import type { Woodpiles } from "./woodpiles";

export interface Tending extends Activity {
  /** True if the player stands still within reach of the command's campfire or woodpile, so it can be carried out now. */
  inReach(command: TendCommand): boolean;
  /** Walks the player beside the command's campfire or woodpile. Once they stop there, the next step carries the command out. */
  walkThen(command: TendCommand): void;
}

/** `act` carries out a command on a campfire or woodpile within reach. It may return a notice, such as a full backpack. */
export function createTending(
  entities: EntityStore,
  campfires: Campfires,
  woodpiles: Woodpiles,
  act: (command: TendCommand) => PlainNotice | undefined,
): Tending {
  const players = playerEntities(entities);
  const walkers = entities.with("player", "tendTask");

  return {
    inReach(command) {
      return "campfireId" in command ? campfires.inReach(command.campfireId) : woodpiles.inReach(command.woodpileId);
    },
    walkThen(command) {
      for (const player of players) {
        // A player already within reach but still walking stops here, so they act without walking past.
        entities.removeComponent(player, "walkPath");
        setComponent(entities, player, "tendTask", command);
      }
      if ("campfireId" in command) campfires.tend(command.campfireId);
      else woodpiles.tend(command.woodpileId);
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

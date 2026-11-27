// A real game for tests of what the player can do, set up with what a test names.
// The game's own rules then allow or refuse each action, so tests of the UI never copy those rules.
import type { BackpackContent, CarriedLog, StructureKind, WoodpileWood } from "../sim/api";
import type { Entity, SledLoad } from "../sim/entities";
import { COOK_MINUTES } from "../sim/fish-on-fire";
import { FIRE_JUG_MINUTES } from "../sim/jug-on-fire";
import { createGame, type Game } from "../sim/game";
import type { PotWater } from "../sim/pot-state";
import type { ActionReader } from "./thing-actions-context";

/** What a test game holds besides the valley. Each thing it names is added well away from the player. */
export interface Setup {
  /** Everything in the backpack. It holds nothing else, not even the starting tools. */
  readonly backpack?: Partial<Record<BackpackContent, number>>;
  readonly carrying?: CarriedLog;
  /**
   * A finished campfire. `pot` puts a pot of that water on it. `fish` puts a fish on it for each entry, cooked if true.
   * `jug` puts a jug on it, fired if true.
   */
  readonly campfire?: {
    readonly lit?: boolean;
    readonly fuelMinutes?: number;
    readonly pot?: PotWater;
    readonly fish?: readonly boolean[];
    readonly jug?: boolean;
  };
  /** A finished woodpile, with this much of each wood on it. */
  readonly woodpile?: Partial<Record<WoodpileWood, number>>;
  /** A finished, parked sled, with this load. */
  readonly sled?: Partial<SledLoad>;
  /** Whether the player drags the sled above, or another sled. */
  readonly dragging?: "thisSled" | "anotherSled";
}

/** A real game set up as given, paused, with the entity ids of what was added. An id is -1 for a thing not asked for. */
export interface World {
  readonly game: Game;
  readonly reader: ActionReader;
  readonly campfire: number;
  readonly woodpile: number;
  readonly sled: number;
  /** Adds an entity well away from the player and returns its id. The view updates. */
  add(components: Entity): number;
  /** Adds a blueprint with this much delivered to it, well away from the player, and returns its id. The view updates. */
  addBlueprint(structure: StructureKind, delivered?: Partial<Record<"log" | "debarkedLog" | "plank", number>>): number;
  /** Adds an empty chest or shelf beside the player, opens it, and returns its id. The view updates. */
  openStorage(furniture: "chest" | "shelf"): number;
}

/** A new game set up as given. */
export function worldWith(setup: Setup): World {
  const game = createGame({ seed: 42 });
  const player = game.entities.with("player", "position", "backpack").first;
  if (player === undefined) throw new Error("No player");
  player.backpack.contents = { ...setup.backpack };
  if (setup.carrying !== undefined) game.entities.addComponent(player, "carrying", setup.carrying);
  let placed = 0;
  /** Adds an entity a few metres further from the player than the last one, out of reach. */
  const addAway = (components: Entity): number => {
    placed += 1;
    const position = { x: player.position.x + 20 + 3 * placed, y: player.position.y, z: player.position.z };
    const id = game.entities.id(game.entities.add({ position, ...components }));
    if (id === undefined) throw new Error("No id");
    return id;
  };
  const { campfire, woodpile, sled } = setup;
  const campfireId =
    campfire === undefined
      ? -1
      : addAway({
          campfire: { lit: campfire.lit ?? false, fuelMinutes: campfire.fuelMinutes ?? 0 },
          ...(campfire.pot === undefined ? {} : { potOnFire: { water: campfire.pot, minutesBoiling: 0 } }),
          ...(campfire.fish === undefined ? {} : { fishOnFire: campfire.fish.map((cooked) => ({ minutesCooked: cooked ? COOK_MINUTES : 0 })) }),
          ...(campfire.jug === undefined ? {} : { jugOnFire: { minutesFired: campfire.jug ? FIRE_JUG_MINUTES : 0 } }),
        });
  const woodpileId = woodpile === undefined ? -1 : addAway({ woodpile: { log: 0, debarkedLog: 0, firewood: 0, ...woodpile } });
  const sledId = sled === undefined ? -1 : addAway({ sled: { log: 0, debarkedLog: 0, plank: 0, ...sled }, facing: { turns: 0 } });
  if (setup.dragging !== undefined) {
    const dragged = setup.dragging === "thisSled" ? sledId : addAway({ sled: { log: 0, debarkedLog: 0, plank: 0 }, facing: { turns: 0 } });
    game.entities.addComponent(player, "dragging", { sledId: dragged });
  }
  /** Pausing keeps time still, and stepping makes the view show what was set up. */
  const refresh = (): void => {
    game.client.send({ type: "setPaused", paused: true });
    game.step();
  };
  refresh();
  const add = (components: Entity): number => {
    const id = addAway(components);
    refresh();
    return id;
  };
  return {
    game,
    reader: game.client,
    campfire: campfireId,
    woodpile: woodpileId,
    sled: sledId,
    add,
    addBlueprint: (structure, delivered = {}) => add({ blueprint: { structure, progress: 0, materialsSpent: 0, delivered }, facing: { turns: 0 } }),
    openStorage: (furniture) => {
      const { x, y, z } = player.position;
      const id = game.entities.id(game.entities.add({ furniture, storage: { contents: {} }, facing: { turns: 0 }, position: { x: x + 1, y, z } }));
      if (id === undefined) throw new Error("No id");
      game.client.send({ type: "setPaused", paused: false });
      game.client.send({ type: "openChest", chestId: id });
      game.step();
      refresh();
      return id;
    },
  };
}

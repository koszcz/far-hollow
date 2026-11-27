import { afterEach, beforeEach, describe, expect, it, type Mock, spyOn } from "bun:test";
import type { ActionCommand } from "./api-commands";
import type { Entity } from "./entities";
import { createGame, type Game } from "./game";
import { describeSave, readSave, writeSave } from "./save";
import { isValidSave } from "./save-schema";

/** One sample of every action command type. TypeScript reports a type that has no sample. */
const SAMPLES: { readonly [Type in ActionCommand["type"]]: Extract<ActionCommand, { type: Type }> } = {
  setPaused: { type: "setPaused", paused: true },
  walkTo: { type: "walkTo", x: 1, z: 2 },
  chopTree: { type: "chopTree", treeId: 3 },
  digUpSapling: { type: "digUpSapling", saplingId: 3 },
  plantSapling: { type: "plantSapling", x: 1, z: 2 },
  digUpBerryBush: { type: "digUpBerryBush", bushId: 3 },
  plantBerryBush: { type: "plantBerryBush", x: 1, z: 2 },
  pickUpLog: { type: "pickUpLog", logId: 3 },
  debarkLog: { type: "debarkLog", logId: 3 },
  plantMushroom: { type: "plantMushroom", logId: 3 },
  takeDownMushroomLog: { type: "takeDownMushroomLog", mushroomLogId: 3 },
  pickUpStick: { type: "pickUpStick", stickId: 3 },
  pickUpBark: { type: "pickUpBark", barkId: 3 },
  forage: { type: "forage", spotId: 3 },
  eat: { type: "eat", food: "smokedFish" },
  splitLog: { type: "splitLog", logId: 3 },
  dropLog: { type: "dropLog" },
  dropLogAt: { type: "dropLogAt", x: 1, z: 2 },
  dropFromBackpack: { type: "dropFromBackpack", content: "stick" },
  pickUpPile: { type: "pickUpPile", pileId: 3 },
  placeBlueprint: { type: "placeBlueprint", structure: "campfire", turns: 1, thenBuild: true, x: 1, z: 2 },
  buildAddOn: { type: "buildAddOn", hostId: 3 },
  build: { type: "build", blueprintId: 3 },
  deliverToBlueprint: { type: "deliverToBlueprint", blueprintId: 3 },
  takeDown: { type: "takeDown", pieceId: 3 },
  stopBuilding: { type: "stopBuilding" },
  tendCampfire: { type: "tendCampfire", campfireId: 3 },
  addFuel: { type: "addFuel", campfireId: 3, fuel: "stick" },
  tendWoodpile: { type: "tendWoodpile", woodpileId: 3 },
  stackOnWoodpile: { type: "stackOnWoodpile", woodpileId: 3, wood: "log", all: false },
  takeFromWoodpile: { type: "takeFromWoodpile", woodpileId: 3, wood: "log" },
  loadSled: { type: "loadSled", sledId: 3 },
  takeFromSled: { type: "takeFromSled", sledId: 3, log: "debarkedLog" },
  loadPlanksOnSled: { type: "loadPlanksOnSled", sledId: 3 },
  takePlanksFromSled: { type: "takePlanksFromSled", sledId: 3 },
  tipOutSled: { type: "tipOutSled", sledId: 3 },
  dragSled: { type: "dragSled", sledId: 3 },
  letGoOfSled: { type: "letGoOfSled" },
  fillSled: { type: "fillSled", sledId: 3 },
  openChest: { type: "openChest", chestId: 3 },
  putInChest: { type: "putInChest", chestId: 3, content: "stick", all: true },
  takeFromChest: { type: "takeFromChest", chestId: 3, content: "stick", all: false },
  lightCampfire: { type: "lightCampfire", campfireId: 3 },
  putOutCampfire: { type: "putOutCampfire", campfireId: 3 },
  layBedroll: { type: "layBedroll" },
  layBedrollInLeanTo: { type: "layBedrollInLeanTo", leanToId: 3 },
  pickUpBedroll: { type: "pickUpBedroll", bedrollId: 3 },
  sleep: { type: "sleep", bedrollId: 3 },
  sleepInBed: { type: "sleepInBed", bedId: 3 },
  sitOnStool: { type: "sitOnStool", stoolId: 3 },
  drinkFromRiver: { type: "drinkFromRiver", x: 1, z: 2 },
  fish: { type: "fish", x: 1, z: 2 },
  setFishTrap: { type: "setFishTrap", x: 1, z: 2 },
  takeFishFromTrap: { type: "takeFishFromTrap", trapId: 3 },
  pickUpFishTrap: { type: "pickUpFishTrap", trapId: 3 },
  gatherStone: { type: "gatherStone", x: 1, z: 2 },
  digClay: { type: "digClay", x: 1, z: 2 },
  fillPot: { type: "fillPot" },
  drinkFromPot: { type: "drinkFromPot" },
  pourIntoJug: { type: "pourIntoJug" },
  drinkFromJug: { type: "drinkFromJug" },
  drinkFromRainBarrel: { type: "drinkFromRainBarrel", barrelId: 3 },
  fillPotFromRainBarrel: { type: "fillPotFromRainBarrel", barrelId: 3 },
  fillJugFromRainBarrel: { type: "fillJugFromRainBarrel", barrelId: 3 },
  hangOnRack: { type: "hangOnRack", rackId: 3, food: "berries" },
  takeFoodOffRack: { type: "takeFoodOffRack", rackId: 3 },
  putInWoodBox: { type: "putInWoodBox", woodBoxId: 3, all: true },
  takeFromWoodBox: { type: "takeFromWoodBox", woodBoxId: 3 },
  putPotOnFire: { type: "putPotOnFire", campfireId: 3 },
  takePotOffFire: { type: "takePotOffFire", campfireId: 3 },
  cookFish: { type: "cookFish", campfireId: 3 },
  takeFishOff: { type: "takeFishOff", campfireId: 3 },
  fireJug: { type: "fireJug", campfireId: 3 },
  takeJugOff: { type: "takeJugOff", campfireId: 3 },
  craft: { type: "craft", recipe: "planks", stationId: 3 },
  lightTorch: { type: "lightTorch" },
  putOutTorch: { type: "putOutTorch" },
  plantTorch: { type: "plantTorch" },
  pickUpTorch: { type: "pickUpTorch", torchId: 3 },
  setShutters: { type: "setShutters", shuttersId: 3, open: true },
  setJournalHidden: { type: "setJournalHidden", hidden: true },
  skipTime: { type: "skipTime", hours: 2 },
  skipToRainChange: { type: "skipToRainChange" },
  skipToSeason: { type: "skipToSeason" },
};

describe("the save check for a stored command", () => {
  it("accepts a sample of every action command type", () => {
    const save = withApproach(writeSave(createGame({ seed: 5 })), SAMPLES.walkTo);
    const player = save.entities.find((entity) => entity.components.player);
    // Only the player matters here, and a small save keeps the check fast.
    save.entities = player === undefined ? [] : [player];
    for (const [type, command] of Object.entries(SAMPLES)) {
      if (player !== undefined) player.components.approach = { command };
      expect({ type, valid: isValidSave(save) }).toEqual({ type, valid: true });
    }
  });
});

describe("a saved approach whose command fails its check", () => {
  let warn: Mock<typeof console.warn>;
  beforeEach(() => {
    warn = spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    warn.mockRestore();
  });

  it("is dropped on load, while the player keeps walking and the rest of the game stays", () => {
    const game = gameWalkingToAStick();
    const saved = writeSave(game);
    const broken = withApproach(saved, { type: "wander" });

    const loaded = readSave(broken);
    if (!loaded.ok) throw new Error("The save was rejected");
    const player = loaded.game.entities.with("player").first;
    expect(player?.approach).toBeUndefined();
    expect(player?.walkPath).toEqual(onlyPlayerOf(saved).walkPath);
    const { approach: _dropped, ...kept } = onlyPlayerOf(saved);
    expect(onlyPlayerOf(writeSave(loaded.game))).toEqual(kept);
    expect({ ...writeSave(loaded.game), entities: undefined }).toEqual({ ...saved, entities: undefined });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("wander");
  });

  it("does not stop the start screen from showing the slot as filled", () => {
    const broken = withApproach(writeSave(gameWalkingToAStick()), { type: "wander" });
    expect(describeSave(broken).state).toBe("filled");
  });

  it("keeps a save with an approach that is fine", () => {
    const saved = writeSave(gameWalkingToAStick());
    expect(onlyPlayerOf(saved).approach).toBeDefined();
    const loaded = readSave(structuredClone(saved));
    expect(loaded.ok && loaded.game.entities.with("player").first?.approach).toEqual(onlyPlayerOf(saved).approach);
  });

  it("does not hide any other fault: the save is still refused", () => {
    const broken = withApproach(writeSave(gameWalkingToAStick()), { type: "wander" });
    const entities = broken.entities.map((entity) => (entity.components.player ? { ...entity, components: { ...entity.components, fishCasts: -1 } } : entity));
    expect(readSave({ ...broken, entities })).toEqual({ ok: false, reason: "notASave" });
    expect(describeSave({ ...broken, entities }).state).toBe("broken");
  });
});

function gameWalkingToAStick(): Game {
  const game = createGame({ seed: 42 });
  const player = game.entities.with("player", "position").first;
  if (player === undefined) throw new Error("No player");
  const distance = (stick: { position: { x: number; z: number } }) => Math.hypot(stick.position.x - player.position.x, stick.position.z - player.position.z);
  const nearest = [...game.entities.with("stick", "position")].sort((a, b) => distance(a) - distance(b))[0];
  const id = nearest && game.entities.id(nearest);
  if (id === undefined) throw new Error("No stick");
  game.client.send({ type: "pickUpStick", stickId: id });
  game.step();
  if (player.approach === undefined) throw new Error("The player is not walking to the stick");
  return game;
}

type StoredSave = ReturnType<typeof writeSave>;

/** A copy of the save in which the player's approach holds this command. */
function withApproach(save: StoredSave, command: object): StoredSave {
  const copy = structuredClone(save);
  const player = copy.entities.find((entity) => entity.components.player);
  if (player === undefined) throw new Error("No player");
  player.components.approach = { command } as { command: ActionCommand };
  return copy;
}

function onlyPlayerOf(save: StoredSave): Entity {
  const player = save.entities.find((entity) => entity.components.player);
  if (player === undefined) throw new Error("No player");
  return player.components;
}

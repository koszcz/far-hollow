import { describe, expect, it } from "bun:test";
import { createGame } from "./game";
import { finishedSawhorseNearPlayer, give, send, idOf } from "./planks-test-helpers";
import { readSave, writeSave } from "./save";
import { LARGE_VALLEY_UPGRADES, SAVE_VERSION } from "./save-upgrades";
import { CRAFTING_SAVE_VERSION, NOTICES_NAME_STATION_SAVE_VERSION, PLANKS_SAVE_VERSION } from "./save-versions";

/** Loads a save made before the valley shrank, the way the game loaded it then. */
const readLargeValleySave = (data: unknown) => readSave(data, LARGE_VALLEY_UPGRADES);

describe("saving planks", () => {
  it("keeps planks in the backpack, at a newer save version", () => {
    const game = createGame({ seed: 42 });
    give(game, { plank: 4 });
    const saved = writeSave(game);
    expect(saved.version).toBe(SAVE_VERSION);
    expect(PLANKS_SAVE_VERSION).toBeGreaterThan(CRAFTING_SAVE_VERSION);

    const loaded = readSave(JSON.parse(JSON.stringify(saved)));
    if (!loaded.ok) throw new Error("The save was rejected");
    expect(loaded.game.client.getView().backpack.plank).toBe(4);
  });

  it("loads a save from before planks", () => {
    const save = JSON.parse(JSON.stringify(writeSave(createGame({ seed: 42 })))) as { version: number };
    save.version = PLANKS_SAVE_VERSION - 1;
    expect(readLargeValleySave(save).ok).toBe(true);
  });
});

describe("saving a notice about crafting", () => {
  it("keeps what the notice names, such as the station or the missing tool", () => {
    const game = createGame({ seed: 42 });
    const sawhorse = finishedSawhorseNearPlayer(game);
    send(game, { type: "craft", recipe: "planks", stationId: idOf(game, sawhorse) });
    const notice = game.client.getView().notice;
    expect(notice?.kind).toBe("cannotCraftYet");

    const loaded = readSave(JSON.parse(JSON.stringify(writeSave(game))));
    if (!loaded.ok) throw new Error("The save was rejected");
    expect(loaded.game.client.getView().notice).toEqual(notice);
  });

  it("names the sawhorse in a notice that no log lies beside the station, from a save made before notices named it", () => {
    const save = JSON.parse(JSON.stringify(writeSave(createGame({ seed: 42 })))) as { version: number; notice: unknown };
    save.version = NOTICES_NAME_STATION_SAVE_VERSION - 1;
    save.notice = { kind: "noLogBesideStation", untilMinutes: 10_000 };

    const loaded = readLargeValleySave(save);
    if (!loaded.ok) throw new Error("The save was rejected");
    expect(loaded.game.client.getView().notice).toEqual({ kind: "noLogBesideStation", station: "sawhorse" });
  });
});

import { describe, expect, it } from "bun:test";
import { createGame } from "../sim/game";
import { readSave, SAVE_VERSION, SMALL_VALLEY_SAVE_VERSION, SNUG_ROOM_NOTICE_SAVE_VERSION, writeSave } from "../sim/save";
import { saveExportFile } from "./save-export";
import { importSaveFile } from "./save-import";

/** A saved game as a file's text, the way export writes it. */
function fileText(save: unknown): string {
  return JSON.stringify(save, null, 2);
}

describe("importing a saved game from a file", () => {
  it("refuses a file that is not JSON", () => {
    expect(importSaveFile("far hollow {")).toEqual({ ok: false, reason: "notASave" });
  });

  it("refuses JSON that is not a Far Hollow saved game", () => {
    expect(importSaveFile(fileText({ name: "a shopping list", items: ["eggs"] }))).toEqual({ ok: false, reason: "notASave" });
    expect(importSaveFile(fileText([1, 2, 3]))).toEqual({ ok: false, reason: "notASave" });
    expect(importSaveFile("null")).toEqual({ ok: false, reason: "notASave" });
  });

  it("refuses a damaged saved game", () => {
    const save = { ...writeSave(createGame({ seed: 5 })), clockMinutes: "noon" };
    expect(importSaveFile(fileText(save))).toEqual({ ok: false, reason: "notASave" });
  });

  it("refuses a saved game made in the 1 km valley", () => {
    const save = { ...writeSave(createGame({ seed: 5 })), version: SMALL_VALLEY_SAVE_VERSION - 1 };
    expect(importSaveFile(fileText(save))).toEqual({ ok: false, reason: "largeValley" });
  });

  it("refuses a saved game made by a newer version of the game", () => {
    const save = { ...writeSave(createGame({ seed: 5 })), version: SAVE_VERSION + 1 };
    expect(importSaveFile(fileText(save))).toEqual({ ok: false, reason: "newerVersion" });
  });

  it("upgrades an older saved game to the newest version", () => {
    const { snugRoomNoticeShown: _, ...older } = { ...writeSave(createGame({ seed: 5 })), version: SNUG_ROOM_NOTICE_SAVE_VERSION - 1 };

    const imported = importSaveFile(fileText(older));

    if (!imported.ok) throw new Error(`The file was refused: ${imported.reason}`);
    expect(imported.save.version).toBe(SAVE_VERSION);
    expect(imported.save.snugRoomNoticeShown).toBe(false);
    expect(imported.save.seed).toBe(5);
  });

  it("imports a file that export wrote, and the game continues as it was", () => {
    const game = createGame({ seed: 4321 });
    game.client.send({ type: "skipTime", hours: 20 });
    game.step();
    const stored = structuredClone(writeSave(game));
    const file = saveExportFile(0, stored);
    if (file === undefined) throw new Error("Nothing was exported");

    const imported = importSaveFile(file.text);

    if (!imported.ok) throw new Error(`The file was refused: ${imported.reason}`);
    expect(imported.save).toEqual(stored);
    const loaded = readSave(structuredClone(imported.save));
    if (!loaded.ok) throw new Error("The imported save did not load");
    expect(loaded.game.client.getView()).toEqual(game.client.getView());
  });
});

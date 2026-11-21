import { describe, expect, it } from "bun:test";
import { createGame } from "../sim/game";
import { writeSave } from "../sim/save";
import { saveExportFile, unreadableSlotExportFile } from "./save-export";

describe("exporting a save slot to a file", () => {
  it("names a filled slot's file after the slot and the day, and holds the stored saved game", () => {
    const game = createGame({ seed: 4321 });
    game.client.send({ type: "skipTime", hours: 20 });
    game.step();
    const stored = structuredClone(writeSave(game));

    const file = saveExportFile(0, stored);

    expect(file?.name).toBe("far-hollow-slot-1-day-2.json");
    expect(JSON.parse(file?.text ?? "")).toEqual(stored);
  });

  it("names a broken slot's file after the slot, and holds the raw data as stored", () => {
    const stored = { version: 3, seed: "not a number", notes: ["kept as is"] };

    const file = saveExportFile(1, stored);

    expect(file?.name).toBe("far-hollow-slot-2-broken.json");
    expect(JSON.parse(file?.text ?? "")).toEqual({ version: 3, seed: "not a number", notes: ["kept as is"] });
  });

  it("names a slot the browser could not read as broken, and holds the read error instead of empty data", () => {
    const file = unreadableSlotExportFile(1, new Error("The stored value could not be read"));

    expect(file.name).toBe("far-hollow-slot-2-broken.json");
    expect(JSON.parse(file.text)).toEqual({ unreadable: "Error: The stored value could not be read" });
  });

  it("writes readable JSON, one value per line", () => {
    const file = saveExportFile(0, structuredClone(writeSave(createGame({ seed: 8 }))));

    expect(file?.text.split("\n").length).toBeGreaterThan(10);
  });

  it("has nothing to export from an empty slot", () => {
    expect(saveExportFile(2, undefined)).toBeUndefined();
  });

  it("leaves the stored saved game unchanged", () => {
    const stored = structuredClone(writeSave(createGame({ seed: 8 })));
    const before = structuredClone(stored);

    saveExportFile(0, stored);

    expect(stored).toEqual(before);
  });
});

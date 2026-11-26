import { describe, expect, it } from "bun:test";
import { createGame } from "./game";
import { FURNITURE } from "./furniture";
import { FURNITURE_PART_SAVE_VERSION, readSave, SAVE_VERSION, writeSave, type SaveFile } from "./save";
import { FURNITURE_KINDS } from "./structure-kind";
import { structureOf } from "./structures";
import { piecesOf, storingPiecesOf } from "./test-steps";

describe("the furniture list", () => {
  it("builds each piece's structure from its definition", () => {
    for (const kind of FURNITURE_KINDS) {
      const structure = structureOf(kind);
      const piece = FURNITURE[kind];
      expect(structure).toMatchObject({ kind, placement: "anywhere", finishedAs: "furniture", cost: piece.cost, buildSeconds: piece.buildSeconds });
      expect(structure.tool).toBe(piece.tool);
    }
  });

  it("lists the furniture in the build menu in the order FURNITURE_KINDS names it", () => {
    const menu = createGame({ seed: 42 })
      .client.getView()
      .buildMenu.map(({ structure }) => structure);
    expect(menu.filter((structure) => (FURNITURE_KINDS as readonly string[]).includes(structure))).toEqual([...FURNITURE_KINDS]);
  });
});

describe("loading a save from before one part marked all furniture", () => {
  /** A save of a new game with one of each piece of furniture in the form older saves stored it, as the version before wrote it. */
  function saveWithOldFurniture(): SaveFile {
    const save = JSON.parse(JSON.stringify(writeSave(createGame({ seed: 42 })))) as SaveFile;
    save.version = FURNITURE_PART_SAVE_VERSION - 1;
    const nextId = Math.max(...save.entities.map(({ id }) => id)) + 1;
    const at = (x: number) => ({ position: { x, y: 0, z: 0 }, facing: { turns: 1 } });
    const old: Record<string, unknown>[] = [
      { ...at(10), chest: { contents: { stick: 4, pot: 1 } }, blocksWalking: { radius: 0.71 } },
      { ...at(12), shelf: { contents: { berries: 3 } }, blocksWalking: { radius: 0.71 } },
      { ...at(14), bed: true, blocksWalkingSpots: [{ x: 14, z: 0 }] },
      { ...at(16), table: true, blocksWalkingSpots: [{ x: 16, z: 0 }] },
      { ...at(18), stool: true, blocksWalking: { radius: 0.71 } },
    ];
    save.entities.push(...old.map((components, index) => ({ id: nextId + index, components: components as SaveFile["entities"][number]["components"] })));
    return save;
  }

  it("raises the save version", () => {
    expect(FURNITURE_PART_SAVE_VERSION).toBeLessThanOrEqual(SAVE_VERSION);
  });

  it("keeps every piece of furniture, where it stood and the way it faced", () => {
    const loaded = readSave(saveWithOldFurniture());
    if (!loaded.ok) throw new Error("The save did not load");

    const pieces = FURNITURE_KINDS.map((kind) => piecesOf(loaded.game.entities, kind).map(({ position, facing }) => ({ kind, x: position.x, facing })));
    expect(pieces).toEqual([
      [{ kind: "chest", x: 10, facing: { turns: 1 } }],
      [{ kind: "shelf", x: 12, facing: { turns: 1 } }],
      [{ kind: "bed", x: 14, facing: { turns: 1 } }],
      [{ kind: "table", x: 16, facing: { turns: 1 } }],
      [{ kind: "stool", x: 18, facing: { turns: 1 } }],
      // Rain barrels and wood boxes came after one part marked all furniture, so no save this old holds one.
      [],
      [],
    ]);
    for (const entity of loaded.game.entities) {
      for (const oldPart of ["chest", "shelf", "bed", "table", "stool"]) expect(entity).not.toHaveProperty(oldPart);
    }
  });

  it("keeps everything in each chest and shelf, and gives nothing else a store", () => {
    const loaded = readSave(saveWithOldFurniture());
    if (!loaded.ok) throw new Error("The save did not load");

    expect(storingPiecesOf(loaded.game.entities, "chest").map(({ storage }) => storage)).toEqual([{ contents: { stick: 4, pot: 1 } }]);
    expect(storingPiecesOf(loaded.game.entities, "shelf").map(({ storage }) => storage.contents)).toEqual([{ berries: 3 }]);
    for (const kind of ["bed", "table", "stool"] as const) expect(piecesOf(loaded.game.entities, kind)[0]?.storage).toBeUndefined();
  });
});

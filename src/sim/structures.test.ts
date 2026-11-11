// Checks every structure in the catalogue the same way, so a new structure kind gets these checks without new tests.
import { describe, expect, it } from "vitest";
import { createEntityStore } from "./entities";
import { createGame } from "./game";
import { readSave, writeSave } from "./save";
import { finishedStructures, footprintOfEntity, placedStructures, STRUCTURES, structureKindOf, type PlacedStructure } from "./structures";

const SPOT = { x: 10, z: -4 };

describe.each(STRUCTURES.map((definition) => [definition.kind, definition] as const))("the %s in the structure catalogue", (kind, definition) => {
  it("is recognised as its own kind once finished", () => {
    const entities = createEntityStore();
    const finished = entities.add({ ...definition.finish(SPOT, 1, entities), position: { x: SPOT.x, y: 0, z: SPOT.z }, facing: { turns: 1 } });

    expect(structureKindOf(finished)).toBe(kind);
    expect(finishedStructures(entities)).toEqual([{ entity: finished, kind }]);
  });

  it("is recognised as its own kind as a blueprint", () => {
    const entities = createEntityStore();
    const blueprint = entities.add({
      blueprint: { structure: kind, progress: 0, materialsSpent: 0, delivered: {} },
      position: { x: SPOT.x, y: 0, z: SPOT.z },
      facing: { turns: 1 },
    });

    expect(structureKindOf(blueprint)).toBe(kind);
    expect(finishedStructures(entities)).toEqual([]);
    expect(placedStructures(entities)).toEqual([{ entity: blueprint, kind }]);
  });

  it("covers the same ground finished as it does as a blueprint", () => {
    const entities = createEntityStore();
    const position = { x: SPOT.x, y: 0, z: SPOT.z };
    const finished = entities.add({ ...definition.finish(SPOT, 1, entities), position, facing: { turns: 1 } }) as PlacedStructure;
    const blueprint = entities.add({ blueprint: { structure: kind, progress: 0, materialsSpent: 0, delivered: {} }, position, facing: { turns: 1 } }) as PlacedStructure;

    expect(footprintOfEntity(finished)).toEqual(footprintOfEntity(blueprint));
    expect(footprintOfEntity(finished)).toEqual(definition.footprint(SPOT, 1));
  });

  it("survives saving and loading, finished and as a blueprint", () => {
    const game = createGame({ seed: 42 });
    const position = { x: SPOT.x, y: 0, z: SPOT.z };
    game.entities.add({ ...definition.finish(SPOT, 1, game.entities), position, facing: { turns: 1 } });
    game.entities.add({ blueprint: { structure: kind, progress: 0.5, materialsSpent: 0, delivered: {} }, position: { ...position, x: position.x + 3 }, facing: { turns: 2 } });

    const loaded = readSave(JSON.parse(JSON.stringify(writeSave(game))));

    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(finishedStructures(loaded.game.entities).map((placed) => placed.kind)).toEqual([kind]);
    expect(placedStructures(loaded.game.entities).map((placed) => placed.kind)).toEqual([kind, kind]);
  });
});

import { describe, expect, it } from "bun:test";
import { createGame } from "./game";
import { readSave, writeSave } from "./save";
import { SAVE_VERSION } from "./save-upgrades";
import { ROOF_FRAMES_SAVE_VERSION, SLEDS_SAVE_VERSION } from "./save-versions";
import {
  finishedSledNearPlayer,
  buildFully,
  deliverLogs,
  openSquareNearPlayer,
  place,
  onlyBlueprint,
  send,
  stepUntil,
  onlyPlayer,
  idOf,
} from "./sled-test-helpers";

describe("saving sleds", () => {
  it("keeps sleds and sled blueprints, where they stand and which way they face", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    send(game, place("sled", square.x, square.z, 1));
    buildFully(game, onlyBlueprint(game));
    send(game, place("sled", square.x + 1.3, square.z + 0.1, 2));
    deliverLogs(game, onlyBlueprint(game), 1);

    const loaded = readSave(JSON.parse(JSON.stringify(writeSave(game))));
    if (!loaded.ok) throw new Error("The save did not load");

    const sleds = loaded.game.entities.with("sled", "position").entities;
    expect(sleds.map(({ position, facing, sled }) => ({ x: position.x, z: position.z, facing, sled }))).toEqual([
      { x: square.x, z: square.z, facing: { turns: 1 }, sled: { log: 0, debarkedLog: 0, plank: 0 } },
    ]);
    const plans = loaded.game.entities.with("blueprint", "position").entities;
    expect(plans.map(({ blueprint, position, facing }) => ({ structure: blueprint.structure, x: position.x, facing, delivered: blueprint.delivered }))).toEqual(
      [{ structure: "sled", x: square.x + 1.3, facing: { turns: 2 }, delivered: { log: 1 } }],
    );
  });

  it("keeps what each sled holds, and a sled command the player is walking to carry out", () => {
    const game = createGame({ seed: 42 });
    const sled = finishedSledNearPlayer(game);
    sled.sled = { log: 3, debarkedLog: 2, plank: 0 };
    send(game, { type: "walkTo", x: sled.position.x + 10, z: sled.position.z });
    stepUntil(game, () => onlyPlayer(game).walkPath === undefined);
    send(game, { type: "takeFromSled", sledId: idOf(game, sled), log: "debarkedLog" });
    expect(onlyPlayer(game).approach).toEqual({ command: { type: "takeFromSled", sledId: idOf(game, sled), log: "debarkedLog" } });

    const loaded = readSave(JSON.parse(JSON.stringify(writeSave(game))));
    if (!loaded.ok) throw new Error("The save did not load");
    const loadedSled = loaded.game.entities.with("sled").first;
    expect(loadedSled?.sled).toEqual({ log: 3, debarkedLog: 2, plank: 0 });
    stepUntil(loaded.game, () => loaded.game.client.getView().carrying !== null);
    expect(loadedSled?.sled).toEqual({ log: 3, debarkedLog: 1, plank: 0 });
  });

  it("raises the save version, and upgrades an older save when it is loaded", () => {
    const game = createGame({ seed: 42 });
    const save = { ...writeSave(game), version: SLEDS_SAVE_VERSION - 1 };

    expect(SLEDS_SAVE_VERSION).toBeLessThanOrEqual(SAVE_VERSION);
    expect(SLEDS_SAVE_VERSION).toBeGreaterThan(ROOF_FRAMES_SAVE_VERSION);
    const loaded = readSave(JSON.parse(JSON.stringify(save)));
    if (!loaded.ok) throw new Error("The older save did not load");
    expect(writeSave(loaded.game).version).toBe(SAVE_VERSION);
    expect(loaded.game.entities.with("sled").size).toBe(0);
  });

  it("turns away a saved sled holding something other than logs", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    send(game, place("sled", square.x, square.z, 0));
    buildFully(game, onlyBlueprint(game));
    const save = JSON.parse(JSON.stringify(writeSave(game))) as { entities: { components: Record<string, unknown> }[] };
    for (const { components } of save.entities) if (components.sled !== undefined) components.sled = { log: 0, debarkedLog: 0, firewood: 2 };

    expect(readSave(save).ok).toBe(false);
  });
});

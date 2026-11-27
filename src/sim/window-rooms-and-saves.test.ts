import { describe, expect, it } from "bun:test";
import { createGame } from "./game";
import { isUnderRoof } from "./roofs";
import { readSave, writeSave } from "./save";
import { SAVE_VERSION } from "./save-upgrades";
import { SNUG_ROOM_NOTICE_SAVE_VERSION, WINDOWS_SAVE_VERSION } from "./save-versions";
import { firelitWindows } from "./window-glow";
import {
  cabinNearPlayer,
  deckTop,
  finishedFoundationAt,
  finishedPieceAt,
  finishedShutters,
  finishShutters,
  idOf,
  lastBlueprint,
  lightIn,
  onlyPlayer,
  openSquareNearPlayer,
  place,
  send,
  stepUntil,
  windowOf,
} from "./window-test-helpers";
describe("rooms with windows", () => {
  it("count a finished window as a closed side, and its shutters decide whether the room is snug", () => {
    const game = createGame({ seed: 42 });
    const [square] = cabinNearPlayer(game);
    expect(game.client.describeRooms()).toMatchObject([{ snug: false }]);

    const window = windowOf(game);
    const closed: { open: boolean } = { open: false };
    const shutters = game.entities.add({
      shutters: closed,
      facing: { ...(window.facing ?? { turns: 0 }) },
      position: { ...window.position },
    });
    expect(game.client.describeRooms()).toMatchObject([{ snug: true }]);

    shutters.shutters.open = true;
    expect(game.client.describeRooms()).toMatchObject([{ snug: false }]);
    shutters.shutters.open = false;
    expect(game.client.describeRooms()).toMatchObject([{ snug: true }]);
    expect(game.client.describeRooms()[0]?.squares).toContainEqual(square);
  });

  it("does not count a shutters blueprint", () => {
    const game = createGame({ seed: 42 });
    cabinNearPlayer(game);
    send(game, place("shutters", windowOf(game).position, 0));

    expect(game.client.describeRooms()).toMatchObject([{ snug: false }]);
  });

  it("keeps the rain out, whether the shutters are open or closed", () => {
    const game = createGame({ seed: 42 });
    const [square] = cabinNearPlayer(game);
    const window = windowOf(game);
    game.entities.add({ shutters: { open: true }, facing: { ...(window.facing ?? { turns: 0 }) }, position: { ...window.position } });

    expect(isUnderRoof(game.entities, square)).toBe(true);
  });

  it("lets a window hold up a roof frame, so it cannot come down", () => {
    const game = createGame({ seed: 42 });
    cabinNearPlayer(game);

    expect(game.client.refusal({ type: "takeDown", pieceId: idOf(game, windowOf(game)) })).toEqual({ kind: "holdsUpPiece" });
  });
});

describe("the window's night glow", () => {
  it("shows in an open window when a lit campfire, fireplace, or torch is in its room, facing away from the room", () => {
    for (const light of ["campfire", "fireplace", "plantedTorch", "handTorch"] as const) {
      const game = createGame({ seed: 42 });
      const [, second] = cabinNearPlayer(game);
      expect(firelitWindows(game.entities)).toEqual([]);

      lightIn(game, light, second);

      expect(firelitWindows(game.entities)).toEqual([{ window: windowOf(game), outward: 1 }]);
    }
  });

  it("shows in a window with open shutters, but not with closed ones", () => {
    const game = createGame({ seed: 42 });
    const [, second] = cabinNearPlayer(game);
    lightIn(game, "campfire", second);
    const window = windowOf(game);
    const shutters: { open: boolean } = { open: false };
    game.entities.add({ shutters, facing: { ...(window.facing ?? { turns: 0 }) }, position: { ...window.position } });
    expect(firelitWindows(game.entities)).toEqual([]);

    shutters.open = true;
    expect(firelitWindows(game.entities)).toHaveLength(1);
  });

  it("does not show with an unlit fire in the room, or a lit fire outside it", () => {
    const game = createGame({ seed: 42 });
    const [first, second] = cabinNearPlayer(game);
    game.entities.add({ campfire: { lit: false, fuelMinutes: 60 }, onFoundation: second, position: { x: second.x, y: deckTop(game, second), z: second.z } });
    const outside = { x: first.x - 2, z: first.z };
    game.entities.add({ campfire: { lit: true, fuelMinutes: 60 }, position: { x: outside.x, y: 0, z: outside.z } });
    game.entities.add({ plantedTorch: { minutesLeft: 60 }, position: { x: outside.x, y: 0, z: outside.z + 1 } });

    expect(firelitWindows(game.entities)).toEqual([]);
  });

  it("does not show in a window whose foundations are not a room", () => {
    const game = createGame({ seed: 42 });
    const [, second] = cabinNearPlayer(game);
    lightIn(game, "plantedTorch", second);
    const roof = game.entities.with("cabinRoof", "position").entities.find(({ position }) => position.x === second.x && position.z === second.z);
    if (roof === undefined) throw new Error("No roof");
    game.entities.remove(roof);

    expect(firelitWindows(game.entities)).toEqual([]);
  });
});

describe("saving windows and shutters", () => {
  it("restores a window with its edge and facing, and shutters with their state", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    finishedFoundationAt(game, square);
    const shut = finishedPieceAt(game, "window", square, 0);
    const open = finishedPieceAt(game, "window", square, 2);
    send(game, place("shutters", shut.position, 0));
    finishShutters(game, lastBlueprint(game, "shutters"));
    send(game, place("shutters", open.position, 0));
    const opened = lastBlueprint(game, "shutters");
    finishShutters(game, opened);
    send(game, { type: "setShutters", shuttersId: idOf(game, opened), open: true });
    stepUntil(game, () => opened.shutters?.open === true);

    const loaded = readSave(structuredClone(writeSave(game)));
    if (!loaded.ok) throw new Error("The save was rejected");

    const windows = loaded.game.entities.with("edgePiece", "position").entities.filter(({ edgePiece }) => edgePiece === "window");
    const byZ = (a: { z: number }, b: { z: number }) => a.z - b.z;
    expect(windows.map(({ facing, position }) => ({ turns: facing?.turns as number | undefined, x: position.x, z: position.z })).sort(byZ)).toEqual(
      [
        { turns: 0, x: shut.position.x, z: shut.position.z },
        { turns: 2, x: open.position.x, z: open.position.z },
      ].sort(byZ),
    );
    const shutters = loaded.game.entities.with("shutters", "position").entities;
    expect(shutters.map(({ shutters: { open: isOpen }, position }) => ({ open: isOpen, z: position.z })).sort(byZ)).toEqual(
      [
        { open: false, z: shut.position.z },
        { open: true, z: open.position.z },
      ].sort(byZ),
    );
  });

  it("saves a player on the way to open shutters", () => {
    const game = createGame({ seed: 42 });
    const shutters = finishedShutters(game);
    const player = onlyPlayer(game);
    player.position = { x: shutters.position.x + 8, y: player.position.y, z: shutters.position.z + 8 };
    send(game, { type: "setShutters", shuttersId: idOf(game, shutters), open: true });

    const loaded = readSave(structuredClone(writeSave(game)));

    expect(loaded.ok).toBe(true);
  });

  it("raises the save version, and loads a save from before windows", () => {
    const game = createGame({ seed: 42 });
    expect(WINDOWS_SAVE_VERSION).toBeGreaterThan(SNUG_ROOM_NOTICE_SAVE_VERSION);
    expect(WINDOWS_SAVE_VERSION).toBeLessThanOrEqual(SAVE_VERSION);
    const old = { ...writeSave(game), version: WINDOWS_SAVE_VERSION - 1 };

    const loaded = readSave(structuredClone(old));

    if (!loaded.ok) throw new Error("The save was rejected");
    expect(loaded.game.entities.with("shutters").entities).toHaveLength(0);
  });
});

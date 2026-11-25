import { describe, expect, it } from "bun:test";
import type { ScenePick, StructureKind } from "../sim/api";
import { createGame, type Game } from "../sim/game";
import { addFinished, newestBlueprint, onlyPlayer, openFoundation, type FinishedPiece } from "../sim/test-steps";
import { actionsFor, type ThingAction } from "./thing-actions";

/** A game with a finished foundation and each host on it: a door frame and a window on opposite edges, a roof frame, and a fireplace. */
function cabin(): { game: Game; doorFrame: FinishedPiece; window: FinishedPiece; roofFrame: FinishedPiece; fireplace: FinishedPiece } {
  const game = createGame({ seed: 42 });
  const square = openFoundation(game);
  const doorFrame = addFinished(game, "doorFrame", square, 0);
  const window = addFinished(game, "window", square, 2);
  const roofFrame = addFinished(game, "roofFrame", square, 0);
  const fireplace = addFinished(game, "fireplace", square, 1);
  return { game, doorFrame, window, roofFrame, fireplace };
}

/** A click on a finished structure, with the ground under it. */
function structurePick(structure: StructureKind, piece: FinishedPiece): ScenePick {
  return { kind: "structure", id: piece.id, structure, under: { kind: "ground", spot: { x: piece.position.x, z: piece.position.z } } };
}

function actionsOn(game: Game, pick: ScenePick): readonly ThingAction[] {
  return actionsFor({ kind: "scene", pick }, game.client);
}

describe("the add-on action on a finished host", () => {
  it("offers to hang a door, hang shutters, or lay the roof as the main action", () => {
    const { game, doorFrame, window, roofFrame } = cabin();

    for (const [structure, piece, label] of [
      ["doorFrame", doorFrame, "Hang a door"],
      ["window", window, "Hang shutters"],
      ["roofFrame", roofFrame, "Lay the roof"],
    ] as const) {
      const [main] = actionsOn(game, structurePick(structure, piece));
      expect(main).toMatchObject({ id: "addOn", label, isMain: true, enabled: true, command: { type: "buildAddOn", hostId: piece.id } });
    }
  });

  it("offers to build a chimney on a fireplace, after its fire, which keeps the main action", () => {
    const { game, fireplace } = cabin();

    const actions = actionsOn(game, { kind: "fireplace", id: fireplace.id });
    const chimney = actions.find(({ id }) => id === "addOn");

    expect(actions[0]?.id).not.toBe("addOn");
    expect(chimney).toMatchObject({ label: "Build a chimney", isMain: false, enabled: true, command: { type: "buildAddOn", hostId: fireplace.id } });
    expect(actionsOn(game, structurePick("fireplace", fireplace)).find(({ id }) => id === "addOn")?.label).toBe("Build a chimney");
  });

  it("shows greyed, with the game's reason, when the game would refuse to place the blueprint", () => {
    const { game, roofFrame } = cabin();
    game.entities.add({ forageSpot: { food: "berries" }, position: { x: roofFrame.position.x + 0.3, y: 0, z: roofFrame.position.z } });

    const [main] = actionsOn(game, structurePick("roofFrame", roofFrame));

    expect(main).toMatchObject({ id: "addOn", enabled: false, reason: "a berry bush is in the way" });
  });

  it("stops showing once the add-on's blueprint exists", () => {
    const { game, doorFrame } = cabin();
    onlyPlayer(game).backpack.contents = {};
    game.client.send({ type: "buildAddOn", hostId: doorFrame.id });
    game.step();
    newestBlueprint(game, "door");

    const actions = actionsOn(game, structurePick("doorFrame", doorFrame));

    expect(actions.map(({ id }) => id)).not.toContain("addOn");
    expect(actions[0]?.isMain).toBe(true);
  });

  it("is not offered by a host that is still a blueprint", () => {
    const game = createGame({ seed: 42 });
    const square = openFoundation(game);
    game.client.send({ type: "placeBlueprint", structure: "doorFrame", turns: 0, x: square.x, z: square.z });
    game.step();
    const id = game.entities.id(newestBlueprint(game, "doorFrame")) ?? -1;

    expect(actionsOn(game, { kind: "blueprint", id }).map(({ id: action }) => action)).not.toContain("addOn");
  });
});

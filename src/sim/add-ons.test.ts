import { describe, expect, it } from "bun:test";
import type { Command } from "./api";
import { DOOR_PLANK_COST } from "./structures";
import { createGame, type Game } from "./game";
import { addFinished, newestBlueprint, onlyPlayer, openFoundation, stepUntil } from "./test-steps";

describe("building an add-on from its host", () => {
  it("places a door blueprint in a finished door frame and starts building it", () => {
    const game = createGame({ seed: 42 });
    const square = openFoundation(game);
    const frame = addFinished(game, "doorFrame", square, 1);
    onlyPlayer(game).backpack.contents = { plank: DOOR_PLANK_COST };

    expect(game.client.refusal({ type: "buildAddOn", hostId: frame.id })).toBeNull();
    send(game, { type: "buildAddOn", hostId: frame.id });

    const door = newestBlueprint(game, "door");
    expect(door.position).toMatchObject({ x: frame.position.x, z: frame.position.z });
    expect(door.facing).toEqual({ turns: 1 });
    stepUntil(game, () => game.client.getView().action?.kind === "build");
    expect(onlyPlayer(game).buildTask?.blueprintId).toBe(game.entities.id(door));
  });

  it("places shutters in a window, a roof section on a roof frame, and a chimney on a fireplace", () => {
    const game = createGame({ seed: 42, freeBuilding: true });
    const square = openFoundation(game);
    addFinished(game, "logWall", square, 0);
    const window = addFinished(game, "window", square, 2);
    const frame = addFinished(game, "roofFrame", square, 3);
    const fireplace = addFinished(game, "fireplace", square, 1);

    for (const [host, addOn] of [
      [window, "shutters"],
      [frame, "roof"],
      [fireplace, "chimney"],
    ] as const) {
      send(game, { type: "buildAddOn", hostId: host.id });
      const blueprint = newestBlueprint(game, addOn);
      expect(blueprint.position).toMatchObject({ x: host.position.x, z: host.position.z });
      expect(blueprint.facing).toEqual(host.entity.facing);
      send(game, { type: "stopBuilding" });
    }
  });

  it("is refused once the host holds its add-on, finished or as a blueprint, and says so in the host's view", () => {
    const game = createGame({ seed: 42 });
    const square = openFoundation(game);
    const frame = addFinished(game, "doorFrame", square, 0);
    expect(game.client.describeThing(frame.id)).toEqual({ kind: "structure", structure: "doorFrame", holdsAddOn: false });

    send(game, { type: "buildAddOn", hostId: frame.id });
    expect(game.client.refusal({ type: "buildAddOn", hostId: frame.id })).toEqual({ kind: "holdsAddOn" });
    expect(game.client.describeThing(frame.id)).toEqual({ kind: "structure", structure: "doorFrame", holdsAddOn: true });

    const door = newestBlueprint(game, "door");
    game.entities.removeComponent(door, "blueprint");
    game.entities.addComponent(door, "door", true);
    expect(game.client.refusal({ type: "buildAddOn", hostId: frame.id })).toEqual({ kind: "holdsAddOn" });
  });

  it("is refused on a window, roof frame, or fireplace once its add-on blueprint exists", () => {
    const game = createGame({ seed: 42, freeBuilding: true });
    const square = openFoundation(game);
    addFinished(game, "logWall", square, 0);
    const hosts = [addFinished(game, "window", square, 2), addFinished(game, "roofFrame", square, 3), addFinished(game, "fireplace", square, 1)];

    for (const host of hosts) {
      expect(game.client.refusal({ type: "buildAddOn", hostId: host.id })).toBeNull();
      send(game, { type: "buildAddOn", hostId: host.id });
      send(game, { type: "stopBuilding" });
      expect(game.client.refusal({ type: "buildAddOn", hostId: host.id })).toEqual({ kind: "holdsAddOn" });
    }
  });

  it("is refused for a host that is still a blueprint, which says nothing about an add-on", () => {
    const game = createGame({ seed: 42 });
    const square = openFoundation(game);
    send(game, { type: "placeBlueprint", structure: "doorFrame", turns: 0, x: square.x, z: square.z });
    const frameId = game.entities.id(newestBlueprint(game, "doorFrame")) ?? -1;

    expect(game.client.refusal({ type: "buildAddOn", hostId: frameId })).toEqual({ kind: "finishHostFirst" });
    expect(game.client.describeThing(frameId)).toEqual({ kind: "structure", structure: "doorFrame" });
  });

  it("leaves the blueprint and says why when the player cannot start building it", () => {
    const game = createGame({ seed: 42 });
    const square = openFoundation(game);
    const frame = addFinished(game, "doorFrame", square, 0);
    onlyPlayer(game).backpack.contents = {};

    expect(game.client.refusal({ type: "buildAddOn", hostId: frame.id })).toBeNull();
    send(game, { type: "buildAddOn", hostId: frame.id });

    expect(newestBlueprint(game, "door").position).toMatchObject({ x: frame.position.x, z: frame.position.z });
    expect(game.client.getView().notice).toMatchObject({
      kind: "refused",
      refusal: { kind: "cannotBuildYet", lacks: { kind: "material", material: "plank" } },
    });
    expect(game.client.getView().action).toBeNull();
  });
});

describe("the build menu", () => {
  it("lists no add-on", () => {
    const structures = createGame({ seed: 42 })
      .client.getView()
      .buildMenu.map(({ structure }) => structure);

    for (const addOn of ["door", "shutters", "roof", "chimney"]) expect(structures).not.toContain(addOn);
    expect(structures).toContain("floor");
    expect(structures).toHaveLength(18);
  });
});

function send(game: Game, command: Command): void {
  game.client.send(command);
  game.step();
}

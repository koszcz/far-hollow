import { describe, expect, it } from "bun:test";
import { type Command } from "./api-commands";
import { createGame } from "./game";
import { addFinished, onlyPlayer, stepUntil } from "./test-steps";
import { addFirewood, gameWithWoodBox, give, roomNearPlayer, standOn, wallOn, addEdge } from "./wood-box-test-helpers";

describe("adding firewood to a fire in the same room", () => {
  it("takes the firewood from the wood box before the backpack", () => {
    const { game, box, fireplace } = gameWithWoodBox();
    box.entity.woodBox = { firewood: 2 };
    give(game, "firewood", 2);

    addFirewood(game, fireplace);

    expect(box.entity.woodBox).toEqual({ firewood: 1 });
    expect(onlyPlayer(game).backpack.contents.firewood).toBe(2);
    expect(fireplace.entity.fireplace?.fuelMinutes).toBeGreaterThan(0);
  });

  it("takes from the backpack once no wood box in the room holds firewood", () => {
    const { game, box, fireplace } = gameWithWoodBox();
    box.entity.woodBox = { firewood: 1 };
    give(game, "firewood", 2);

    addFirewood(game, fireplace);
    addFirewood(game, fireplace);

    expect(box.entity.woodBox).toEqual({ firewood: 0 });
    expect(onlyPlayer(game).backpack.contents.firewood).toBe(1);
  });

  it("is offered when only the wood box holds firewood, and refused with the reason when neither does", () => {
    const { game, box, fireplace } = gameWithWoodBox();
    const command: Command = { type: "addFuel", campfireId: fireplace.id, fuel: "firewood" };
    expect(game.client.refusal(command)).toEqual({ kind: "noContent", content: "firewood" });

    box.entity.woodBox = { firewood: 1 };
    expect(game.client.refusal(command)).toBeNull();
  });

  it("is refused while the fire is full, even with firewood in the box", () => {
    const { game, box, fireplace } = gameWithWoodBox();
    box.entity.woodBox = { firewood: 5 };
    if (fireplace.entity.fireplace === undefined) throw new Error("No fire");
    fireplace.entity.fireplace.fuelMinutes = 16 * 60;

    expect(game.client.refusal({ type: "addFuel", campfireId: fireplace.id, fuel: "firewood" })).toEqual({ kind: "fireFull" });
  });

  it("takes from the wood box nearest the fire", () => {
    const game = createGame({ seed: 42 });
    const squares = roomNearPlayer(game, 4);
    const [first, second, third, fourth] = squares;
    if (third === undefined || fourth === undefined) throw new Error("A short room");
    const fireplace = addFinished(game, "fireplace", first, 0);
    const far = addFinished(game, "woodBox", fourth, 0);
    const near = addFinished(game, "woodBox", third, 0);
    far.entity.woodBox = { firewood: 4 };
    near.entity.woodBox = { firewood: 4 };
    standOn(game, second);

    addFirewood(game, fireplace);

    expect(near.entity.woodBox).toEqual({ firewood: 3 });
    expect(far.entity.woodBox).toEqual({ firewood: 4 });
  });

  it("takes from a campfire on a foundation in the room too", () => {
    const game = createGame({ seed: 42 });
    const [first, second, third] = roomNearPlayer(game, 3);
    if (third === undefined) throw new Error("A short room");
    const campfire = addFinished(game, "campfire", first, 0);
    const box = addFinished(game, "woodBox", third, 0);
    box.entity.woodBox = { firewood: 2 };
    standOn(game, second);

    addFirewood(game, campfire);

    expect(box.entity.woodBox).toEqual({ firewood: 1 });
    expect(campfire.entity.campfire?.fuelMinutes).toBeGreaterThan(0);
  });

  it("does not walk the player to the wood box", () => {
    const { game, box, fireplace } = gameWithWoodBox();
    box.entity.woodBox = { firewood: 2 };
    const before = { ...onlyPlayer(game).position };

    addFirewood(game, fireplace);

    expect(onlyPlayer(game).position).toMatchObject({ x: before.x, z: before.z });
  });

  it("takes each queued piece from the box first, as Shift-click queues them", () => {
    const { game, box, fireplace } = gameWithWoodBox();
    box.entity.woodBox = { firewood: 2 };
    give(game, "firewood", 2);
    const command: Command = { type: "addFuel", campfireId: fireplace.id, fuel: "firewood" };

    for (let i = 0; i < 2; i += 1) game.client.send({ type: "queueAction", action: command });
    game.step();
    stepUntil(game, () => game.client.getView().actionQueue.length === 0 && game.client.getView().reach === null);

    expect(box.entity.woodBox).toEqual({ firewood: 0 });
    expect(onlyPlayer(game).backpack.contents.firewood).toBe(2);

    game.client.send({ type: "queueAction", action: command });
    game.step();
    stepUntil(game, () => game.client.getView().actionQueue.length === 0 && game.client.getView().reach === null);

    expect(onlyPlayer(game).backpack.contents.firewood).toBe(1);
  });

  it("feeds a fireplace that stands against a wall of the room, whichever way it faces", () => {
    for (const turns of [0, 1, 2, 3] as const) {
      const game = createGame({ seed: 42 });
      const [first, second, third] = roomNearPlayer(game, 3);
      if (third === undefined) throw new Error("A short room");
      // The first square has walls on three sides, so the fireplace backs onto a wall whichever way it faces.
      const fireplace = addFinished(game, "fireplace", first, turns);
      const box = addFinished(game, "woodBox", third, 0);
      box.entity.woodBox = { firewood: 2 };
      standOn(game, second);

      addFirewood(game, fireplace);

      expect(box.entity.woodBox).toEqual({ firewood: 1 });
      expect(fireplace.entity.fireplace?.fuelMinutes).toBeGreaterThan(0);
    }
  });

  it("serves no fire in another room or out in the open", () => {
    const game = createGame({ seed: 42 });
    const [first, second, third] = roomNearPlayer(game, 3);
    if (third === undefined) throw new Error("A short room");
    const box = addFinished(game, "woodBox", third, 0);
    box.entity.woodBox = { firewood: 3 };
    standOn(game, second);
    // A wall across the room splits it in two, so the box and the fire stand in different rooms.
    addEdge(game, second, 3);
    const fireplace = addFinished(game, "fireplace", first, 0);
    standOn(game, first);

    expect(game.client.refusal({ type: "addFuel", campfireId: fireplace.id, fuel: "firewood" })).toEqual({ kind: "noContent", content: "firewood" });
  });

  it("keeps its firewood when the room breaks, and serves no fire until the room is whole again", () => {
    const { game, box, fireplace, squares } = gameWithWoodBox();
    box.entity.woodBox = { firewood: 3 };
    const command: Command = { type: "addFuel", campfireId: fireplace.id, fuel: "firewood" };
    const wall = wallOn(game, squares[0], 1);
    const wallParts = { ...wall };
    game.entities.remove(wall);

    expect(game.client.refusal(command)).toEqual({ kind: "noContent", content: "firewood" });
    expect(box.entity.woodBox).toEqual({ firewood: 3 });

    game.entities.add(wallParts);
    expect(game.client.refusal(command)).toBeNull();
  });

  it("never fuels or relights a fire on its own", () => {
    const { game, box, fireplace } = gameWithWoodBox();
    box.entity.woodBox = { firewood: 3 };

    game.client.send({ type: "skipTime", hours: 4 });
    game.step();

    expect(box.entity.woodBox).toEqual({ firewood: 3 });
    expect(fireplace.entity.fireplace).toEqual({ lit: false, fuelMinutes: 0 });
  });

  it("still takes sticks and bark only from the backpack", () => {
    const { game, box, fireplace } = gameWithWoodBox();
    box.entity.woodBox = { firewood: 3 };

    expect(game.client.refusal({ type: "addFuel", campfireId: fireplace.id, fuel: "stick" })).toEqual({ kind: "noContent", content: "stick" });
    expect(game.client.refusal({ type: "addFuel", campfireId: fireplace.id, fuel: "bark" })).toEqual({ kind: "noContent", content: "bark" });
  });
});

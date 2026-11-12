import { describe, expect, it } from "bun:test";
import { createGame, type Game } from "../sim/game";
import { isWalkable } from "../sim/walk-map";
import { NOT_BUILDING, pickBuildEntry, placeCommandFor, pressBuildKey } from "./build-mode";

/** A spot on the building grid a few metres from the player, with open ground all round it. */
function openSpotNear(game: Game): { x: number; z: number } {
  const player = game.entities.with("player", "position").first;
  if (player === undefined) throw new Error("No player");
  for (let distance = 3; distance < 20; distance += 1) {
    const spot = { x: Math.round(player.position.x + distance), z: Math.round(player.position.z) };
    const around = [
      [0, 0],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].every(([ax = 0, az = 0]) => isWalkable(game.walkMap, { x: spot.x + ax, z: spot.z + az }));
    if (around) return spot;
  }
  throw new Error("No open spot");
}

describe("the build menu key", () => {
  it("opens the build menu with B, and closes it with B again", () => {
    const open = pressBuildKey(NOT_BUILDING, "KeyB");

    expect(open).toEqual({ menuOpen: true, placing: null });
    expect(pressBuildKey(open ?? NOT_BUILDING, "KeyB")).toEqual(NOT_BUILDING);
  });
});

describe("picking a build menu entry", () => {
  it("closes the menu and puts that structure's blueprint under the mouse, facing the default way", () => {
    const mode = pickBuildEntry("campfire");

    expect(mode).toEqual({ menuOpen: false, placing: { structure: "campfire", turns: 0 } });
  });
});

describe("placing a blueprint", () => {
  it("turns the blueprint a quarter turn with each press of R, back round to the start after four", () => {
    let mode = pickBuildEntry("campfire");
    const turns: number[] = [];
    for (let press = 0; press < 4; press += 1) {
      mode = pressBuildKey(mode, "KeyR") ?? mode;
      turns.push(mode.placing?.turns ?? -1);
    }

    expect(turns).toEqual([1, 2, 3, 0]);
  });

  it("cancels with Escape, which also closes an open menu", () => {
    expect(pressBuildKey(pickBuildEntry("campfire"), "Escape")).toEqual(NOT_BUILDING);
    expect(pressBuildKey({ menuOpen: true, placing: null }, "Escape")).toEqual(NOT_BUILDING);
    expect(pressBuildKey(NOT_BUILDING, "Escape")).toBeUndefined();
  });

  it("places the blueprint, turned as the player turned it, where they click the ground through the menu", () => {
    const game = createGame({ seed: 42 });
    const spot = openSpotNear(game);
    expect(pressBuildKey(NOT_BUILDING, "KeyB")?.menuOpen).toBe(true);
    const entry = game.client.getView().buildMenu[0];
    if (entry === undefined) throw new Error("Empty build menu");
    let mode = pickBuildEntry(entry.structure);
    mode = pressBuildKey(mode, "KeyR") ?? mode;

    const command = placeCommandFor(mode, { kind: "ground", spot: { x: spot.x + 0.2, z: spot.z + 0.3 } });
    if (command === undefined) throw new Error("No command");
    game.client.send(command);
    game.step();

    const blueprint = game.entities.with("blueprint", "position").first;
    expect(blueprint?.blueprint.structure).toBe("campfire");
    expect(blueprint?.facing).toEqual({ turns: 1 });
    expect(blueprint?.position).toMatchObject({ x: spot.x, z: spot.z });
  });

  it("places nothing on a click that misses the ground, or when nothing is being placed", () => {
    expect(placeCommandFor(pickBuildEntry("campfire"), { kind: "tree", id: 3 })).toBeUndefined();
    expect(placeCommandFor(NOT_BUILDING, { kind: "ground", spot: { x: 0, z: 0 } })).toBeUndefined();
  });

  it("ignores R when nothing is being placed", () => {
    expect(pressBuildKey(NOT_BUILDING, "KeyR")).toBeUndefined();
  });
});

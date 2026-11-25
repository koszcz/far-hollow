import { describe, expect, it } from "bun:test";
import { nearbyOf, type Command } from "./api";
import { BACKPACK_WEIGHT_LIMIT_KG, CONTENT_WEIGHT_KG } from "./backpack";
import { FISH_TRAP_SPACING_METRES } from "./fish-traps";
import { createGame, type Game } from "./game";
import { groundDistance, type GroundPoint } from "./ground-point";
import { CLAY_SAVE_VERSION, FISH_TRAPS_SAVE_VERSION, readSave, SAVE_VERSION, writeSave } from "./save";
import { finishReach, storingPiecesOf } from "./test-steps";
import { isWalkable } from "./walk-map";
import { distanceToRiver, nearestRiverPoint } from "./valley";

describe("cord and the fish trap in the backpack", () => {
  it("weigh 0.1 kg and 1 kg", () => {
    expect(CONTENT_WEIGHT_KG.cord).toBe(0.1);
    expect(CONTENT_WEIGHT_KG.fishTrap).toBe(1);
  });
});

describe("the craft menu", () => {
  it("lists cord as a hand recipe: 3 bark make 1 cord, with no tool", () => {
    const cord = createGame({ seed: 42 })
      .client.getView()
      .craftMenu.find(({ kind }) => kind === "cord");
    expect(cord).toMatchObject({ materials: [{ material: "bark", count: 3 }], result: { content: "cord", count: 1 } });
    expect(cord?.tool).toBeUndefined();
    expect(cord?.station).toBeUndefined();
  });

  it("lists the fish trap as a hand recipe: 2 cord and 6 sticks, with the knife", () => {
    const trap = createGame({ seed: 42 })
      .client.getView()
      .craftMenu.find(({ kind }) => kind === "fishTrap");
    expect(trap).toMatchObject({
      materials: [
        { material: "cord", count: 2 },
        { material: "stick", count: 6 },
      ],
      result: { content: "fishTrap", count: 1 },
      tool: "knife",
    });
    expect(trap?.station).toBeUndefined();
  });

  it("twists 3 bark into 1 cord, then makes a fish trap from 2 cord and 6 sticks", () => {
    const game = createGame({ seed: 42 });
    onlyPlayer(game).backpack.contents = { knife: 1, bark: 6, stick: 6 };

    craft(game, "cord");
    craft(game, "cord");
    expect(game.client.getView().backpack).toMatchObject({ bark: 0, cord: 2 });
    craft(game, "fishTrap");

    expect(game.client.getView().backpack).toMatchObject({ cord: 0, stick: 0, fishTrap: 1, knife: 1 });
  });

  it("will not make a fish trap without the knife", () => {
    const game = createGame({ seed: 42 });
    onlyPlayer(game).backpack.contents = { cord: 2, stick: 6 };

    expect(game.client.refusal({ type: "craft", recipe: "fishTrap" })).toEqual({ kind: "cannotCraftYet", lacks: [{ kind: "tool", tool: "knife" }] });
  });
});

describe("dropping and storing cord and fish traps", () => {
  it("drops each in a pile, which can be picked up again", () => {
    for (const content of ["cord", "fishTrap"] as const) {
      const game = createGame({ seed: 42 });
      onlyPlayer(game).backpack.contents = { [content]: 3 };
      send(game, { type: "dropFromBackpack", content });

      const pile = nearbyOf(game.client.getView(), "pile");
      expect(pile).toMatchObject({ content, count: 3 });
      send(game, { type: "pickUpPile", pileId: pile?.id ?? -1 });
      stepUntil(game, () => game.client.getView().reach === null && onlyPlayer(game).walkPath === undefined);
      finishReach(game);
      expect(game.client.getView().backpack[content]).toBe(3);
    }
  });

  it("puts each in a chest and on a shelf", () => {
    for (const furniture of ["chest", "shelf"] as const) {
      const game = createGame({ seed: 42, freeBuilding: true });
      const pieceId = buildStoringPiece(game, furniture);
      onlyPlayer(game).backpack.contents = { cord: 2, fishTrap: 1 };
      send(game, { type: "openChest", chestId: pieceId });
      stepUntil(game, () => onlyPlayer(game).walkPath === undefined);

      send(game, { type: "putInChest", chestId: pieceId, content: "cord", all: true });
      send(game, { type: "putInChest", chestId: pieceId, content: "fishTrap", all: true });

      expect(nearbyOf(game.client.getView(), "openChest")?.contents).toEqual({ cord: 2, fishTrap: 1 });
    }
  });
});

/** Builds a chest or shelf on open ground a few metres west of the player, in the playground, and returns its entity id. */
function buildStoringPiece(game: Game, furniture: "chest" | "shelf"): number {
  const { position } = onlyPlayer(game);
  let square: GroundPoint | undefined;
  for (let distance = 3; distance < 30 && square === undefined; distance += 1) {
    const candidate = { x: Math.floor(position.x - distance) + 0.5, z: Math.floor(position.z) + 0.5 };
    const offsets = [-2, -1, 0, 1, 2];
    if (offsets.every((ax) => offsets.every((az) => isWalkable(game.walkMap, { x: candidate.x + ax, z: candidate.z + az })))) square = candidate;
  }
  if (square === undefined) throw new Error("No open square");
  send(game, { type: "placeBlueprint", structure: furniture, turns: 0, x: square.x, z: square.z });
  const blueprint = game.entities.with("blueprint", "position").first;
  const blueprintId = blueprint === undefined ? undefined : game.entities.id(blueprint);
  if (blueprintId === undefined) throw new Error("No blueprint");
  send(game, { type: "build", blueprintId });
  stepUntil(game, () => storingPiecesOf(game.entities, furniture).length > 0);
  const piece = storingPiecesOf(game.entities, furniture)[0];
  const pieceId = piece === undefined ? undefined : game.entities.id(piece);
  if (pieceId === undefined) throw new Error("No piece");
  return pieceId;
}

describe("setting a fish trap", () => {
  it("walks to the bank and sets the trap in the water at the edge on the player's side, nearest the clicked spot", () => {
    const game = createGame({ seed: 42 });
    giveTrap(game);
    const start = { ...onlyPlayer(game).position };
    const spot = riverMiddleNearPlayer(game);

    setTrap(game, spot);

    const trap = onlyTrap(game);
    const fromMiddle = distanceToRiver(game.valley.river, trap.position);
    expect(fromMiddle).toBeLessThan(game.valley.river.width / 2);
    expect(fromMiddle).toBeGreaterThan(game.valley.river.width / 2 - 0.6);
    expect(groundDistance(trap.position, spot)).toBeLessThan(game.valley.river.width / 2);
    expect(groundDistance(trap.position, start)).toBeLessThan(groundDistance(spot, start));
    expect(game.client.getView().backpack.fishTrap ?? 0).toBe(0);
    expect(trap.fishTrap.holding).toBe(false);
  });

  it("keeps the trap on the bank the player started from, when the clicked spot is far along the river", () => {
    const game = createGame({ seed: 42 });
    giveTrap(game);
    const start = { ...onlyPlayer(game).position };
    const level = riverMiddleNearPlayer(game);
    const spot = { x: level.x, z: level.z + 25 };
    const middle = nearestRiverPoint(game.valley.river, spot);

    setTrap(game, spot);

    const trap = onlyTrap(game);
    // The player starts on the west bank, and the river runs north to south, so the trap sits west of the middle line.
    expect(start.x).toBeLessThan(middle.x);
    expect(trap.position.x).toBeLessThan(middle.x);
    expect(groundDistance(trap.position, middle)).toBeLessThan(game.valley.river.width / 2);
    expect(groundDistance(trap.position, middle)).toBeGreaterThan(game.valley.river.width / 2 - 0.6);
  });

  it("is a quick action, not timed work", () => {
    const game = createGame({ seed: 42 });
    giveTrap(game);
    send(game, { type: "setFishTrap", ...riverMiddleNearPlayer(game) });
    stepUntil(game, () => traps(game).length > 0 || game.client.getView().action !== null);
    expect(game.client.getView().action).toBeNull();
  });

  it("is refused without a fish trap in the backpack", () => {
    const game = createGame({ seed: 42 });
    expect(game.client.refusal({ type: "setFishTrap", ...riverMiddleNearPlayer(game) })).toEqual({ kind: "noFishTrap" });
  });

  it("is refused while the player carries a log or drags a sled", () => {
    const game = createGame({ seed: 42 });
    giveTrap(game);
    const spot = riverMiddleNearPlayer(game);
    onlyPlayer(game).carrying = "log";
    expect(game.client.refusal({ type: "setFishTrap", ...spot })).toEqual({ kind: "putLogDownFirst" });
    game.entities.removeComponent(onlyPlayer(game), "carrying");
    game.entities.addComponent(onlyPlayer(game), "dragging", { sledId: 9999 });
    expect(game.client.refusal({ type: "setFishTrap", ...spot })).toEqual({ kind: "letGoFirst" });
  });

  it("is refused less than 10 m from another set trap, and allowed beyond", () => {
    const game = createGame({ seed: 42 });
    giveTrap(game, 2);
    const spot = riverMiddleNearPlayer(game);
    setTrap(game, spot);

    expect(FISH_TRAP_SPACING_METRES).toBe(10);
    expect(game.client.refusal({ type: "setFishTrap", x: spot.x, z: spot.z + 5 })).toEqual({ kind: "fishTrapTooClose" });
    expect(game.client.refusal({ type: "setFishTrap", x: spot.x, z: spot.z + 14 })).toBeNull();
  });

  it("lets the player set any number of traps", () => {
    const game = createGame({ seed: 42 });
    giveTrap(game, 3);
    const spot = riverMiddleNearPlayer(game);
    for (const along of [0, 15, 30]) setTrap(game, { x: spot.x, z: spot.z + along });
    expect(traps(game)).toHaveLength(3);
  });
});

describe("a set fish trap catching fish", () => {
  it("catches one fish 6 to 12 game hours after it is set, and shows it holds one", () => {
    const game = createGame({ seed: 42 });
    giveTrap(game);
    setTrap(game, riverMiddleNearPlayer(game));

    skipHours(game, 5.9);
    expect(onlyTrap(game).fishTrap.holding).toBe(false);
    skipHours(game, 6.2);
    expect(onlyTrap(game).fishTrap.holding).toBe(true);
  });

  it("holds only one fish, however long it is left", () => {
    const game = createGame({ seed: 42 });
    giveTrap(game);
    setTrap(game, riverMiddleNearPlayer(game));
    skipHours(game, 40);
    expect(onlyTrap(game).fishTrap.holding).toBe(true);

    const before = game.client.getView().backpack.rawFish ?? 0;
    takeFish(game);
    expect(game.client.getView().backpack.rawFish).toBe(before + 1);
    expect(onlyTrap(game).fishTrap.holding).toBe(false);
  });

  it("keeps its fish from spoiling, so a fish taken days later keeps its full day", () => {
    const game = createGame({ seed: 42 });
    giveTrap(game);
    setTrap(game, riverMiddleNearPlayer(game));
    skipHours(game, 72);
    expect(onlyTrap(game).fishTrap.holding).toBe(true);

    takeFish(game);
    game.step();

    expect(game.client.getView().backpackFreshness.rawFish?.minutesLeft).toBeCloseTo(24 * 60, -1);
  });

  it("catches while the player sleeps", () => {
    const game = createGame({ seed: 42 });
    giveTrap(game);
    setTrap(game, riverMiddleNearPlayer(game));
    const minutesToCatch = onlyTrap(game).fishTrap.minutesToNext;
    send(game, { type: "layBedroll" });
    const bedroll = game.entities.with("bedroll", "position").first;
    const bedrollId = bedroll === undefined ? undefined : game.entities.id(bedroll);
    if (bedrollId === undefined) throw new Error("No bedroll");
    onlyPlayer(game).needs.fatigue.level = 0.1;
    const asleepAt = game.progress().clockMinutes;
    send(game, { type: "sleep", bedrollId });
    stepUntil(game, () => game.client.getView().lastSleep !== null);
    const sleptMinutes = game.progress().clockMinutes - asleepAt;
    expect(sleptMinutes).toBeGreaterThan(60);

    expect(onlyTrap(game).fishTrap.holding).toBe(sleptMinutes >= minutesToCatch);
    if (sleptMinutes < minutesToCatch) expect(onlyTrap(game).fishTrap.minutesToNext).toBeLessThan(minutesToCatch - sleptMinutes + 60);
  });

  it("waits a newly drawn time for its next fish once the fish is taken", () => {
    const game = createGame({ seed: 42 });
    giveTrap(game);
    setTrap(game, riverMiddleNearPlayer(game));
    skipHours(game, 13);
    takeFish(game);

    const wait = onlyTrap(game).fishTrap.minutesToNext;
    expect(wait).toBeGreaterThanOrEqual(6 * 60);
    expect(wait).toBeLessThanOrEqual(12 * 60);
    skipHours(game, 5.9);
    expect(onlyTrap(game).fishTrap.holding).toBe(false);
    skipHours(game, 6.2);
    expect(onlyTrap(game).fishTrap.holding).toBe(true);
  });
});

describe("taking the fish and picking the trap up", () => {
  it("refuses Take fish while the trap holds no fish", () => {
    const game = createGame({ seed: 42 });
    giveTrap(game);
    setTrap(game, riverMiddleNearPlayer(game));
    expect(game.client.refusal({ type: "takeFishFromTrap", trapId: trapId(game) })).toEqual({ kind: "nothingToTake" });
  });

  it("refuses Take fish when the fish does not fit in the backpack", () => {
    const game = createGame({ seed: 42 });
    giveTrap(game);
    setTrap(game, riverMiddleNearPlayer(game));
    skipHours(game, 13);
    onlyPlayer(game).backpack.contents = { stone: BACKPACK_WEIGHT_LIMIT_KG / 2 };
    expect(game.client.refusal({ type: "takeFishFromTrap", trapId: trapId(game) })).toEqual({ kind: "backpackFull" });
  });

  it("needs no tool, and leaves the trap set", () => {
    const game = createGame({ seed: 42 });
    giveTrap(game);
    setTrap(game, riverMiddleNearPlayer(game));
    skipHours(game, 13);
    onlyPlayer(game).backpack.contents = {};
    takeFish(game);
    expect(game.client.getView().backpack).toEqual({ rawFish: 1 });
    expect(traps(game)).toHaveLength(1);
  });

  it("puts an empty set trap back in the backpack", () => {
    const game = createGame({ seed: 42 });
    giveTrap(game);
    setTrap(game, riverMiddleNearPlayer(game));
    send(game, { type: "pickUpFishTrap", trapId: trapId(game) });
    stepUntil(game, () => traps(game).length === 0);
    expect(game.client.getView().backpack.fishTrap).toBe(1);
  });

  it("refuses to pick up a trap that holds a fish", () => {
    const game = createGame({ seed: 42 });
    giveTrap(game);
    setTrap(game, riverMiddleNearPlayer(game));
    skipHours(game, 13);
    expect(game.client.refusal({ type: "pickUpFishTrap", trapId: trapId(game) })).toEqual({ kind: "takeFishFirst" });
  });
});

describe("saving fish traps", () => {
  it("raises the save version for fish traps, and loads a save from before then", () => {
    const game = createGame({ seed: 42 });
    expect(FISH_TRAPS_SAVE_VERSION).toBeLessThanOrEqual(SAVE_VERSION);
    expect(FISH_TRAPS_SAVE_VERSION).toBeGreaterThan(CLAY_SAVE_VERSION);
    const save = JSON.parse(JSON.stringify(writeSave(game))) as { version: number };
    save.version = FISH_TRAPS_SAVE_VERSION - 1;
    expect(readSave(save).ok).toBe(true);
  });

  it("keeps cord, fish traps in the backpack, and set traps with their spot, fish, and time to the next catch", () => {
    const game = createGame({ seed: 42 });
    giveTrap(game, 2);
    const spot = riverMiddleNearPlayer(game);
    setTrap(game, spot);
    skipHours(game, 13);
    setTrap(game, { x: spot.x, z: spot.z + 15 });
    giveTrap(game, 1);
    onlyPlayer(game).backpack.contents = { ...onlyPlayer(game).backpack.contents, cord: 2 };
    const before = traps(game).map(({ position, fishTrap }) => ({ position: { ...position }, fishTrap: { ...fishTrap } }));

    const loaded = readSave(JSON.parse(JSON.stringify(writeSave(game))));
    if (!loaded.ok) throw new Error("The save did not load");

    expect(loaded.game.client.getView().backpack).toMatchObject({ cord: 2, fishTrap: 1 });
    const after = traps(loaded.game).map(({ position, fishTrap }) => ({ position, fishTrap }));
    const byZ = (a: { position: GroundPoint }, b: { position: GroundPoint }) => a.position.z - b.position.z;
    expect(after.sort(byZ)).toEqual(before.sort(byZ));
    expect(after.map(({ fishTrap }) => fishTrap.holding).sort()).toEqual([false, true]);
  });
});

/** Jumps the clock forward an hour at a time, filling the player's needs before each, so they never collapse and sleep through more hours. */
function skipHours(game: Game, hours: number): void {
  for (let left = hours; left > 0; left -= 1) {
    for (const need of Object.values(onlyPlayer(game).needs)) need.level = 1;
    send(game, { type: "skipTime", hours: Math.min(1, left) });
  }
}

/** Puts `count` fish traps in the backpack, in place of any it held. */
function giveTrap(game: Game, count = 1): void {
  const { backpack } = onlyPlayer(game);
  backpack.contents = { ...backpack.contents, fishTrap: count };
}

/** Sets a fish trap toward a spot on the river, and waits until it is set. */
function setTrap(game: Game, spot: GroundPoint): void {
  const before = traps(game).length;
  send(game, { type: "setFishTrap", ...spot });
  stepUntil(game, () => traps(game).length > before);
}

/** Takes the fish from the only set trap, and waits until it is in the backpack. */
function takeFish(game: Game): void {
  send(game, { type: "takeFishFromTrap", trapId: trapId(game) });
  stepUntil(game, () => !onlyTrap(game).fishTrap.holding);
}

function traps(game: Game) {
  return game.entities.with("fishTrap", "position").entities;
}

function onlyTrap(game: Game) {
  const [trap] = traps(game);
  if (trap === undefined) throw new Error("No trap");
  return trap;
}

function trapId(game: Game): number {
  const id = game.entities.id(onlyTrap(game));
  if (id === undefined) throw new Error("No trap");
  return id;
}

/** The spot on the middle line of the river level with the player. The player starts on the west bank. */
function riverMiddleNearPlayer(game: Game): GroundPoint {
  const { position } = onlyPlayer(game);
  let best = { x: position.x, z: position.z };
  for (let x = position.x; x < position.x + 100; x += 0.1) {
    if (distanceToRiver(game.valley.river, { x, z: position.z }) < distanceToRiver(game.valley.river, best)) best = { x, z: position.z };
  }
  return best;
}

/** Crafts one of a hand recipe and waits until the work is done. */
function craft(game: Game, recipe: "cord" | "fishTrap"): void {
  send(game, { type: "craft", recipe });
  stepUntil(game, () => game.client.getView().action === null);
}

function stepUntil(game: Game, done: () => boolean): void {
  for (let i = 0; !done(); i += 1) {
    if (i > 2_000_000) throw new Error("It never happened");
    game.step();
  }
}

function onlyPlayer(game: Game) {
  const player = game.entities.with("player", "position", "needs", "backpack").first;
  if (player === undefined) throw new Error("No player");
  return player;
}

function send(game: Game, command: Command): void {
  game.client.send(command);
  game.step();
  finishReach(game);
}

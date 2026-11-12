import { describe, expect, it } from "bun:test";
import type { BackpackContent, CampfireView, GameView, WoodpileView } from "../sim/api";
import { createGame } from "../sim/game";
import { promptFor, promptForButton, type CursorPrompt } from "./cursor-prompt";
import type { ActionReader } from "./thing-actions";

const START_VIEW = createGame({ seed: 42 }).client.getView();

describe("the cursor prompt over a thing in the world", () => {
  it("names a tree and its chop", () => {
    const reader = readerWith({ backpack: { axe: 1 } });

    expect(text(promptFor({ kind: "scene", pick: { kind: "tree", id: 1 } }, reader))).toEqual(["Tree", "Left-click: Chop"]);
  });

  it("greys the chop with its reason when the player has no axe", () => {
    const prompt = promptFor({ kind: "scene", pick: { kind: "tree", id: 1 } }, readerWith({}));

    expect(text(prompt)).toEqual(["Tree", "Left-click: Chop: needs the axe (off)"]);
  });

  it("shows nothing over plain ground, where a click walks", () => {
    expect(promptFor({ kind: "scene", pick: { kind: "ground", spot: { x: 1, z: 2 } } }, readerWith({}))).toBeUndefined();
  });

  it("offers more actions on a log, which can be debarked too", () => {
    const prompt = promptFor({ kind: "scene", pick: { kind: "log", id: 3 } }, readerWith({}));

    expect(text(prompt)).toEqual(["Log", "Left-click: Pick up", "Right-click: More actions"]);
  });

  it("names the river and drinking from it", () => {
    const prompt = promptFor({ kind: "scene", pick: { kind: "river", spot: { x: 0, z: 0 } } }, readerWith({}));

    expect(text(prompt)).toEqual(["River", "Left-click: Drink"]);
  });

  it("names a stick, bark, a forage spot, and a pile with their main actions", () => {
    const reader = readerWith({});
    const lines = (kind: "stick" | "bark" | "forage" | "pile") => text(promptFor({ kind: "scene", pick: { kind, id: 4 } }, reader));

    expect(lines("stick")).toEqual(["Stick", "Left-click: Pick up"]);
    expect(lines("bark")).toEqual(["Bark", "Left-click: Pick up"]);
    expect(lines("forage")).toEqual(["Forage spot", "Left-click: Forage"]);
    expect(lines("pile")).toEqual(["Pile", "Left-click: Pick up"]);
  });

  it("names a campfire and lights it, with more actions for fuel and the pot", () => {
    const reader = readerWith({ backpack: { fireStriker: 1 }, campfire: { fuelMinutes: 20 } });

    expect(text(promptFor({ kind: "scene", pick: { kind: "campfire", id: 7 } }, reader))).toEqual([
      "Campfire",
      "Left-click: Light",
      "Right-click: More actions",
    ]);
  });

  it("names a woodpile and taking firewood from it when the player carries nothing", () => {
    const reader = readerWith({ woodpile: { contents: { log: 0, debarkedLog: 0, firewood: 3 }, total: 3 } });

    expect(text(promptFor({ kind: "scene", pick: { kind: "woodpile", id: 8 } }, reader))).toEqual([
      "Woodpile",
      "Left-click: Take firewood",
      "Right-click: More actions",
    ]);
  });

  it("names a blueprint and building it", () => {
    const prompt = promptFor({ kind: "scene", pick: { kind: "blueprint", id: 11 } }, readerWith({}));

    expect(text(prompt)).toEqual(["Building piece", "Left-click: Build", "Right-click: More actions"]);
  });

  it("names a laid bedroll and sleeping on it", () => {
    const prompt = promptFor({ kind: "scene", pick: { kind: "bedroll", id: 5 } }, readerWith({}));

    expect(text(prompt)).toEqual(["Bedroll", "Left-click: Sleep", "Right-click: More actions"]);
  });

  it("names a chest and opening it", () => {
    const prompt = promptFor({ kind: "scene", pick: { kind: "chest", id: 6 } }, readerWith({}));

    expect(text(prompt)).toEqual(["Chest", "Left-click: Open", "Right-click: More actions"]);
  });

  it("names a work station and opening its menu", () => {
    const prompt = promptFor({ kind: "scene", pick: { kind: "workStation", id: 9, station: "sawhorse" } }, readerWith({}));

    expect(text(prompt)).toEqual(["Sawhorse", "Left-click: Open its menu", "Right-click: More actions"]);
  });

  it("names a finished wall by its kind, with no left-click action, and still offers its menu", () => {
    const pick = { kind: "structure", id: 10, structure: "logWall", under: { kind: "ground", spot: { x: 0, z: 0 } } } as const;

    expect(text(promptFor({ kind: "scene", pick }, readerWith({})))).toEqual(["Log wall", "Right-click: More actions"]);
  });

  it("names the thing behind a finished structure, since a left-click acts on it", () => {
    const pick = { kind: "structure", id: 10, structure: "logWall", under: { kind: "stick", id: 4 } } as const;

    expect(text(promptFor({ kind: "scene", pick }, readerWith({})))).toEqual(["Stick", "Left-click: Pick up", "Right-click: More actions"]);
  });
});

describe("the cursor prompt over the thing nearest the player", () => {
  it("shows E beside the main action of the nearest thing", () => {
    const prompt = promptFor({ kind: "scene", pick: { kind: "tree", id: 1 } }, readerWith({ backpack: { axe: 1 } }), { kind: "tree", id: 1 });

    expect(text(prompt)).toEqual(["Tree", "Left-click, E: Chop"]);
  });

  it("shows no E over a thing that is not the nearest", () => {
    const prompt = promptFor({ kind: "scene", pick: { kind: "tree", id: 1 } }, readerWith({ backpack: { axe: 1 } }), { kind: "stick", id: 2 });

    expect(text(prompt)).toEqual(["Tree", "Left-click: Chop"]);
  });

  it("shows E over a wall when the nearest thing is behind it", () => {
    const pick = { kind: "structure", id: 9, structure: "logWall", under: { kind: "stick", id: 2 } } as const;

    expect(text(promptFor({ kind: "scene", pick }, readerWith({}), { kind: "stick", id: 2 }))).toEqual([
      "Stick",
      "Left-click, E: Pick up",
      "Right-click: More actions",
    ]);
  });
});

describe("the cursor prompt over a hotbar cell", () => {
  it("names food and eating it, with more actions for dropping it", () => {
    const prompt = promptFor({ kind: "backpackContent", content: "berries" }, readerWith({ backpack: { berries: 2 } }));

    expect(text(prompt)).toEqual(["Berries", "Left-click: Eat", "Right-click: More actions"]);
  });

  it("says a click does nothing for a backpack content with no use", () => {
    const prompt = promptFor({ kind: "backpackContent", content: "stick" }, readerWith({ backpack: { stick: 1 } }));

    expect(text(prompt)).toEqual(["Stick", "Left-click: No use (off)", "Right-click: More actions"]);
  });
});

describe("the cursor prompt over the build and craft buttons", () => {
  it("says what each button opens and closes", () => {
    expect(text(promptForButton("build", false))).toEqual(["Build", "Left-click: Open the build wheel"]);
    expect(text(promptForButton("build", true))).toEqual(["Build", "Left-click: Close the build wheel"]);
    expect(text(promptForButton("craft", false))).toEqual(["Craft", "Left-click: Open the craft wheel"]);
  });
});

/** The prompt as lines of text: the title, then each mouse button's line, with its key if it has one. A greyed line ends in "(off)". */
function text(prompt: CursorPrompt | undefined): readonly string[] | undefined {
  if (prompt === undefined) return undefined;
  return [
    prompt.title,
    ...prompt.lines.map(({ button, key, text: line, enabled }) => `${button}${key === undefined ? "" : `, ${key}`}: ${line}${enabled ? "" : " (off)"}`),
  ];
}

function readerWith({
  backpack = {},
  campfire,
  woodpile,
}: {
  backpack?: Partial<Record<BackpackContent, number>>;
  campfire?: Partial<CampfireView>;
  woodpile?: Partial<WoodpileView>;
}): ActionReader {
  const view: GameView = { ...START_VIEW, backpack, carrying: null };
  const fullCampfire: CampfireView = {
    id: 7,
    lit: false,
    fuelLeft: 0,
    fuelMinutes: 0,
    canLight: false,
    fits: { stick: true, firewood: true, bark: true },
    pot: null,
    ...campfire,
  };
  return {
    getView: () => view,
    describeBlueprint: () => null,
    describeCampfire: (id) => (id === 7 && campfire !== undefined ? fullCampfire : null),
    describeWoodpile: (id) =>
      id === 8 && woodpile !== undefined ? { id: 8, contents: { log: 0, debarkedLog: 0, firewood: 0 }, total: 0, capacity: 20, ...woodpile } : null,
  };
}

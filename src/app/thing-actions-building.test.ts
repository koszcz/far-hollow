import { describe, expect, it } from "bun:test";
import type { CarriedLog, StructureKind } from "../sim/api";
import { worldWith } from "./test-world";
import { actionsFor, mainAction, type ActionTarget } from "./thing-actions";
import { find, summary, scene } from "./thing-actions-test-support";

describe("building actions", () => {
  it("builds a blueprint, adds a carried debarked log it needs first, and takes it down", () => {
    const blueprint = (carrying: CarriedLog | undefined) => {
      const world = worldWith(carrying === undefined ? {} : { carrying });
      const id = world.addBlueprint("foundation", { debarkedLog: 1 });
      return summary(actionsFor(scene("blueprint", id), world.reader));
    };

    expect(blueprint("debarkedLog")).toEqual(["deliver:debarkedLog main", "build", "takeDown"]);
    expect(blueprint(undefined)).toEqual(["build main", "takeDown"]);
  });

  it("greys out building, with why, when the player lacks a tool or material", () => {
    const build = (structure: StructureKind) => {
      const world = worldWith({});
      return mainAction(actionsFor(scene("blueprint", world.addBlueprint(structure)), world.reader));
    };

    expect(build("campfire")).toMatchObject({ id: "build", enabled: false, reason: "no sticks" });
    expect(build("foundation")).toMatchObject({ enabled: false, reason: "bring a debarked log first" });
    expect(build("chest")).toMatchObject({ enabled: false, reason: "needs the axe" });
  });

  it("opens a work station's menu, lists the recipes made there, then takes it down", () => {
    const actions = actionsFor({ kind: "scene", pick: { kind: "workStation", id: 10, station: "sawhorse" } }, worldWith({}).reader);

    expect(actions.map(({ id }) => id)).toEqual(["openMenu", "craft:planks", "takeDown"]);
    expect(mainAction(actions)?.command).toBeUndefined();
    expect(find(actions, "craft:planks")).toMatchObject({
      enabled: false,
      reason: "needs the saw and a sawhorse",
      command: { type: "craft", recipe: "planks", stationId: 10 },
    });
  });

  it("acts on the thing under a finished structure, then takes the structure down", () => {
    const world = worldWith({});
    const pick = { kind: "structure", id: 11, structure: "foundation", under: { kind: "stick", id: world.add({ stick: true }) } } as const;
    const actions = actionsFor({ kind: "scene", pick }, world.reader);

    expect(summary(actions)).toEqual(["pickUp main", "takeDownStructure"]);
    expect(find(actions, "takeDownStructure")?.command).toEqual({ type: "takeDown", pieceId: 11 });
  });

  it("offers a walk onto a finished structure with ground under it, then taking it down", () => {
    const pick = { kind: "structure", id: 11, structure: "foundation", under: { kind: "ground", spot: { x: 0, z: 0 } } } as const;
    const actions = actionsFor({ kind: "scene", pick }, worldWith({}).reader);

    expect(summary(actions)).toEqual(["walk main", "takeDownStructure"]);
  });

  it("offers to lay the bedroll in a lean-to while the backpack holds one", () => {
    const pick = { kind: "structure", id: 11, structure: "leanTo", under: { kind: "ground", spot: { x: 0, z: 0 } } } as const;
    const withBedroll = actionsFor({ kind: "scene", pick }, worldWith({ backpack: { bedroll: 1 } }).reader);
    const without = actionsFor({ kind: "scene", pick }, worldWith({ backpack: { bedroll: 0 } }).reader);

    expect(summary(withBedroll)).toEqual(["walk main", "layBedroll", "takeDownStructure"]);
    expect(find(withBedroll, "layBedroll")?.command).toEqual({ type: "layBedrollInLeanTo", leanToId: 11 });
    expect(summary(without)).toEqual(["walk main", "takeDownStructure"]);
  });

  it("makes laying the bedroll the main action on a lean-to with nothing under the pointer", () => {
    const pick = { kind: "structure", id: 11, structure: "leanTo", under: undefined } as const;

    expect(summary(actionsFor({ kind: "scene", pick }, worldWith({ backpack: { bedroll: 1 } }).reader))).toEqual(["layBedroll main", "takeDownStructure"]);
  });
});

describe("shutters' actions", () => {
  it("opens closed shutters as the main action, clicked or reached with E, then takes them down", () => {
    const world = worldWith({});
    const shutters = world.add({ shutters: { open: false }, facing: { turns: 0 } });
    const clicked: ActionTarget = { kind: "scene", pick: { kind: "structure", id: shutters, structure: "shutters", under: undefined } };

    for (const target of [clicked, { kind: "scene", pick: { kind: "shutters", id: shutters } } as const]) {
      const actions = actionsFor(target, world.reader);
      expect(summary(actions)).toEqual(["openShutters main", "takeDown"]);
      expect(mainAction(actions)?.label).toBe("Open shutters");
      expect(mainAction(actions)?.command).toEqual({ type: "setShutters", shuttersId: shutters, open: true });
    }
  });

  it("closes open shutters as the main action", () => {
    const world = worldWith({});
    const shutters = world.add({ shutters: { open: true }, facing: { turns: 0 } });

    const actions = actionsFor({ kind: "scene", pick: { kind: "shutters", id: shutters } }, world.reader);

    expect(summary(actions)).toEqual(["closeShutters main", "takeDown"]);
    expect(mainAction(actions)?.label).toBe("Close shutters");
    expect(mainAction(actions)?.command).toEqual({ type: "setShutters", shuttersId: shutters, open: false });
  });
});

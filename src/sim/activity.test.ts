// Checks which timed work the player is doing, as both the HUD and the player's drawn pose read it.
import { describe, expect, it } from "vitest";
import { playerActivity } from "./activity";
import { CHOP_SECONDS } from "./chopping";
import { DEBARK_SECONDS } from "./debarking";
import { createEntityStore, type Entity } from "./entities";
import { SPLIT_SECONDS } from "./gathering";

function storeWithPlayer(components: Entity) {
  const entities = createEntityStore();
  const player = entities.add({ player: true, position: { x: 0, y: 0, z: 0 }, ...components });
  return { entities, player };
}

describe("the timed work the player is doing", () => {
  it("is nothing while the player stands idle", () => {
    const { entities, player } = storeWithPlayer({});
    expect(playerActivity(entities, player)).toBeUndefined();
  });

  it("is chopping, with the tree and how far along it is", () => {
    const { entities, player } = storeWithPlayer({ chopTask: { treeId: 7, secondsDone: CHOP_SECONDS / 4 } });
    expect(playerActivity(entities, player)).toEqual({ kind: "chop", progress: 0.25, targetId: 7 });
  });

  it("does not count walking to the work", () => {
    const { entities, player } = storeWithPlayer({ chopTask: { treeId: 7, secondsDone: 0 }, walkPath: [{ x: 1, z: 1 }] });
    expect(playerActivity(entities, player)).toBeUndefined();
  });

  it("is debarking, with the log", () => {
    const { entities, player } = storeWithPlayer({ debarkTask: { logId: 3, secondsDone: DEBARK_SECONDS } });
    expect(playerActivity(entities, player)).toEqual({ kind: "debark", progress: 1, targetId: 3 });
  });

  it("is splitting, with no target", () => {
    const { entities, player } = storeWithPlayer({ splitTask: { secondsDone: SPLIT_SECONDS / 2 } });
    expect(playerActivity(entities, player)).toEqual({ kind: "split", progress: 0.5 });
  });

  it("is building, with the blueprint and its progress", () => {
    const entities = createEntityStore();
    const blueprint = entities.add({ blueprint: { structure: "campfire", progress: 0.4, materialsSpent: 2, delivered: {} }, position: { x: 1, y: 0, z: 1 } });
    const id = entities.id(blueprint) ?? -1;
    const player = entities.add({ player: true, position: { x: 0, y: 0, z: 0 }, buildTask: { blueprintId: id } });
    expect(playerActivity(entities, player)).toEqual({ kind: "build", progress: 0.4, targetId: id });
  });

  it("puts crafting before building when both are under way", () => {
    const entities = createEntityStore();
    const blueprint = entities.add({ blueprint: { structure: "campfire", progress: 0.4, materialsSpent: 2, delivered: {} }, position: { x: 1, y: 0, z: 1 } });
    const player = entities.add({
      player: true,
      position: { x: 0, y: 0, z: 0 },
      buildTask: { blueprintId: entities.id(blueprint) ?? -1 },
      craftTask: { recipe: "saw", secondsDone: 0 },
    });
    expect(playerActivity(entities, player)?.kind).toBe("craft");
  });
});

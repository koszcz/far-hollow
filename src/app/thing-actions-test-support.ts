import type { FurnitureKind } from "../sim/api";
import type { ActionTarget, ThingAction } from "./thing-actions";

export function find(actions: readonly ThingAction[], id: string): ThingAction | undefined {
  return actions.find((action) => action.id === id);
}

/** Each action as one short line: its id, "main" if it is the main action, and why it is off. */
export function summary(actions: readonly ThingAction[]): string[] {
  return actions.map(({ id, isMain, enabled, reason }) => [id, isMain ? "main" : "", enabled ? "" : `off: ${reason}`].filter(Boolean).join(" "));
}

type ThingKind =
  | "campfire"
  | "woodpile"
  | "sled"
  | "tree"
  | "youngTree"
  | "sapling"
  | "stump"
  | "log"
  | "debarkedLog"
  | "stick"
  | "bedroll"
  | "blueprint"
  | "plantedTorch"
  | "fishTrap"
  | "forage"
  | "mushroomLog";

/** A thing in the world, given by its kind and entity id, as the scene reports it under the cursor. */
export function scene(kind: ThingKind, id: number): ActionTarget {
  return { kind: "scene", pick: { kind, id } };
}

/** A finished piece of furniture, given by its kind and entity id, as the scene reports it under the cursor. */
export function furniture(kind: FurnitureKind, id: number): ActionTarget {
  return { kind: "scene", pick: { kind: "furniture", id, furniture: kind } };
}

export function ground(): ActionTarget {
  return { kind: "scene", pick: { kind: "ground", spot: { x: 1, z: 2 } } };
}

export function riverBank(): ActionTarget {
  return { kind: "scene", pick: { kind: "ground", spot: { x: 1, z: 2 }, riverBank: true } };
}

export function river(): ActionTarget {
  return { kind: "scene", pick: { kind: "river", spot: { x: 1, z: 2 } } };
}

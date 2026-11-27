// The save upgrades from version 22 to version 42, one function for each version.
import type { Entity } from "./entities";
import { giveBack, giveStartingItem, nothingToUpgrade } from "./save-upgrade-helpers";

/**
 * Version 22 to 23: the player can build sleds, and a blueprint can hold logs carried to it. A save from before then has
 * neither, so it carries over unchanged.
 */
export function addSleds(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return nothingToUpgrade(save);
}

/**
 * Version 23 to 24: a roof section is rows of planks, not strips of bark. A finished roof stores no material, so every
 * finished bark roof loads as a finished plank roof, at no cost. Every roof blueprint keeps its turn and starts again,
 * and any bark already spent on it goes back in the player's backpack.
 */
export function layPlankRoofs(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  if (!Array.isArray(save.entities)) return { ...save };
  let barkBack = 0;
  const entities: unknown[] = save.entities.map((entity: unknown) => {
    const components = (entity as { components?: Entity } | null)?.components;
    const blueprint = components?.blueprint;
    if (blueprint?.structure !== "roof" || typeof blueprint.materialsSpent !== "number") return entity;
    barkBack += blueprint.materialsSpent;
    return { ...(entity as object), components: { ...components, blueprint: { ...blueprint, progress: 0, materialsSpent: 0 } } };
  });
  return giveBack({ ...save, entities }, "bark", barkBack);
}

/**
 * Version 24 to 25: a new game now starts with a fishing line, for crafting the fishing rod. A player saved before then
 * gets one too, unless they already hold a fishing rod.
 */
export function giveFishingLine(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return giveStartingItem(save, "fishingLine", ["fishingRod"]);
}

/**
 * Version 25 to 26: the player can cook fish on a campfire, and carry cooked fish. A save from before then has no fish on
 * any campfire and no cooked fish, so it carries over unchanged.
 */
export function cookFishOnCampfires(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return nothingToUpgrade(save);
}

/**
 * Version 26 to 27: a new chest costs 4 planks, and a blueprint keeps the planks it takes from the backpack.
 * Every chest and chest blueprint saved before then keeps the cost of 2 debarked logs it was placed with.
 * A roof section was the only structure that cost planks, one for each stage. A roof blueprint now counts the planks it has had,
 * so it counts each plank construction has already spent.
 */
export function payChestsInPlanks(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  if (!Array.isArray(save.entities)) return { ...save };
  const entities: unknown[] = save.entities.map((entity: unknown) => {
    const components = (entity as { components?: Entity & { chest?: unknown } } | null)?.components;
    const blueprint = components?.blueprint;
    if (components?.chest !== undefined || blueprint?.structure === "chest") {
      return { ...(entity as object), components: { ...components, builtCost: [{ material: "debarkedLog", count: 2 }] } };
    }
    if (blueprint?.structure !== "roof" || typeof blueprint.materialsSpent !== "number" || blueprint.materialsSpent <= 0) return entity;
    return { ...(entity as object), components: { ...components, blueprint: { ...blueprint, delivered: { plank: blueprint.materialsSpent } } } };
  });
  return { ...save, entities };
}

/** Version 27 to 28: a sled can carry planks as well as logs. Every sled saved before then holds no planks. */
export function putPlanksOnSleds(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  if (!Array.isArray(save.entities)) return { ...save };
  const entities: unknown[] = save.entities.map((entity: unknown) => {
    const components = (entity as { components?: Record<string, unknown> } | null)?.components;
    const sled = components?.sled;
    if (typeof sled !== "object" || sled === null) return entity;
    return { ...(entity as object), components: { ...components, sled: { ...sled, plank: 0 } } };
  });
  return { ...save, entities };
}

/** Version 28 to 29: the player can build shelves. A save from before then has none, so it carries over unchanged. */
export function addShelves(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return nothingToUpgrade(save);
}

/** Version 29 to 30: the player can build beds. A save from before then has none, so it carries over unchanged. */
export function addBeds(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return nothingToUpgrade(save);
}

/** Version 30 to 31: the player can build tables. A save from before then has none, so it carries over unchanged. */
export function addTables(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return nothingToUpgrade(save);
}

/** Version 31 to 32: the player can build stools. A save from before then has none, so it carries over unchanged. */
export function addStools(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return nothingToUpgrade(save);
}

/**
 * Version 32 to 33: one `furniture` part, holding the piece's name, marks every finished piece of furniture, in place of a part
 * for each piece. What a chest or shelf holds moves to a shared `storage` part. Blueprints and `builtCost` already name the
 * structure, so they carry over unchanged. A later piece of furniture needs no upgrade of its own.
 */
export function putFurnitureInOnePart(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const MARKED_PIECES = ["bed", "table", "stool"];
  const STORING_PIECES = ["chest", "shelf"];
  if (!Array.isArray(save.entities)) return { ...save };
  const entities: unknown[] = save.entities.map((entity: unknown) => {
    const components = (entity as { components?: Record<string, unknown> | null } | null)?.components;
    if (components === undefined || components === null) return entity;
    const piece = [...MARKED_PIECES, ...STORING_PIECES].find((name) => components[name] !== undefined);
    if (piece === undefined) return entity;
    const { [piece]: oldPart, ...others } = components;
    const storage = STORING_PIECES.includes(piece) ? { storage: { contents: (oldPart as { contents?: unknown } | null)?.contents } } : {};
    return { ...(entity as object), components: { ...others, furniture: piece, ...storage } };
  });
  return { ...save, entities };
}

/**
 * Version 33 to 34: a felled tree's stump grows back into a tree. Each stump in an older save starts growing as if the tree
 * had just been felled, a whole game day before its sapling shows.
 */
export function growStumpsBack(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const STUMP_STAGE_MINUTES = 24 * 60;
  if (!Array.isArray(save.entities)) return { ...save };
  const entities: unknown[] = save.entities.map((entity: unknown) => {
    const components = (entity as { components?: Record<string, unknown> | null } | null)?.components;
    if (components?.stump !== true || components.growth !== undefined) return entity;
    return { ...(entity as object), components: { ...components, growth: { stage: "stump", minutesLeft: STUMP_STAGE_MINUTES } } };
  });
  return { ...save, entities };
}

/** Version 34 to 35: the player can gather stone. A save from before then has none, so it carries over unchanged. */
export function addStone(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return nothingToUpgrade(save);
}

/** Version 35 to 36: the player can build fireplaces from stone. A save from before then has none, so it carries over unchanged. */
export function addFireplaces(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return nothingToUpgrade(save);
}

/**
 * Version 36 to 37: a fireplace holds a fire, with its fuel and whether it is lit. A fireplace in an older save could not
 * be fuelled, so it gets an empty fire that is out.
 */
export function lightFireplaces(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  if (!Array.isArray(save.entities)) return { ...save };
  const entities: unknown[] = save.entities.map((entity: unknown) => {
    const components = (entity as { components?: Record<string, unknown> | null } | null)?.components;
    if (components?.fireplace !== true) return entity;
    return { ...(entity as object), components: { ...components, fireplace: { lit: false, fuelMinutes: 0 } } };
  });
  return { ...save, entities };
}

/**
 * Version 37 to 38: the player can craft torches and carry one lit. A save from before then has no torches, unlit or lit,
 * so it carries over unchanged.
 */
export function addTorches(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return nothingToUpgrade(save);
}

/**
 * Version 38 to 39: the player can plant a lit torch in the ground. A save from before then has no planted torches,
 * so it carries over unchanged.
 */
export function plantTorches(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return nothingToUpgrade(save);
}

/**
 * Version 39 to 40: the player can cook fish and boil water on a fireplace. A save from before then has no pot or fish on any
 * fireplace, so it carries over unchanged.
 */
export function cookOnFireplaces(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return nothingToUpgrade(save);
}

/**
 * For each walk-only task component an older save can hold, the command a pending approach holds in its place.
 * The commands are written out here, so later changes to a command do not change what the upgrade does.
 */
const APPROACH_OF_TASK: Readonly<Record<string, (task: Record<string, unknown>) => Record<string, unknown>>> = {
  bedTask: (task) => ({ type: "sleepInBed", bedId: task.bedId }),
  stoolTask: (task) => ({ type: "sitOnStool", stoolId: task.stoolId }),
  stickPickUpTask: (task) => ({ type: "pickUpStick", stickId: task.stickId }),
  barkPickUpTask: (task) => ({ type: "pickUpBark", barkId: task.barkId }),
  forageTask: (task) => ({ type: "forage", spotId: task.spotId }),
  logPickUpTask: (task) => ({ type: task.thenSplit === true ? "splitLog" : "pickUpLog", logId: task.logId }),
  logDropTask: (task) => ({ type: "dropLogAt", x: task.x, z: task.z }),
  bedrollTask: (task) => ({ type: task.then === "sleep" ? "sleep" : "pickUpBedroll", bedrollId: task.bedrollId }),
  layBedrollTask: (task) => ({ type: "layBedrollInLeanTo", leanToId: task.leanToId }),
  torchPickUpTask: (task) => ({ type: "pickUpTorch", torchId: task.torchId }),
  pileTask: (task) => ({ type: "pickUpPile", pileId: task.pileId }),
  deliverTask: (task) => ({ type: "deliverToBlueprint", blueprintId: task.blueprintId }),
  // A tend task already held the command itself, such as adding fuel to a campfire.
  tendTask: (task) => ({ ...task }),
};

/**
 * Version 40 to 41: the player walking to act on a thing has one pending approach, which holds the command that started it,
 * in place of a task component for each kind of thing. Each walk-only task component becomes the approach for its command,
 * so a player saved on the way carries on and acts when they arrive. Timed work keeps its own task component.
 */
export function startApproaches(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return tasksToApproaches(save, APPROACH_OF_TASK, () => true);
}

/**
 * Turns one task component on each entity of `save` into a pending approach that holds its command, from `approachOf`.
 * `turns` says which of the entity's task components to turn. The first of them in `approachOf` gives the command.
 * The player walked to one thing at a time, so any other task it names, which no save should hold, is dropped.
 * `adjust` may change the entity's other components for the task that was turned.
 */
function tasksToApproaches(
  save: Readonly<Record<string, unknown>>,
  approachOf: Readonly<Record<string, (task: Record<string, unknown>) => Record<string, unknown>>>,
  turns: (task: string, components: Readonly<Record<string, unknown>>) => boolean,
  adjust?: (task: string, others: Record<string, unknown>) => void,
): Record<string, unknown> {
  if (!Array.isArray(save.entities)) return { ...save };
  const entities: unknown[] = save.entities.map((entity: unknown) => {
    const components = (entity as { components?: Record<string, unknown> | null } | null)?.components;
    if (components === undefined || components === null) return entity;
    const tasks = Object.keys(approachOf).filter((name) => components[name] !== undefined && turns(name, components));
    const first = tasks[0];
    if (first === undefined) return entity;
    const command = approachOf[first]?.(components[first] as Record<string, unknown>);
    const others = Object.fromEntries(Object.entries(components).filter(([name]) => !tasks.includes(name)));
    adjust?.(first, others);
    return { ...(entity as object), components: { ...others, approach: { command } } };
  });
  return { ...save, entities };
}

/**
 * For each timed task component an older save can hold, the command a pending approach holds in its place, if the player
 * was still walking to the work. The commands are written out here, so later changes to a command do not change what the upgrade does.
 */
const APPROACH_OF_TIMED_TASK: Readonly<Record<string, (task: Record<string, unknown>) => Record<string, unknown>>> = {
  chopTask: (task) => ({ type: "chopTree", treeId: task.treeId }),
  debarkTask: (task) => ({ type: "debarkLog", logId: task.logId }),
  buildTask: (task) => ({ type: "build", blueprintId: task.blueprintId }),
  takeDownTask: (task) => ({ type: "takeDown", pieceId: task.pieceId }),
  drinkTask: (task) => ({ type: "drinkFromRiver", x: task.x, z: task.z }),
  fillPotTask: () => ({ type: "fillPot" }),
  fishTask: (task) => ({ type: "fish", x: task.x, z: task.z }),
  stoneTask: (task) => ({ type: "gatherStone", x: task.x, z: task.z }),
};

/** The task components that only ever marked a walk, so they become an approach even without a `walkPath`. */
const WALK_ONLY_TIMED_TASKS: ReadonlySet<string> = new Set(["drinkTask", "fillPotTask"]);

/**
 * Version 41 to 42: the player walking to timed work, such as chopping, has a pending approach too, and the timed task component
 * means the work in progress only. A timed task component on a player who still has a `walkPath` becomes the approach for its
 * command, so they carry on and start the work when they arrive. A timed task component without a `walkPath` is work already
 * under way, so it stays as it is. The player used to cast as they set off to fish, and now casts on arrival, so fishing saved
 * on the way takes that cast back off the count. The cast on arrival then waits as long as the saved one would have. Drinking from the river and filling the pot take no time once there, so their task components always become approaches.
 */
export function approachTimedTasks(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return tasksToApproaches(
    save,
    APPROACH_OF_TIMED_TASK,
    (task, components) => components.walkPath !== undefined || WALK_ONLY_TIMED_TASKS.has(task),
    (task, others) => {
      if (task === "fishTask" && typeof others.fishCasts === "number" && others.fishCasts > 0) others.fishCasts -= 1;
    },
  );
}

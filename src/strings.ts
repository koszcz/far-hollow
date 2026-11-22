// All player-facing text lives here, so the game can be translated later.
import { ACTION_QUEUE_LIMIT, type BackpackContent } from "./sim/api";
import { NEARBY_MATERIALS_METRES } from "./sim/building";
import { STATION_GROUND_METRES } from "./sim/crafting";

/** A weight in kilograms, to one decimal place at most, such as "5.5" or "10". */
function kilogramsText(kilograms: number): string {
  return `${Number(kilograms.toFixed(1))}`;
}

/** A list in words, such as "a, b and c". */
function listText(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** The text with its first letter in capitals. */
function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** How many of each kind of thing a pile holds, in words. */
const PILE_HOLDS: Readonly<Record<BackpackContent, (count: number) => string>> = {
  axe: (count) => (count === 1 ? "An axe" : `${count} axes`),
  knife: (count) => (count === 1 ? "A knife" : `${count} knives`),
  drawknife: (count) => (count === 1 ? "A drawknife" : `${count} drawknives`),
  steelAndFlint: (count) => (count === 1 ? "A steel and flint" : `${count} sets of steel and flint`),
  bedroll: (count) => (count === 1 ? "A rolled-up bedroll" : `${count} rolled-up bedrolls`),
  stick: (count) => (count === 1 ? "1 stick" : `${count} sticks`),
  firewood: (count) => (count === 1 ? "1 piece of firewood" : `${count} pieces of firewood`),
  bark: (count) => (count === 1 ? "1 piece of bark" : `${count} pieces of bark`),
  stone: (count) => (count === 1 ? "1 stone" : `${count} stones`),
  torch: (count) => (count === 1 ? "1 torch" : `${count} torches`),
  sapling: (count) => (count === 1 ? "1 sapling" : `${count} saplings`),
  berries: (count) => (count === 1 ? "1 handful of berries" : `${count} handfuls of berries`),
  mushroom: (count) => (count === 1 ? "1 mushroom" : `${count} mushrooms`),
  pot: () => "An empty pot",
  potOfRiverWater: () => "A pot of river water",
  potOfBoiledWater: () => "A pot of clean water",
  sawBlade: (count) => (count === 1 ? "A saw blade" : `${count} saw blades`),
  saw: (count) => (count === 1 ? "A saw" : `${count} saws`),
  plank: (count) => (count === 1 ? "1 plank" : `${count} planks`),
  fishingLine: (count) => (count === 1 ? "A fishing line" : `${count} fishing lines`),
  fishingRod: (count) => (count === 1 ? "A fishing rod" : `${count} fishing rods`),
  rawFish: (count) => (count === 1 ? "1 raw fish" : `${count} raw fish`),
  cookedFish: (count) => (count === 1 ? "1 cooked fish" : `${count} cooked fish`),
};

export const strings = {
  gameTitle: "Far Hollow",
  startScreen: {
    slots: "Saved games",
    slot: (number: number) => `Slot ${number}`,
    empty: "Empty",
    broken: "This saved game cannot be loaded.",
    summary: (day: number, seed: number) => `Day ${day} · Seed ${seed}`,
    continueGame: "Continue",
    newGame: "New game",
    seed: "Seed",
    randomSeed: "Random",
    seedHint: "Leave blank for a random valley, or type a number or word.",
    start: "Start",
    replaceWarning: (slot: number) => `This replaces the saved game in slot ${slot}.`,
    replace: "Replace saved game",
    cancel: "Cancel",
    cannotSave: "This browser cannot save games, so your progress will be lost when you close the page.",
    exportGame: "Export",
    exportFileName: (slot: number, day: number) => `far-hollow-slot-${slot}-day-${day}.json`,
    brokenExportFileName: (slot: number) => `far-hollow-slot-${slot}-broken.json`,
    importGame: "Import",
    importWarning: (slot: number) => `Importing a file replaces the saved game in slot ${slot}.`,
    chooseFile: "Choose file",
    importRefusals: {
      notASave: "This file is not a Far Hollow saved game.",
      largeValley: "This saved game was made in the old 1 km valley, so it cannot be loaded.",
      newerVersion: "This saved game was made by a newer version of Far Hollow. Update the game to load it.",
      notStored: "The saved game could not be stored in this browser.",
    },
  },
  pause: "Pause",
  resume: "Resume",
  paused: "Paused",
  chopping: "Chopping",
  splitting: "Splitting",
  debarking: "Debarking",
  debark: "Debark",
  building: "Building",
  takingDown: "Taking down",
  takeDown: "Take down",
  crafting: "Crafting",
  fishing: "Fishing",
  gatheringStone: "Gathering stone",
  diggingUp: "Digging up",
  planting: "Planting",
  plantingMushroom: "Planting a mushroom",
  /** The hint while a see-through sapling follows the mouse. */
  plantingSapling: {
    what: "Planting: Sapling. Click the ground to plant it.",
    refused: (reason: string) => `Cannot plant here: ${reason}.`,
  },
  craftMenu: {
    open: "Craft",
    title: "Craft",
    recipes: {
      saw: "Saw",
      planks: "Cut planks",
      fishingRod: "Fishing rod",
      torch: "Torch",
    },
    /** What a station recipe uses from the ground beside its station, such as "1 debarked log by the sawhorse". */
    besideStation: (materials: string, station: string) => `${materials} by the ${station.toLowerCase()}`,
    /** Logs and debarked logs a station recipe uses from the ground, by how many. */
    groundMaterials: {
      log: (count: number) => (count === 1 ? "1 log" : `${count} logs`),
      debarkedLog: (count: number) => (count === 1 ? "1 debarked log" : `${count} debarked logs`),
    },
    /** What a recipe uses and how long it takes, such as "Saw blade, Stick ×3 · 5 s". */
    cost: (materials: readonly string[], seconds: number) => `${materials.join(", ")} · ${seconds} s`,
    /** Each thing a recipe can lack, as the craft menu and notices name it. */
    lacking: {
      /** A tool that is not in the backpack, such as "the saw". */
      tool: (tool: string) => `the ${tool.toLowerCase()}`,
      /** A work station that does not stand yet, such as "a sawhorse". */
      station: (station: string) => `a ${station.toLowerCase()}`,
      materials: "more materials",
    },
    /** What the craft menu says a recipe lacks, such as "needs the saw and a sawhorse". */
    needs: (lacking: readonly string[]) => `needs ${lacking.join(" and ")}`,
  },
  /** The HUD clock in the top left corner, such as "Day 2 · 14:20". */
  clock: (day: number, hour: number, minute: number) => `Day ${day} · ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  /** The time of day the HUD clock names after the time, in secondary text. */
  timeOfDay: {
    morning: "morning",
    afternoon: "afternoon",
    evening: "evening",
    night: "night",
  },
  buildMenu: {
    open: "Build",
    title: "Build",
    structures: {
      campfire: "Campfire",
      leanTo: "Lean-to",
      foundation: "Foundation",
      floor: "Floor",
      logWall: "Log wall",
      doorFrame: "Door frame",
      roofFrame: "Roof frame",
      roof: "Roof section",
      door: "Door",
      fireplace: "Fireplace",
      woodpile: "Woodpile",
      chest: "Chest",
      shelf: "Shelf",
      bed: "Bed",
      table: "Table",
      stool: "Stool",
      rainBarrel: "Rain barrel",
      sawhorse: "Sawhorse",
      sled: "Sled",
    },
    materials: {
      stick: (count: number) => (count === 1 ? "1 stick" : `${count} sticks`),
      bark: (count: number) => `${count} bark`,
      plank: (count: number) => (count === 1 ? "1 plank" : `${count} planks`),
      stone: (count: number) => (count === 1 ? "1 stone" : `${count} stones`),
      log: (count: number) => (count === 1 ? "1 log" : `${count} logs`),
      debarkedLog: (count: number) => (count === 1 ? "1 debarked log" : `${count} debarked logs`),
    },
    cost: (materials: readonly string[]) => materials.join(", "),
    /** The full name of a build menu tile, for screen readers, such as "Campfire: 5 sticks". A structure that costs nothing has only its name. */
    entryLabel: (structure: string, cost: string) => (cost === "" ? structure : `${structure}: ${cost}`),
    /** What to click while placing each kind of structure, given its name. The keys show after it, from `hudLabels.placingKeys`. */
    /** The placing hint when the game refuses the spot under the mouse and says why. */
    refusedHere: (structure: string, reason: string) => `Cannot place a ${structure} here: ${reason}.`,
    placing: {
      anywhere: (structure: string) => `Placing: ${structure}. Click the ground or a floor to place it anywhere.`,
      onGround: (structure: string) => `Placing: ${structure}. Click the ground to place it.`,
      onFoundation: (structure: string) => `Placing: ${structure}. Point at a finished foundation and click to place it. R turns it.`,
      underfoot: (structure: string) =>
        `Placing: ${structure}. Point at a finished foundation and click to place it. Hold Shift and drag to place one on each square.`,
      onEdge: (structure: string) => `Placing: ${structure}. Point at a finished foundation and click to place it on an edge. R picks another edge.`,
      overWalls: (structure: string) =>
        `Placing: ${structure}. Point at a finished foundation with a wall or door frame on its edge, and click to place it. R turns the way it slopes down.`,
      onFrame: (structure: string) => `Placing: ${structure}. Point at a finished roof frame and click to place it. It slopes the way the frame does.`,
      inDoorFrame: (structure: string) => `Placing: ${structure}. Point at a finished door frame with no door, and click to hang it there.`,
    },
  },
  /** Labels that name the HUD's buttons and bars, and the keys that work them. */
  hudLabels: {
    /** The key that opens the build menu, shown on its button. */
    buildKey: "B",
    /** The key that opens the craft menu, shown on its button. */
    craftKey: "C",
    /** The keys that work while placing a structure, shown after the placing hint. */
    placingKeys: {
      rotate: "R to rotate",
      cancel: "Esc to cancel",
      /** Placing floors goes on after each click, so Esc stops it rather than cancelling one placement. */
      stop: "Esc to stop",
      join: (keys: readonly string[]) => keys.join(" · "),
    },
  },
  blueprint: {
    title: (structure: string) => `Blueprint: ${structure}`,
    deliveries: {
      log: (has: number, needs: number) => `Logs: ${has} of ${needs}`,
      debarkedLog: (has: number, needs: number) => `Debarked logs: ${has} of ${needs}`,
      plank: (has: number, needs: number) => `Planks: ${has} of ${needs}`,
      stone: (has: number, needs: number) => `Stone: ${has} of ${needs}`,
    },
    /** How to add the material the blueprint still waits for. */
    deliverHint: {
      log: `Lay logs within ${NEARBY_MATERIALS_METRES} m of the blueprint, or carry one here and click the blueprint to add it.`,
      debarkedLog: `Lay debarked logs within ${NEARBY_MATERIALS_METRES} m of the blueprint, or carry one here and click the blueprint to add it.`,
      plank: "Bring planks in your backpack and click the blueprint to build with them.",
      stone: `Bring stone in your backpack, or lay it within ${NEARBY_MATERIALS_METRES} m of the blueprint, and click the blueprint to build with it.`,
    },
    buildHint: "Click the blueprint to build it. Click elsewhere or press Escape to stop.",
  },
  actionMenu: "Actions",
  campfire: "Campfire",
  fireplace: "Fireplace",
  campfireLit: "Burning",
  campfireUnlit: "Not lit",
  campfireFuel: "Fuel",
  potBoiling: "Boiling",
  potBoiled: "The water has boiled.",
  /** One fish on the campfire, as the campfire's panel lists it. */
  fishCooking: "Cooking",
  fishCooked: "Cooked",
  woodpile: {
    title: "Woodpile",
    fill: "Stacked",
    count: (total: number, capacity: number) => `${total} of ${capacity}`,
    contents: {
      log: (count: number) => (count === 1 ? "1 log" : `${count} logs`),
      debarkedLog: (count: number) => (count === 1 ? "1 debarked log" : `${count} debarked logs`),
      firewood: (count: number) => (count === 1 ? "1 piece of firewood" : `${count} pieces of firewood`),
    },
  },
  rainBarrel: {
    title: "Rain barrel",
    fill: "Water",
    /** How many drinks of clean water the barrel holds, out of the most it holds. */
    count: (drinks: number, limit: number) => `${drinks} of ${limit} drinks`,
    underRoof: "Under a roof: catches no rain.",
  },
  warmth: "Warmth",
  needs: "Needs",
  hunger: "Hunger",
  raining: "It is raining. The rain chills you.",
  thirst: "Thirst",
  sick: "Sick: your needs drain faster. Rest to recover sooner.",
  /** The hint above the need gauges when one or more needs are low enough to slow the player. */
  lowNeeds: {
    /** How each low need makes the player feel, such as "hungry". */
    feeling: { hunger: "hungry", thirst: "thirsty", warmth: "cold", fatigue: "tired" },
    /** What the player does to fill each low need, such as "eat". */
    remedy: { hunger: "eat", thirst: "drink", warmth: "warm up by a fire", fatigue: "rest" },
    /** Such as "Hungry and cold: you move and work more slowly. Eat and warm up by a fire." */
    slowed: (feelings: readonly string[], remedies: readonly string[]) =>
      `${capitalise(listText(feelings))}: you move and work more slowly. ${capitalise(listText(remedies))}.`,
    /** Added when a need is empty. */
    collapseSoon: "If a need stays empty for an hour, you collapse.",
  },
  fatigue: "Rest",
  notices: {
    survivedFirstNight: "You survived the night.",
    snugRoomKeepsOutCold: "This room now keeps out the cold. At night, you lose warmth here at half the rate.",
    collapsed: "You collapsed. You woke the next morning.",
    backpackFull: "Your backpack is full.",
    chestFull: "The chest is full.",
    shelfFull: "The shelf is full.",
    holdsUpPiece: "Something stands on this. Take that down first.",
    stillHoldsSomething: "Something is still in this. Empty it first.",
    saveBroken: "Your saved game could not be loaded, so a new game has started.",
    putLogDownFirst: "Put the log down first.",
    letGoFirst: "Let go of the sled first.",
    fishGotAway: "A fish got away. Your backpack is full.",
    /** The player tried a station recipe with no debarked log beside the station, such as "Lay a debarked log within 2 m of the sawhorse first." */
    noLogBesideStation: (station: string) => `Lay a debarked log within ${STATION_GROUND_METRES} m of the ${station.toLowerCase()} first.`,
    /** The player tried a recipe they cannot follow yet, such as "This needs the saw first." */
    cannotCraftYet: (lacking: readonly string[]) => `This needs ${lacking.join(" and ")} first.`,
    /** Crafting finished, but some of the result did not fit in the backpack, such as "2 planks dropped beside the sawhorse." */
    droppedBesideStation: (what: string, station: string) => `${what} dropped beside the ${station.toLowerCase()}.`,
    queueFull: `You can line up at most ${ACTION_QUEUE_LIMIT} actions.`,
    /** The player tried to line up an action the game refuses now, such as "You cannot line that up: needs the axe." */
    cannotQueue: (reason: string) => `You cannot line that up: ${reason}.`,
    /** A lined-up action's turn came, but the game refused it, such as "Skipped the next action: the fire is full." */
    actionSkipped: (reason: string) => `Skipped the next action: ${reason}.`,
    /** The player sent an action the game refuses now, such as "You cannot do that: needs the fishing rod." */
    refused: (reason: string) => `You cannot do that: ${reason}.`,
  },
  backpack: "Backpack",
  backpackContents: {
    axe: "Axe",
    knife: "Knife",
    drawknife: "Drawknife",
    steelAndFlint: "Steel and flint",
    bedroll: "Bedroll",
    stick: "Stick",
    firewood: "Firewood",
    bark: "Bark",
    stone: "Stone",
    torch: "Torch",
    sapling: "Sapling",
    pot: "Pot (empty)",
    potOfRiverWater: "Pot of river water",
    potOfBoiledWater: "Pot of clean water",
    berries: "Berries",
    mushroom: "Mushroom",
    sawBlade: "Saw blade",
    saw: "Saw",
    plank: "Plank",
    fishingLine: "Fishing line",
    fishingRod: "Fishing rod",
    rawFish: "Raw fish",
    cookedFish: "Cooked fish",
  },
  chest: {
    title: "Chest",
    empty: "The chest is empty.",
    /** The full name of a chest cell, for screen readers. */
    take: (name: string) => `Take ${name.toLowerCase()} from the chest`,
    hint: "Click something in the backpack to put one in the chest. Click something in the chest to take one out. Shift-click moves all that fit.",
  },
  /** The chest panel, when the player has a shelf open. */
  shelf: {
    title: "Shelf",
    empty: "The shelf is empty.",
    /** The full name of a shelf cell, for screen readers. */
    take: (name: string) => `Take ${name.toLowerCase()} from the shelf`,
    hint: "Click something in the backpack to put one on the shelf. Click something on the shelf to take one off. Shift-click moves all that fit.",
  },
  pile: {
    title: "Pile",
    /** What a pile holds, such as "7 sticks". */
    holds: (content: BackpackContent, count: number) => PILE_HOLDS[content](count),
  },
  backpackContentCount: (name: string, count: number) => (count === 1 ? name : `${name} ×${count}`),
  /** The count shown in the corner of a backpack cell when the backpack holds more than one. */
  backpackCountBadge: (count: number) => `${count}`,
  /** The exact weight a weight ring shows when the player points at it, such as "5.5 of 20 kg". */
  weightOf: (kilograms: number, limitKilograms: number) => `${kilogramsText(kilograms)} of ${kilogramsText(limitKilograms)} kg`,
  /** The hotbar's cells: the backpack contents and the log on the shoulder. */
  hotbar: {
    /** The number key that uses a cell, shown in its corner. */
    key: (number: number) => `${number}`,
    /** The full name of a cell, for screen readers, such as "Berries ×3, key 2". `what` comes from `backpackContentCount`. */
    cell: (what: string, key: string | undefined) => (key === undefined ? what : `${what}, key ${key}`),
    /** The name of the shoulder cell for screen readers, such as "On your shoulder: Log". */
    shoulder: (name: string) => `On your shoulder: ${name}`,
    /**
     * The name of the sled cell, with how many log spaces the sled's load fills and how many it has, such as "Sled 4/6".
     * Each plank fills a quarter of a log space, so the load can be a fraction, such as "Sled 1.5/6".
     */
    sled: (total: number, capacity: number) => `Sled ${Number(total.toFixed(2))}/${capacity}`,
    /** The label above a backpack cell, with how much its contents weigh, such as "Plank ×5 · 10 kg". `what` comes from `backpackContentCount`. */
    nameWithWeight: (what: string, kilograms: number) => `${what} · ${kilogramsText(kilograms)} kg`,
    /** The name of the sled cell for screen readers, such as "Dragging: Sled 4/6". */
    dragging: (name: string) => `Dragging: ${name}`,
    /** The name of the cell for the lit torch in the player's hand. */
    litTorch: "Lit torch",
    /** The name of the lit torch cell for screen readers, such as "In your hand: Lit torch · 2 h 10 min left". */
    inHand: (what: string) => `In your hand: ${what}`,
    /** The label above the lit torch cell, with how long it still burns, such as "Lit torch · 2 h 10 min left". */
    burnsFor: (name: string, minutes: number) => {
      const whole = Math.max(0, Math.ceil(minutes));
      const hours = Math.floor(whole / 60);
      const left = whole % 60;
      const time = hours === 0 ? `${left} min` : left === 0 ? `${hours} h` : `${hours} h ${left} min`;
      return `${name} · ${time} left`;
    },
  },
  /** The action queue: the row of icons beside the clock, one per lined-up action. */
  actionQueue: {
    /** The row's name, for screen readers. */
    title: "Lined-up actions",
    /** The full name of one icon, for screen readers, such as "Cancel: Chop". A click on it cancels that action. */
    cancel: (action: string) => `Cancel: ${action}`,
    /** Walking beside a campfire or woodpile to tend it. */
    tend: "Tend",
    stopBuilding: "Stop building",
  },
  /** What the player can do to a thing, as the action menu names it. */
  actions: {
    walk: "Walk here",
    drink: "Drink",
    fish: "Fish",
    gatherStone: "Gather stone",
    chop: "Chop",
    digUp: "Dig up",
    pickUp: "Pick up",
    forage: "Forage",
    debark: "Debark",
    light: "Light",
    addFuel: { firewood: "Add firewood", stick: "Add a stick", bark: "Add bark" },
    putPotOn: "Put the pot on",
    takePotOff: "Take the pot off",
    cookFish: "Cook fish",
    takeFishOff: "Take fish off",
    stack: { log: "Stack the log", debarkedLog: "Stack the debarked log", firewood: "Stack firewood" },
    stackAllFirewood: "Stack all firewood",
    take: { log: "Take a log", debarkedLog: "Take a debarked log", firewood: "Take firewood" },
    loadSled: { log: "Put the log on the sled", debarkedLog: "Put the debarked log on the sled" },
    loadPlanks: "Load planks",
    takePlanks: "Take planks",
    tipOut: "Tip out everything",
    drag: "Drag the sled",
    letGo: "Let go of the sled",
    open: "Open",
    sleep: "Sleep",
    sit: "Sit",
    build: "Build",
    deliver: { log: "Add the log", debarkedLog: "Add the debarked log" },
    openMenu: "Open its menu",
    takeDown: "Take down",
    eat: "Eat",
    layOut: "Lay it out",
    /** Throwing away the lit torch in the player's hand. */
    putOut: "Put out",
    /** Standing the lit torch in the player's hand in the ground at their feet. */
    plant: "Plant",
    /** Planting a mushroom from the backpack on a plain log on the ground. */
    plantMushroom: "Plant mushroom",
    /** Laying the bedroll from the backpack in a lean-to, across its open front. */
    layBedrollHere: "Lay the bedroll here",
    fillPot: "Fill it at the river",
    fillPotHere: "Fill the pot",
    drinkFromPot: "Drink",
    drop: "Drop",
    dropHere: { log: "Drop the log here", debarkedLog: "Drop the debarked log here" },
    /** Putting a backpack content in the open chest or on the open shelf. */
    putInChest: { chest: "Put one in the chest", shelf: "Put one on the shelf" },
    putAllInChest: { chest: "Put all in the chest", shelf: "Put all on the shelf" },
    split: "Split into firewood",
    /** A disabled action with the reason it is off, such as "Add bark: no bark". */
    withReason: (action: string, reason: string) => `${action}: ${reason}`,
  },
  /** Why the player cannot do an action yet. */
  actionReasons: {
    /** A tool that is not in the backpack, such as "needs the axe". */
    needsTool: (tool: string) => `needs the ${tool.toLowerCase()}`,
    /** A fuel or wood the backpack does not hold. */
    noContent: { firewood: "no firewood", stick: "no sticks", bark: "no bark", plank: "no planks" },
    /** What a blueprint lacks when it has no stone to build its next stage. */
    noStone: "no stone",
    fireEmpty: "no fuel",
    fireFull: "the fire is full",
    lightFirst: "light the fire first",
    noPotOfWater: "no pot of water",
    noRawFish: "no raw fish",
    fireFullOfFish: "the fire holds 3 fish",
    woodpileFull: "the woodpile is full",
    sledFull: "the sled is full",
    letGoFirst: "let go of the sled first",
    shoulderFull: "your shoulder is full",
    putLogDownFirst: "put the log down first",
    noLogCarried: "carrying no log",
    nothingToTake: "nothing to take",
    emptyFirst: "empty it first",
    potOnFire: "take the pot off first",
    fishOnFire: "take the fish off first",
    fireNotOut: "let the fire burn out first",
    holdsUpPiece: "take down what stands on it first",
    tooYoungToChop: "the tree is too young to chop",
    noSaplingYet: "no sapling grows on the stump yet",
    tooBigToDigUp: "the tree is too big to dig up",
    noSapling: "no sapling in the backpack",
    notPlantableGround: "a sapling grows only on forest floor or in a clearing",
    tooCloseToTree: "too close to a tree, stump, or sapling",
    tooCloseToStructure: "too close to something built here",
    backpackFull: "the backpack is full",
    torchAlreadyLit: "you already hold a lit torch",
    gone: "it is no longer there",
    openFirst: "open it first",
    torchTooClose: "another torch stands too close",
    noLitTorch: "you hold no lit torch",
    noMushroom: "no mushroom in the backpack",
    needsPlainLog: "a mushroom grows only on a log with its bark on",
    coversMushroomLog: "a mushroom log lies here",
    barrelEmpty: "the barrel is empty",
    noEmptyPot: "no empty pot in the backpack",
    /** A delivered material the blueprint needs before the next stage can be built. */
    bringFirst: { log: "bring a log first", debarkedLog: "bring a debarked log first" },
  },
  /** The names of the logs the player can carry on their shoulder, as the hotbar shows them. */
  things: {
    log: "Log",
    debarkedLog: "Debarked log",
  },
  debugFps: "FPS",
  debugEntities: "Entities",
  debugSeed: "Seed",
  debugTime: "Time",
  debugDayAndTime: (day: number, clock: string) => `Day ${day}, ${clock}`,
  debugSkipHours: (hours: number) => `Skip ${hours} h`,
  debugRain: "Rain",
  debugRainFalling: "Falling",
  debugRainDry: "Dry",
  debugSkipToRainChange: (raining: boolean) => (raining ? "Skip to rain stopping" : "Skip to rain starting"),
  debugRooms: "Rooms",
  debugRoom: (squares: number, heated: boolean, snug: boolean) =>
    `${squares} ${squares === 1 ? "square" : "squares"}, ${heated ? "heated" : "not heated"}, ${snug ? "snug" : "not snug"}`,
} as const;

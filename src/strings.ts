// All player-facing text lives here, so the game can be translated later.
import type { BackpackContent } from "./sim/api";
import { STATION_GROUND_METRES } from "./sim/crafting";

/** How many of each kind of thing a pile holds, in words. */
const PILE_HOLDS: Readonly<Record<BackpackContent, (count: number) => string>> = {
  axe: (count) => (count === 1 ? "An axe" : `${count} axes`),
  knife: (count) => (count === 1 ? "A knife" : `${count} knives`),
  drawknife: (count) => (count === 1 ? "A drawknife" : `${count} drawknives`),
  fireStriker: (count) => (count === 1 ? "A fire striker" : `${count} fire strikers`),
  bedroll: (count) => (count === 1 ? "A rolled-up bedroll" : `${count} rolled-up bedrolls`),
  stick: (count) => (count === 1 ? "1 stick" : `${count} sticks`),
  firewood: (count) => (count === 1 ? "1 piece of firewood" : `${count} pieces of firewood`),
  bark: (count) => (count === 1 ? "1 piece of bark" : `${count} pieces of bark`),
  berries: (count) => (count === 1 ? "1 handful of berries" : `${count} handfuls of berries`),
  mushroom: (count) => (count === 1 ? "1 mushroom" : `${count} mushrooms`),
  pot: () => "An empty pot",
  potOfRiverWater: () => "A pot of river water",
  potOfBoiledWater: () => "A pot of boiled water",
  sawBlade: (count) => (count === 1 ? "A saw blade" : `${count} saw blades`),
  saw: (count) => (count === 1 ? "A saw" : `${count} saws`),
  plank: (count) => (count === 1 ? "1 plank" : `${count} planks`),
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
  craftMenu: {
    open: "Craft",
    title: "Craft",
    /** What the craft wheel's centre says before the player points at a recipe. */
    pick: "Pick a recipe",
    recipes: {
      saw: "Saw",
      planks: "Cut planks",
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
  buildMenu: {
    open: "Build",
    title: "Build",
    /** What the build wheel's centre says before the player points at a structure. */
    pick: "Pick a structure",
    structures: {
      campfire: "Campfire",
      leanTo: "Lean-to",
      foundation: "Foundation",
      logWall: "Log wall",
      doorFrame: "Door frame",
      roofFrame: "Roof frame",
      roof: "Roof section",
      woodpile: "Woodpile",
      chest: "Chest",
      sawhorse: "Sawhorse",
    },
    materials: {
      stick: (count: number) => (count === 1 ? "1 stick" : `${count} sticks`),
      bark: (count: number) => `${count} bark`,
      debarkedLog: (count: number) => (count === 1 ? "1 debarked log" : `${count} debarked logs`),
    },
    cost: (materials: readonly string[]) => materials.join(", "),
    /** The full name of a build menu tile, for screen readers, such as "Campfire: 5 sticks". A structure that costs nothing has only its name. */
    entryLabel: (structure: string, cost: string) => (cost === "" ? structure : `${structure}: ${cost}`),
    /** What the build menu says about the tool a structure needs, such as "needs the axe". */
    needsTool: (tool: string) => `needs the ${tool.toLowerCase()}`,
    /** What to click while placing each kind of structure, given its name. The keys show after it, from `hudLabels.placingKeys`. */
    placing: {
      anywhere: (structure: string) => `Placing: ${structure}. Click the ground or a floor to place it anywhere.`,
      onGround: (structure: string) => `Placing: ${structure}. Click the ground to place it.`,
      onEdge: (structure: string) => `Placing: ${structure}. Point at a finished foundation and click to place it on an edge. R picks another edge.`,
      overWalls: (structure: string) =>
        `Placing: ${structure}. Point at a finished foundation with a wall or door frame on its edge, and click to place it. R turns the way it slopes down.`,
      onFrame: (structure: string) => `Placing: ${structure}. Point at a finished roof frame and click to place it. It slopes the way the frame does.`,
    },
  },
  /** Labels that name the HUD's buttons and bars, and the keys that work them. */
  hudLabels: {
    /** The key that opens the build wheel, shown on its button. */
    buildKey: "B",
    /** The key that opens the craft wheel, shown on its button. */
    craftKey: "C",
    /** The keys that work while placing a structure, shown after the placing hint. */
    placingKeys: {
      rotate: "R to rotate",
      cancel: "Esc to cancel",
      join: (keys: readonly string[]) => keys.join(" · "),
    },
  },
  blueprint: {
    title: (structure: string) => `Blueprint: ${structure}`,
    deliveries: {
      debarkedLog: (has: number, needs: number) => `Debarked logs: ${has} of ${needs}`,
    },
    deliverHint: "Carry a debarked log here and click the blueprint to add it.",
    buildHint: "Click the blueprint to build it. Click elsewhere or press Escape to stop.",
  },
  actionMenu: "Actions",
  campfire: "Campfire",
  campfireLit: "Burning",
  campfireUnlit: "Not lit",
  campfireFuel: "Fuel",
  potBoiling: "Boiling",
  potBoiled: "The water has boiled.",
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
  warmth: "Warmth",
  needs: "Needs",
  hunger: "Hunger",
  raining: "It is raining. The rain chills you.",
  thirst: "Thirst",
  sick: "Sick: your needs drain faster. Rest to recover sooner.",
  fatigue: "Rest",
  notices: {
    survivedFirstNight: "You survived the night.",
    collapsed: "You collapsed. You woke the next morning.",
    backpackFull: "Your backpack is full.",
    chestFull: "The chest is full.",
    holdsUpPiece: "Something stands on this. Take that down first.",
    stillHoldsSomething: "Something is still in this. Empty it first.",
    saveBroken: "Your saved game could not be loaded, so a new game has started.",
    putLogDownFirst: "Put the log down first.",
    /** The player tried a station recipe with no debarked log beside the station, such as "Lay a debarked log within 2 m of the sawhorse first." */
    noLogBesideStation: (station: string) => `Lay a debarked log within ${STATION_GROUND_METRES} m of the ${station.toLowerCase()} first.`,
    /** The player tried a recipe they cannot follow yet, such as "This needs the saw first." */
    cannotCraftYet: (lacking: readonly string[]) => `This needs ${lacking.join(" and ")} first.`,
  },
  backpack: "Backpack",
  backpackContents: {
    axe: "Axe",
    knife: "Knife",
    drawknife: "Drawknife",
    fireStriker: "Fire striker",
    bedroll: "Bedroll",
    stick: "Stick",
    firewood: "Firewood",
    bark: "Bark",
    pot: "Pot (empty)",
    potOfRiverWater: "Pot of river water",
    potOfBoiledWater: "Pot of boiled water",
    berries: "Berries",
    mushroom: "Mushroom",
    sawBlade: "Saw blade",
    saw: "Saw",
    plank: "Plank",
  },
  chest: {
    title: "Chest",
    empty: "The chest is empty.",
    /** The tip shown when the player points at a chest cell. */
    takeTip: (name: string) => `${name}. Click to take one.`,
    /** The full name of a chest cell, for screen readers. */
    take: (name: string) => `Take ${name.toLowerCase()} from the chest`,
    hint: "Click a backpack item to put one in the chest. Click a chest item to take one out. Shift-click moves all that fit.",
  },
  pile: {
    title: "Pile",
    /** What a pile holds, such as "7 sticks". */
    holds: (content: BackpackContent, count: number) => PILE_HOLDS[content](count),
  },
  backpackContentCount: (name: string, count: number) => (count === 1 ? name : `${name} ×${count}`),
  /** The count shown in the corner of a backpack cell when the backpack holds more than one. */
  backpackCountBadge: (count: number) => `${count}`,
  backpackWeight: (kilograms: number, limitKilograms: number) => `${kilograms.toFixed(1)} / ${limitKilograms} kg`,
  /** The hotbar's cells: the backpack items and the log on the shoulder. */
  hotbar: {
    /** The number key that uses a cell, shown in its corner. */
    key: (number: number) => `${number}`,
    /** The full name of a cell, for screen readers, such as "Berries ×3, key 2". */
    cell: (name: string, count: number, key: string | undefined) => {
      const what = count === 1 ? name : `${name} ×${count}`;
      return key === undefined ? what : `${what}, key ${key}`;
    },
    /** The name of the shoulder cell for screen readers, such as "On your shoulder: Log". */
    shoulder: (name: string) => `On your shoulder: ${name}`,
  },
  /** What the player can do to a thing, as the right-click menu and the cursor prompt name it. */
  actions: {
    walk: "Walk here",
    drink: "Drink",
    chop: "Chop",
    pickUp: "Pick up",
    forage: "Forage",
    debark: "Debark",
    light: "Light",
    addFuel: { firewood: "Add firewood", stick: "Add a stick", bark: "Add bark" },
    putPotOn: "Put the pot on",
    takePotOff: "Take the pot off",
    stack: { log: "Stack the log", debarkedLog: "Stack the debarked log", firewood: "Stack firewood" },
    stackAllFirewood: "Stack all firewood",
    take: { log: "Take a log", debarkedLog: "Take a debarked log", firewood: "Take firewood" },
    open: "Open",
    sleep: "Sleep",
    build: "Build",
    deliver: { debarkedLog: "Add the debarked log" },
    openMenu: "Open its menu",
    takeDown: "Take down",
    eat: "Eat",
    layOut: "Lay it out",
    fillPot: "Fill it at the river",
    drinkFromPot: "Drink",
    drop: "Drop",
    putInChest: "Put one in the chest",
    putAllInChest: "Put all in the chest",
    split: "Split into firewood",
    /** A disabled action with the reason it is off, such as "Add bark: no bark". */
    withReason: (action: string, reason: string) => `${action}: ${reason}`,
  },
  /** Why the player cannot do an action yet. */
  actionReasons: {
    /** A tool that is not in the backpack, such as "needs the axe". */
    needsTool: (tool: string) => `needs the ${tool.toLowerCase()}`,
    noFuel: { firewood: "no firewood", stick: "no sticks", bark: "no bark" },
    fireEmpty: "no fuel",
    fireFull: "the fire is full",
    lightFirst: "light the fire first",
    noPotOfWater: "no pot of water",
    noFirewood: "no firewood",
    woodpileFull: "the woodpile is full",
    shoulderFull: "your shoulder is full",
    nothingToTake: "nothing to take",
    emptyFirst: "empty it first",
  },
  /** The names of things the player can act on, as the cursor prompt shows them. */
  things: {
    ground: "Ground",
    river: "River",
    tree: "Tree",
    log: "Log",
    debarkedLog: "Debarked log",
    stick: "Stick",
    bark: "Bark",
    forage: "Forage spot",
    campfire: "Campfire",
    woodpile: "Woodpile",
    chest: "Chest",
    bedroll: "Bedroll",
    pile: "Pile",
    structure: "Building piece",
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
  debugRoom: (squares: number, heated: boolean) => `${squares} ${squares === 1 ? "square" : "squares"}, ${heated ? "heated" : "not heated"}`,
} as const;

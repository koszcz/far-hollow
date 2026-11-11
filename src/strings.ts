// All player-facing text lives here, so the game can be translated later.
import type { BackpackContent } from "./sim/api";

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
    /** What the craft menu says about a tool a recipe needs that is not in the backpack, such as "needs the saw". */
    needsTool: (tool: string) => `needs the ${tool.toLowerCase()}`,
    /** What the craft menu says about a work station a recipe needs that does not stand yet, such as "needs a sawhorse". */
    needsStation: (station: string) => `needs a ${station.toLowerCase()}`,
    putLogDownFirst: "Put the log down first.",
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
    /** What to do while placing each kind of structure, given its name. */
    placing: {
      anywhere: (structure: string) =>
        `Placing: ${structure}. Click the ground or a floor to place it anywhere. Press R to turn it, or Escape to cancel.`,
      onGround: (structure: string) => `Placing: ${structure}. Click the ground to place it. Press R to turn it, or Escape to cancel.`,
      onEdge: (structure: string) =>
        `Placing: ${structure}. Point at a finished foundation and click to place it on an edge. Press R to pick another edge, or Escape to cancel.`,
      overWalls: (structure: string) =>
        `Placing: ${structure}. Point at a finished foundation with a wall or door frame on its edge, and click to place it. Press Escape to cancel.`,
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
  carryingLog: "Carrying a log",
  carryingDebarkedLog: "Carrying a debarked log",
  dropLog: "Drop log",
  actionMenu: "Actions",
  splitLog: "Split into firewood",
  campfire: "Campfire",
  campfireLit: "Burning",
  campfireUnlit: "Not lit",
  campfireFuel: "Fuel",
  addStick: "Add a stick",
  addFirewood: "Add firewood",
  addBark: "Add bark",
  lightCampfire: "Light with fire striker",
  putPotOnFire: "Put the pot on to boil",
  takePotOffFire: "Take the pot off",
  potBoiling: "Boiling",
  potBoiled: "The water has boiled.",
  fillPot: "Fill the pot at the river",
  drinkFromPot: "Drink from the pot",
  woodpile: {
    title: "Woodpile",
    fill: "Stacked",
    count: (total: number, capacity: number) => `${total} of ${capacity}`,
    contents: {
      log: (count: number) => (count === 1 ? "1 log" : `${count} logs`),
      debarkedLog: (count: number) => (count === 1 ? "1 debarked log" : `${count} debarked logs`),
      firewood: (count: number) => (count === 1 ? "1 piece of firewood" : `${count} pieces of firewood`),
    },
    stack: {
      log: "Stack the log",
      debarkedLog: "Stack the debarked log",
      firewood: "Stack firewood",
    },
    take: {
      log: "Take a log",
      debarkedLog: "Take a debarked log",
      firewood: "Take firewood",
    },
    stackAllHint: "Shift-click Stack firewood to stack all the firewood that fits.",
  },
  warmth: "Warmth",
  needs: "Needs",
  hunger: "Hunger",
  raining: "It is raining. The rain chills you.",
  thirst: "Thirst",
  eat: "Eat",
  /** The full name of an eat button, for screen readers. */
  eatFood: (food: string) => `Eat ${food.toLowerCase()}`,
  sick: "Sick: your needs drain faster. Rest to recover sooner.",
  fatigue: "Rest",
  layBedroll: "Lay out bedroll",
  bedroll: "Bedroll",
  sleep: "Sleep",
  pickUpBedroll: "Roll up and pack",
  notices: {
    survivedFirstNight: "You survived the night.",
    collapsed: "You collapsed. You woke the next morning.",
    backpackFull: "Your backpack is full.",
    chestFull: "The chest is full.",
    holdsUpPiece: "Something stands on this. Take that down first.",
    stillHoldsSomething: "Something is still in this. Empty it first.",
    saveBroken: "Your saved game could not be loaded, so a new game has started.",
    putLogDownFirst: "Put the log down first.",
    noLogBesideStation: "Lay a debarked log within 2 m of the sawhorse first.",
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
    /** The tip shown when the player points at a backpack cell while a chest is open. */
    putTip: (name: string) => `${name}. Click to put one in the chest.`,
    /** The full name of a backpack cell while a chest is open, for screen readers. */
    put: (name: string) => `Put ${name.toLowerCase()} in the chest`,
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
    pickUp: "Pick up",
    /** The tip shown when the player points at a backpack cell. */
    dropTip: (name: string) => `${name}. Click to drop all of it here.`,
    /** The full name of a backpack cell's drop button, for screen readers. */
    drop: (name: string) => `Drop ${name.toLowerCase()}`,
  },
  backpackContentCount: (name: string, count: number) => (count === 1 ? name : `${name} ×${count}`),
  /** The count shown in the corner of a backpack cell when the backpack holds more than one. */
  backpackCountBadge: (count: number) => `${count}`,
  backpackWeight: (kilograms: number, limitKilograms: number) => `${kilograms.toFixed(1)} / ${limitKilograms} kg`,
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

// The HUD showcase states for the action queue, dried food, and smoked fish icons.
import type { GameView, ThingView } from "../sim/api";
import { BASE_VIEW, type ShowcaseState } from "./hud-showcase-view";

/** What each thing the "action-queue-icons" views queue actions on is, by its made-up entity id. */
export const QUEUE_THINGS: Readonly<Record<number, ThingView>> = {
  10: { kind: "tree" },
  11: { kind: "debarkedLog" },
  12: { kind: "structure", structure: "campfire" },
  13: { kind: "structure", structure: "sled" },
  14: { kind: "forage", food: "mushroom" },
  15: { kind: "bedroll" },
};

/**
 * The approved "action-queue-icons" asset: the action queue beside the clock. The first view is the icon sheet. The others show
 * a full queue while chopping, two actions in the evening, and three while paused at night.
 */
export const ACTION_QUEUE_ICON_STATES: readonly ShowcaseState[] = [
  // QueueIconSheet replaces this view.
  { view: BASE_VIEW, buildMenuOpen: false, placing: null },
  {
    view: {
      ...BASE_VIEW,
      action: { kind: "chop", progress: 0.4 },
      actionQueue: [
        { type: "chopTree", treeId: 10 },
        { type: "pickUpLog", logId: 11 },
        { type: "addFuel", campfireId: 12, fuel: "firewood" },
        { type: "fish", x: 0, z: 0 },
      ],
    },
    buildMenuOpen: false,
    placing: null,
  },
  {
    view: {
      ...BASE_VIEW,
      time: { day: 2, hour: 18, minute: 10, hourOfDay: 18 + 10 / 60 },
      carrying: "log",
      actionQueue: [
        { type: "loadSled", sledId: 13 },
        { type: "craft", recipe: "saw" },
      ],
    },
    buildMenuOpen: false,
    placing: null,
  },
  {
    view: {
      ...BASE_VIEW,
      paused: true,
      time: { day: 3, hour: 22, minute: 40, hourOfDay: 22 + 40 / 60 },
      night: true,
      actionQueue: [
        { type: "walkTo", x: 0, z: 0 },
        { type: "forage", spotId: 14 },
        { type: "sleep", bedrollId: 15 },
      ],
    },
    buildMenuOpen: false,
    placing: null,
  },
];

/**
 * The draft "dried-food-icons" asset: dried berries and a dried mushroom in the backpack beside fresh ones, the drying rack panel
 * with fresh and dried food on it, the same by evening, and both icons drawn large beside the fresh foods.
 */
const DRIED_FOOD_RACK: GameView["nearby"][number] = {
  kind: "dryingRack",
  view: {
    id: 1,
    limit: 6,
    food: [
      { food: "berries", content: "driedBerries", preserved: true, progress: 1, waitsForFire: false },
      { food: "mushroom", content: "driedMushroom", preserved: true, progress: 1, waitsForFire: false },
      { food: "berries", content: "berries", preserved: false, progress: 0.6, waitsForFire: false },
      { food: "mushroom", content: "mushroom", preserved: false, progress: 0.1, waitsForFire: false },
    ],
  },
};
export const DRIED_FOOD_ICON_STATES: readonly ShowcaseState[] = [
  {
    view: {
      ...BASE_VIEW,
      backpack: { ...BASE_VIEW.backpack, berries: 3, mushroom: 2, driedBerries: 5, driedMushroom: 4 },
      backpackFreshness: { berries: { minutesLeft: 1500, share: 0.52 }, mushroom: { minutesLeft: 3000, share: 0.7 } },
    },
    buildMenuOpen: false,
    placing: null,
  },
  { view: { ...BASE_VIEW, backpack: { ...BASE_VIEW.backpack, berries: 1, driedBerries: 2 }, nearby: [DRIED_FOOD_RACK] }, buildMenuOpen: false, placing: null },
  {
    view: {
      ...BASE_VIEW,
      time: { ...BASE_VIEW.time, hour: 19, hourOfDay: 19 },
      backpack: { ...BASE_VIEW.backpack, driedMushroom: 3 },
      nearby: [DRIED_FOOD_RACK],
    },
    buildMenuOpen: false,
    placing: null,
  },
  // IconSheet replaces this view.
  { view: BASE_VIEW, buildMenuOpen: false, placing: null },
];

/**
 * The draft "smoked-fish-icon" asset: smoked fish in the backpack beside raw and cooked fish, the drying rack panel with fish
 * smoking, smoked, and waiting for a fire, the same by evening, and the icon drawn large beside the other fish.
 */
const SMOKED_FISH_RACK: GameView["nearby"][number] = {
  kind: "dryingRack",
  view: {
    id: 1,
    limit: 6,
    food: [
      { food: "rawFish", content: "smokedFish", preserved: true, progress: 1, waitsForFire: false },
      { food: "rawFish", content: "rawFish", preserved: false, progress: 0.45, waitsForFire: false },
      { food: "berries", content: "berries", preserved: false, progress: 0.3, waitsForFire: false },
    ],
  },
};
const SMOKED_FISH_RACK_NO_FIRE: GameView["nearby"][number] = {
  kind: "dryingRack",
  view: {
    id: 1,
    limit: 6,
    food: [
      { food: "rawFish", content: "smokedFish", preserved: true, progress: 1, waitsForFire: false },
      { food: "rawFish", content: "rawFish", preserved: false, progress: 0.45, waitsForFire: true },
    ],
  },
};
export const SMOKED_FISH_ICON_STATES: readonly ShowcaseState[] = [
  {
    view: {
      ...BASE_VIEW,
      backpack: { ...BASE_VIEW.backpack, rawFish: 2, cookedFish: 1, smokedFish: 4 },
      backpackFreshness: { rawFish: { minutesLeft: 600, share: 0.42 }, cookedFish: { minutesLeft: 2400, share: 0.83 } },
    },
    buildMenuOpen: false,
    placing: null,
  },
  { view: { ...BASE_VIEW, backpack: { ...BASE_VIEW.backpack, smokedFish: 1 }, nearby: [SMOKED_FISH_RACK] }, buildMenuOpen: false, placing: null },
  {
    view: {
      ...BASE_VIEW,
      time: { ...BASE_VIEW.time, hour: 19, hourOfDay: 19 },
      backpack: { ...BASE_VIEW.backpack, smokedFish: 3 },
      nearby: [SMOKED_FISH_RACK_NO_FIRE],
    },
    buildMenuOpen: false,
    placing: null,
  },
  // IconSheet replaces this view.
  { view: BASE_VIEW, buildMenuOpen: false, placing: null },
];

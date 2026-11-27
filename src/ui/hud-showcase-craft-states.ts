// The HUD showcase states for the jug, build, crafting, torch, fishing, and fish trap icons.
import type { GameView } from "../sim/api-game-view";
import { BASE_VIEW, FULL_BUILD_MENU, type ShowcaseState } from "./hud-showcase-view";

/** The draft "jug" asset, over the last view only: jugs in the backpack, beside a campfire firing a jug. */
export const JUG_STATES: readonly (ShowcaseState | null)[] = [
  null,
  null,
  null,
  {
    view: {
      ...BASE_VIEW,
      backpack: { unfiredJug: 2, jug: 1, clay: 1, axe: 1, knife: 1 },
      nearby: [
        {
          kind: "campfire",
          view: {
            id: 1,
            kind: "campfire",
            lit: true,
            fuelLeft: 0.8,
            fuelMinutes: 380,
            pot: { water: "river", boilProgress: 0.4 },
            fish: [{ cooked: false, cookProgress: 0.5 }],
            jug: { fired: false, fireProgress: 0.5 },
          },
        },
      ],
    },
    buildMenuOpen: false,
    placing: null,
  },
];

/** The unfired jug recipe as the craft menu lists it, with what the player has. */
const UNFIRED_JUG_RECIPE: GameView["craftMenu"][number] = {
  kind: "unfiredJug",
  materials: [{ material: "clay", count: 2 }],
  result: { content: "unfiredJug", count: 1 },
  seconds: 6,
};

/**
 * The approved "jug-icons" asset: the unfired jug recipe in the craft menu, the icons drawn large, shaping a jug under way,
 * and unfired jugs and jugs at each fill level in the backpack.
 */
export const JUG_ICON_STATES: readonly ShowcaseState[] = [
  {
    view: { ...BASE_VIEW, backpack: { ...BASE_VIEW.backpack, clay: 3 }, craftMenu: [...BASE_VIEW.craftMenu, UNFIRED_JUG_RECIPE] },
    buildMenuOpen: false,
    placing: null,
    craftMenuOpen: true,
  },
  // JugIconSheet replaces this view.
  { view: BASE_VIEW, buildMenuOpen: false, placing: null },
  {
    view: { ...BASE_VIEW, backpack: { ...BASE_VIEW.backpack, clay: 2 }, action: { kind: "craft", progress: 0.6 } },
    buildMenuOpen: false,
    placing: null,
  },
  {
    view: { ...BASE_VIEW, backpack: { ...BASE_VIEW.backpack, unfiredJug: 3, jug: 2, jugWith1Drink: 1, jugWith2Drinks: 1, jugWith3Drinks: 2 } },
    buildMenuOpen: false,
    placing: null,
  },
];

/** The "build-icons" asset: the full build menu open, in four game states. */
export const BUILD_ICON_STATES: readonly ShowcaseState[] = [
  { view: { ...BASE_VIEW, buildMenu: FULL_BUILD_MENU }, buildMenuOpen: true, placing: null },
  { view: { ...BASE_VIEW, buildMenu: FULL_BUILD_MENU, backpack: { axe: 1, stick: 1 } }, buildMenuOpen: true, placing: null },
  { view: { ...BASE_VIEW, buildMenu: FULL_BUILD_MENU, backpack: { axe: 1, stick: 10, bark: 6 } }, buildMenuOpen: true, placing: null },
  { view: { ...BASE_VIEW, buildMenu: FULL_BUILD_MENU, paused: true }, buildMenuOpen: true, placing: null },
];

/** The "crafting-icons" asset: the saw blade, the saw, and the plank in the backpack, with the craft menu and crafting under way. The last view is the icon sheet. */
export const CRAFTING_ICON_STATES: readonly ShowcaseState[] = [
  { view: { ...BASE_VIEW, backpack: { axe: 1, sawBlade: 1, stick: 3 } }, buildMenuOpen: false, placing: null, craftMenuOpen: true },
  { view: { ...BASE_VIEW, backpack: { axe: 1, sawBlade: 1, stick: 3 }, action: { kind: "craft", progress: 0.6 } }, buildMenuOpen: false, placing: null },
  { view: { ...BASE_VIEW, backpack: { saw: 1, sawBlade: 3, plank: 4, stick: 1 } }, buildMenuOpen: false, placing: null },
  // CraftingIconSheet replaces this view.
  { view: BASE_VIEW, buildMenuOpen: false, placing: null },
];

/** The torch recipe as the craft menu lists it, with what the player has. */
const TORCH_RECIPE: GameView["craftMenu"][number] = {
  kind: "torch",
  materials: [
    { material: "stick", count: 1 },
    { material: "bark", count: 1 },
  ],
  result: { content: "torch", count: 1 },
  seconds: 4,
};

/**
 * The approved "torch-icons" asset: the torch recipe in the craft menu, both icons drawn large, and the lit torch in the
 * hand with its gauge full and nearly burnt out. Unlit torches show in the backpack in the last two views. The lit torch cell shows its label, as when the player points at it.
 */
export const TORCH_ICON_STATES: readonly ShowcaseState[] = [
  {
    view: { ...BASE_VIEW, backpack: { ...BASE_VIEW.backpack, bark: 2 }, craftMenu: [...BASE_VIEW.craftMenu, TORCH_RECIPE] },
    buildMenuOpen: false,
    placing: null,
    craftMenuOpen: true,
  },
  // TorchIconSheet replaces this view.
  { view: BASE_VIEW, buildMenuOpen: false, placing: null },
  {
    view: { ...BASE_VIEW, backpack: { ...BASE_VIEW.backpack, torch: 2 }, litTorch: { minutesLeft: 178 } },
    buildMenuOpen: false,
    placing: null,
  },
  {
    view: { ...BASE_VIEW, carrying: "log", backpack: { ...BASE_VIEW.backpack, torch: 1 }, litTorch: { minutesLeft: 25 } },
    buildMenuOpen: false,
    placing: null,
  },
];

/** The fishing rod recipe as the craft menu lists it, with what the player has. */
const FISHING_ROD_RECIPE: GameView["craftMenu"][number] = {
  kind: "fishingRod",
  materials: [
    { material: "fishingLine", count: 1 },
    { material: "stick", count: 2 },
  ],
  result: { content: "fishingRod", count: 1 },
  seconds: 5,
  tool: "knife",
};

/**
 * The draft "fishing-icons" asset: the fishing line, the fishing rod, raw fish, and cooked fish in the backpack, with the
 * craft menu, crafting under way, and fish cooking on a campfire. The last view is the icon sheet.
 */
export const FISHING_ICON_STATES: readonly ShowcaseState[] = [
  {
    view: { ...BASE_VIEW, backpack: { axe: 1, knife: 1, fishingLine: 1, stick: 2 }, craftMenu: [...BASE_VIEW.craftMenu, FISHING_ROD_RECIPE] },
    buildMenuOpen: false,
    placing: null,
    craftMenuOpen: true,
  },
  {
    view: { ...BASE_VIEW, backpack: { axe: 1, knife: 1, fishingLine: 1, stick: 2 }, action: { kind: "craft", progress: 0.4 } },
    buildMenuOpen: false,
    placing: null,
  },
  {
    view: {
      ...BASE_VIEW,
      backpack: { axe: 1, knife: 1, fishingRod: 1, fishingLine: 2, stick: 3, rawFish: 3, cookedFish: 2 },
      backpackFreshness: { rawFish: { minutesLeft: 300, share: 0.21 }, cookedFish: { minutesLeft: 2400, share: 0.83 } },
      nearby: [
        {
          kind: "campfire",
          view: {
            id: 1,
            kind: "campfire",
            lit: true,
            fuelLeft: 0.5,
            fuelMinutes: 240,
            pot: null,
            jug: null,
            fish: [
              { cooked: true, cookProgress: 1 },
              { cooked: false, cookProgress: 0.6 },
              { cooked: false, cookProgress: 0.1 },
            ],
          },
        },
      ],
    },
    buildMenuOpen: false,
    placing: null,
  },
  // IconSheet replaces this view.
  { view: BASE_VIEW, buildMenuOpen: false, placing: null },
];

/** The cord and fish trap recipes as the craft menu lists them. */
const CORD_RECIPES: GameView["craftMenu"] = [
  { kind: "cord", materials: [{ material: "bark", count: 3 }], result: { content: "cord", count: 1 }, seconds: 4 },
  {
    kind: "fishTrap",
    materials: [
      { material: "cord", count: 2 },
      { material: "stick", count: 6 },
    ],
    result: { content: "fishTrap", count: 1 },
    seconds: 8,
    tool: "knife",
  },
];

/** The approved "fish-trap-icons" asset: both recipes in the craft menu, cord and a fish trap in the backpack by day and evening, and both icons drawn large. */
export const FISH_TRAP_ICON_STATES: readonly ShowcaseState[] = [
  {
    view: { ...BASE_VIEW, backpack: { ...BASE_VIEW.backpack, bark: 6, cord: 1, stick: 6 }, craftMenu: [...BASE_VIEW.craftMenu, ...CORD_RECIPES] },
    buildMenuOpen: false,
    placing: null,
    craftMenuOpen: true,
  },
  { view: { ...BASE_VIEW, backpack: { ...BASE_VIEW.backpack, cord: 3, fishTrap: 2 } }, buildMenuOpen: false, placing: null },
  { view: { ...BASE_VIEW, backpack: { ...BASE_VIEW.backpack, cord: 1, fishTrap: 1, rawFish: 2 } }, buildMenuOpen: false, placing: null },
  // IconSheet replaces this view.
  { view: BASE_VIEW, buildMenuOpen: false, placing: null },
];

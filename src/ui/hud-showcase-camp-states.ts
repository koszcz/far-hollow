// The HUD showcase states for the HUD itself, bark, the backpack icons, and the piles of stone, clay, saplings, and berry bushes.
import { BASE_VIEW, type ShowcaseState } from "./hud-showcase-view";

/** One game state per view, with whether the build menu is open and what the player is placing. */
export const STATES: readonly ShowcaseState[] = [
  {
    // The build menu opens on its first tab, Camp. A quarter of the screen fits only one row under the tabs.
    view: {
      ...BASE_VIEW,
      nearby: [
        {
          kind: "openChest",
          view: {
            id: 3,
            furniture: "chest",
            contents: { stick: 8, firewood: 4, bark: 2, berries: 6, pot: 1 },
            weight: 9.4,
            weightLimit: 60,
            freshness: { berries: { minutesLeft: 840, share: 0.3 } },
          },
        },
      ],
    },
    buildMenuOpen: true,
    placing: null,
  },
  {
    view: {
      ...BASE_VIEW,
      backpack: { axe: 1, knife: 1, steelAndFlint: 1, bedroll: 1, stick: 12, firewood: 6 },
      backpackWeight: 19.6,
      action: { kind: "chop", progress: 0.4 },
      warmth: 0.7,
      notice: { kind: "backpackFull" },
    },
    buildMenuOpen: false,
    placing: null,
  },
  {
    view: {
      ...BASE_VIEW,
      backpack: { axe: 1, knife: 1, steelAndFlint: 1, bedroll: 1, firewood: 2 },
      carrying: "log",
      nearby: [
        {
          kind: "campfire",
          view: {
            id: 1,
            kind: "campfire",
            lit: true,
            fuelLeft: 0.6,
            fuelMinutes: 90,
            pot: null,
            jug: null,
            fish: [],
          },
        },
      ],
      warmth: 0.55,
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
      backpack: { axe: 1, knife: 1, steelAndFlint: 1, stick: 3 },
      nearby: [{ kind: "bedroll", view: { id: 2 } }],
      warmth: 0.15,
      needs: { ...BASE_VIEW.needs, warmth: 0.15, fatigue: 0.2 },
      notice: { kind: "collapsed" },
    },
    buildMenuOpen: false,
    placing: "campfire",
  },
];

/** The "bark" asset: bark in the backpack, debarking under way, bark offered as fuel, and a debarked log on the shoulder. */
export const BARK_STATES: readonly ShowcaseState[] = [
  { view: { ...BASE_VIEW, backpack: { ...BASE_VIEW.backpack, drawknife: 1, bark: 4 } }, buildMenuOpen: false, placing: null },
  {
    view: { ...BASE_VIEW, backpack: { ...BASE_VIEW.backpack, drawknife: 1, bark: 2 }, action: { kind: "debark", progress: 0.6 } },
    buildMenuOpen: false,
    placing: null,
  },
  {
    view: {
      ...BASE_VIEW,
      backpack: { ...BASE_VIEW.backpack, drawknife: 1, bark: 6 },
      nearby: [
        {
          kind: "campfire",
          view: {
            id: 1,
            kind: "campfire",
            lit: true,
            fuelLeft: 0.3,
            fuelMinutes: 40,
            pot: null,
            jug: null,
            fish: [],
          },
        },
      ],
    },
    buildMenuOpen: false,
    placing: null,
  },
  {
    view: { ...BASE_VIEW, backpack: { ...BASE_VIEW.backpack, drawknife: 1, bark: 2 }, carrying: "debarkedLog" },
    buildMenuOpen: false,
    placing: null,
  },
];

/** The "backpack-icons" asset: every kind of backpack content, shown once alone and once with a count. */
export const BACKPACK_ICON_STATES: readonly ShowcaseState[] = [
  { view: { ...BASE_VIEW, backpack: { axe: 1, knife: 1, drawknife: 1, steelAndFlint: 1, bedroll: 1, pot: 1 } }, buildMenuOpen: false, placing: null },
  { view: { ...BASE_VIEW, backpack: { axe: 1, stick: 1, firewood: 4, bark: 1 } }, buildMenuOpen: false, placing: null },
  { view: { ...BASE_VIEW, backpack: { stick: 7, bark: 3, berries: 5, mushroom: 1, potOfRiverWater: 1 } }, buildMenuOpen: false, placing: null },
  { view: { ...BASE_VIEW, backpack: { knife: 1, firewood: 1, berries: 1, mushroom: 2, potOfBoiledWater: 1 } }, buildMenuOpen: false, placing: null },
];

/**
 * The approved "stone" asset. The first three views show stones close up, with no HUD over them.
 * The last shows stone first in the hotbar while gathering, beside a pile of stone.
 */
export const STONE_STATES: readonly (ShowcaseState | null)[] = [
  null,
  null,
  null,
  {
    view: {
      ...BASE_VIEW,
      backpack: { stone: 3, axe: 1, knife: 1 },
      action: { kind: "gatherStone", progress: 0.6 },
      nearby: [{ kind: "pile", view: { id: 1, content: "stone", count: 12 } }],
    },
    buildMenuOpen: false,
    placing: null,
  },
];

/** The approved "clay" asset, over the last view only: clay in the backpack while digging one, beside a pile of clay. */
export const CLAY_STATES: readonly (ShowcaseState | null)[] = [
  null,
  null,
  null,
  {
    view: {
      ...BASE_VIEW,
      backpack: { clay: 3, stone: 2, axe: 1, knife: 1 },
      action: { kind: "digClay", progress: 0.6 },
      nearby: [{ kind: "pile", view: { id: 1, content: "clay", count: 12 } }],
    },
    buildMenuOpen: false,
    placing: null,
  },
];

/** The approved "sapling-icon" asset, over the last view only: saplings in the backpack while digging one up, beside a pile of them. */
export const SAPLING_ICON_STATES: readonly (ShowcaseState | null)[] = [
  null,
  null,
  null,
  {
    view: {
      ...BASE_VIEW,
      backpack: { sapling: 2, axe: 1, knife: 1 },
      action: { kind: "digUp", progress: 0.6 },
      nearby: [{ kind: "pile", view: { id: 1, content: "sapling", count: 3 } }],
    },
    buildMenuOpen: false,
    placing: null,
  },
];

/** The approved "berry-bush-icon" asset, over the last view only: berry bushes in the backpack while digging one up, beside a pile of them. */
export const BERRY_BUSH_ICON_STATES: readonly (ShowcaseState | null)[] = [
  null,
  null,
  null,
  {
    view: {
      ...BASE_VIEW,
      backpack: { berryBush: 2, berries: 3, axe: 1, knife: 1 },
      action: { kind: "digUp", progress: 0.6 },
      nearby: [{ kind: "pile", view: { id: 1, content: "berryBush", count: 3 } }],
    },
    buildMenuOpen: false,
    placing: null,
  },
];

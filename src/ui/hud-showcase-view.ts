// The base game state and the build menu every HUD showcase state starts from.
import { nightHoursOf, type StructureKind } from "../sim/api";
import { FURNITURE_BUILD_MENU } from "../sim/api-build-menu";
import { type GameView } from "../sim/api-game-view";

export const BASE_VIEW: GameView = {
  seed: 42,
  paused: false,
  stepCount: 0,
  entityCount: 0,
  playerPosition: { x: 0, y: 0, z: 0 },
  time: { day: 1, hour: 12, minute: 0, hourOfDay: 12 },
  night: false,
  nightHours: nightHoursOf("spring"),
  season: { season: "spring", dayOfSeason: 1, seasonDays: 7 },
  seasonBanner: null,
  afterFirstWinter: false,
  backpack: { axe: 1, knife: 1, steelAndFlint: 1, bedroll: 1, stick: 3 },
  backpackFreshness: {},
  backpackWeight: 4.2,
  backpackWeightLimit: 20,
  buildMenu: [{ structure: "campfire", cost: [{ material: "stick", count: 5 }], placement: "onGround" }],
  craftMenu: [
    {
      kind: "saw",
      materials: [
        { material: "sawBlade", count: 1 },
        { material: "stick", count: 3 },
      ],
      result: { content: "saw", count: 1 },
      seconds: 5,
    },
  ],
  action: null,
  carrying: null,
  dragging: null,
  litTorch: null,
  plantedTorches: [],
  nearby: [],
  warmth: 0.9,
  needs: { hunger: 1, thirst: 0.8, warmth: 0.9, fatigue: 1 },
  sick: false,
  raining: false,
  snowing: false,
  snowCover: 0,
  notice: null,
  lastSleep: null,
  lastEatOrDrink: null,
  sittingOn: null,
  reach: null,
  actionQueue: [],
  journal: { done: [], hidden: false, justDone: null },
};

/** Every structure in the build menu, with its real cost, for the "hud" and "build-icons" showcases. */
export const FULL_BUILD_MENU: GameView["buildMenu"] = [
  { structure: "campfire", cost: [{ material: "stick", count: 5 }], placement: "onGround" },
  {
    structure: "leanTo",
    cost: [
      { material: "stick", count: 10 },
      { material: "bark", count: 6 },
    ],
    placement: "onGround",
  },
  { structure: "foundation", cost: [{ material: "debarkedLog", count: 4 }], placement: "onGround" },
  { structure: "floor", cost: [{ material: "plank", count: 2 }], placement: "underfoot", fixedFacing: true, inRows: true },
  { structure: "logWall", cost: [{ material: "debarkedLog", count: 4 }], placement: "onEdge" },
  { structure: "doorFrame", cost: [{ material: "debarkedLog", count: 3 }], placement: "onEdge" },
  { structure: "window", cost: [{ material: "debarkedLog", count: 3 }], placement: "onEdge" },
  { structure: "roofFrame", cost: [{ material: "debarkedLog", count: 5 }], placement: "overWalls" },
  { structure: "fireplace", cost: [{ material: "stone", count: 12 }], placement: "onFoundation" },
  { structure: "woodpile", cost: [], placement: "onGround" },
  ...FURNITURE_BUILD_MENU,
  { structure: "sawhorse", cost: [{ material: "debarkedLog", count: 2 }], placement: "onGround" },
  {
    structure: "sled",
    cost: [
      { material: "log", count: 2 },
      { material: "stick", count: 4 },
    ],
    tool: "axe",
    placement: "anywhere",
  },
];

/** One HUD state: the game state, whether the build menu is open, what the player is placing, and whether the craft menu is open. */
export interface ShowcaseState {
  view: GameView;
  buildMenuOpen: boolean;
  placing: StructureKind | null;
  craftMenuOpen?: boolean;
}

// Draws the real HUD over the asset showcase at /?asset=hud, /?asset=bark, /?asset=stone, /?asset=backpack-icons, /?asset=crafting-icons, /?asset=fishing-icons, or /?asset=build-icons, once in each of the four views, each in a
// different game state. The states match the order of the views in src/render/showcases/interface.ts and src/render/showcases/camp.ts. Development builds only.
import { render } from "preact";
import { FURNITURE_BUILD_MENU, nightHoursOf, type BackpackContent, type GameClient, type GameView, type StructureKind, type ThingView } from "../sim/api";
import { QUEUE_THING_DRAWINGS, type QueueThing } from "./action-queue-icons";
import { BackpackIcon, ShadedIcon } from "./backpack-icons";
import { MaterialIcon } from "./build-icons";
import { StructureIcon } from "./structure-icon";
import { LIT_TORCH_DRAWING, TORCH_DRAWING } from "./torch-icons";
import { JUG_DRAWINGS, UNFIRED_JUG_DRAWING } from "./jug-icons";
import { Hud } from "./hud";

const BASE_VIEW: GameView = {
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
  backpack: { axe: 1, knife: 1, steelAndFlint: 1, bedroll: 1, stick: 3 },
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

/** One HUD state: the game state, whether the build menu is open, what the player is placing, and whether the craft menu is open. */
interface ShowcaseState {
  view: GameView;
  buildMenuOpen: boolean;
  placing: StructureKind | null;
  craftMenuOpen?: boolean;
}

/** One game state per view, with whether the build menu is open and what the player is placing. */
const STATES: readonly ShowcaseState[] = [
  {
    view: {
      ...BASE_VIEW,
      nearby: [
        {
          kind: "openChest",
          view: { id: 3, furniture: "chest", contents: { stick: 8, firewood: 4, bark: 2, berries: 6, pot: 1 }, weight: 9.4, weightLimit: 60 },
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
const BARK_STATES: readonly ShowcaseState[] = [
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
const BACKPACK_ICON_STATES: readonly ShowcaseState[] = [
  { view: { ...BASE_VIEW, backpack: { axe: 1, knife: 1, drawknife: 1, steelAndFlint: 1, bedroll: 1, pot: 1 } }, buildMenuOpen: false, placing: null },
  { view: { ...BASE_VIEW, backpack: { axe: 1, stick: 1, firewood: 4, bark: 1 } }, buildMenuOpen: false, placing: null },
  { view: { ...BASE_VIEW, backpack: { stick: 7, bark: 3, berries: 5, mushroom: 1, potOfRiverWater: 1 } }, buildMenuOpen: false, placing: null },
  { view: { ...BASE_VIEW, backpack: { knife: 1, firewood: 1, berries: 1, mushroom: 2, potOfBoiledWater: 1 } }, buildMenuOpen: false, placing: null },
];

/**
 * The approved "stone" asset. The first three views show stones close up, with no HUD over them.
 * The last shows stone first in the hotbar while gathering, beside a pile of stone.
 */
const STONE_STATES: readonly (ShowcaseState | null)[] = [
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
const CLAY_STATES: readonly (ShowcaseState | null)[] = [
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

/** The draft "jug" asset, over the last view only: jugs in the backpack, beside a campfire firing a jug. */
const JUG_STATES: readonly (ShowcaseState | null)[] = [
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
const JUG_ICON_STATES: readonly ShowcaseState[] = [
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

/** The approved "sapling-icon" asset, over the last view only: saplings in the backpack while digging one up, beside a pile of them. */
const SAPLING_ICON_STATES: readonly (ShowcaseState | null)[] = [
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
const BERRY_BUSH_ICON_STATES: readonly (ShowcaseState | null)[] = [
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

/** Every structure in the build menu, with its real cost, for the "build-icons" showcase. */
const FULL_BUILD_MENU: GameView["buildMenu"] = [
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
  { structure: "floor", cost: [{ material: "plank", count: 2 }], placement: "underfoot", fixedFacing: true },
  { structure: "logWall", cost: [{ material: "debarkedLog", count: 4 }], placement: "onEdge" },
  { structure: "doorFrame", cost: [{ material: "debarkedLog", count: 3 }], placement: "onEdge" },
  { structure: "window", cost: [{ material: "debarkedLog", count: 3 }], placement: "onEdge" },
  { structure: "roofFrame", cost: [{ material: "debarkedLog", count: 5 }], placement: "overWalls" },
  { structure: "roof", cost: [{ material: "plank", count: 6 }], placement: "onFrame", fixedFacing: true },
  { structure: "door", cost: [{ material: "plank", count: 3 }], placement: "inDoorFrame", fixedFacing: true },
  { structure: "shutters", cost: [{ material: "plank", count: 2 }], placement: "inWindow", fixedFacing: true },
  { structure: "fireplace", cost: [{ material: "stone", count: 12 }], placement: "onFoundation" },
  { structure: "chimney", cost: [{ material: "stone", count: 8 }], placement: "onFireplace", fixedFacing: true },
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

/** The "build-icons" asset: the full build menu open, in four game states. */
const BUILD_ICON_STATES: readonly ShowcaseState[] = [
  { view: { ...BASE_VIEW, buildMenu: FULL_BUILD_MENU }, buildMenuOpen: true, placing: null },
  { view: { ...BASE_VIEW, buildMenu: FULL_BUILD_MENU, backpack: { axe: 1, stick: 1 } }, buildMenuOpen: true, placing: null },
  { view: { ...BASE_VIEW, buildMenu: FULL_BUILD_MENU, backpack: { axe: 1, stick: 10, bark: 6 } }, buildMenuOpen: true, placing: null },
  { view: { ...BASE_VIEW, buildMenu: FULL_BUILD_MENU, paused: true }, buildMenuOpen: true, placing: null },
];

/** The "crafting-icons" asset: the saw blade, the saw, and the plank in the backpack, with the craft menu and crafting under way. The last view is the icon sheet. */
const CRAFTING_ICON_STATES: readonly ShowcaseState[] = [
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
const TORCH_ICON_STATES: readonly ShowcaseState[] = [
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
const FISHING_ICON_STATES: readonly ShowcaseState[] = [
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

/** What each thing the "action-queue-icons" views queue actions on is, by its made-up entity id. */
const QUEUE_THINGS: Readonly<Record<number, ThingView>> = {
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
const ACTION_QUEUE_ICON_STATES: readonly ShowcaseState[] = [
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

/** The "action-queue-icons" first view: each drawn icon large, with its name, so the owner can judge the drawings. */
function QueueIconSheet() {
  return (
    <div style={{ position: "absolute", top: "8px", left: "8px", right: "8px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" }}>
      {(Object.keys(QUEUE_THING_DRAWINGS) as QueueThing[]).map((thing) => (
        <div
          key={thing}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "2px",
            padding: "6px",
            background: "#3d2b1e",
            borderRadius: "6px",
            color: "#cdb898",
            fontSize: "11px",
          }}
        >
          <span style={{ width: "96px", height: "96px", display: "grid" }} class="showcase-big-icon">
            <ShadedIcon drawing={QUEUE_THING_DRAWINGS[thing]} className="backpack-icon" />
          </span>
          {thing}
        </div>
      ))}
    </div>
  );
}

/** The "build-icons" first view: every build icon drawn large, with its name, so the owner can judge the drawings. */
function BuildIconSheet() {
  const cell = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "2px",
    padding: "4px",
    background: "#3d2b1e",
    borderRadius: "6px",
    color: "#cdb898",
    fontSize: "11px",
  } as const;
  return (
    <div style={{ position: "absolute", top: "8px", left: "8px", right: "8px", display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "4px" }}>
      {FULL_BUILD_MENU.map(({ structure }) => (
        <div key={structure} style={cell}>
          <span style={{ width: "64px", height: "64px", display: "grid" }} class="showcase-big-icon">
            <StructureIcon structure={structure} />
          </span>
          {structure}
        </div>
      ))}
      {(["log", "debarkedLog"] as const).map((material) => (
        <div key={material} style={cell}>
          <span style={{ width: "64px", height: "64px", display: "grid" }} class="showcase-big-icon">
            <MaterialIcon material={material} />
          </span>
          {material}
        </div>
      ))}
    </div>
  );
}

/** The furniture icons the "rain-barrel-icon" sheet draws beside the rain barrel, so the owner can compare their style. */
const RAIN_BARREL_NEIGHBOURS = ["chest", "table", "stool", "bed"] as const;

/**
 * The "rain-barrel-icon" first view: the rain barrel's icon drawn large and at build menu size, beside four other furniture icons.
 * The full build icon sheet does not fit the rain barrel in a quarter of the screen.
 */
function RainBarrelIconSheet() {
  const cell = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
    padding: "6px",
    background: "#3d2b1e",
    borderRadius: "6px",
    color: "#cdb898",
    fontSize: "11px",
  } as const;
  return (
    <div style={{ position: "absolute", top: "8px", left: "8px", right: "8px", display: "flex", gap: "6px" }}>
      <div style={cell}>
        <span style={{ width: "160px", height: "160px", display: "grid" }} class="showcase-big-icon">
          <StructureIcon structure="rainBarrel" />
        </span>
        <span style={{ width: "40px", height: "40px", display: "grid" }} class="showcase-big-icon">
          <StructureIcon structure="rainBarrel" />
        </span>
        rainBarrel
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "6px" }}>
        {RAIN_BARREL_NEIGHBOURS.map((structure) => (
          <div key={structure} style={cell}>
            <span style={{ width: "72px", height: "72px", display: "grid" }} class="showcase-big-icon">
              <StructureIcon structure={structure} />
            </span>
            {structure}
          </div>
        ))}
      </div>
    </div>
  );
}

/** The last view of "crafting-icons" or "fishing-icons": each icon drawn large, with its name, so the owner can judge the drawings. */
function IconSheet({ contents }: { contents: readonly BackpackContent[] }) {
  return (
    <div style={{ position: "absolute", top: "8px", left: "8px", right: "8px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" }}>
      {contents.map((content) => (
        <div
          key={content}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "2px",
            padding: "6px",
            background: "#3d2b1e",
            borderRadius: "6px",
            color: "#cdb898",
            fontSize: "11px",
          }}
        >
          <span style={{ width: "96px", height: "96px", display: "grid" }} class="showcase-big-icon">
            <BackpackIcon content={content} />
          </span>
          {content}
        </div>
      ))}
    </div>
  );
}

/** The second view of "torch-icons": the unlit and lit torch drawn large and at hotbar size, so the owner can judge the drawings. */
function TorchIconSheet() {
  const drawings = [
    ["torch", TORCH_DRAWING],
    ["lit torch", LIT_TORCH_DRAWING],
  ] as const;
  return (
    <div style={{ position: "absolute", top: "8px", left: "8px", right: "8px", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "6px" }}>
      {drawings.map(([name, drawing]) => (
        <div
          key={name}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "4px",
            padding: "6px",
            background: "#3d2b1e",
            borderRadius: "6px",
            color: "#cdb898",
            fontSize: "11px",
          }}
        >
          <span style={{ width: "160px", height: "160px", display: "grid" }} class="showcase-big-icon">
            <ShadedIcon drawing={drawing} className="backpack-icon" />
          </span>
          <span style={{ width: "32px", height: "32px", display: "grid" }} class="showcase-big-icon">
            <ShadedIcon drawing={drawing} className="backpack-icon" />
          </span>
          {name}
        </div>
      ))}
    </div>
  );
}

/** The jug icons that the "jug-icons" icon sheet draws, with their names. */
const JUG_SHEET_ICONS = [
  { drawing: UNFIRED_JUG_DRAWING, name: "unfired jug" },
  { drawing: JUG_DRAWINGS.jug, name: "empty jug" },
  { drawing: JUG_DRAWINGS.jugWith1Drink, name: "jug with 1 drink" },
  { drawing: JUG_DRAWINGS.jugWith2Drinks, name: "jug with 2 drinks" },
  { drawing: JUG_DRAWINGS.jugWith3Drinks, name: "jug with 3 drinks" },
] as const;

/** The second view of "jug-icons": each jug icon drawn large and at hotbar size, so the owner can judge the drawing. */
function JugIconSheet() {
  return (
    <div style={{ position: "absolute", top: "8px", left: "8px", right: "8px", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "6px" }}>
      {JUG_SHEET_ICONS.map(({ drawing, name }) => (
        <div
          key={name}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "4px",
            padding: "6px",
            background: "#3d2b1e",
            borderRadius: "6px",
            color: "#cdb898",
            fontSize: "11px",
          }}
        >
          <span style={{ width: "160px", height: "160px", display: "grid" }} class="showcase-big-icon">
            <ShadedIcon drawing={drawing} className="backpack-icon" />
          </span>
          <span style={{ width: "32px", height: "32px", display: "grid" }} class="showcase-big-icon">
            <ShadedIcon drawing={drawing} className="backpack-icon" />
          </span>
          {name}
        </div>
      ))}
    </div>
  );
}

/** The icons each icon sheet draws large. */
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
const FISH_TRAP_ICON_STATES: readonly ShowcaseState[] = [
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

const ICON_SHEETS = {
  "crafting-icons": { states: CRAFTING_ICON_STATES, contents: ["sawBlade", "saw", "plank"] },
  "fishing-icons": { states: FISHING_ICON_STATES, contents: ["fishingLine", "fishingRod", "rawFish", "cookedFish"] },
  "fish-trap-icons": { states: FISH_TRAP_ICON_STATES, contents: ["cord", "fishTrap"] },
} as const;

/** A client that always shows `view` and ignores commands. `things` says what each made-up entity id is. */
function stillClient(view: GameView, things: Readonly<Record<number, ThingView>> = {}): GameClient {
  return {
    getView: () => view,
    checkPlacement: (_structure, _at, turns) => ({ spot: { x: 0, y: 0, z: 0 }, turns, allowed: true }),
    describeBlueprint: () => null,
    describeCampfire: () => null,
    describeWoodpile: () => null,
    describeSled: () => null,
    refusal: () => null,
    nearestInReach: () => null,
    describeThing: (id) => things[id] ?? null,
    describeRooms: () => [],
    send() {},
    subscribe: () => () => {},
  };
}

const STATES_BY_ASSET = {
  hud: STATES,
  bark: BARK_STATES,
  stone: STONE_STATES,
  clay: CLAY_STATES,
  jug: JUG_STATES,
  "jug-icons": JUG_ICON_STATES,
  "sapling-icon": SAPLING_ICON_STATES,
  "berry-bush-icon": BERRY_BUSH_ICON_STATES,
  "backpack-icons": BACKPACK_ICON_STATES,
  "crafting-icons": CRAFTING_ICON_STATES,
  "fishing-icons": FISHING_ICON_STATES,
  "build-icons": BUILD_ICON_STATES,
  // The sled's icons show in the build menu, so the "sled-icon" showcase is the build menu's.
  "sled-icon": BUILD_ICON_STATES,
  // The furniture icons show in the build menu too, so the "furniture-icons" showcase is the build menu's as well.
  "furniture-icons": BUILD_ICON_STATES,
  // So does the fireplace's icon.
  "fireplace-icon": BUILD_ICON_STATES,
  // And the rain barrel's.
  "rain-barrel-icon": BUILD_ICON_STATES,
  // And the floor's and door's icons.
  "floor-and-door-icons": BUILD_ICON_STATES,
  "window-icons": BUILD_ICON_STATES,
  "chimney-icon": BUILD_ICON_STATES,
  "action-queue-icons": ACTION_QUEUE_ICON_STATES,
  "torch-icons": TORCH_ICON_STATES,
  "fish-trap-icons": FISH_TRAP_ICON_STATES,
} as const;

/** A showcase that draws the HUD over its views. Its showcase has `overlay: "hud"`. */
export type HudShowcaseId = keyof typeof STATES_BY_ASSET;

/** Whether this showcase has HUD states to draw. */
export function isHudShowcase(id: string): id is HudShowcaseId {
  return Object.hasOwn(STATES_BY_ASSET, id);
}

/** Draws one HUD in each quarter of `ui`, in the states for one showcase with `overlay: "hud"`. */
export function renderHudShowcase(ui: HTMLElement, asset: HudShowcaseId): void {
  const states: readonly (ShowcaseState | null)[] = STATES_BY_ASSET[asset];
  states.forEach((state, index) => {
    // A view with no state shows the scene alone.
    if (state === null) return;
    const { view, buildMenuOpen, placing, craftMenuOpen = false } = state;
    const quarter = document.createElement("div");
    quarter.className = `showcase-hud showcase-hud-${index}`;
    ui.append(quarter);
    if (
      asset === "build-icons" ||
      asset === "sled-icon" ||
      asset === "furniture-icons" ||
      asset === "fireplace-icon" ||
      asset === "rain-barrel-icon" ||
      asset === "floor-and-door-icons" ||
      asset === "window-icons" ||
      asset === "chimney-icon"
    ) {
      // The needs panel would cover the menu's top row in a quarter of the screen, so these views hide it.
      quarter.classList.add("showcase-hud-no-needs");
      if (index === 0) {
        render(asset === "rain-barrel-icon" ? <RainBarrelIconSheet /> : <BuildIconSheet />, quarter);
        return;
      }
    }
    if (asset === "jug-icons" && index === 1) {
      render(<JugIconSheet />, quarter);
      return;
    }
    if (asset === "torch-icons" && index === 1) {
      render(<TorchIconSheet />, quarter);
      return;
    }
    if (asset === "action-queue-icons" && index === 0) {
      render(<QueueIconSheet />, quarter);
      return;
    }
    if ((asset === "crafting-icons" || asset === "fishing-icons" || asset === "fish-trap-icons") && index === ICON_SHEETS[asset].states.length - 1) {
      render(<IconSheet contents={ICON_SHEETS[asset].contents} />, quarter);
      return;
    }
    render(
      <Hud
        client={stillClient(view, QUEUE_THINGS)}
        buildMenuOpen={buildMenuOpen}
        placing={placing}
        onToggleBuildMenu={() => {}}
        onPickBuildEntry={() => {}}
        craftMenuOpen={craftMenuOpen}
        onToggleCraftMenu={() => {}}
        onOpenHotbarMenu={() => {}}
      />,
      quarter,
    );
  });
}

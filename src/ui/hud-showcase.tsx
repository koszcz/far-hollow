// Draws the real HUD over the asset showcase at /?asset=hud, /?asset=bark, /?asset=stone, /?asset=backpack-icons, /?asset=crafting-icons, /?asset=fishing-icons, or /?asset=build-icons, once in each of the four views, each in a
// different game state. The states match the order of the views in src/render/showcases/interface.ts and src/render/showcases/camp.ts. Development builds only.
import { render } from "preact";
import { FURNITURE_BUILD_MENU, type BackpackContent, type GameClient, type GameView, type StructureKind, type ThingView } from "../sim/api";
import { QUEUE_THING_DRAWINGS, type QueueThing } from "./action-queue-icons";
import { BackpackIcon, ShadedIcon } from "./backpack-icons";
import { MaterialIcon } from "./build-icons";
import { StructureIcon } from "./structure-icon";
import { Hud } from "./hud";

const BASE_VIEW: GameView = {
  seed: 42,
  paused: false,
  stepCount: 0,
  entityCount: 0,
  playerPosition: { x: 0, y: 0, z: 0 },
  time: { day: 1, hour: 12, minute: 0, hourOfDay: 12 },
  night: false,
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
      lacks: [],
    },
  ],
  action: null,
  carrying: null,
  dragging: null,
  litTorch: null,
  nearby: [],
  warmth: 0.9,
  needs: { hunger: 1, thirst: 0.8, warmth: 0.9, fatigue: 1 },
  sick: false,
  raining: false,
  notice: null,
  lastSleep: null,
  lastEatOrDrink: null,
  sittingOn: null,
  reach: null,
  actionQueue: [],
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
  { structure: "logWall", cost: [{ material: "debarkedLog", count: 4 }], placement: "onEdge" },
  { structure: "doorFrame", cost: [{ material: "debarkedLog", count: 3 }], placement: "onEdge" },
  { structure: "roofFrame", cost: [{ material: "debarkedLog", count: 5 }], placement: "overWalls" },
  { structure: "roof", cost: [{ material: "plank", count: 6 }], placement: "onFrame" },
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
  lacks: [],
};

/**
 * The draft "torch-icons" asset: the torch recipe in the craft menu, unlit torches in the backpack, and the lit torch in the
 * hand with its gauge full and nearly burnt out. The lit torch cell shows its label, as when the player points at it.
 */
const TORCH_ICON_STATES: readonly ShowcaseState[] = [
  {
    view: { ...BASE_VIEW, backpack: { ...BASE_VIEW.backpack, bark: 2 }, craftMenu: [...BASE_VIEW.craftMenu, TORCH_RECIPE] },
    buildMenuOpen: false,
    placing: null,
    craftMenuOpen: true,
  },
  { view: { ...BASE_VIEW, backpack: { ...BASE_VIEW.backpack, torch: 3 } }, buildMenuOpen: false, placing: null },
  {
    view: { ...BASE_VIEW, backpack: { ...BASE_VIEW.backpack, torch: 2 }, litTorch: { minutesLeft: 178, burnLeft: 178 / 180 } },
    buildMenuOpen: false,
    placing: null,
  },
  {
    view: { ...BASE_VIEW, carrying: "log", backpack: { ...BASE_VIEW.backpack, torch: 1 }, litTorch: { minutesLeft: 25, burnLeft: 25 / 180 } },
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
  lacks: [],
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

/** The icons each icon sheet draws large. */
const ICON_SHEETS = {
  "crafting-icons": { states: CRAFTING_ICON_STATES, contents: ["sawBlade", "saw", "plank"] },
  "fishing-icons": { states: FISHING_ICON_STATES, contents: ["fishingLine", "fishingRod", "rawFish", "cookedFish"] },
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
  "action-queue-icons": ACTION_QUEUE_ICON_STATES,
  "torch-icons": TORCH_ICON_STATES,
} as const;

/** Draws one HUD in each quarter of `ui`, in the states for the "hud", "bark", "stone", "backpack-icons", "crafting-icons", "fishing-icons", "build-icons", "sled-icon", "furniture-icons", "fireplace-icon", "action-queue-icons", or "torch-icons" showcase. */
export function renderHudShowcase(ui: HTMLElement, asset: keyof typeof STATES_BY_ASSET): void {
  const states: readonly (ShowcaseState | null)[] = STATES_BY_ASSET[asset];
  states.forEach((state, index) => {
    // A view with no state shows the scene alone.
    if (state === null) return;
    const { view, buildMenuOpen, placing, craftMenuOpen = false } = state;
    const quarter = document.createElement("div");
    quarter.className = `showcase-hud showcase-hud-${index}`;
    ui.append(quarter);
    if (asset === "build-icons" || asset === "sled-icon" || asset === "furniture-icons" || asset === "fireplace-icon") {
      // The needs panel would cover the menu's top row in a quarter of the screen, so these views hide it.
      quarter.classList.add("showcase-hud-no-needs");
      if (index === 0) {
        render(<BuildIconSheet />, quarter);
        return;
      }
    }
    if (asset === "action-queue-icons" && index === 0) {
      render(<QueueIconSheet />, quarter);
      return;
    }
    if ((asset === "crafting-icons" || asset === "fishing-icons") && index === ICON_SHEETS[asset].states.length - 1) {
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

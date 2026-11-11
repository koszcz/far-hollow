// Draws the real HUD over the asset showcase at /?asset=hud, /?asset=bark, or /?asset=backpack-icons, once in each of the four views, each in a
// different game state. The states match the order of the views in src/render/asset-showcase.ts. Development builds only.
import { render } from "preact";
import type { GameClient, GameView, StructureKind } from "../sim/api";
import { Hud } from "./hud";

const BASE_VIEW: GameView = {
  seed: 42,
  paused: false,
  stepCount: 0,
  entityCount: 0,
  playerPosition: { x: 0, y: 0, z: 0 },
  time: { day: 1, hour: 12, minute: 0, hourOfDay: 12 },
  backpack: { axe: 1, knife: 1, fireStriker: 1, bedroll: 1, stick: 3 },
  backpackWeight: 4.2,
  backpackWeightLimit: 20,
  buildMenu: [{ structure: "campfire", cost: [{ material: "stick", count: 5 }] }],
  action: null,
  carrying: null,
  nearbyCampfire: null,
  nearbyBedroll: null,
  nearbyBlueprint: null,
  warmth: 0.9,
  needs: { hunger: 1, thirst: 0.8, warmth: 0.9, fatigue: 1 },
  sick: false,
  raining: false,
  notice: null,
};

/** One game state per view, with whether the build menu is open and what the player is placing. */
const STATES: readonly { view: GameView; buildMenuOpen: boolean; placing: StructureKind | null }[] = [
  { view: BASE_VIEW, buildMenuOpen: true, placing: null },
  {
    view: {
      ...BASE_VIEW,
      backpack: { axe: 1, knife: 1, fireStriker: 1, bedroll: 1, stick: 12, firewood: 6 },
      backpackWeight: 19.6,
      action: { kind: "chop", progress: 0.4 },
      warmth: 0.7,
      notice: "backpackFull",
    },
    buildMenuOpen: false,
    placing: null,
  },
  {
    view: {
      ...BASE_VIEW,
      backpack: { axe: 1, knife: 1, fireStriker: 1, bedroll: 1, firewood: 2 },
      carrying: "log",
      nearbyCampfire: { id: 1, lit: true, fuelLeft: 0.6, fuelMinutes: 90, canLight: false, pot: null },
      warmth: 0.55,
    },
    buildMenuOpen: false,
    placing: null,
  },
  {
    view: {
      ...BASE_VIEW,
      paused: true,
      backpack: { axe: 1, knife: 1, fireStriker: 1, stick: 3 },
      nearbyBedroll: { id: 2 },
      warmth: 0.15,
      needs: { ...BASE_VIEW.needs, warmth: 0.15, fatigue: 0.2 },
      notice: "collapsed",
    },
    buildMenuOpen: false,
    placing: "campfire",
  },
];

/** The "bark" asset: bark in the backpack, debarking under way, bark offered as fuel, and a debarked log on the shoulder. */
const BARK_STATES: readonly { view: GameView; buildMenuOpen: boolean; placing: StructureKind | null }[] = [
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
      nearbyCampfire: { id: 1, lit: true, fuelLeft: 0.3, fuelMinutes: 40, canLight: false, pot: null },
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
const BACKPACK_ICON_STATES: readonly { view: GameView; buildMenuOpen: boolean; placing: StructureKind | null }[] = [
  { view: { ...BASE_VIEW, backpack: { axe: 1, knife: 1, drawknife: 1, fireStriker: 1, bedroll: 1, pot: 1 } }, buildMenuOpen: false, placing: null },
  { view: { ...BASE_VIEW, backpack: { axe: 1, stick: 1, firewood: 4, bark: 1 } }, buildMenuOpen: false, placing: null },
  { view: { ...BASE_VIEW, backpack: { stick: 7, bark: 3, berries: 5, mushroom: 1, potOfRiverWater: 1 } }, buildMenuOpen: false, placing: null },
  { view: { ...BASE_VIEW, backpack: { knife: 1, firewood: 1, berries: 1, mushroom: 2, potOfBoiledWater: 1 } }, buildMenuOpen: false, placing: null },
];

/** A client that always shows `view` and ignores commands. */
function stillClient(view: GameView): GameClient {
  return {
    getView: () => view,
    checkPlacement: () => ({ spot: { x: 0, y: 0, z: 0 }, allowed: true }),
    describeBlueprint: () => null,
    send() {},
    subscribe: () => () => {},
  };
}

const STATES_BY_ASSET = { hud: STATES, bark: BARK_STATES, "backpack-icons": BACKPACK_ICON_STATES } as const;

/** Draws one HUD in each quarter of `ui`, in the states for the "hud", "bark", or "backpack-icons" showcase. */
export function renderHudShowcase(ui: HTMLElement, asset: keyof typeof STATES_BY_ASSET): void {
  STATES_BY_ASSET[asset].forEach(({ view, buildMenuOpen, placing }, index) => {
    const quarter = document.createElement("div");
    quarter.className = `showcase-hud showcase-hud-${index}`;
    ui.append(quarter);
    render(
      <Hud
        client={stillClient(view)}
        cameraFollow={true}
        onCameraFollowChange={() => {}}
        buildMenuOpen={buildMenuOpen}
        placing={placing}
        onToggleBuildMenu={() => {}}
        onPickBuildEntry={() => {}}
      />,
      quarter,
    );
  });
}

// Draws the real HUD over the asset showcase at /?asset=hud, /?asset=bark, /?asset=stone, /?asset=backpack-icons, /?asset=crafting-icons, /?asset=fishing-icons, or /?asset=build-icons, once in each of the four views, each in a
// different game state. The states match the order of the views in src/render/showcases/interface.ts and src/render/showcases/camp.ts. Development builds only.
import { render } from "preact";
import type { GameClient, GameView, ThingView } from "../sim/api";
import { Hud } from "./hud";
import { BuildIconSheet, FurnitureIconSheet, IconSheet, JugIconSheet, QueueIconSheet, TorchIconSheet } from "./hud-showcase-sheets";
import type { ShowcaseState } from "./hud-showcase-view";
import { BACKPACK_ICON_STATES, BARK_STATES, BERRY_BUSH_ICON_STATES, CLAY_STATES, SAPLING_ICON_STATES, STATES, STONE_STATES } from "./hud-showcase-camp-states";
import {
  BUILD_ICON_STATES,
  CRAFTING_ICON_STATES,
  FISH_TRAP_ICON_STATES,
  FISHING_ICON_STATES,
  JUG_ICON_STATES,
  JUG_STATES,
  TORCH_ICON_STATES,
} from "./hud-showcase-craft-states";
import { ACTION_QUEUE_ICON_STATES, DRIED_FOOD_ICON_STATES, QUEUE_THINGS, SMOKED_FISH_ICON_STATES } from "./hud-showcase-food-states";

const ICON_SHEETS = {
  "crafting-icons": { states: CRAFTING_ICON_STATES, contents: ["sawBlade", "saw", "plank"] },
  "fishing-icons": { states: FISHING_ICON_STATES, contents: ["fishingLine", "fishingRod", "rawFish", "cookedFish"] },
  "fish-trap-icons": { states: FISH_TRAP_ICON_STATES, contents: ["cord", "fishTrap"] },
  "dried-food-icons": { states: DRIED_FOOD_ICON_STATES, contents: ["berries", "driedBerries", "mushroom", "driedMushroom"] },
  "smoked-fish-icon": { states: SMOKED_FISH_ICON_STATES, contents: ["rawFish", "cookedFish", "smokedFish"] },
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
    describeDryingRack: () => null,
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
  // And the drying rack's.
  "drying-rack-icon": BUILD_ICON_STATES,
  "dried-food-icons": DRIED_FOOD_ICON_STATES,
  "smoked-fish-icon": SMOKED_FISH_ICON_STATES,
  // And the wood box's.
  "wood-box-icon": BUILD_ICON_STATES,
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
      asset === "drying-rack-icon" ||
      asset === "wood-box-icon" ||
      asset === "floor-and-door-icons" ||
      asset === "window-icons" ||
      asset === "chimney-icon"
    ) {
      // The needs panel would cover the menu's top row in a quarter of the screen, so these views hide it.
      quarter.classList.add("showcase-hud-no-needs");
      if (index === 0) {
        const sheet =
          asset === "rain-barrel-icon" ? (
            <FurnitureIconSheet piece="rainBarrel" />
          ) : asset === "drying-rack-icon" ? (
            <FurnitureIconSheet piece="dryingRack" />
          ) : asset === "wood-box-icon" ? (
            <FurnitureIconSheet piece="woodBox" />
          ) : (
            <BuildIconSheet />
          );
        render(sheet, quarter);
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
    if (
      (asset === "crafting-icons" ||
        asset === "fishing-icons" ||
        asset === "fish-trap-icons" ||
        asset === "dried-food-icons" ||
        asset === "smoked-fish-icon") &&
      index === ICON_SHEETS[asset].states.length - 1
    ) {
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

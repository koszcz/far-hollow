// The HUD, the "hud" asset in asset-manifest.json: smoked walnut glass over the scene, in the "hotbar and wheel" layout the owner chose, with build and craft changed to lists.
// The backpack is a hotbar at the bottom centre, with the need gauges to its left, and above them the panels and the open chest.
// The clock sits top left, the pause button top right, and banners top centre. Build and craft open as lists above their buttons.
// Built in code. Approved by the owner. Its look lives in the .hud rules of src/app/style.css. Its icons are in hud-icons.tsx.
// The backpack content icons, in backpack-icons.tsx, are the approved "backpack-icons" asset. The build icons, in build-icons.tsx, are the approved "build-icons" asset.
import { useEffect, useState } from "preact/hooks";
import type { StructureKind } from "../sim/api";
import type { GameClient } from "../sim/api-client";
import type { Notice } from "../sim/api-notice";
import type { Refusal } from "../sim/api-refusal";
import { FRESH_FOODS } from "../sim/api";
import { nearbyOf } from "../sim/api-game-view";
import { FIRST_BUILD_TAB, type BuildTab } from "./build-tabs";
import { strings } from "../strings";
import { ActionQueueRow } from "./action-queue-row";
import { lackingText, refusalText } from "./refusal-text";
import { dayShare, timeOfDayWord } from "./clock-face";
import { type HotbarTarget } from "./hotbar-cells";
import { HudIcon, type HudIconName } from "./hud-icons";
import { JournalLine, JournalPanel } from "./journal-panel";
import { lowNeedsHint } from "./need-gauge";
import { HotbarGrid, WeightRing, ChestPanel } from "./hud-backpack";
import { HudIconButton, HudToolButton } from "./hud-buttons";
import { PlacingHintText, PlantingHintText, type PlantingHintState } from "./hud-hints";
import { FATIGUE_COLOUR, HUNGER_COLOUR, Meter, NeedGauge, THIRST_COLOUR, WORK_BAR_COLOUR, warmthColour } from "./hud-meters";
import { BuildMenu, CraftMenu } from "./hud-menus";
import { hasPanel, NearbyPanel } from "./hud-nearby-panels";

export interface HudProps {
  client: GameClient;
  /** Whether the build menu is open. */
  buildMenuOpen: boolean;
  /** The structure whose blueprint follows the mouse, or null while not placing one. */
  placing: StructureKind | null;
  /** While placing, why the game refuses the spot under the mouse, when it says why. Optional, so showcases need not pass it. */
  placingRefusal?: Refusal | undefined;
  /**
   * While the player plants a sapling or berry bush, what they plant and why the game refuses the spot under the mouse, or null if it allows it.
   * Undefined while the player is not planting. Optional, so showcases need not pass it.
   */
  planting?: PlantingHintState | undefined;
  /** Called when the player opens or closes the build menu. The menu is input state, not game state, so this is not a command. */
  onToggleBuildMenu: () => void;
  /** Called when the player picks a structure from the build menu. Its blueprint then follows the mouse. */
  onPickBuildEntry: (structure: StructureKind) => void;
  /** Whether the craft menu is open. */
  craftMenuOpen: boolean;
  /** Called when the player opens or closes the craft menu. The menu is input state, not game state, so this is not a command. */
  onToggleCraftMenu: () => void;
  /** Called when the player clicks a hotbar cell, with the middle of its top edge on the page, to open the menu of its actions above it. */
  onOpenHotbarMenu: (target: HotbarTarget, x: number, y: number) => void;
  /** Whether the journal panel is open. Optional, so showcases need not pass it. */
  journalOpen?: boolean;
  /** Called when the player closes the journal panel. The panel is input state, not game state, so this is not a command. */
  onCloseJournal?: () => void;
}

/** The text of a notice. */
function noticeText(notice: Notice): string {
  switch (notice.kind) {
    case "noLogBesideStation":
      return strings.notices.noLogBesideStation(strings.buildMenu.structures[notice.station]);
    case "cannotCraftYet":
      return strings.notices.cannotCraftYet(notice.lacks.map(lackingText));
    case "droppedBesideStation":
      return strings.notices.droppedBesideStation(strings.pile.holds(notice.content, notice.count), strings.buildMenu.structures[notice.station]);
    case "cannotQueue":
    case "actionSkipped":
    case "refused":
      return strings.notices[notice.kind](refusalText(notice.refusal));
    case "foodSpoiled":
      return strings.notices.foodSpoiled(FRESH_FOODS.flatMap((food) => ((notice.spoiled[food] ?? 0) > 0 ? [[food, notice.spoiled[food] ?? 0] as const] : [])));
    default:
      return strings.notices[notice.kind];
  }
}

const actionLabels = {
  chop: strings.chopping,
  split: strings.splitting,
  debark: strings.debarking,
  build: strings.building,
  takeDown: strings.takingDown,
  craft: strings.crafting,
  fish: strings.fishing,
  gatherStone: strings.gatheringStone,
  digClay: strings.diggingClay,
  digUp: strings.diggingUp,
  plant: strings.planting,
  plantMushroom: strings.plantingMushroom,
} as const;

const actionIcons: Record<keyof typeof actionLabels, HudIconName> = {
  chop: "axe",
  split: "axe",
  debark: "bark",
  build: "campfire",
  takeDown: "axe",
  craft: "axe",
  fish: "droplet",
  // Stone comes from the river bank, so its meter shows the river's droplet, as fishing does.
  gatherStone: "droplet",
  // Clay comes from the river bank too.
  digClay: "droplet",
  // A dug-up sapling goes in the backpack.
  digUp: "backpack",
  // A planted sapling comes out of the backpack.
  plant: "backpack",
  // The mushroom comes out of the backpack.
  plantMushroom: "backpack",
};

export function Hud({
  client,
  buildMenuOpen,
  placing,
  placingRefusal,
  planting,
  onToggleBuildMenu,
  onPickBuildEntry,
  craftMenuOpen,
  onToggleCraftMenu,
  onOpenHotbarMenu,
  journalOpen = false,
  onCloseJournal = () => {},
}: HudProps) {
  const [view, setView] = useState(client.getView());
  // The build menu opens on the tab the player used last. The HUD stays while the menu closes, so this lasts until the page reloads. It is never saved.
  const [buildTab, setBuildTab] = useState<BuildTab>(FIRST_BUILD_TAB);
  useEffect(
    () =>
      client.subscribe(() => {
        setView(client.getView());
      }),
    [client],
  );
  const openChest = nearbyOf(view, "openChest");
  const nearbyPanels = view.nearby.filter(hasPanel);

  const hasContext = view.action !== null || placing !== null || planting !== undefined || nearbyPanels.length > 0;
  const lowNeeds = lowNeedsHint(view.needs);
  const justDone = view.journal?.justDone ?? null;

  return (
    <>
      {(view.paused || view.raining || view.snowing || view.seasonBanner !== null || view.notice !== null || justDone !== null) && (
        <div class="hud-banners">
          {view.paused && <p class="hud-banner hud-paused">{strings.paused}</p>}
          {view.seasonBanner !== null && (
            <p class="hud-banner hud-season" role="status">
              {strings.seasonStarted[view.seasonBanner]}
            </p>
          )}
          {view.raining && <p class="hud-banner hud-raining">{strings.raining}</p>}
          {view.snowing && <p class="hud-banner hud-snowing">{strings.snowing}</p>}
          {view.notice !== null && (
            <p class="hud-banner hud-notice" role="status">
              {noticeText(view.notice)}
            </p>
          )}
          {justDone !== null && (
            <p class="hud-banner hud-notice" role="status">
              {strings.journal.justDone(strings.journal.goals[justDone].done)}
            </p>
          )}
        </div>
      )}
      <div class="hud hud-clock">
        <p class="hud-panel">
          <span class={`hud-clock-ring hud-clock-ring-${view.season.season}`} style={{ "--hud-day": dayShare(view.time.hourOfDay) }}>
            <HudIcon name={view.night ? "moon" : "sun"} />
          </span>
          {strings.clock(strings.seasons[view.season.season], view.season.dayOfSeason, view.season.seasonDays, view.time.hour, view.time.minute)}
          <small class="hud-clock-word">{strings.timeOfDay[timeOfDayWord(view.time.hourOfDay, view.nightHours)]}</small>
        </p>
        <ActionQueueRow client={client} view={view} />
      </div>
      <JournalLine journal={view.journal} />
      {journalOpen && view.journal !== null && <JournalPanel client={client} journal={view.journal} onClose={onCloseJournal} />}
      <div class="hud hud-pause">
        <div class="hud-panel">
          <HudIconButton
            icon={view.paused ? "play" : "pause"}
            label={view.paused ? strings.resume : strings.pause}
            onClick={() => {
              client.send({ type: "setPaused", paused: !view.paused });
            }}
          />
        </div>
      </div>
      <div class="hud hud-dock">
        {openChest !== null && (
          <div class="hud-panel">
            <ChestPanel client={client} chest={openChest} />
          </div>
        )}
        {hasContext && (
          <div class="hud-panel hud-context">
            {view.action !== null && (
              <Meter icon={actionIcons[view.action.kind]} label={actionLabels[view.action.kind]} value={view.action.progress} colour={WORK_BAR_COLOUR} />
            )}
            {placing !== null && <PlacingHintText entries={view.buildMenu} placing={placing} refusal={placingRefusal} />}
            {planting !== undefined && <PlantingHintText plant={planting.plant} refusal={planting.refusal} />}
            {nearbyPanels.map((thing) => (
              <NearbyPanel key={thing.kind} thing={thing} />
            ))}
          </div>
        )}
        <div class="hud-dock-bottom">
          <section class="hud-needs" aria-label={strings.needs}>
            {lowNeeds !== null && (
              <p class="hud-hint" role="status">
                {lowNeeds}
              </p>
            )}
            {view.sick && <p class="hud-hint">{strings.sick}</p>}
            <NeedGauge icon="flame" label={strings.warmth} value={view.warmth} colour={warmthColour(view.warmth)} />
            <NeedGauge icon="berry" label={strings.hunger} value={view.needs.hunger} colour={HUNGER_COLOUR} />
            <NeedGauge icon="droplet" label={strings.thirst} value={view.needs.thirst} colour={THIRST_COLOUR} />
            <NeedGauge icon="moon" label={strings.fatigue} value={view.needs.fatigue} colour={FATIGUE_COLOUR} />
          </section>
          <div class="hud-panel hud-hotbar">
            <section class="hud-backpack" aria-label={strings.backpack}>
              <WeightRing label={strings.backpack} weight={view.backpackWeight} limit={view.backpackWeightLimit} />
              <span class="hud-hotbar-divider" aria-hidden="true" />
              <HotbarGrid view={view} onOpenMenu={onOpenHotbarMenu} />
            </section>
            <div class="hud-hotbar-tools">
              <HudToolButton
                icon="place"
                label={strings.buildMenu.open}
                shortcut={strings.hudLabels.buildKey}
                pressed={buildMenuOpen}
                disabled={placing !== null}
                onClick={onToggleBuildMenu}
              />
              <HudToolButton
                icon="axe"
                label={strings.craftMenu.open}
                shortcut={strings.hudLabels.craftKey}
                pressed={craftMenuOpen}
                onClick={onToggleCraftMenu}
              />
              {buildMenuOpen && (
                <BuildMenu entries={view.buildMenu} tab={buildTab} onChooseTab={setBuildTab} onPick={onPickBuildEntry} onClose={onToggleBuildMenu} />
              )}
              {craftMenuOpen && (
                <CraftMenu
                  client={client}
                  view={view}
                  onChoose={(recipe) => {
                    client.send({ type: "craft", recipe });
                    onToggleCraftMenu();
                  }}
                  onClose={onToggleCraftMenu}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

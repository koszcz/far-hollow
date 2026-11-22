// The HUD, the "hud" asset in asset-manifest.json: smoked walnut glass over the scene, in the "hotbar and wheel" layout the owner chose, with build and craft changed to lists.
// The backpack is a hotbar at the bottom centre, with the need gauges to its left, and above them the panels and the open chest.
// The clock sits top left, the pause button top right, and banners top centre. Build and craft open as lists above their buttons.
// Built in code. Approved by the owner. Its look lives in the .hud rules of src/app/style.css. Its icons are in hud-icons.tsx.
// The backpack content icons, in backpack-icons.tsx, are the approved "backpack-icons" asset. The build icons, in build-icons.tsx, are the approved "build-icons" asset.
import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import type {
  BackpackContent,
  BlueprintView,
  BuildMenuEntry,
  CampfireView,
  ChestView,
  GameClient,
  GameView,
  NearbyThing,
  Notice,
  PileView,
  RainBarrelView,
  RecipeKind,
  Plantable,
  Refusal,
  StructureKind,
  WoodpileView,
  WoodpileWood,
} from "../sim/api";
import { nearbyOf } from "../sim/api";
import { strings } from "../strings";
import { BackpackIcon, ShadedIcon } from "./backpack-icons";
import { ActionQueueRow } from "./action-queue-row";
import { chestTakeReason, recipeReason, type RefusalReader } from "./menu-refusals";
import { lackingText, refusalText } from "./refusal-text";
import { MaterialIcon } from "./build-icons";
import { StructureIcon } from "./structure-icon";
import { dayShare, timeOfDayWord } from "./clock-face";
import { hotbarCells, type HotbarTarget } from "./hotbar-cells";
import { HudIcon, type HudIconName } from "./hud-icons";
import { lowNeedsHint, needPulses, needRingShare } from "./need-gauge";
import { placingHint, plantingHint } from "./placing-hint";
import { SLED_DRAWING } from "./sled-icons";
import { LIT_TORCH_DRAWING } from "./torch-icons";
import { weightRingShare, weightRingWarns } from "./weight-ring";

/** The kinds of thing in the backpack, with how many of each, in a steady order. */
function backpackContents(backpack: GameView["backpack"]): [BackpackContent, number][] {
  const contents: [BackpackContent, number][] = [];
  for (const content of Object.keys(strings.backpackContents) as BackpackContent[]) {
    const count = backpack[content] ?? 0;
    if (count > 0) contents.push([content, count]);
  }
  return contents;
}

/**
 * A grid of icons, one cell per kind, with a count badge when there is more than one.
 * Each cell is a button. A click calls `onClick` with that kind, and whether shift was held.
 * `tip` is the text shown when the player points at a cell. `label` is a cell's full name, for screen readers.
 */
function ContentGrid({
  contents,
  label,
  reason,
  onClick,
}: {
  contents: GameView["backpack"];
  label: (name: string) => string;
  /** Why the game would refuse a click on this content now, or null if it would not. A refused cell is dimmed and does nothing. */
  reason: (content: BackpackContent) => string | null;
  onClick: (content: BackpackContent, shiftKey: boolean) => void;
}) {
  return (
    <ul>
      {backpackContents(contents).map(([content, count]) => {
        const name = strings.backpackContents[content];
        const refused = reason(content);
        const described = label(strings.backpackContentCount(name, count));
        return (
          <li key={content}>
            <button
              type="button"
              class={refused === null ? "hud-content-move" : "hud-content-move hud-content-move-dimmed"}
              aria-label={refused === null ? described : `${described} · ${refused}`}
              aria-disabled={refused !== null}
              title={refused ?? undefined}
              onClick={(event) => {
                if (refused === null) onClick(content, event.shiftKey);
              }}
            >
              <BackpackIcon content={content} />
              {count > 1 && (
                <span class="hud-backpack-count" aria-hidden="true">
                  {strings.backpackCountBadge(count)}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The hotbar's cells: the sled the player drags, the log on the shoulder, then each kind in the backpack. Each shows its icon,
 * a count when there is more than one, and its number key. Its name shows in a label above it only while the player points at it or focuses it. A click calls `onOpenMenu` with the middle of the cell's top edge, to open its action menu above it.
 */
function HotbarGrid({ view, onOpenMenu }: { view: GameView; onOpenMenu: (target: HotbarTarget, x: number, y: number) => void }) {
  return (
    <ul class="hud-hotbar-cells">
      {hotbarCells(view).map(({ target, name, tip, count, key, gauge }) => (
        <li key={target.kind === "backpackContent" ? target.content : target.kind} class={HOTBAR_CELL_CLASS[target.kind]}>
          <button
            type="button"
            class="hud-content-move hud-hotbar-cell"
            aria-label={hotbarCellLabel(target, name, count, key, tip)}
            onClick={(event) => {
              const cell = event.currentTarget.getBoundingClientRect();
              onOpenMenu(target, cell.left + cell.width / 2, cell.top);
            }}
          >
            <HotbarCellIcon target={target} />
            <span class="hud-hotbar-name" aria-hidden="true">
              {tip}
            </span>
            {count > 1 && (
              <span class="hud-backpack-count" aria-hidden="true">
                {strings.backpackCountBadge(count)}
              </span>
            )}
            {key !== undefined && (
              <span class="hud-hotbar-key" aria-hidden="true">
                {key}
              </span>
            )}
            {gauge !== undefined && <span class="hud-hotbar-gauge" style={{ "--hud-level": gauge }} aria-hidden="true" />}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** The class of each kind of hotbar cell. The shoulder, sled, and lit torch cells sit apart from the backpack contents. */
const HOTBAR_CELL_CLASS: Readonly<Record<HotbarTarget["kind"], string | undefined>> = {
  backpackContent: undefined,
  shoulder: "hud-hotbar-shoulder",
  sled: "hud-hotbar-sled",
  litTorch: "hud-hotbar-torch",
};

/** The full name of a hotbar cell, for screen readers. The lit torch cell's tip says how long it still burns. */
function hotbarCellLabel(target: HotbarTarget, name: string, count: number, key: string | undefined, tip: string): string {
  switch (target.kind) {
    case "shoulder":
      return strings.hotbar.shoulder(name);
    case "litTorch":
      return strings.hotbar.inHand(tip);
    case "sled":
      return strings.hotbar.dragging(name);
    case "backpackContent":
      return strings.hotbar.cell(strings.backpackContentCount(name, count), key);
  }
}

/**
 * How much the backpack, chest, or shelf holds: its backpack icon inside a ring that fills with the weight as a share of the limit.
 * Ring and icon are amber, and turn to the warning colour with a pulsing icon when nearly full. Pointing at the ring or focusing it shows
 * the exact weight in a label, such as "5.5 of 20 kg". Screen readers read the same text as the meter's value.
 */
function WeightRing({ label, weight, limit }: { label: string; weight: number; limit: number }) {
  const text = strings.weightOf(weight, limit);
  return (
    <span
      class={weightRingWarns(weight, limit) ? "hud-weight-ring hud-weight-ring-warn" : "hud-weight-ring"}
      style={{ "--hud-level": weightRingShare(weight, limit) }}
      role="meter"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={limit}
      aria-valuenow={weight}
      aria-valuetext={text}
    >
      <HudIcon name="backpack" />
      <span class="hud-weight-tip" aria-hidden="true">
        {text}
      </span>
    </span>
  );
}

/** A backpack content's icon, the log icon for the shoulder, or the approved "sled-icon" for the sled the player drags. */
function HotbarCellIcon({ target }: { target: HotbarTarget }) {
  switch (target.kind) {
    case "backpackContent":
      return <BackpackIcon content={target.content} />;
    case "shoulder":
      return <HudIcon name="log" />;
    case "sled":
      return <ShadedIcon drawing={SLED_DRAWING} className="backpack-icon" />;
    case "litTorch":
      return <ShadedIcon drawing={LIT_TORCH_DRAWING} className="backpack-icon" />;
  }
}

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
}

/** One row in a list menu: its icon, its name, and what it costs or lacks. */
interface MenuEntry {
  key: string;
  name: string;
  icon: ComponentChildren;
  /** Shown at the right end of the row, such as material icons with counts. */
  aside?: ComponentChildren;
  /** Shown under the name, such as the cost as text. */
  detail?: ComponentChildren;
  /** The full text screen readers read for this row. */
  label: string;
  /** A dimmed row still shows what it lacks, but a click does nothing. */
  dimmed?: boolean;
  onPick: () => void;
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
    default:
      return strings.notices[notice.kind];
  }
}

/**
 * A list of choices that opens above the build and craft buttons, used for the build and craft menus. A click on a row
 * picks it. A click outside the list closes it.
 */
function ListMenu({ title, entries, onClose }: { title: string; entries: readonly MenuEntry[]; onClose: () => void }) {
  return (
    <>
      <div class="hud-menu-backdrop" onClick={onClose} />
      <section class="hud-menu" aria-label={title}>
        <h3 class="hud-menu-title" aria-hidden="true">
          {title}
        </h3>
        <ul>
          {entries.map((entry) => (
            <li key={entry.key}>
              <button
                type="button"
                class={entry.dimmed === true ? "hud-menu-entry hud-menu-entry-dimmed" : "hud-menu-entry"}
                aria-label={entry.label}
                aria-disabled={entry.dimmed === true}
                onClick={() => {
                  if (entry.dimmed !== true) entry.onPick();
                }}
              >
                {entry.icon}
                <span class="hud-menu-text">
                  <span class="hud-menu-name">{entry.name}</span>
                  {entry.detail !== undefined && <span class="hud-menu-detail">{entry.detail}</span>}
                </span>
                {entry.aside !== undefined && <span aria-hidden="true">{entry.aside}</span>}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

/**
 * The craft menu: one row per recipe, with the icon of what it makes. Each row shows what the recipe uses, how long
 * it takes, and which tool or work station it lacks. A recipe the player cannot follow yet is dimmed. Choosing one starts crafting it.
 */
function CraftMenu({
  client,
  view,
  onChoose,
  onClose,
}: {
  client: RefusalReader;
  view: GameView;
  onChoose: (recipe: RecipeKind) => void;
  onClose: () => void;
}) {
  const entries = view.craftMenu.map(({ kind, materials, besideStation, station, seconds, result }): MenuEntry => {
    const name = strings.craftMenu.recipes[kind];
    const reason = recipeReason(client, kind);
    const notes = reason === null ? [] : [reason];
    const cost = strings.craftMenu.cost(
      [
        ...materials.map(({ material, count }) => strings.backpackContentCount(strings.backpackContents[material], count)),
        ...(besideStation === undefined || station === undefined
          ? []
          : besideStation.map(({ material, count }) =>
              strings.craftMenu.besideStation(strings.craftMenu.groundMaterials[material](count), strings.buildMenu.structures[station]),
            )),
      ],
      seconds,
    );
    return {
      key: kind,
      name,
      icon: <BackpackIcon content={result.content} />,
      detail: (
        <>
          {cost}
          {notes.map((note) => (
            <span key={note} class="hud-menu-note">
              {note}
            </span>
          ))}
        </>
      ),
      label: [name, cost, ...notes].join(" · "),
      dimmed: notes.length > 0,
      onPick: () => {
        onChoose(kind);
      },
    };
  });
  return <ListMenu title={strings.craftMenu.title} entries={entries} onClose={onClose} />;
}

/**
 * The build menu: one row per structure the player can build, with its icon, its name, the materials it costs as icons
 * with counts, and the tool it needs. Picking one puts its blueprint under the mouse.
 */
function BuildMenu({ entries, onPick, onClose }: { entries: GameView["buildMenu"]; onPick: (structure: StructureKind) => void; onClose: () => void }) {
  const menuEntries = entries.map(({ structure, cost, tool }): MenuEntry => {
    const name = strings.buildMenu.structures[structure];
    const costText = strings.buildMenu.cost([
      ...cost.map(({ material, count }) => strings.buildMenu.materials[material](count)),
      ...(tool === undefined ? [] : [strings.actionReasons.needsTool(strings.backpackContents[tool])]),
    ]);
    return {
      key: structure,
      name,
      icon: <StructureIcon structure={structure} />,
      aside: (
        <span class="hud-build-cost">
          {cost.map(({ material, count }) => (
            <span key={material} class="hud-build-material">
              <MaterialIcon material={material} />
              {count}
            </span>
          ))}
          {tool !== undefined && (
            <span class="hud-build-material hud-build-tool">
              <BackpackIcon content={tool} />
            </span>
          )}
        </span>
      ),
      label: strings.buildMenu.entryLabel(name, costText),
      onPick: () => {
        onPick(structure);
      },
    };
  });
  return <ListMenu title={strings.buildMenu.title} entries={menuEntries} onClose={onClose} />;
}

/** Warmth's bar colour runs from this cold blue at 0 to the ember orange at 1. */
const COLD_RGB = [111, 168, 214] as const;
const WARM_RGB = [232, 131, 58] as const;
/** A cool river blue for the thirst bar. */
const THIRST_COLOUR = "#5aa9e6";
/** A berry red for the hunger bar. */
const HUNGER_COLOUR = "#c8553d";
/** A dusk violet for the fatigue bar. */
const FATIGUE_COLOUR = "#9a8fd6";

/** The colour of the warmth bar at `warmth`, from 0 (frozen) to 1 (fully warm). */
function warmthColour(warmth: number): string {
  const t = Math.min(1, Math.max(0, warmth));
  const mix = (cold: number, warm: number): number => Math.round(cold + (warm - cold) * t);
  return `rgb(${mix(COLD_RGB[0], WARM_RGB[0])} ${mix(COLD_RGB[1], WARM_RGB[1])} ${mix(COLD_RGB[2], WARM_RGB[2])})`;
}

/** One row of a bar with an icon and a label. The progress of timed work, and campfire fuel, use it. */
function Meter({ icon, label, value, colour }: { icon: HudIconName; label: string; value: number; colour: string }) {
  return (
    <label class="hud-meter" style={{ "--hud-bar": colour }}>
      <HudIcon name={icon} />
      <span class="hud-meter-label">{label}</span>
      <progress max={1} value={value} />
    </label>
  );
}

/**
 * One need as a round gauge: a ring in the need's colour that fills with its level, the need's icon inside, and its name below.
 * A low need pulses. A hidden progress bar in the label lets screen readers read the need's name and level.
 */
function NeedGauge({ icon, label, value, colour }: { icon: HudIconName; label: string; value: number; colour: string }) {
  return (
    <label class={needPulses(value) ? "hud-need hud-need-low" : "hud-need"} style={{ "--hud-bar": colour, "--hud-level": needRingShare(value) }}>
      <span class="hud-need-ring">
        <HudIcon name={icon} />
      </span>
      <span class="hud-need-label">{label}</span>
      <progress class="hud-sr-only" max={1} value={value} />
    </label>
  );
}

/** A square HUD button that shows only an icon. Its label shows when the player points at it, and screen readers read it. */
function HudIconButton({
  icon,
  label,
  disabled = false,
  pressed,
  onClick,
}: {
  icon: HudIconName;
  label: string;
  disabled?: boolean;
  pressed?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" class="hud-button hud-icon-button" aria-label={label} aria-pressed={pressed} data-tip={label} disabled={disabled} onClick={onClick}>
      <HudIcon name={icon} />
    </button>
  );
}

/** A square HUD button that shows an icon over its name, and the key that does the same in its corner, such as "B" on Build. The build and craft buttons use it. */
function HudToolButton({
  icon,
  label,
  shortcut,
  disabled = false,
  pressed,
  onClick,
}: {
  icon: HudIconName;
  label: string;
  shortcut: string;
  disabled?: boolean;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      class="hud-button hud-tool-button"
      aria-label={label}
      aria-keyshortcuts={shortcut}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
    >
      <HudIcon name={icon} />
      <span class="hud-tool-label">{label}</span>
      <kbd class="hud-key">{shortcut}</kbd>
    </button>
  );
}

/** The colour of the bar that shows how far a fish on the fire has cooked: the browned skin of cooked fish. */
const COOKING_COLOUR = "#c98a4b";

/** One fish on a campfire: its icon, raw or cooked, and a bar for how far it has cooked. */
function FishOnFireMeter({ fish }: { fish: CampfireView["fish"][number] }) {
  return (
    <label class="hud-meter" style={{ "--hud-bar": COOKING_COLOUR }}>
      <BackpackIcon content={fish.cooked ? "cookedFish" : "rawFish"} />
      <span class="hud-meter-label">{fish.cooked ? strings.fishCooked : strings.fishCooking}</span>
      <progress max={1} value={fish.cookProgress} />
    </label>
  );
}

/**
 * Shows whether the campfire or fireplace beside the player burns, how much fuel it has, how far the pot on it has boiled,
 * and how far each fish on it has cooked. Its actions are on the campfire or fireplace itself.
 */
function CampfirePanel({ campfire }: { campfire: CampfireView }) {
  const title = campfire.kind === "fireplace" ? strings.fireplace : strings.campfire;
  return (
    <section class="hud-section hud-campfire" aria-label={title}>
      <h2>
        <HudIcon name="campfire" />
        {title}
        <span class={campfire.lit ? "hud-tag hud-tag-lit" : "hud-tag"}>{campfire.lit ? strings.campfireLit : strings.campfireUnlit}</span>
      </h2>
      <Meter icon="flame" label={strings.campfireFuel} value={campfire.fuelLeft} colour={`rgb(${WARM_RGB.join(" ")})`} />
      {campfire.pot !== null &&
        (campfire.pot.water === "boiled" ? (
          <p class="hud-hint">{strings.potBoiled}</p>
        ) : (
          <Meter icon="droplet" label={strings.potBoiling} value={campfire.pot.boilProgress} colour={THIRST_COLOUR} />
        ))}
      {campfire.fish.map((fish, index) => (
        <FishOnFireMeter key={index} fish={fish} />
      ))}
    </section>
  );
}

/** The kinds of wood a woodpile holds, in the order the woodpile panel lists them. */
const WOODPILE_WOODS: readonly WoodpileWood[] = ["log", "debarkedLog", "firewood"];

/** Shows how full the woodpile beside the player is and what it holds. Its actions are on the woodpile itself. */
function WoodpilePanel({ woodpile }: { woodpile: WoodpileView }) {
  return (
    <section class="hud-section hud-woodpile" aria-label={strings.woodpile.title}>
      <h2>
        <HudIcon name="log" />
        {strings.woodpile.title}
        <span class="hud-tag">{strings.woodpile.count(woodpile.total, woodpile.capacity)}</span>
      </h2>
      <Meter icon="log" label={strings.woodpile.fill} value={woodpile.total / woodpile.capacity} colour={WORK_BAR_COLOUR} />
      <ul>
        {WOODPILE_WOODS.filter((wood) => woodpile.contents[wood] > 0).map((wood) => (
          <li key={wood}>{strings.woodpile.contents[wood](woodpile.contents[wood])}</li>
        ))}
      </ul>
    </section>
  );
}

/** Shows how many drinks of clean water the rain barrel beside the player holds, and whether a roof keeps the rain off it. */
function RainBarrelPanel({ barrel }: { barrel: RainBarrelView }) {
  const text = strings.rainBarrel;
  return (
    <section class="hud-section hud-rain-barrel" aria-label={text.title}>
      <h2>
        <HudIcon name="droplet" />
        {text.title}
        <span class="hud-tag">{text.count(barrel.drinks, barrel.limit)}</span>
      </h2>
      <Meter icon="droplet" label={text.fill} value={barrel.drinks / barrel.limit} colour={THIRST_COLOUR} />
      {barrel.underRoof && <p class="hud-hint">{text.underRoof}</p>}
    </section>
  );
}

/** Shows what the pile beside the player holds and how many. A click on the pile picks it up. */
function PilePanel({ pile }: { pile: PileView }) {
  return (
    <section class="hud-section hud-pile" aria-label={strings.pile.title}>
      <h2>
        <BackpackIcon content={pile.content} />
        {strings.pile.holds(pile.content, pile.count)}
      </h2>
    </section>
  );
}

/** Shows the blueprint beside the player: how many of each carried material it has and needs, and how to go on. */
function BlueprintPanel({ blueprint }: { blueprint: BlueprintView }) {
  const name = strings.buildMenu.structures[blueprint.structure];
  const waiting = blueprint.deliveries.find(({ has, needs }) => has < needs);
  return (
    <section class="hud-section hud-blueprint" aria-label={strings.blueprint.title(name)}>
      <h2>
        <HudIcon name="place" />
        {strings.blueprint.title(name)}
      </h2>
      <ul>
        {blueprint.deliveries.map(({ material, has, needs }) => (
          <li key={material}>{strings.blueprint.deliveries[material](has, needs)}</li>
        ))}
      </ul>
      <p class="hud-hint">
        {waiting === undefined || blueprint.lacks === null ? strings.blueprint.buildHint : strings.blueprint.deliverHint[waiting.material]}
      </p>
    </section>
  );
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

/** The colour of the bar for timed work, such as chopping. */
const WORK_BAR_COLOUR = "#d9c48a";

/** The hint shown while placing a structure: what to click, then the keys on a line of their own. */
function PlacingHintText({ entries, placing, refusal }: { entries: readonly BuildMenuEntry[]; placing: StructureKind; refusal: Refusal | undefined }) {
  const { what, keys } = placingHint(entries, placing, refusal);
  return (
    <p class="hud-hint hud-placing-hint">
      {what}
      <span class="hud-placing-keys">{keys}</span>
    </p>
  );
}

/** What the planting hint shows: what the player plants, and why the game refuses the spot under the mouse, or null if it allows it. */
export interface PlantingHintState {
  readonly plant: Plantable;
  readonly refusal: Refusal | null;
}

/** The hint shown while planting a sapling or berry bush: what to click, or why the spot is not allowed, then the cancel key on a line of its own. */
function PlantingHintText({ plant, refusal }: PlantingHintState) {
  const { what, keys } = plantingHint(plant, refusal);
  return (
    <p class="hud-hint hud-placing-hint">
      {what}
      <span class="hud-placing-keys">{keys}</span>
    </p>
  );
}

/**
 * A thing within reach that shows a panel under the work. The open chest shows beside the backpack instead.
 * A laid bedroll has no status to show, so it has no panel. Its actions are on the bedroll itself.
 */
type PanelThing = Exclude<NearbyThing, { kind: "openChest" | "bedroll" }>;

function hasPanel(thing: NearbyThing): thing is PanelThing {
  return thing.kind !== "openChest" && thing.kind !== "bedroll";
}

/** The panel for one thing within the player's reach, by its kind. TypeScript reports a kind with no panel. */
function NearbyPanel({ thing }: { thing: PanelThing }) {
  switch (thing.kind) {
    case "campfire":
      return <CampfirePanel campfire={thing.view} />;
    case "woodpile":
      return <WoodpilePanel woodpile={thing.view} />;
    case "pile":
      return <PilePanel pile={thing.view} />;
    case "blueprint":
      return <BlueprintPanel blueprint={thing.view} />;
    case "rainBarrel":
      return <RainBarrelPanel barrel={thing.view} />;
  }
}

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
}: HudProps) {
  const [view, setView] = useState(client.getView());
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

  return (
    <>
      {(view.paused || view.raining || view.notice !== null) && (
        <div class="hud-banners">
          {view.paused && <p class="hud-banner hud-paused">{strings.paused}</p>}
          {view.raining && <p class="hud-banner hud-raining">{strings.raining}</p>}
          {view.notice !== null && (
            <p class="hud-banner hud-notice" role="status">
              {noticeText(view.notice)}
            </p>
          )}
        </div>
      )}
      <div class="hud hud-clock">
        <p class="hud-panel">
          <span class="hud-clock-ring" style={{ "--hud-day": dayShare(view.time.hourOfDay) }}>
            <HudIcon name={view.night ? "moon" : "sun"} />
          </span>
          {strings.clock(view.time.day, view.time.hour, view.time.minute)}
          <small class="hud-clock-word">{strings.timeOfDay[timeOfDayWord(view.time.hourOfDay)]}</small>
        </p>
        <ActionQueueRow client={client} view={view} />
      </div>
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
              {buildMenuOpen && <BuildMenu entries={view.buildMenu} onPick={onPickBuildEntry} onClose={onToggleBuildMenu} />}
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

/**
 * The open chest or shelf, above the backpack: what it holds, as a grid of icons grouped by kind, like the backpack.
 * A click on an icon takes one of that kind out into the backpack. A shift-click takes all that fit.
 */
function ChestPanel({ client, chest }: { client: GameClient; chest: ChestView }) {
  const text = strings[chest.furniture];
  const empty = backpackContents(chest.contents).length === 0;
  return (
    <section class="hud-section hud-backpack hud-chest" aria-label={text.title}>
      <h2>
        <WeightRing label={text.title} weight={chest.weight} limit={chest.weightLimit} />
        {text.title}
      </h2>
      {empty ? (
        <p class="hud-hint">{text.empty}</p>
      ) : (
        <ContentGrid
          contents={chest.contents}
          label={text.take}
          reason={(content) => chestTakeReason(client, chest.id, content)}
          onClick={(content, all) => {
            client.send({ type: "takeFromChest", chestId: chest.id, content, all });
          }}
        />
      )}
      <p class="hud-hint">{text.hint}</p>
    </section>
  );
}

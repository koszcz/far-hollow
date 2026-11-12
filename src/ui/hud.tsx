// The HUD, the "hud" asset in asset-manifest.json: woodland panels over the scene, in the "hotbar and wheel" layout the owner chose, with build and craft changed to lists.
// The backpack is a hotbar at the bottom centre, with the needs bars just above it, and above them the panels and the open chest.
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
  RecipeKind,
  RecipeLack,
  StructureKind,
  WoodpileView,
  WoodpileWood,
} from "../sim/api";
import { nearbyOf } from "../sim/api";
import { strings } from "../strings";
import { BackpackIcon, ShadedIcon } from "./backpack-icons";
import { MaterialIcon, StructureIcon } from "./build-icons";
import type { PromptButton } from "./cursor-prompt-view";
import { hotbarCells, type HotbarTarget } from "./hotbar-cells";
import { HudIcon, type HudIconName } from "./hud-icons";
import { placingHint } from "./placing-hint";
import { SLED_DRAWING } from "./sled-icons";

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
  tip,
  label,
  onClick,
}: {
  contents: GameView["backpack"];
  tip: (name: string) => string;
  label: (name: string) => string;
  onClick: (content: BackpackContent, shiftKey: boolean) => void;
}) {
  return (
    <ul>
      {backpackContents(contents).map(([content, count]) => {
        const name = strings.backpackContents[content];
        return (
          <li key={content} data-tip={tip(name)}>
            <button
              type="button"
              class="hud-content-move"
              aria-label={label(strings.backpackContentCount(name, count))}
              onClick={(event) => {
                onClick(content, event.shiftKey);
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
 * its name, a count when there is more than one, and its number key. A click calls `onUse`. A right-click calls `onOpenMenu` at the cursor.
 * A backpack cell sets `data-prompt-content`, the shoulder cell sets `data-prompt-shoulder`, and the sled cell sets `data-prompt-sled`,
 * so the cursor prompt describes it (src/app/cursor-prompt-overlay.tsx).
 */
function HotbarGrid({
  view,
  onUse,
  onOpenMenu,
}: {
  view: GameView;
  onUse: (target: HotbarTarget, shiftKey: boolean) => void;
  onOpenMenu: (target: HotbarTarget, x: number, y: number) => void;
}) {
  return (
    <ul class="hud-hotbar-cells">
      {hotbarCells(view).map(({ target, name, count, key }) => (
        <li
          key={target.kind === "backpackContent" ? target.content : target.kind}
          class={target.kind === "shoulder" ? "hud-hotbar-shoulder" : target.kind === "sled" ? "hud-hotbar-sled" : undefined}
          data-prompt-content={target.kind === "backpackContent" ? target.content : undefined}
          data-prompt-shoulder={target.kind === "shoulder" ? "" : undefined}
          data-prompt-sled={target.kind === "sled" ? "" : undefined}
        >
          <button
            type="button"
            class="hud-content-move hud-hotbar-cell"
            aria-label={hotbarCellLabel(target, name, count, key)}
            onClick={(event) => {
              onUse(target, event.shiftKey);
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              onOpenMenu(target, event.clientX, event.clientY);
            }}
          >
            <HotbarCellIcon target={target} />
            <span class="hud-hotbar-name" aria-hidden="true">
              {name}
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
          </button>
        </li>
      ))}
    </ul>
  );
}

/** The full name of a hotbar cell, for screen readers. */
function hotbarCellLabel(target: HotbarTarget, name: string, count: number, key: string | undefined): string {
  switch (target.kind) {
    case "shoulder":
      return strings.hotbar.shoulder(name);
    case "sled":
      return strings.hotbar.dragging(name);
    case "backpackContent":
      return strings.hotbar.cell(strings.backpackContentCount(name, count), key);
  }
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
  }
}

export interface HudProps {
  client: GameClient;
  /** Whether the build menu is open. */
  buildMenuOpen: boolean;
  /** The structure whose blueprint follows the mouse, or null while not placing one. */
  placing: StructureKind | null;
  /** Called when the player opens or closes the build menu. The menu is input state, not game state, so this is not a command. */
  onToggleBuildMenu: () => void;
  /** Called when the player picks a structure from the build menu. Its blueprint then follows the mouse. */
  onPickBuildEntry: (structure: StructureKind) => void;
  /** Whether the craft menu is open. */
  craftMenuOpen: boolean;
  /** Called when the player opens or closes the craft menu. The menu is input state, not game state, so this is not a command. */
  onToggleCraftMenu: () => void;
  /** Called when the player clicks a hotbar cell, with whether shift was held. The caller decides what that does, such as eating berries. */
  onUseHotbarCell: (target: HotbarTarget, shiftKey: boolean) => void;
  /** Called when the player right-clicks a hotbar cell, with the cursor's place on the page, to open the menu of its actions. */
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

/** Names one thing a recipe lacks, such as "the saw". */
function lackingText(lack: RecipeLack): string {
  switch (lack.kind) {
    case "tool":
      return strings.craftMenu.lacking.tool(strings.backpackContents[lack.tool]);
    case "station":
      return strings.craftMenu.lacking.station(strings.buildMenu.structures[lack.station]);
    case "materials":
      return strings.craftMenu.lacking.materials;
  }
}

/** The text of a notice. */
function noticeText(notice: Notice): string {
  switch (notice.kind) {
    case "noLogBesideStation":
      return strings.notices.noLogBesideStation(strings.buildMenu.structures[notice.station]);
    case "cannotCraftYet":
      return strings.notices.cannotCraftYet(notice.lacks.map(lackingText));
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
function CraftMenu({ view, onChoose, onClose }: { view: GameView; onChoose: (recipe: RecipeKind) => void; onClose: () => void }) {
  const entries = view.craftMenu.map(({ kind, materials, besideStation, station, seconds, lacks, result }): MenuEntry => {
    const name = strings.craftMenu.recipes[kind];
    const notes = [
      ...(lacks.length === 0 ? [] : [strings.craftMenu.needs(lacks.map(lackingText))]),
      ...(view.carrying === null ? [] : [strings.notices.putLogDownFirst]),
    ];
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
/** At or below this level a need's bar pulses, to warn the player. */
const LOW_NEED = 0.25;
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

/** One row of a bar with an icon and a label. Needs such as warmth, and the progress of timed work, use it. */
function Meter({ icon, label, value, colour, low = false }: { icon: HudIconName; label: string; value: number; colour: string; low?: boolean }) {
  return (
    <label class={low ? "hud-meter hud-meter-low" : "hud-meter"} style={{ "--hud-bar": colour }}>
      <HudIcon name={icon} />
      <span class="hud-meter-label">{label}</span>
      <progress max={1} value={value} />
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

/** A larger HUD button that shows an icon, its name, and the key that does the same, such as "Build B". The build and craft buttons use it. */
function HudToolButton({
  icon,
  label,
  prompt,
  shortcut,
  disabled = false,
  pressed,
  onClick,
}: {
  icon: HudIconName;
  label: string;
  /** Which cursor prompt it shows when pointed at. See src/app/cursor-prompt-overlay.tsx. */
  prompt: PromptButton;
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
      data-prompt-button={prompt}
      disabled={disabled}
      onClick={onClick}
    >
      <HudIcon name={icon} />
      <span class="hud-tool-label">{label}</span>
      <kbd class="hud-key">{shortcut}</kbd>
    </button>
  );
}

/** Shows whether the campfire beside the player burns, how much fuel it has, and how far the pot on it has boiled. Its actions are on the campfire itself. */
function CampfirePanel({ campfire }: { campfire: CampfireView }) {
  return (
    <section class="hud-section hud-campfire" aria-label={strings.campfire}>
      <h2>
        <HudIcon name="campfire" />
        {strings.campfire}
        <span class={campfire.lit ? "hud-tag hud-tag-lit" : "hud-tag"}>{campfire.lit ? strings.campfireLit : strings.campfireUnlit}</span>
      </h2>
      <Meter icon="flame" label={strings.campfireFuel} value={campfire.fuelLeft} colour={`rgb(${WARM_RGB.join(" ")})`} />
      {campfire.pot !== null &&
        (campfire.pot.water === "boiled" ? (
          <p class="hud-hint">{strings.potBoiled}</p>
        ) : (
          <Meter icon="droplet" label={strings.potBoiling} value={campfire.pot.boilProgress} colour={THIRST_COLOUR} />
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
      <p class="hud-hint">{waiting === undefined ? strings.blueprint.buildHint : strings.blueprint.deliverHint[waiting.material]}</p>
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
} as const;

const actionIcons: Record<keyof typeof actionLabels, HudIconName> = {
  chop: "axe",
  split: "axe",
  debark: "bark",
  build: "campfire",
  takeDown: "axe",
  craft: "axe",
};

/** At or above this share of its limit, the backpack weight turns amber. */
const FULL_BACKPACK = 0.9;

/** The colour of the bar for timed work, such as chopping. */
const WORK_BAR_COLOUR = "#d9c48a";

/** The hint shown while placing a structure: what to click, then the keys on a line of their own. */
function PlacingHintText({ entries, placing }: { entries: readonly BuildMenuEntry[]; placing: StructureKind }) {
  const { what, keys } = placingHint(entries, placing);
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
  }
}

export function Hud({
  client,
  buildMenuOpen,
  placing,
  onToggleBuildMenu,
  onPickBuildEntry,
  craftMenuOpen,
  onToggleCraftMenu,
  onUseHotbarCell,
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

  const hasContext = view.action !== null || placing !== null || nearbyPanels.length > 0;
  const daylight = view.time.hourOfDay >= 6 && view.time.hourOfDay < 20;

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
          <HudIcon name={daylight ? "sun" : "moon"} />
          {strings.clock(view.time.day, view.time.hour, view.time.minute)}
        </p>
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
            {placing !== null && <PlacingHintText entries={view.buildMenu} placing={placing} />}
            {nearbyPanels.map((thing) => (
              <NearbyPanel key={thing.kind} thing={thing} />
            ))}
          </div>
        )}
        <section class="hud-needs" aria-label={strings.needs}>
          <Meter icon="flame" label={strings.warmth} value={view.warmth} colour={warmthColour(view.warmth)} low={view.warmth <= LOW_NEED} />
          <Meter icon="berry" label={strings.hunger} value={view.needs.hunger} colour={HUNGER_COLOUR} low={view.needs.hunger <= LOW_NEED} />
          <Meter icon="droplet" label={strings.thirst} value={view.needs.thirst} colour={THIRST_COLOUR} low={view.needs.thirst <= LOW_NEED} />
          <Meter icon="moon" label={strings.fatigue} value={view.needs.fatigue} colour={FATIGUE_COLOUR} low={view.needs.fatigue <= LOW_NEED} />
          {view.sick && <p class="hud-hint">{strings.sick}</p>}
        </section>
        <div class="hud-panel hud-hotbar">
          <section class="hud-backpack" aria-label={strings.backpack}>
            <HotbarGrid view={view} onUse={onUseHotbarCell} onOpenMenu={onOpenHotbarMenu} />
            <span
              class={view.backpackWeight >= view.backpackWeightLimit * FULL_BACKPACK ? "hud-backpack-weight hud-backpack-weight-full" : "hud-backpack-weight"}
            >
              {strings.backpackWeight(view.backpackWeight, view.backpackWeightLimit)}
            </span>
          </section>
          <div class="hud-hotbar-tools">
            <HudToolButton
              icon="place"
              label={strings.buildMenu.open}
              prompt="build"
              shortcut={strings.hudLabels.buildKey}
              pressed={buildMenuOpen}
              disabled={placing !== null}
              onClick={onToggleBuildMenu}
            />
            <HudToolButton
              icon="axe"
              label={strings.craftMenu.open}
              prompt="craft"
              shortcut={strings.hudLabels.craftKey}
              pressed={craftMenuOpen}
              onClick={onToggleCraftMenu}
            />
            {buildMenuOpen && <BuildMenu entries={view.buildMenu} onPick={onPickBuildEntry} onClose={onToggleBuildMenu} />}
            {craftMenuOpen && (
              <CraftMenu
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
    </>
  );
}

/**
 * The open chest, above the backpack: what it holds, as a grid of icons grouped by kind, like the backpack.
 * A click on an icon takes one of that kind out into the backpack. A shift-click takes all that fit.
 */
function ChestPanel({ client, chest }: { client: GameClient; chest: ChestView }) {
  const empty = backpackContents(chest.contents).length === 0;
  return (
    <section class="hud-section hud-backpack hud-chest" aria-label={strings.chest.title}>
      <h2>
        <HudIcon name="backpack" />
        {strings.chest.title}
        <span class="hud-backpack-weight">{strings.backpackWeight(chest.weight, chest.weightLimit)}</span>
      </h2>
      {empty ? (
        <p class="hud-hint">{strings.chest.empty}</p>
      ) : (
        <ContentGrid
          contents={chest.contents}
          tip={strings.chest.takeTip}
          label={strings.chest.take}
          onClick={(content, all) => {
            client.send({ type: "takeFromChest", chestId: chest.id, content, all });
          }}
        />
      )}
      <p class="hud-hint">{strings.chest.hint}</p>
    </section>
  );
}

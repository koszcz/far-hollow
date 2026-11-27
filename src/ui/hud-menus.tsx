// The HUD's list menus: the build menu and the craft menu, above their buttons.
import type { ComponentChildren } from "preact";
import type { RecipeKind, StructureKind } from "../sim/api";
import type { GameView } from "../sim/api-game-view";
import { isHost } from "../sim/api";
import { BUILD_TABS, entriesInTab, type BuildTab } from "./build-tabs";
import { actionsText } from "../strings/actions";
import { backpackText } from "../strings/backpack";
import { workText } from "../strings/work";
import { BackpackIcon } from "./backpack-icons";
import { recipeReason, type RefusalReader } from "./menu-refusals";
import { MaterialIcon } from "./build-icons";
import { StructureIcon } from "./structure-icon";

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

/**
 * A list of choices that opens above the build and craft buttons, used for the build and craft menus. A click on a row
 * picks it. A click outside the list closes it.
 */
function ListMenu({ title, tabs, entries, onClose }: { title: string; tabs?: ComponentChildren; entries: readonly MenuEntry[]; onClose: () => void }) {
  return (
    <>
      <div class="hud-menu-backdrop" onClick={onClose} />
      <section class="hud-menu" aria-label={title}>
        <h3 class="hud-menu-title" aria-hidden="true">
          {title}
        </h3>
        {tabs}
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
export function CraftMenu({
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
    const name = workText.craftMenu.recipes[kind];
    const reason = recipeReason(client, kind);
    const notes = reason === null ? [] : [reason];
    const cost = workText.craftMenu.cost(
      [
        ...materials.map(({ material, count }) => backpackText.backpackContentCount(backpackText.backpackContents[material], count)),
        ...(besideStation === undefined || station === undefined
          ? []
          : besideStation.map(({ material, count }) =>
              workText.craftMenu.besideStation(workText.craftMenu.groundMaterials[material](count), workText.buildMenu.structures[station]),
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
  return <ListMenu title={workText.craftMenu.title} entries={entries} onClose={onClose} />;
}

/**
 * The build menu: text tabs for Camp, Shelter, and Furniture, then one row per structure in the chosen tab, with its icon, its name,
 * the materials it costs as icons with counts, and the tool it needs. A host's row names the add-on the player builds from it.
 * Picking a row puts its blueprint under the mouse.
 */
export function BuildMenu({
  entries,
  tab,
  onChooseTab,
  onPick,
  onClose,
}: {
  entries: GameView["buildMenu"];
  tab: BuildTab;
  onChooseTab: (tab: BuildTab) => void;
  onPick: (structure: StructureKind) => void;
  onClose: () => void;
}) {
  const tabs = (
    <div class="hud-menu-tabs" role="tablist">
      {BUILD_TABS.map((each) => (
        <button
          key={each}
          type="button"
          role="tab"
          class={each === tab ? "hud-menu-tab hud-menu-tab-chosen" : "hud-menu-tab"}
          aria-selected={each === tab}
          onClick={() => {
            onChooseTab(each);
          }}
        >
          {workText.buildMenu.tabs[each]}
        </button>
      ))}
    </div>
  );
  const menuEntries = entriesInTab(entries, tab).map(({ structure, cost, tool }): MenuEntry => {
    const name = workText.buildMenu.structures[structure];
    const addOn = isHost(structure) ? workText.buildMenu.addOnDetail[structure] : undefined;
    const costText = workText.buildMenu.cost([
      ...cost.map(({ material, count }) => workText.buildMenu.materials[material](count)),
      ...(tool === undefined ? [] : [actionsText.actionReasons.needsTool(backpackText.backpackContents[tool])]),
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
      ...(addOn === undefined ? {} : { detail: addOn }),
      label: workText.buildMenu.entryLabel(name, costText, addOn),
      onPick: () => {
        onPick(structure);
      },
    };
  });
  return <ListMenu title={workText.buildMenu.title} tabs={tabs} entries={menuEntries} onClose={onClose} />;
}

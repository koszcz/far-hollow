// The HUD's backpack: the hotbar, the weight ring, and the open chest's grid of contents.
import type { BackpackContent } from "../sim/api";
import type { GameClient } from "../sim/api-client";
import type { GameView } from "../sim/api-game-view";
import type { ChestView, FreshnessViews } from "../sim/api-nearby";
import { isCarriedLog, isFreshFood } from "../sim/api";
import { strings } from "../strings";
import { BackpackIcon, ShadedIcon } from "./backpack-icons";
import { chestTakeReason } from "./menu-refusals";
import { hotbarCells, type HotbarTarget } from "./hotbar-cells";
import { HudIcon } from "./hud-icons";
import { SLED_DRAWING } from "./sled-icons";
import { LIT_TORCH_DRAWING } from "./torch-icons";
import { weightRingShare, weightRingWarns } from "./weight-ring";

/** The kinds of thing in the backpack, with how many of each, in a steady order. */
export function backpackContents(backpack: GameView["backpack"]): [BackpackContent, number][] {
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
  freshness,
  label,
  reason,
  onClick,
}: {
  contents: GameView["backpack"];
  /** How fresh the oldest of each fresh food is. Each fresh food's cell shows a bar that drains as it nears spoiling. */
  freshness: FreshnessViews;
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
        const fresh = isFreshFood(content) ? freshness[content] : undefined;
        const spoilsIn = fresh === undefined ? null : strings.hotbar.spoilsIn(fresh.minutesLeft);
        const described = [label(strings.backpackContentCount(name, count)), spoilsIn, refused].filter((part) => part !== null).join(" · ");
        return (
          <li key={content}>
            <button
              type="button"
              class={refused === null ? "hud-content-move" : "hud-content-move hud-content-move-dimmed"}
              aria-label={described}
              aria-disabled={refused !== null}
              title={refused ?? spoilsIn ?? undefined}
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
              {fresh !== undefined && <span class="hud-hotbar-gauge" style={{ "--hud-level": fresh.share }} aria-hidden="true" />}
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
export function HotbarGrid({ view, onOpenMenu }: { view: GameView; onOpenMenu: (target: HotbarTarget, x: number, y: number) => void }) {
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
            {gauge !== undefined && (
              <span
                class={key === undefined ? "hud-hotbar-gauge" : "hud-hotbar-gauge hud-hotbar-gauge-keyed"}
                style={{ "--hud-level": gauge }}
                aria-hidden="true"
              />
            )}
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
      return isCarriedLog(target.log) ? strings.hotbar.shoulder(name) : strings.hotbar.inHands(name);
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
export function WeightRing({ label, weight, limit }: { label: string; weight: number; limit: number }) {
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
      return isCarriedLog(target.log) ? <HudIcon name="log" /> : <BackpackIcon content={target.log} />;
    case "sled":
      return <ShadedIcon drawing={SLED_DRAWING} className="backpack-icon" />;
    case "litTorch":
      return <ShadedIcon drawing={LIT_TORCH_DRAWING} className="backpack-icon" />;
  }
}

/**
 * The open chest or shelf, above the backpack: what it holds, as a grid of icons grouped by kind, like the backpack.
 * A click on an icon takes one of that kind out into the backpack. A shift-click takes all that fit.
 */
export function ChestPanel({ client, chest }: { client: GameClient; chest: ChestView }) {
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
          freshness={chest.freshness}
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

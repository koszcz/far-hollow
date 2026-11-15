// The cells of the hotbar: the sled the player drags, if any, the log on their shoulder, if any, then one cell per kind of thing in the backpack.
import { CONTENT_WEIGHT_KG, type BackpackContent, type CarriedLog, type GameView } from "../sim/api";
import { strings } from "../strings";

/**
 * What a hotbar cell holds: one kind of thing in the backpack, the log on the shoulder, or the sled the player drags.
 * src/app/thing-actions.ts takes it as an action target.
 */
export type HotbarTarget =
  | { readonly kind: "backpackContent"; readonly content: BackpackContent }
  | { readonly kind: "shoulder"; readonly log: CarriedLog }
  | { readonly kind: "sled"; readonly sledId: number };

export interface HotbarCell {
  readonly target: HotbarTarget;
  /** The name of what the cell holds, such as "Plank". Screen readers read it in the cell's full name. */
  readonly name: string;
  /**
   * The text in the label above the cell while the player points at it or focuses it.
   * A backpack cell adds how much its contents weigh, such as "Plank ×5 · 10 kg".
   */
  readonly tip: string;
  readonly count: number;
  /** The number key that uses it, "1" to "9". Only the first nine backpack cells have one. */
  readonly key: string | undefined;
}

/** How many backpack cells get a number key. */
const KEYED_CELLS = 9;

/**
 * The sled cell first, where the shoulder cell goes, then the shoulder cell, then each kind in the backpack in a steady order.
 * The backpack cells are numbered from 1.
 */
export function hotbarCells(view: Pick<GameView, "backpack" | "carrying" | "dragging">): readonly HotbarCell[] {
  const sled: HotbarCell[] =
    view.dragging === null
      ? []
      : [
          {
            target: { kind: "sled", sledId: view.dragging.id },
            name: strings.hotbar.sled(view.dragging.total, view.dragging.capacity),
            tip: strings.hotbar.sled(view.dragging.total, view.dragging.capacity),
            count: 1,
            key: undefined,
          },
        ];
  const shoulder: HotbarCell[] =
    view.carrying === null
      ? []
      : [
          {
            target: { kind: "shoulder", log: view.carrying },
            name: strings.things[view.carrying],
            tip: strings.things[view.carrying],
            count: 1,
            key: undefined,
          },
        ];
  const contents = (Object.keys(strings.backpackContents) as BackpackContent[])
    .filter((content) => (view.backpack[content] ?? 0) > 0)
    .map((content, index): HotbarCell => {
      const name = strings.backpackContents[content];
      const count = view.backpack[content] ?? 0;
      return {
        target: { kind: "backpackContent", content },
        name,
        tip: strings.hotbar.nameWithWeight(strings.backpackContentCount(name, count), count * CONTENT_WEIGHT_KG[content]),
        count,
        key: index < KEYED_CELLS ? strings.hotbar.key(index + 1) : undefined,
      };
    });
  return [...sled, ...shoulder, ...contents];
}

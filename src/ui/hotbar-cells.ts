// The cells of the hotbar: the log on the player's shoulder, if any, then one cell per kind of thing in the backpack.
import type { BackpackContent, CarriedLog, GameView } from "../sim/api";
import { strings } from "../strings";

/** What a hotbar cell holds: one kind of thing in the backpack, or the log on the shoulder. src/app/thing-actions.ts takes it as an action target. */
export type HotbarTarget = { readonly kind: "item"; readonly content: BackpackContent } | { readonly kind: "shoulder"; readonly log: CarriedLog };

export interface HotbarCell {
  readonly target: HotbarTarget;
  /** The name shown under the icon. */
  readonly name: string;
  readonly count: number;
  /** The number key that uses it, "1" to "9". Only the first nine backpack cells have one. */
  readonly key: string | undefined;
}

/** How many backpack cells get a number key. */
const KEYED_CELLS = 9;

/** The shoulder cell first, then each kind in the backpack in a steady order. The backpack cells are numbered from 1. */
export function hotbarCells(view: Pick<GameView, "backpack" | "carrying">): readonly HotbarCell[] {
  const shoulder: HotbarCell[] =
    view.carrying === null ? [] : [{ target: { kind: "shoulder", log: view.carrying }, name: strings.things[view.carrying], count: 1, key: undefined }];
  const items = (Object.keys(strings.backpackContents) as BackpackContent[])
    .filter((content) => (view.backpack[content] ?? 0) > 0)
    .map((content, index): HotbarCell => ({
      target: { kind: "item", content },
      name: strings.backpackContents[content],
      count: view.backpack[content] ?? 0,
      key: index < KEYED_CELLS ? strings.hotbar.key(index + 1) : undefined,
    }));
  return [...shoulder, ...items];
}

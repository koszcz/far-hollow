import type { EatOrDrinkView } from "./api";
import { deepFreeze } from "./deep-freeze";
import { copyToward, type GroundPoint } from "./ground-point";

/** Records the player's bites and drinks, for drawing to play. */
export function createEatOrDrinkReport() {
  /** The player's last bite or drink since the game was loaded. It is not saved. */
  let last: EatOrDrinkView | null = null;
  return {
    last: (): EatOrDrinkView | null => last,

    /** Records a bite or drink. `toward` is the spot on the river, for a drink from the river. */
    report(kind: EatOrDrinkView["kind"], toward?: GroundPoint): void {
      const count = (last?.count ?? 0) + 1;
      last = deepFreeze({ count, kind, ...copyToward(toward) });
    },
  };
}

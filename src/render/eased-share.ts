// A share from 0 to 1 that eases towards a target, such as how strongly the rain falls or how strongly the birds show.

export interface EasedShare {
  /** Moves the share `seconds` of the way towards `target`, 0 or 1, and returns it. The first call starts at `target`. */
  toward(target: number, seconds: number): number;
}

/** A share that takes `riseSeconds` to go from 0 to 1, and `fallSeconds` to go from 1 to 0. */
export function createEasedShare(timing: { readonly riseSeconds: number; readonly fallSeconds: number }): EasedShare {
  let share: number | undefined;
  return {
    toward(target, seconds) {
      if (share === undefined) share = target;
      else if (share < target) share = Math.min(share + seconds / timing.riseSeconds, target);
      else share = Math.max(share - seconds / timing.fallSeconds, target);
      return share;
    },
  };
}

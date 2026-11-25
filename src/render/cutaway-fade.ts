// How far each piece the cabin cutaway touches has faded, so it eases out and back in instead of switching at once.
// A fade level runs from 0, solid, to 1, as faded as the cutaway makes it: a wall see-through, a roof gone.
// A piece seen for the first time starts at its target, so a game that loads with the player inside shows no fade.
import type * as THREE from "three";
import type { Entity } from "../sim/entities";
import { createEasedShare, type EasedShare } from "./eased-share";
import { FADED_OPACITY } from "./structure-look";

/** How long a piece takes to fade out, or to come back, in seconds. */
export const CUTAWAY_FADE_SECONDS = 0.35;
/** A fade this close to its end counts as finished. */
const SETTLED = 1e-6;

export interface CutawayFades {
  /**
   * How far `entity` has faded, eased towards `faded` since the last call. `nowSeconds` is the time of this frame.
   * Without it, as in a still showcase, the level jumps to its target.
   */
  level(entity: Entity, faded: boolean, nowSeconds?: number): number;
  /** Drops what is known about a piece that is no longer drawn. */
  forget(entity: Entity): void;
}

export function createCutawayFades(): CutawayFades {
  const known = new Map<Entity, { share: EasedShare; at: number }>();
  return {
    level(entity, faded, nowSeconds) {
      const target = faded ? 1 : 0;
      if (nowSeconds === undefined) {
        known.delete(entity);
        return target;
      }
      let state = known.get(entity);
      if (state === undefined) {
        state = { share: createEasedShare({ riseSeconds: CUTAWAY_FADE_SECONDS, fallSeconds: CUTAWAY_FADE_SECONDS }), at: nowSeconds };
        known.set(entity, state);
      }
      const seconds = Math.max(0, nowSeconds - state.at);
      state.at = nowSeconds;
      const share = state.share.toward(target, seconds);
      // Easing in steps leaves a rounding speck short of the end. A piece that is all but there counts as there.
      if (Math.abs(share - target) < SETTLED) return target;
      return smoothStep(share);
    },
    forget(entity) {
      known.delete(entity);
    },
  };
}

/** How solid a wall, door, window, or set of shutters is at fade `level`: solid at 0, FADED_OPACITY at 1. */
export function cutawayOpacity(level: number): number {
  return 1 - level * (1 - FADED_OPACITY);
}

/** Eases a share from 0 to 1 so it starts and ends gently. */
function smoothStep(share: number): number {
  return share * share * (3 - 2 * share);
}

/**
 * Gives a see-through copy of a piece's material the `opacity` of its fade. It keeps casting its shadow while it fades,
 * so the room behind a faded wall or under a hidden roof stays in shade.
 */
export function showFading(material: THREE.Material, opacity: number): void {
  material.opacity = opacity;
  material.userData.castsShadow = true;
}

// Small line icons for the HUD, the "hud" asset in asset-manifest.json. Built in code. Approved by the owner.
// Each icon is drawn on a 24 by 24 grid with round strokes in the current text colour, so CSS sets its colour.

const PATHS = {
  /** Warmth. */
  flame: "M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 0 2 1 3 2 3.5C11 9 11 6 12 3z",
  /** A campfire: a flame over two crossed logs. */
  campfire: "M12 3c.7 2.5 3.5 3.8 3.5 7a3.5 3.5 0 0 1-7 0c0-1.7 1-2.8 1.8-3.5 0 1.4.7 2.1 1.4 2.4C11.2 7.2 11.3 5 12 3zM4 20l16-4M4 16l16 4",
  backpack: "M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 7h12a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8a1 1 0 0 1 1-1zM9 14h6v4H9z",
  pause: "M8 5v14M16 5v14",
  play: "M7 4l12 8-12 8z",
  axe: "M5 20L15 10M13 4l7 7c-2 2-4.5 2-6.5 0L13 10.5 11 8.5l2.5-2.5C11.5 4 11.5 2.5 13 4z",
  /** A log seen from the side, with its cut end. */
  log: "M6 9h12a3 3 0 0 1 0 6H6a3 3 0 0 1 0-6zM6 9a3 3 0 0 0 0 6",
  /** Thirst: a water drop. Draft, added by settling-in ticket 05; awaiting owner approval. */
  droplet: "M12 3c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11z",
  /** Hunger: a berry with a leaf. Draft, added by settling-in ticket 07; awaiting owner approval. */
  berry: "M12 9a5.5 5.5 0 1 1 0 11a5.5 5.5 0 0 1 0-11zM12 9c0-2 1-4 3-5M12 7c-2-2-4-2-5-1",
  /** Placing something on the ground. */
  place: "M12 21s-6-5.5-6-10a6 6 0 0 1 12 0c0 4.5-6 10-6 10zM12 9v4M10 11h4",
} as const;

export type HudIconName = keyof typeof PATHS;

/** Draws one HUD icon at the size of the text around it. Screen readers skip it, because a text label always goes with it. */
export function HudIcon({ name }: { name: HudIconName }) {
  return (
    <svg class="hud-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </svg>
  );
}

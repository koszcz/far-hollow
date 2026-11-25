// Draws the wall mode button over the views of its showcase, one wall mode per view: walls up, cutaway, and walls down, then cutaway at dusk.
import { render } from "preact";
import type { WallMode } from "../wall-mode";
import { WallModeButton } from "./cutaway-button";

/** The wall mode the button shows in each of the four views. */
const VIEW_WALL_MODES: readonly WallMode[] = ["wallsUp", "cutaway", "wallsDown", "cutaway"];

/** Draws the wall mode button over each of the four views. */
export function renderCutawayShowcase(ui: HTMLElement): void {
  VIEW_WALL_MODES.forEach((mode, index) => {
    const quarter = document.createElement("div");
    quarter.className = `showcase-hud showcase-hud-${index}`;
    ui.append(quarter);
    render(<WallModeButton mode={mode} onNext={() => {}} />, quarter);
  });
}

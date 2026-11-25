// Draws the cutaway button over the views of its showcase: off in the first and third views, on in the second and fourth.
import { render } from "preact";
import { CutawayButton } from "./cutaway-button";

/** Draws the cutaway button over each of the four views. */
export function renderCutawayShowcase(ui: HTMLElement): void {
  for (let index = 0; index < 4; index += 1) {
    const quarter = document.createElement("div");
    quarter.className = `showcase-hud showcase-hud-${index}`;
    ui.append(quarter);
    render(<CutawayButton on={index % 2 === 1} onToggle={() => {}} />, quarter);
  }
}

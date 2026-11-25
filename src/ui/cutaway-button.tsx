// The "cutaway-button" draft asset in asset-manifest.json: the small round HUD button that turns the cabin cutaway on and off.
// On, every cabin roof hides and the cabin walls facing the camera fade, so the player sees inside. Its icon is drawn in the HUD icons' line style.
import { strings } from "../strings";

/** A cabin with its roof lifted off above it, on the HUD icons' 24 by 24 grid. */
const CUTAWAY_ICON = "M3 9l9-6 9 6M5 13v8h14v-8M5 13h14M10 21v-4h4v4";

/** The round cutaway button at the top right of the HUD, left of the sound button. It shows pressed while the cutaway is on. */
export function CutawayButton({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  const label = on ? strings.cutaway.hide : strings.cutaway.show;
  return (
    <div class="hud hud-cutaway">
      <div class="hud-panel">
        <button type="button" class="hud-button hud-icon-button" aria-label={label} aria-pressed={on} data-tip={label} onClick={onToggle}>
          <svg class="hud-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d={CUTAWAY_ICON} />
          </svg>
        </button>
      </div>
    </div>
  );
}

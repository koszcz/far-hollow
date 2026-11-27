// The "cutaway-button" draft asset in asset-manifest.json: the small round HUD button that picks the wall mode (src/wall-mode.ts).
// Each click moves to the next wall mode. Its icon shows the current wall mode, drawn in the HUD icons' line style.
// Its label and tooltip name the wall mode the next click switches to.
import { nextWallMode, type WallMode } from "../wall-mode";
import { shellText } from "../strings/shell";

/** One icon per wall mode, on the HUD icons' 24 by 24 grid. */
const WALL_MODE_ICONS: Readonly<Record<WallMode, string>> = {
  // A cabin with its roof on.
  wallsUp: "M3 11l9-8 9 8M5 9.2V21h14V9.2M10 21v-5h4v5",
  // A cabin with its roof lifted off above it.
  cutaway: "M3 9l9-6 9 6M5 13v8h14v-8M5 13h14M10 21v-4h4v4",
  // Low walls, two log courses high, with a doorway between them and no roof.
  wallsDown: "M3 21h18M4 21v-7h6v7M14 21v-7h6v7M4 17.5h6M14 17.5h6",
};

/** The round wall mode button at the top right of the HUD, left of the sound button. */
export function WallModeButton({ mode, onNext }: { mode: WallMode; onNext: () => void }) {
  const label = shellText.wallMode.show[nextWallMode(mode)];
  return (
    <div class="hud hud-cutaway">
      <div class="hud-panel">
        <button type="button" class="hud-button hud-icon-button" aria-label={label} data-tip={label} data-wall-mode={mode} onClick={onNext}>
          <svg class="hud-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d={WALL_MODE_ICONS[mode]} />
          </svg>
        </button>
      </div>
    </div>
  );
}

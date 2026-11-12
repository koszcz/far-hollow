// The ring of actions a click on a thing opens. It has no background: only the options show, spaced around the click like a clock face.
// Its look lives in the .action-menu rules of src/app/style.css.
import { useEffect } from "preact/hooks";
import type { GameClient } from "../sim/api";
import { strings } from "../strings";
import { BackpackIcon } from "./backpack-icons";
import { HudIcon } from "./hud-icons";
import type { ActionIcon, ThingAction } from "./thing-action";

export interface ActionMenuProps {
  client: GameClient;
  /** The middle of the ring, in page pixels. With `above`, the ring sits wholly above this point instead, such as above a hotbar cell. */
  x: number;
  y: number;
  above?: boolean;
  /** Every action the thing offers, the most likely first. The first sits at 12 o'clock. Actions that send no command are left out. */
  actions: readonly ThingAction[];
  /** Called when the player picks an action, after its command is sent, or presses anywhere outside the menu, so the menu can close. */
  onClose: () => void;
}

/** The ring's smallest radius, in pixels, from the middle to each option's centre. */
const MIN_RADIUS_PIXELS = 58;
/** How much room each option needs along the ring, in pixels. More options make a wider ring. */
const PIXELS_PER_OPTION = 80;
/** How far beyond the ring a side option's name reaches, in pixels. The ring stays this far from the window's left and right edges. */
const SIDE_MARGIN_PIXELS = 90;
/** How far beyond the ring a top or bottom option's icon and name reach, in pixels. The ring stays this far from the top and bottom edges. */
const END_MARGIN_PIXELS = 52;

/** Where an option's name sits next to its icon: away from the ring's middle. */
type LabelSide = "above" | "below" | "left" | "right";

/**
 * A ring of actions around the spot the player clicked. Each option is a round icon with its name beside it. Picking one sends its command.
 * The first action sits at 12 o'clock. The rest follow clockwise. An action the player cannot do yet is greyed, says why, and does nothing.
 */
export function ActionMenu({ client, x, y, above = false, actions, onClose }: ActionMenuProps) {
  useEffect(() => {
    // A press anywhere outside the options, such as on the HUD, closes the menu. Presses on the scene close it through walk input too.
    function onPointerDown(event: PointerEvent): void {
      if (event.target instanceof Element && event.target.closest(".action-menu-option") === null) onClose();
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [onClose]);

  const shown = actions.filter(({ command }) => command !== undefined);
  const radius = Math.max(MIN_RADIUS_PIXELS, (PIXELS_PER_OPTION * shown.length) / (2 * Math.PI));
  // Keep the whole ring on screen. Near an edge, its middle moves inwards.
  const reachX = radius + SIDE_MARGIN_PIXELS;
  const reachY = radius + END_MARGIN_PIXELS;
  const centreX = clamp(x, reachX, window.innerWidth - reachX);
  const centreY = clamp(above ? y - reachY : y, reachY, window.innerHeight - reachY);

  return (
    <nav class="action-menu" style={{ left: `${centreX}px`, top: `${centreY}px` }} aria-label={strings.actionMenu}>
      {shown.map(({ id, label, icon, enabled, reason, command }, index) => {
        // Clockwise from 12 o'clock.
        const angle = (index / shown.length) * 2 * Math.PI;
        const dx = Math.sin(angle) * radius;
        const dy = -Math.cos(angle) * radius;
        const name = enabled || reason === undefined ? label : strings.actions.withReason(label, reason);
        return (
          <button
            key={id}
            type="button"
            class={`action-menu-option action-menu-label-${labelSide(dx, dy)}`}
            style={{ left: `${dx}px`, top: `${dy}px` }}
            disabled={!enabled}
            aria-label={name}
            onClick={() => {
              if (command !== undefined) client.send(command);
              onClose();
            }}
          >
            <span class="action-menu-icon">
              <ActionIconView icon={icon} />
            </span>
            <span class="action-menu-name" aria-hidden="true">
              {name}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

/** The top and bottom options put their names above and below. The others put them to the side. */
function labelSide(dx: number, dy: number): LabelSide {
  if (Math.abs(dx) < 1) return dy < 0 ? "above" : "below";
  return dx > 0 ? "right" : "left";
}

function clamp(value: number, min: number, max: number): number {
  return min > max ? (min + max) / 2 : Math.min(Math.max(value, min), max);
}

function ActionIconView({ icon }: { icon: ActionIcon }) {
  return "hud" in icon ? <HudIcon name={icon.hud} /> : <BackpackIcon content={icon.content} />;
}

// The menu a right-click on a thing in the world opens. It uses the HUD's button style. Its own look lives in the
// .action-menu rules of src/app/style.css.
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import type { GameClient } from "../sim/api";
import { strings } from "../strings";
import { BackpackIcon } from "./backpack-icons";
import { HudIcon } from "./hud-icons";
import type { ActionIcon, ThingAction } from "./thing-action";

export interface ActionMenuProps {
  client: GameClient;
  /** Where the menu opens, in page pixels. */
  x: number;
  y: number;
  /** Every action the thing offers, main first. Actions that send no command are left out. */
  actions: readonly ThingAction[];
  /** Called when the player picks an action, after its command is sent, or presses anywhere outside the menu, so the menu can close. */
  onClose: () => void;
}

/** How far the menu opens from the cursor, in pixels. */
const CURSOR_GAP_PIXELS = 6;

/**
 * A small list of actions at the spot the player right-clicked, each with an icon and a name. Picking one sends its command.
 * An action the player cannot do yet is greyed, says why, and does nothing.
 */
export function ActionMenu({ client, x, y, actions, onClose }: ActionMenuProps) {
  const menu = useRef<HTMLElement>(null);
  const [place, setPlace] = useState({ left: x + CURSOR_GAP_PIXELS, top: y + CURSOR_GAP_PIXELS });
  useLayoutEffect(() => {
    // Keep the whole menu on screen. Near the right or bottom edge, it opens to the left of or above the cursor instead.
    const size = menu.current?.getBoundingClientRect();
    if (size === undefined) return;
    const left = x + CURSOR_GAP_PIXELS + size.width > window.innerWidth ? x - CURSOR_GAP_PIXELS - size.width : x + CURSOR_GAP_PIXELS;
    const top = y + CURSOR_GAP_PIXELS + size.height > window.innerHeight ? y - CURSOR_GAP_PIXELS - size.height : y + CURSOR_GAP_PIXELS;
    setPlace({ left: Math.max(0, left), top: Math.max(0, top) });
  }, [x, y, actions]);
  useEffect(() => {
    // A press anywhere outside the menu, such as on the HUD, closes it. Presses on the scene close it through walk input too.
    function onPointerDown(event: PointerEvent): void {
      if (event.target instanceof Node && menu.current?.contains(event.target) !== true) onClose();
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [onClose]);
  return (
    <nav ref={menu} class="action-menu" style={{ left: `${place.left}px`, top: `${place.top}px` }} aria-label={strings.actionMenu}>
      {actions.map(({ id, label, icon, enabled, reason, command }) =>
        command === undefined ? null : (
          <button
            key={id}
            type="button"
            class="hud-button"
            disabled={!enabled}
            onClick={() => {
              client.send(command);
              onClose();
            }}
          >
            <ActionIconView icon={icon} />
            {enabled || reason === undefined ? label : strings.actions.withReason(label, reason)}
          </button>
        ),
      )}
    </nav>
  );
}

function ActionIconView({ icon }: { icon: ActionIcon }) {
  return "hud" in icon ? <HudIcon name={icon.hud} /> : <BackpackIcon content={icon.content} />;
}

// The list of actions a click on a thing opens. It sits beside the click, with the main action on top.
// Its look lives in the .action-menu rules of src/app/style.css. src/ui/action-menu-place.ts decides where it goes.
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { queued } from "../sim/api-commands";
import { type GameClient } from "../sim/api-client";
import { type Plantable } from "../sim/api";
import { actionsText } from "../strings/actions";
import { placeActionMenu } from "./action-menu-place";
import { BackpackIcon } from "./backpack-icons";
import { HudIcon } from "./hud-icons";
import { isListed, type ActionIcon, type ThingAction } from "./thing-action";

export interface ActionMenuProps {
  client: GameClient;
  /** The click, in page pixels. The list opens to its right, or to its left near the right edge. With `above`, the list sits wholly above this point instead, such as above a hotbar cell. */
  x: number;
  y: number;
  above?: boolean;
  /**
   * Reads every action the thing offers now, the most likely first, or undefined once it offers none. The first tops the list.
   * Actions that send no command are left out, except planting a sapling. The menu reads again after each logic step, so it stays current while it is open.
   */
  readActions: () => readonly ThingAction[] | undefined;
  /** Called when the player picks planting a sapling or berry bush, which puts a see-through one under the mouse instead of sending a command. */
  onStartPlanting: (plant: Plantable) => void;
  /** Called when the player picks an action, after its command is sent, presses anywhere outside the menu, or the thing offers no actions any more, so the menu can close. */
  onClose: () => void;
}

/**
 * A list of actions beside the spot the player clicked. Each row is an icon with the action's name. Picking one sends its command.
 * The main action tops the list in bold. An action the player cannot do yet is greyed, says why under its name, and does nothing.
 */
export function ActionMenu({ client, x, y, above = false, readActions, onStartPlanting, onClose }: ActionMenuProps) {
  // Actions change as the game runs, such as "pick up" turning on once the player has put a log down.
  const [actions, setActions] = useState(readActions);
  useEffect(
    () =>
      client.subscribe(() => {
        const next = readActions();
        if (next === undefined) onClose();
        else setActions((shown) => (shown !== undefined && sameActions(shown, next) ? shown : next));
      }),
    [client, readActions, onClose],
  );

  useEffect(() => {
    // A press anywhere outside the list, such as on the HUD, closes the menu. Presses on the scene close it through walk input too.
    function onPointerDown(event: PointerEvent): void {
      if (event.target instanceof Element && event.target.closest(".action-menu") === null) onClose();
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [onClose]);

  const shown = (actions ?? []).filter(isListed);
  // Greying an action adds its reason under its name, which can change the list's size.
  const sizeKey = shown.map(({ label, enabled, reason }) => `${label}|${enabled ? "" : (reason ?? "")}`).join("\n");

  // The list's place depends on its size, so measure it before the first paint, then move it there.
  const listRef = useRef<HTMLElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const list = listRef.current;
    if (list === null) return;
    const { width, height } = list.getBoundingClientRect();
    setPlace(placeActionMenu({ x, y, above, width, height, viewWidth: window.innerWidth, viewHeight: window.innerHeight }));
  }, [x, y, above, sizeKey]);

  return (
    <nav
      ref={listRef}
      class="action-menu"
      style={place === null ? { left: "0px", top: "0px", visibility: "hidden" } : { left: `${place.left}px`, top: `${place.top}px` }}
      aria-label={actionsText.actionMenu}
    >
      <h3 class="action-menu-title" aria-hidden="true">
        {actionsText.actionMenu}
      </h3>
      <ul>
        {shown.map(({ id, label, icon, enabled, reason, command, isMain, startsPlanting }) => {
          const name = enabled || reason === undefined ? label : actionsText.actions.withReason(label, reason);
          return (
            <li key={id}>
              <button
                type="button"
                class={isMain ? "action-menu-option action-menu-option-main" : "action-menu-option"}
                disabled={!enabled}
                aria-label={name}
                onClick={(event) => {
                  // A Shift-click adds the action to the end of the action queue.
                  if (command !== undefined) client.send(event.shiftKey ? queued(command) : command);
                  if (startsPlanting !== undefined) onStartPlanting(startsPlanting);
                  onClose();
                }}
              >
                <span class="action-menu-icon">
                  <ActionIconView icon={icon} />
                </span>
                <span class="action-menu-text" aria-hidden="true">
                  <span class="action-menu-name">{label}</span>
                  {!enabled && reason !== undefined && <span class="action-menu-reason">{capitalise(reason)}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** True if both lists show the same actions the same way, so the menu need not draw again. */
function sameActions(a: readonly ThingAction[], b: readonly ThingAction[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function ActionIconView({ icon }: { icon: ActionIcon }) {
  return "hud" in icon ? <HudIcon name={icon.hud} /> : <BackpackIcon content={icon.content} />;
}

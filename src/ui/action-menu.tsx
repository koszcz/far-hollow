// The menu a right-click on a thing in the world opens. It uses the HUD's button style. Its own look lives in the
// .action-menu rules of src/app/style.css.
import type { Command, GameClient } from "../sim/api";
import { strings } from "../strings";

export interface ActionMenuProps {
  client: GameClient;
  /** Where the menu opens, in page pixels. */
  x: number;
  y: number;
  /** The choices, in order, each with its text and the command it sends. */
  actions: readonly { readonly label: string; readonly command: Command }[];
  /** Called when the player picks a choice, after its command is sent, so the menu can close. */
  onClose: () => void;
}

/** A small list of buttons at the spot the player right-clicked. Picking one sends its command. */
export function ActionMenu({ client, x, y, actions, onClose }: ActionMenuProps) {
  return (
    <nav class="action-menu" style={{ left: `${x}px`, top: `${y}px` }} aria-label={strings.actionMenu}>
      {actions.map(({ label, command }) => (
        <button
          key={label}
          type="button"
          class="hud-button"
          onClick={() => {
            client.send(command);
            onClose();
          }}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}

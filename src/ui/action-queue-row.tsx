// The action queue beside the clock: one icon per lined-up action, the action under way first and a little larger.
// Pointing at an icon shows the action's name. A click on it cancels that action. With an empty queue, the row shows nothing.
// Its look lives in the .hud-queue rules of src/app/style.css.
import type { GameClient } from "../sim/api-client";
import type { GameView } from "../sim/api-game-view";
import { actionsText } from "../strings/actions";
import { QUEUE_THING_DRAWINGS } from "./action-queue-icons";
import { backpackDrawing, ShadedIcon } from "./backpack-icons";
import { carriedLogDrawing } from "./build-icons";
import { HudIcon } from "./hud-icons";
import { queuedActions, type QueueIcon } from "./queued-actions";
import { structureDrawing } from "./structure-icon";

export function ActionQueueRow({ client, view }: { client: GameClient; view: GameView }) {
  const actions = queuedActions(view, client);
  if (actions.length === 0) return null;
  return (
    <ol class="hud-panel hud-queue" aria-label={actionsText.actionQueue.title}>
      {actions.map(({ icon, name }, index) => (
        // The same action can wait more than once, such as two fishing trips, so its place in the queue is part of its key.
        <li key={`${index}-${name}`} class={index === 0 ? "hud-queue-under-way" : undefined}>
          <button
            type="button"
            class="hud-queue-cell"
            aria-label={actionsText.actionQueue.cancel(name)}
            onClick={() => {
              client.send({ type: "cancelQueuedAction", index });
            }}
          >
            <QueueIconView icon={icon} />
            <span class="hud-queue-name" aria-hidden="true">
              {name}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

/** Draws one queued action's icon. Screen readers skip it, because the button's label names the action. */
function QueueIconView({ icon }: { icon: QueueIcon }) {
  if ("hud" in icon) return <HudIcon name={icon.hud} />;
  const drawing =
    "content" in icon
      ? backpackDrawing(icon.content)
      : "structure" in icon
        ? structureDrawing(icon.structure)
        : "log" in icon
          ? carriedLogDrawing(icon.log)
          : QUEUE_THING_DRAWINGS[icon.thing];
  return <ShadedIcon drawing={drawing} className="hud-queue-icon" />;
}

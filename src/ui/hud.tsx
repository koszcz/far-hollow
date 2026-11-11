import { useEffect, useState } from "preact/hooks";
import type { BackpackItem, GameClient, GameView } from "../sim/api";
import { strings } from "../strings";

/** The kinds of thing in the backpack, with how many of each, in a steady order. */
function backpackItems(backpack: GameView["backpack"]): [BackpackItem, number][] {
  const items: [BackpackItem, number][] = [];
  for (const item of Object.keys(strings.backpackItems) as BackpackItem[]) {
    const count = backpack[item] ?? 0;
    if (count > 0) items.push([item, count]);
  }
  return items;
}

export interface HudProps {
  client: GameClient;
  /** Whether the camera follows the player when the HUD first shows. */
  cameraFollow: boolean;
  /** Called when the player turns camera follow on or off. The camera is not game state, so this is not a command. */
  onCameraFollowChange: (enabled: boolean) => void;
}

export function Hud({ client, cameraFollow: initialCameraFollow, onCameraFollowChange }: HudProps) {
  const [view, setView] = useState(client.getView());
  const [cameraFollow, setCameraFollow] = useState(initialCameraFollow);
  useEffect(
    () =>
      client.subscribe(() => {
        setView(client.getView());
      }),
    [client],
  );

  return (
    <div class="hud">
      {view.paused && <p class="hud-paused">{strings.paused}</p>}
      <button type="button" onClick={() => {
          client.send({ type: "setPaused", paused: !view.paused });
        }}>
        {view.paused ? strings.resume : strings.pause}
      </button>
      <label class="hud-setting">
        <input
          type="checkbox"
          checked={cameraFollow}
          onChange={(event) => {
            const enabled = event.currentTarget.checked;
            setCameraFollow(enabled);
            onCameraFollowChange(enabled);
          }}
        />
        {strings.cameraFollow}
      </label>
      {view.action !== null && (
        <label class="hud-action">
          {view.action.kind === "chop" ? strings.chopping : strings.splitting}
          <progress max={1} value={view.action.progress} />
        </label>
      )}
      {view.carrying === "log" && (
        <p class="hud-carrying">
          {strings.carryingLog}{" "}
          <button type="button" onClick={() => {
              client.send({ type: "dropLog" });
            }}>
            {strings.dropLog}
          </button>{" "}
          <button type="button" onClick={() => {
              client.send({ type: "splitLog" });
            }}>
            {strings.splitLog}
          </button>
        </p>
      )}
      <section class="hud-backpack" aria-label={strings.backpack}>
        <h2>{strings.backpack}</h2>
        <p class="hud-backpack-weight">{strings.backpackWeight(view.backpackWeight, view.backpackWeightLimit)}</p>
        <ul>
          {backpackItems(view.backpack).map(([item, count]) => (
            <li key={item}>{strings.backpackItemCount(strings.backpackItems[item], count)}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

import { useEffect, useState } from "preact/hooks";
import type { GameClient } from "../sim/api";
import { strings } from "../strings";

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
    </div>
  );
}

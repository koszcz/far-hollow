import { useEffect, useState } from "preact/hooks";
import type { GameClient } from "../sim/api";
import { strings } from "../strings";

export function Hud({ client }: { client: GameClient }) {
  const [view, setView] = useState(client.getView());
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
    </div>
  );
}

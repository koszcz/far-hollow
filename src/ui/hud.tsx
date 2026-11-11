import { useEffect, useState } from "preact/hooks";
import type { BackpackContent, CampfireView, GameClient, GameView } from "../sim/api";
import { strings } from "../strings";

/** The kinds of thing in the backpack, with how many of each, in a steady order. */
function backpackContents(backpack: GameView["backpack"]): [BackpackContent, number][] {
  const contents: [BackpackContent, number][] = [];
  for (const content of Object.keys(strings.backpackContents) as BackpackContent[]) {
    const count = backpack[content] ?? 0;
    if (count > 0) contents.push([content, count]);
  }
  return contents;
}

export interface HudProps {
  client: GameClient;
  /** Whether the camera follows the player when the HUD first shows. */
  cameraFollow: boolean;
  /** Called when the player turns camera follow on or off. The camera is not game state, so this is not a command. */
  onCameraFollowChange: (enabled: boolean) => void;
  /** Whether the next click on the ground places a campfire blueprint. */
  placingCampfire: boolean;
  /** Called when the player chooses to place a campfire. Placing is input state, not game state, so this is not a command. */
  onPlaceCampfire: () => void;
}

/** Shows whether the campfire beside the player burns and how much fuel it has, with buttons to fuel and light it. */
function CampfirePanel({ client, view, campfire }: { client: GameClient; view: GameView; campfire: CampfireView }) {
  const hasSticks = (view.backpack.stick ?? 0) > 0;
  const hasFirewood = (view.backpack.firewood ?? 0) > 0;
  return (
    <section class="hud-campfire" aria-label={strings.campfire}>
      <h2>{strings.campfire}</h2>
      <p>{campfire.lit ? strings.campfireLit : strings.campfireUnlit}</p>
      <label>
        {strings.campfireFuel} <progress max={1} value={campfire.fuelLeft} />
      </label>
      <button type="button" disabled={!hasSticks} onClick={() => {
          client.send({ type: "addFuel", campfireId: campfire.id, fuel: "stick" });
        }}>
        {strings.addStick}
      </button>
      <button type="button" disabled={!hasFirewood} onClick={() => {
          client.send({ type: "addFuel", campfireId: campfire.id, fuel: "firewood" });
        }}>
        {strings.addFirewood}
      </button>
      {!campfire.lit && (
        <button type="button" disabled={!campfire.canLight} onClick={() => {
            client.send({ type: "lightCampfire", campfireId: campfire.id });
          }}>
          {strings.lightCampfire}
        </button>
      )}
    </section>
  );
}

const actionLabels = {
  chop: strings.chopping,
  split: strings.splitting,
  build: strings.building,
} as const;

export function Hud({ client, cameraFollow: initialCameraFollow, onCameraFollowChange, placingCampfire, onPlaceCampfire }: HudProps) {
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
      {view.notice !== null && (
        <p class="hud-notice" role="status">
          {strings.notices[view.notice]}
        </p>
      )}
      {view.raining && <p class="hud-raining">{strings.raining}</p>}
      <label class="hud-warmth">
        {strings.warmth} <progress max={1} value={view.warmth} />
      </label>
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
          {actionLabels[view.action.kind]}
          <progress max={1} value={view.action.progress} />
        </label>
      )}
      {placingCampfire ? (
        <p class="hud-placing">{strings.placingCampfire}</p>
      ) : (
        <button type="button" onClick={onPlaceCampfire}>
          {strings.placeCampfire(view.campfireStickCost)}
        </button>
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
      {view.nearbyCampfire !== null && <CampfirePanel client={client} view={view} campfire={view.nearbyCampfire} />}
      <section class="hud-backpack" aria-label={strings.backpack}>
        <h2>{strings.backpack}</h2>
        <p class="hud-backpack-weight">{strings.backpackWeight(view.backpackWeight, view.backpackWeightLimit)}</p>
        <ul>
          {backpackContents(view.backpack).map(([content, count]) => (
            <li key={content}>{strings.backpackContentCount(strings.backpackContents[content], count)}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

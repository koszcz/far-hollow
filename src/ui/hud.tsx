// The HUD, the "hud" asset in asset-manifest.json: a woodland panel over the scene. Built in code. Approved by the owner.
// Its look lives in the .hud rules of src/app/style.css. Its icons are in hud-icons.tsx.
import { useEffect, useState } from "preact/hooks";
import type { BackpackContent, BedrollView, CampfireView, Food, GameClient, GameView } from "../sim/api";
import { strings } from "../strings";
import { HudIcon, type HudIconName } from "./hud-icons";

/** The kinds of thing in the backpack, with how many of each, in a steady order. */
function backpackContents(backpack: GameView["backpack"]): [BackpackContent, number][] {
  const contents: [BackpackContent, number][] = [];
  for (const content of Object.keys(strings.backpackContents) as BackpackContent[]) {
    const count = backpack[content] ?? 0;
    if (count > 0) contents.push([content, count]);
  }
  return contents;
}

/** Backpack contents the player can eat. */
const FOODS: readonly BackpackContent[] = ["berries", "mushroom"] satisfies Food[];

function isFood(content: BackpackContent): content is Food {
  return FOODS.includes(content);
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

/** Warmth's bar colour runs from this cold blue at 0 to the ember orange at 1. */
const COLD_RGB = [111, 168, 214] as const;
const WARM_RGB = [232, 131, 58] as const;
/** At or below this level a need's bar pulses, to warn the player. */
const LOW_NEED = 0.25;
/** A cool river blue for the thirst bar. */
const THIRST_COLOUR = "#5aa9e6";
/** A berry red for the hunger bar. */
const HUNGER_COLOUR = "#c8553d";
/** A dusk violet for the fatigue bar. */
const FATIGUE_COLOUR = "#9a8fd6";

/** The colour of the warmth bar at `warmth`, from 0 (frozen) to 1 (fully warm). */
function warmthColour(warmth: number): string {
  const t = Math.min(1, Math.max(0, warmth));
  const mix = (cold: number, warm: number): number => Math.round(cold + (warm - cold) * t);
  return `rgb(${mix(COLD_RGB[0], WARM_RGB[0])} ${mix(COLD_RGB[1], WARM_RGB[1])} ${mix(COLD_RGB[2], WARM_RGB[2])})`;
}

/** One row of a bar with an icon and a label. Needs such as warmth, and the progress of timed work, use it. */
function Meter({ icon, label, value, colour, low = false }: { icon: HudIconName; label: string; value: number; colour: string; low?: boolean }) {
  return (
    <label class={low ? "hud-meter hud-meter-low" : "hud-meter"} style={{ "--hud-bar": colour }}>
      <HudIcon name={icon} />
      <span class="hud-meter-label">{label}</span>
      <progress max={1} value={value} />
    </label>
  );
}

/** A HUD button with an icon in front of its text. */
function HudButton({ icon, label, disabled = false, onClick }: { icon?: HudIconName; label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" class="hud-button" disabled={disabled} onClick={onClick}>
      {icon !== undefined && <HudIcon name={icon} />}
      {label}
    </button>
  );
}

/** Shows whether the campfire beside the player burns and how much fuel it has, with buttons to fuel and light it. */
function CampfirePanel({ client, view, campfire }: { client: GameClient; view: GameView; campfire: CampfireView }) {
  const hasSticks = (view.backpack.stick ?? 0) > 0;
  const hasFirewood = (view.backpack.firewood ?? 0) > 0;
  return (
    <section class="hud-section hud-campfire" aria-label={strings.campfire}>
      <h2>
        <HudIcon name="campfire" />
        {strings.campfire}
        <span class={campfire.lit ? "hud-tag hud-tag-lit" : "hud-tag"}>{campfire.lit ? strings.campfireLit : strings.campfireUnlit}</span>
      </h2>
      <Meter icon="flame" label={strings.campfireFuel} value={campfire.fuelLeft} colour={`rgb(${WARM_RGB.join(" ")})`} />
      <div class="hud-buttons">
        <HudButton label={strings.addStick} disabled={!hasSticks} onClick={() => {
            client.send({ type: "addFuel", campfireId: campfire.id, fuel: "stick" });
          }} />
        <HudButton label={strings.addFirewood} disabled={!hasFirewood} onClick={() => {
            client.send({ type: "addFuel", campfireId: campfire.id, fuel: "firewood" });
          }} />
        {!campfire.lit && (
          <HudButton icon="flame" label={strings.lightCampfire} disabled={!campfire.canLight} onClick={() => {
              client.send({ type: "lightCampfire", campfireId: campfire.id });
            }} />
        )}
      </div>
    </section>
  );
}

/** Buttons to sleep on the bedroll beside the player, or to pack it away. */
function BedrollPanel({ client, bedroll }: { client: GameClient; bedroll: BedrollView }) {
  return (
    <section class="hud-section hud-bedroll" aria-label={strings.bedroll}>
      <h2>
        <HudIcon name="moon" />
        {strings.bedroll}
      </h2>
      <div class="hud-buttons">
        <HudButton icon="moon" label={strings.sleep} onClick={() => {
            client.send({ type: "sleep", bedrollId: bedroll.id });
          }} />
        <HudButton icon="backpack" label={strings.pickUpBedroll} onClick={() => {
            client.send({ type: "pickUpBedroll", bedrollId: bedroll.id });
          }} />
      </div>
    </section>
  );
}

const actionLabels = {
  chop: strings.chopping,
  split: strings.splitting,
  build: strings.building,
} as const;

const actionIcons: Record<keyof typeof actionLabels, HudIconName> = { chop: "axe", split: "axe", build: "campfire" };

/** The colour of the bar for timed work, such as chopping. */
const WORK_BAR_COLOUR = "#d9c48a";

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
      {view.paused && <p class="hud-banner hud-paused">{strings.paused}</p>}
      {view.raining && <p class="hud-banner hud-raining">{strings.raining}</p>}
      {view.notice !== null && (
        <p class="hud-banner hud-notice" role="status">
          {strings.notices[view.notice]}
        </p>
      )}
      <div class="hud-panel">
        <section class="hud-needs" aria-label={strings.needs}>
          <Meter icon="flame" label={strings.warmth} value={view.warmth} colour={warmthColour(view.warmth)} low={view.warmth <= LOW_NEED} />
          <Meter icon="berry" label={strings.hunger} value={view.needs.hunger} colour={HUNGER_COLOUR} low={view.needs.hunger <= LOW_NEED} />
          <Meter icon="droplet" label={strings.thirst} value={view.needs.thirst} colour={THIRST_COLOUR} low={view.needs.thirst <= LOW_NEED} />
          <Meter icon="moon" label={strings.fatigue} value={view.needs.fatigue} colour={FATIGUE_COLOUR} low={view.needs.fatigue <= LOW_NEED} />
          {view.sick && <p class="hud-hint">{strings.sick}</p>}
        </section>
        {view.action !== null && (
          <Meter icon={actionIcons[view.action.kind]} label={actionLabels[view.action.kind]} value={view.action.progress} colour={WORK_BAR_COLOUR} />
        )}
        <div class="hud-buttons">
          <HudButton icon={view.paused ? "play" : "pause"} label={view.paused ? strings.resume : strings.pause} onClick={() => {
              client.send({ type: "setPaused", paused: !view.paused });
            }} />
          {!placingCampfire && <HudButton icon="place" label={strings.placeCampfire(view.campfireStickCost)} onClick={onPlaceCampfire} />}
          {(view.backpack.bedroll ?? 0) > 0 && (
            <HudButton icon="place" label={strings.layBedroll} onClick={() => {
                client.send({ type: "layBedroll" });
              }} />
          )}
        </div>
        {placingCampfire && <p class="hud-hint">{strings.placingCampfire}</p>}
        {view.carrying === "log" && (
          <section class="hud-section hud-carrying" aria-label={strings.carryingLog}>
            <h2>
              <HudIcon name="log" />
              {strings.carryingLog}
            </h2>
            <div class="hud-buttons">
              <HudButton label={strings.dropLog} onClick={() => {
                  client.send({ type: "dropLog" });
                }} />
              <HudButton icon="axe" label={strings.splitLog} onClick={() => {
                  client.send({ type: "splitLog" });
                }} />
            </div>
          </section>
        )}
        {view.nearbyCampfire !== null && <CampfirePanel client={client} view={view} campfire={view.nearbyCampfire} />}
        {view.nearbyBedroll !== null && <BedrollPanel client={client} bedroll={view.nearbyBedroll} />}
        <section class="hud-section hud-backpack" aria-label={strings.backpack}>
          <h2>
            <HudIcon name="backpack" />
            {strings.backpack}
            <span class="hud-backpack-weight">{strings.backpackWeight(view.backpackWeight, view.backpackWeightLimit)}</span>
          </h2>
          <ul>
            {backpackContents(view.backpack).map(([content, count]) => (
              <li key={content}>
                {strings.backpackContentCount(strings.backpackContents[content], count)}
                {isFood(content) && (
                  <HudButton label={strings.eat} onClick={() => {
                      client.send({ type: "eat", food: content });
                    }} />
                )}
              </li>
            ))}
          </ul>
        </section>
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
    </div>
  );
}

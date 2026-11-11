// The HUD, the "hud" asset in asset-manifest.json: a woodland panel over the scene. Built in code. Approved by the owner.
// Its look lives in the .hud rules of src/app/style.css. Its icons are in hud-icons.tsx. The backpack content icons, in backpack-icons.tsx, are the approved "backpack-icons" asset.
import { useEffect, useState } from "preact/hooks";
import type {
  BackpackContent, BedrollView, BlueprintView, CampfireView, Food, GameClient, GameView, StructureKind, WoodpileView, WoodpileWood,
} from "../sim/api";
import { strings } from "../strings";
import { BackpackIcon } from "./backpack-icons";
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
  /** Whether the build menu is open. */
  buildMenuOpen: boolean;
  /** The structure whose blueprint follows the mouse, or null while not placing one. */
  placing: StructureKind | null;
  /** Called when the player opens or closes the build menu. The menu is input state, not game state, so this is not a command. */
  onToggleBuildMenu: () => void;
  /** Called when the player picks a structure from the build menu. Its blueprint then follows the mouse. */
  onPickBuildEntry: (structure: StructureKind) => void;
}

/** The build menu: every structure the player can build, with its cost. Picking one puts its blueprint under the mouse. */
function BuildMenu({ entries, onPick }: { entries: GameView["buildMenu"]; onPick: (structure: StructureKind) => void }) {
  return (
    <section class="hud-section hud-build-menu" aria-label={strings.buildMenu.title}>
      <h2>
        <HudIcon name="place" />
        {strings.buildMenu.title}
      </h2>
      <ul>
        {entries.map(({ structure, cost }) => (
          <li key={structure}>
            <HudButton
              label={strings.buildMenu.structures[structure]}
              onClick={() => {
                onPick(structure);
              }}
            />
            <span class="hud-build-cost">{strings.buildMenu.cost(cost.map(({ material, count }) => strings.buildMenu.materials[material](count)))}</span>
          </li>
        ))}
      </ul>
      <p class="hud-hint">{strings.buildMenu.close}</p>
    </section>
  );
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
function HudButton({
  icon, label, disabled = false, onClick,
}: { icon?: HudIconName; label: string; disabled?: boolean; onClick: (event: MouseEvent) => void }) {
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
  const hasBark = (view.backpack.bark ?? 0) > 0;
  const hasFullPot = (view.backpack.potOfRiverWater ?? 0) > 0 || (view.backpack.potOfBoiledWater ?? 0) > 0;
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
        <HudButton icon="bark" label={strings.addBark} disabled={!hasBark} onClick={() => {
            client.send({ type: "addFuel", campfireId: campfire.id, fuel: "bark" });
          }} />
        {!campfire.lit && (
          <HudButton icon="flame" label={strings.lightCampfire} disabled={!campfire.canLight} onClick={() => {
              client.send({ type: "lightCampfire", campfireId: campfire.id });
            }} />
        )}
        {campfire.pot === null && (
          <HudButton icon="droplet" label={strings.putPotOnFire} disabled={!campfire.lit || !hasFullPot} onClick={() => {
              client.send({ type: "putPotOnFire", campfireId: campfire.id });
            }} />
        )}
      </div>
      {campfire.pot !== null && (
        <>
          {campfire.pot.water === "boiled" ? (
            <p class="hud-hint">{strings.potBoiled}</p>
          ) : (
            <Meter icon="droplet" label={strings.potBoiling} value={campfire.pot.boilProgress} colour={THIRST_COLOUR} />
          )}
          <div class="hud-buttons">
            <HudButton icon="backpack" label={strings.takePotOffFire} onClick={() => {
                client.send({ type: "takePotOffFire", campfireId: campfire.id });
              }} />
          </div>
        </>
      )}
    </section>
  );
}

/** The kinds of wood a woodpile holds, in the order the woodpile panel lists them. */
const WOODPILE_WOODS: readonly WoodpileWood[] = ["log", "debarkedLog", "firewood"];

/**
 * Shows how full the woodpile beside the player is and what it holds, with buttons to stack wood on it and take wood off.
 * A log or debarked log is stacked from the shoulder. Firewood is stacked from the backpack: one with a click, all that fit with a shift-click.
 */
function WoodpilePanel({ client, view, woodpile }: { client: GameClient; view: GameView; woodpile: WoodpileView }) {
  const full = woodpile.total >= woodpile.capacity;
  const canStack = (wood: WoodpileWood): boolean => !full && (wood === "firewood" ? (view.backpack.firewood ?? 0) > 0 : view.carrying === wood);
  const canTake = (wood: WoodpileWood): boolean => woodpile.contents[wood] > 0 && (wood === "firewood" || view.carrying === null);
  return (
    <section class="hud-section hud-woodpile" aria-label={strings.woodpile.title}>
      <h2>
        <HudIcon name="log" />
        {strings.woodpile.title}
        <span class="hud-tag">{strings.woodpile.count(woodpile.total, woodpile.capacity)}</span>
      </h2>
      <Meter icon="log" label={strings.woodpile.fill} value={woodpile.total / woodpile.capacity} colour={WORK_BAR_COLOUR} />
      <ul>
        {WOODPILE_WOODS.filter((wood) => woodpile.contents[wood] > 0).map((wood) => (
          <li key={wood}>{strings.woodpile.contents[wood](woodpile.contents[wood])}</li>
        ))}
      </ul>
      <div class="hud-buttons">
        {WOODPILE_WOODS.filter((wood) => wood === "firewood" || view.carrying === wood).map((wood) => (
          <HudButton key={`stack-${wood}`} label={strings.woodpile.stack[wood]} disabled={!canStack(wood)} onClick={(event) => {
              client.send({ type: "stackOnWoodpile", woodpileId: woodpile.id, wood, all: event.shiftKey });
            }} />
        ))}
        {WOODPILE_WOODS.map((wood) => (
          <HudButton key={`take-${wood}`} icon={wood === "firewood" ? "backpack" : "log"} label={strings.woodpile.take[wood]} disabled={!canTake(wood)} onClick={() => {
              client.send({ type: "takeFromWoodpile", woodpileId: woodpile.id, wood });
            }} />
        ))}
      </div>
      <p class="hud-hint">{strings.woodpile.stackAllHint}</p>
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

/** Shows the blueprint beside the player: how many of each carried material it has and needs, and how to go on. */
function BlueprintPanel({ blueprint }: { blueprint: BlueprintView }) {
  const name = strings.buildMenu.structures[blueprint.structure];
  const waiting = blueprint.deliveries.some(({ has, needs }) => has < needs);
  return (
    <section class="hud-section hud-blueprint" aria-label={strings.blueprint.title(name)}>
      <h2>
        <HudIcon name="place" />
        {strings.blueprint.title(name)}
      </h2>
      <ul>
        {blueprint.deliveries.map(({ material, has, needs }) => (
          <li key={material}>{strings.blueprint.deliveries[material](has, needs)}</li>
        ))}
      </ul>
      <p class="hud-hint">{waiting ? strings.blueprint.deliverHint : strings.blueprint.buildHint}</p>
    </section>
  );
}

const actionLabels = {
  chop: strings.chopping,
  split: strings.splitting,
  debark: strings.debarking,
  build: strings.building,
  takeDown: strings.takingDown,
} as const;

const actionIcons: Record<keyof typeof actionLabels, HudIconName> = { chop: "axe", split: "axe", debark: "bark", build: "campfire", takeDown: "axe" };

/** The colour of the bar for timed work, such as chopping. */
const WORK_BAR_COLOUR = "#d9c48a";

export function Hud({ client, buildMenuOpen, placing, onToggleBuildMenu, onPickBuildEntry }: HudProps) {
  const [view, setView] = useState(client.getView());
  useEffect(
    () =>
      client.subscribe(() => {
        setView(client.getView());
      }),
    [client],
  );

  const hasContext =
    view.action !== null ||
    buildMenuOpen ||
    placing !== null ||
    view.carrying !== null ||
    view.nearbyCampfire !== null ||
    view.nearbyBedroll !== null ||
    view.nearbyWoodpile !== null ||
    view.nearbyBlueprint !== null;

  return (
    <>
      {(view.paused || view.raining || view.notice !== null) && (
        <div class="hud-banners">
          {view.paused && <p class="hud-banner hud-paused">{strings.paused}</p>}
          {view.raining && <p class="hud-banner hud-raining">{strings.raining}</p>}
          {view.notice !== null && (
            <p class="hud-banner hud-notice" role="status">
              {strings.notices[view.notice]}
            </p>
          )}
        </div>
      )}
      {hasContext && (
        <div class="hud-context">
          <div class="hud-panel">
            {view.action !== null && (
              <Meter icon={actionIcons[view.action.kind]} label={actionLabels[view.action.kind]} value={view.action.progress} colour={WORK_BAR_COLOUR} />
            )}
            {buildMenuOpen && <BuildMenu entries={view.buildMenu} onPick={onPickBuildEntry} />}
            {placing !== null && (
              <p class="hud-hint">
                {placing === "logWall" || placing === "doorFrame"
                  ? strings.buildMenu.placingOnEdge(strings.buildMenu.structures[placing])
                  : placing === "roof"
                    ? strings.buildMenu.placingRoof(strings.buildMenu.structures[placing])
                    : strings.buildMenu.placing(strings.buildMenu.structures[placing])}
              </p>
            )}
            {view.carrying !== null && (
              <section class="hud-section hud-carrying" aria-label={view.carrying === "log" ? strings.carryingLog : strings.carryingDebarkedLog}>
                <h2>
                  <HudIcon name="log" />
                  {view.carrying === "log" ? strings.carryingLog : strings.carryingDebarkedLog}
                </h2>
                <div class="hud-buttons">
                  <HudButton label={strings.dropLog} onClick={() => {
                      client.send({ type: "dropLog" });
                    }} />
                  {view.carrying === "log" && (
                    <HudButton icon="axe" label={strings.splitLog} onClick={() => {
                        client.send({ type: "splitLog" });
                      }} />
                  )}
                </div>
              </section>
            )}
            {view.nearbyCampfire !== null && <CampfirePanel client={client} view={view} campfire={view.nearbyCampfire} />}
            {view.nearbyWoodpile !== null && <WoodpilePanel client={client} view={view} woodpile={view.nearbyWoodpile} />}
            {view.nearbyBedroll !== null && <BedrollPanel client={client} bedroll={view.nearbyBedroll} />}
            {view.nearbyBlueprint !== null && <BlueprintPanel blueprint={view.nearbyBlueprint} />}
          </div>
        </div>
      )}
      <div class="hud">
        <div class="hud-panel">
          <section class="hud-needs" aria-label={strings.needs}>
            <Meter icon="flame" label={strings.warmth} value={view.warmth} colour={warmthColour(view.warmth)} low={view.warmth <= LOW_NEED} />
            <Meter icon="berry" label={strings.hunger} value={view.needs.hunger} colour={HUNGER_COLOUR} low={view.needs.hunger <= LOW_NEED} />
            <Meter icon="droplet" label={strings.thirst} value={view.needs.thirst} colour={THIRST_COLOUR} low={view.needs.thirst <= LOW_NEED} />
            <Meter icon="moon" label={strings.fatigue} value={view.needs.fatigue} colour={FATIGUE_COLOUR} low={view.needs.fatigue <= LOW_NEED} />
            {view.sick && <p class="hud-hint">{strings.sick}</p>}
          </section>
          <div class="hud-buttons">
            <HudButton icon={view.paused ? "play" : "pause"} label={view.paused ? strings.resume : strings.pause} onClick={() => {
                client.send({ type: "setPaused", paused: !view.paused });
              }} />
            <HudButton icon="place" label={strings.buildMenu.open} disabled={placing !== null} onClick={onToggleBuildMenu} />
          </div>
          <section class="hud-section hud-backpack" aria-label={strings.backpack}>
            <h2>
              <HudIcon name="backpack" />
              {strings.backpack}
              <span class="hud-backpack-weight">{strings.backpackWeight(view.backpackWeight, view.backpackWeightLimit)}</span>
            </h2>
            <ul>
              {backpackContents(view.backpack).map(([content, count]) => (
                <li key={content} data-tip={strings.backpackContents[content]}>
                  <BackpackIcon content={content} />
                  <span class="hud-sr-only">{strings.backpackContentCount(strings.backpackContents[content], count)}</span>
                  {count > 1 && (
                    <span class="hud-backpack-count" aria-hidden="true">
                      {strings.backpackCountBadge(count)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <div class="hud-buttons">
              {backpackContents(view.backpack)
                .map(([content]) => content)
                .filter(isFood)
                .map((food) => (
                  <button
                    key={food}
                    type="button"
                    class="hud-button"
                    aria-label={strings.eatFood(strings.backpackContents[food])}
                    onClick={() => {
                      client.send({ type: "eat", food });
                    }}
                  >
                    <BackpackIcon content={food} />
                    {strings.eat}
                  </button>
                ))}
              {(view.backpack.bedroll ?? 0) > 0 && (
                <HudButton icon="place" label={strings.layBedroll} onClick={() => {
                    client.send({ type: "layBedroll" });
                  }} />
              )}
              {(view.backpack.pot ?? 0) > 0 && (
                <HudButton icon="droplet" label={strings.fillPot} onClick={() => {
                    client.send({ type: "fillPot" });
                  }} />
              )}
              {((view.backpack.potOfRiverWater ?? 0) > 0 || (view.backpack.potOfBoiledWater ?? 0) > 0) && (
                <HudButton icon="droplet" label={strings.drinkFromPot} onClick={() => {
                    client.send({ type: "drinkFromPot" });
                  }} />
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

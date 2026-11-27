// The panels under the work for the things within the player's reach: campfire, woodpile, pile, blueprint, rain barrel, drying rack, wood box.
import type { WoodpileWood } from "../sim/api";
import type { BlueprintView, CampfireView, DryingRackView, NearbyThing, PileView, RainBarrelView, WoodBoxView, WoodpileView } from "../sim/api-nearby";
import { strings } from "../strings";
import { BackpackIcon } from "./backpack-icons";
import { HudIcon } from "./hud-icons";
import { Meter, THIRST_COLOUR, WARM_RGB, WORK_BAR_COLOUR } from "./hud-meters";

/** The colour of the bar that shows how far a fish on the fire has cooked: the browned skin of cooked fish. */
const COOKING_COLOUR = "#c98a4b";

/** One fish on a campfire: its icon, raw or cooked, and a bar for how far it has cooked. */
function FishOnFireMeter({ fish }: { fish: CampfireView["fish"][number] }) {
  return (
    <label class="hud-meter" style={{ "--hud-bar": COOKING_COLOUR }}>
      <BackpackIcon content={fish.cooked ? "cookedFish" : "rawFish"} />
      <span class="hud-meter-label">{fish.cooked ? strings.fishCooked : strings.fishCooking}</span>
      <progress max={1} value={fish.cookProgress} />
    </label>
  );
}

/** The colour of the bar that shows how far the jug on the fire has fired: the orange-brown of fired clay. */
const FIRING_COLOUR = "#b0603c";

/** The jug on a campfire: its icon, unfired or fired, and a bar for how far it has fired. */
function JugOnFireMeter({ jug }: { jug: NonNullable<CampfireView["jug"]> }) {
  return (
    <label class="hud-meter" style={{ "--hud-bar": FIRING_COLOUR }}>
      <BackpackIcon content={jug.fired ? "jug" : "unfiredJug"} />
      <span class="hud-meter-label">{jug.fired ? strings.jugFired : strings.jugFiring}</span>
      <progress max={1} value={jug.fireProgress} />
    </label>
  );
}

/**
 * Shows whether the campfire or fireplace beside the player burns, how much fuel it has, how far the pot on it has boiled,
 * how far each fish on it has cooked, and how far the jug on it has fired. Its actions are on the campfire or fireplace itself.
 */
function CampfirePanel({ campfire }: { campfire: CampfireView }) {
  const title = campfire.kind === "fireplace" ? strings.fireplace : strings.campfire;
  return (
    <section class="hud-section hud-campfire" aria-label={title}>
      <h2>
        <HudIcon name="campfire" />
        {title}
        <span class={campfire.lit ? "hud-tag hud-tag-lit" : "hud-tag"}>{campfire.lit ? strings.campfireLit : strings.campfireUnlit}</span>
      </h2>
      <Meter icon="flame" label={strings.campfireFuel} value={campfire.fuelLeft} colour={`rgb(${WARM_RGB.join(" ")})`} />
      {campfire.pot !== null &&
        (campfire.pot.water === "boiled" ? (
          <p class="hud-hint">{strings.potBoiled}</p>
        ) : (
          <Meter icon="droplet" label={strings.potBoiling} value={campfire.pot.boilProgress} colour={THIRST_COLOUR} />
        ))}
      {campfire.fish.map((fish, index) => (
        <FishOnFireMeter key={index} fish={fish} />
      ))}
      {campfire.jug !== null && <JugOnFireMeter jug={campfire.jug} />}
    </section>
  );
}

/** The kinds of wood a woodpile holds, in the order the woodpile panel lists them. */
const WOODPILE_WOODS: readonly WoodpileWood[] = ["log", "debarkedLog", "firewood"];

/** Shows how full the woodpile beside the player is and what it holds. Its actions are on the woodpile itself. */
function WoodpilePanel({ woodpile }: { woodpile: WoodpileView }) {
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
    </section>
  );
}

/** Shows how many drinks of clean water the rain barrel beside the player holds, and whether a roof keeps the rain off it. */
function RainBarrelPanel({ barrel }: { barrel: RainBarrelView }) {
  const text = strings.rainBarrel;
  return (
    <section class="hud-section hud-rain-barrel" aria-label={text.title}>
      <h2>
        <HudIcon name="droplet" />
        {text.title}
        <span class="hud-tag">{text.count(barrel.drinks, barrel.limit)}</span>
      </h2>
      <Meter icon="droplet" label={text.fill} value={barrel.drinks / barrel.limit} colour={THIRST_COLOUR} />
      {barrel.underRoof && <p class="hud-hint">{text.underRoof}</p>}
    </section>
  );
}

/** The colour of the bar that shows how far a food on the rack has dried: the brown of dried food. */
const DRYING_COLOUR = "#9a6a3c";

/** What the rack's panel says about one food: drying or smoking, dried or smoked, or raw fish that needs a lit fire close by. */
function foodOnRackLabel(item: DryingRackView["food"][number]): string {
  const text = strings.dryingRack;
  if (item.waitsForFire) return text.noFire;
  const smoked = item.food === "rawFish";
  if (item.preserved) return smoked ? text.smoked : text.dried;
  return smoked ? text.smoking : text.drying;
}

/** One food on a drying rack: its icon, fresh or preserved, and a bar for how far it has dried or smoked. */
function FoodOnRackMeter({ item }: { item: DryingRackView["food"][number] }) {
  return (
    <label class="hud-meter" style={{ "--hud-bar": DRYING_COLOUR }}>
      <BackpackIcon content={item.content} />
      <span class="hud-meter-label">{foodOnRackLabel(item)}</span>
      <progress max={1} value={item.progress} />
    </label>
  );
}

/** Shows what hangs on the drying rack beside the player and how far each food has dried or smoked. Its actions are on the rack itself. */
function DryingRackPanel({ rack }: { rack: DryingRackView }) {
  const text = strings.dryingRack;
  return (
    <section class="hud-section hud-drying-rack" aria-label={text.title}>
      <h2>
        <BackpackIcon content="driedBerries" />
        {text.title}
        <span class="hud-tag">{text.count(rack.food.length, rack.limit)}</span>
      </h2>
      {rack.food.length === 0 ? <p class="hud-hint">{text.empty}</p> : rack.food.map((item, index) => <FoodOnRackMeter key={index} item={item} />)}
    </section>
  );
}

/** Shows how much firewood the wood box beside the player holds. A fire in the same room takes its firewood first. */
function WoodBoxPanel({ box }: { box: WoodBoxView }) {
  const text = strings.woodBox;
  return (
    <section class="hud-section hud-wood-box" aria-label={text.title}>
      <h2>
        <HudIcon name="log" />
        {text.title}
        <span class="hud-tag">{text.count(box.firewood, box.limit)}</span>
      </h2>
      <Meter icon="log" label={text.fill} value={box.firewood / box.limit} colour={WORK_BAR_COLOUR} />
    </section>
  );
}

/** Shows what the pile beside the player holds and how many. A click on the pile picks it up. */
function PilePanel({ pile }: { pile: PileView }) {
  return (
    <section class="hud-section hud-pile" aria-label={strings.pile.title}>
      <h2>
        <BackpackIcon content={pile.content} />
        {strings.pile.holds(pile.content, pile.count)}
      </h2>
    </section>
  );
}

/** Shows the blueprint beside the player: how many of each carried material it has and needs, and how to go on. */
function BlueprintPanel({ blueprint }: { blueprint: BlueprintView }) {
  const name = strings.buildMenu.structures[blueprint.structure];
  const waiting = blueprint.deliveries.find(({ has, needs }) => has < needs);
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
      <p class="hud-hint">
        {waiting === undefined || blueprint.lacks === null ? strings.blueprint.buildHint : strings.blueprint.deliverHint[waiting.material]}
      </p>
    </section>
  );
}

/**
 * A thing within reach that shows a panel under the work. The open chest shows beside the backpack instead.
 * A laid bedroll has no status to show, so it has no panel. Its actions are on the bedroll itself.
 */
export type PanelThing = Exclude<NearbyThing, { kind: "openChest" | "bedroll" }>;

export function hasPanel(thing: NearbyThing): thing is PanelThing {
  return thing.kind !== "openChest" && thing.kind !== "bedroll";
}

/** The panel for one thing within the player's reach, by its kind. TypeScript reports a kind with no panel. */
export function NearbyPanel({ thing }: { thing: PanelThing }) {
  switch (thing.kind) {
    case "campfire":
      return <CampfirePanel campfire={thing.view} />;
    case "woodpile":
      return <WoodpilePanel woodpile={thing.view} />;
    case "pile":
      return <PilePanel pile={thing.view} />;
    case "blueprint":
      return <BlueprintPanel blueprint={thing.view} />;
    case "rainBarrel":
      return <RainBarrelPanel barrel={thing.view} />;
    case "dryingRack":
      return <DryingRackPanel rack={thing.view} />;
    case "woodBox":
      return <WoodBoxPanel box={thing.view} />;
  }
}

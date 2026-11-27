import { kilogramsText, hoursText } from "./text";
import { type BackpackContent } from "../sim/api";

/** How many of each kind of thing a pile holds, in words. */
const PILE_HOLDS: Readonly<Record<BackpackContent, (count: number) => string>> = {
  axe: (count) => (count === 1 ? "An axe" : `${count} axes`),
  knife: (count) => (count === 1 ? "A knife" : `${count} knives`),
  drawknife: (count) => (count === 1 ? "A drawknife" : `${count} drawknives`),
  steelAndFlint: (count) => (count === 1 ? "A steel and flint" : `${count} sets of steel and flint`),
  bedroll: (count) => (count === 1 ? "A rolled-up bedroll" : `${count} rolled-up bedrolls`),
  stick: (count) => (count === 1 ? "1 stick" : `${count} sticks`),
  firewood: (count) => (count === 1 ? "1 piece of firewood" : `${count} pieces of firewood`),
  bark: (count) => (count === 1 ? "1 piece of bark" : `${count} pieces of bark`),
  stone: (count) => (count === 1 ? "1 stone" : `${count} stones`),
  clay: (count) => (count === 1 ? "1 clay" : `${count} clay`),
  unfiredJug: (count) => (count === 1 ? "1 unfired jug" : `${count} unfired jugs`),
  jug: (count) => (count === 1 ? "1 empty jug" : `${count} empty jugs`),
  jugWith1Drink: (count) => (count === 1 ? "1 jug with 1 drink" : `${count} jugs with 1 drink`),
  jugWith2Drinks: (count) => (count === 1 ? "1 jug with 2 drinks" : `${count} jugs with 2 drinks`),
  jugWith3Drinks: (count) => (count === 1 ? "1 jug with 3 drinks" : `${count} jugs with 3 drinks`),
  torch: (count) => (count === 1 ? "1 torch" : `${count} torches`),
  cord: (count) => (count === 1 ? "1 cord" : `${count} cords`),
  fishTrap: (count) => (count === 1 ? "1 fish trap" : `${count} fish traps`),
  sapling: (count) => (count === 1 ? "1 sapling" : `${count} saplings`),
  berryBush: (count) => (count === 1 ? "1 berry bush" : `${count} berry bushes`),
  berries: (count) => (count === 1 ? "1 handful of berries" : `${count} handfuls of berries`),
  mushroom: (count) => (count === 1 ? "1 mushroom" : `${count} mushrooms`),
  pot: () => "An empty pot",
  potOfRiverWater: () => "A pot of river water",
  potOfBoiledWater: () => "A pot of clean water",
  sawBlade: (count) => (count === 1 ? "A saw blade" : `${count} saw blades`),
  saw: (count) => (count === 1 ? "A saw" : `${count} saws`),
  plank: (count) => (count === 1 ? "1 plank" : `${count} planks`),
  fishingLine: (count) => (count === 1 ? "A fishing line" : `${count} fishing lines`),
  fishingRod: (count) => (count === 1 ? "A fishing rod" : `${count} fishing rods`),
  rawFish: (count) => (count === 1 ? "1 raw fish" : `${count} raw fish`),
  cookedFish: (count) => (count === 1 ? "1 cooked fish" : `${count} cooked fish`),
  driedBerries: (count) => (count === 1 ? "1 handful of dried berries" : `${count} handfuls of dried berries`),
  driedMushroom: (count) => (count === 1 ? "1 dried mushroom" : `${count} dried mushrooms`),
  smokedFish: (count) => (count === 1 ? "1 smoked fish" : `${count} smoked fish`),
};

export const backpackText = {
  backpack: "Backpack",
  backpackContents: {
    axe: "Axe",
    knife: "Knife",
    drawknife: "Drawknife",
    steelAndFlint: "Steel and flint",
    bedroll: "Bedroll",
    stick: "Stick",
    firewood: "Firewood",
    bark: "Bark",
    stone: "Stone",
    clay: "Clay",
    unfiredJug: "Unfired jug",
    jug: "Empty jug",
    jugWith1Drink: "Jug with 1 drink",
    jugWith2Drinks: "Jug with 2 drinks",
    jugWith3Drinks: "Jug with 3 drinks",
    torch: "Torch",
    cord: "Cord",
    fishTrap: "Fish trap",
    sapling: "Sapling",
    berryBush: "Berry bush",
    pot: "Pot (empty)",
    potOfRiverWater: "Pot of river water",
    potOfBoiledWater: "Pot of clean water",
    berries: "Berries",
    mushroom: "Mushroom",
    sawBlade: "Saw blade",
    saw: "Saw",
    plank: "Plank",
    fishingLine: "Fishing line",
    fishingRod: "Fishing rod",
    rawFish: "Raw fish",
    cookedFish: "Cooked fish",
    driedBerries: "Dried berries",
    driedMushroom: "Dried mushroom",
    smokedFish: "Smoked fish",
  },
  chest: {
    title: "Chest",
    empty: "The chest is empty.",
    /** The full name of a chest cell, for screen readers. */
    take: (name: string) => `Take ${name.toLowerCase()} from the chest`,
    hint: "Click something in the backpack to put one in the chest. Click something in the chest to take one out. Shift-click moves all that fit.",
  },
  /** The chest panel, when the player has a shelf open. */
  shelf: {
    title: "Shelf",
    empty: "The shelf is empty.",
    /** The full name of a shelf cell, for screen readers. */
    take: (name: string) => `Take ${name.toLowerCase()} from the shelf`,
    hint: "Click something in the backpack to put one on the shelf. Click something on the shelf to take one off. Shift-click moves all that fit.",
  },
  pile: {
    title: "Pile",
    /** What a pile holds, such as "7 sticks". */
    holds: (content: BackpackContent, count: number) => PILE_HOLDS[content](count),
  },
  backpackContentCount: (name: string, count: number) => (count === 1 ? name : `${name} ×${count}`),
  /** The count shown in the corner of a backpack cell when the backpack holds more than one. */
  backpackCountBadge: (count: number) => `${count}`,
  /** The exact weight a weight ring shows when the player points at it, such as "5.5 of 20 kg". */
  weightOf: (kilograms: number, limitKilograms: number) => `${kilogramsText(kilograms)} of ${kilogramsText(limitKilograms)} kg`,
  /** The hotbar's cells: the backpack contents and the log on the shoulder. */
  hotbar: {
    /** The number key that uses a cell, shown in its corner. */
    key: (number: number) => `${number}`,
    /** The full name of a cell, for screen readers, such as "Berries ×3, key 2". `what` comes from `backpackContentCount`. */
    cell: (what: string, key: string | undefined) => (key === undefined ? what : `${what}, key ${key}`),
    /** The name of the shoulder cell for screen readers, such as "On your shoulder: Log". */
    shoulder: (name: string) => `On your shoulder: ${name}`,
    /** The name of the same cell when the player carries a plank or stone in both hands, such as "In your hands: Plank". */
    inHands: (name: string) => `In your hands: ${name}`,
    /**
     * The name of the sled cell, with how many log spaces the sled's load fills and how many it has, such as "Sled 4/6".
     * Each plank fills a quarter of a log space, so the load can be a fraction, such as "Sled 1.5/6".
     */
    sled: (total: number, capacity: number) => `Sled ${Number(total.toFixed(2))}/${capacity}`,
    /** The label above a backpack cell, with how much its contents weigh, such as "Plank ×5 · 10 kg". `what` comes from `backpackContentCount`. */
    nameWithWeight: (what: string, kilograms: number) => `${what} · ${kilogramsText(kilograms)} kg`,
    /** The name of the sled cell for screen readers, such as "Dragging: Sled 4/6". */
    dragging: (name: string) => `Dragging: ${name}`,
    /** The name of the cell for the lit torch in the player's hand. */
    litTorch: "Lit torch",
    /** The name of the lit torch cell for screen readers, such as "In your hand: Lit torch · 2 h 10 min left". */
    inHand: (what: string) => `In your hand: ${what}`,
    /** The label above the lit torch cell, with how long it still burns, such as "Lit torch · 2 h 10 min left". */
    burnsFor: (name: string, minutes: number) => `${name} · ${hoursText(minutes)} left`,
    /**
     * How long the oldest of a fresh food has left before it spoils, such as "Spoils in 14 h". Under an hour it gives minutes,
     * such as "Spoils in 40 min". Over an hour it gives whole hours, rounded up.
     */
    spoilsIn: (minutes: number) => `Spoils in ${minutes > 60 ? `${Math.ceil(minutes / 60)} h` : hoursText(minutes)}`,
    /** A backpack cell's label with how soon its food spoils, such as "Berries ×3 · 0.3 kg · Spoils in 14 h". */
    withSpoilsIn: (tip: string, spoilsIn: string) => `${tip} · ${spoilsIn}`,
  },
  /** The names of the logs the player can carry on their shoulder, as the hotbar shows them. */
  things: {
    log: "Log",
    debarkedLog: "Debarked log",
    plank: "Plank",
    stone: "Stone",
  },
} as const;

import { listText, capitalise } from "./text";
import { ACTION_QUEUE_LIMIT } from "../sim/api-commands";
import { type FreshFood, type Goal } from "../sim/api";
import { STATION_GROUND_METRES } from "../sim/crafting-recipes";
import { CAMPFIRE_STICK_COST, LEAN_TO_BARK_COST, LEAN_TO_STICK_COST, SAWHORSE_LOG_COST } from "../sim/structure-camp";
import { DRYING_RACK_CORD_COST, DRYING_RACK_STICK_COST } from "../sim/furniture/drying-rack";
import { DRY_MINUTES, SMOKE_MINUTES } from "../sim/rack-food";

/** How many of each fresh food spoiled, in words, for the notice that says so. */
const SPOILED: Readonly<Record<FreshFood, (count: number) => string>> = {
  berries: (count) => (count === 1 ? "1 handful of berries" : `${count} berries`),
  mushroom: (count) => (count === 1 ? "1 mushroom" : `${count} mushrooms`),
  rawFish: (count) => (count === 1 ? "1 raw fish" : `${count} raw fish`),
  cookedFish: (count) => (count === 1 ? "1 cooked fish" : `${count} cooked fish`),
};

export const noticesText = {
  notices: {
    survivedFirstNight: "You survived the night.",
    snugRoomKeepsOutCold: "This room now keeps out the cold. You lose warmth here at half the rate.",
    collapsed: "You collapsed. You woke the next morning.",
    backpackFull: "Your backpack is full.",
    chestFull: "The chest is full.",
    shelfFull: "The shelf is full.",
    holdsUpPiece: "Something stands on this. Take that down first.",
    stillHoldsSomething: "Something is still in this. Empty it first.",
    saveBroken: "Your saved game could not be loaded, so a new game has started.",
    putLogDownFirst: "Put the log down first.",
    letGoFirst: "Let go of the sled first.",
    fishGotAway: "A fish got away. Your backpack is full.",
    /** The player tried a station recipe with no debarked log beside the station, such as "Lay a debarked log within 2 m of the sawhorse first." */
    noLogBesideStation: (station: string) => `Lay a debarked log within ${STATION_GROUND_METRES} m of the ${station.toLowerCase()} first.`,
    /** The player tried a recipe they cannot follow yet, such as "This needs the saw first." */
    cannotCraftYet: (lacking: readonly string[]) => `This needs ${lacking.join(" and ")} first.`,
    /** Crafting finished, but some of the result did not fit in the backpack, such as "2 planks dropped beside the sawhorse." */
    droppedBesideStation: (what: string, station: string) => `${what} dropped beside the ${station.toLowerCase()}.`,
    cantGetThere: "You can't get to it from here.",
    queueFull: `You can line up at most ${ACTION_QUEUE_LIMIT} actions.`,
    /** The player tried to line up an action the game refuses now, such as "You cannot line that up: needs the axe." */
    cannotQueue: (reason: string) => `You cannot line that up: ${reason}.`,
    /** A lined-up action's turn came, but the game refused it, such as "Skipped the next action: the fire is full." */
    actionSkipped: (reason: string) => `Skipped the next action: ${reason}.`,
    /** The player sent an action the game refuses now, such as "You cannot do that: needs the fishing rod." */
    refused: (reason: string) => `You cannot do that: ${reason}.`,
    /** Fresh food kept its full time and is gone, such as "2 berries spoiled." or "2 berries and 1 raw fish spoiled." */
    foodSpoiled: (spoiled: readonly (readonly [FreshFood, number])[]) =>
      `${capitalise(listText(spoiled.map(([food, count]) => SPOILED[food](count))))} spoiled.`,
  },
  /** The journal of suggested goals, its panel, and the HUD line that names the next goal. */
  journal: {
    title: "Journal",
    /** The notice banner when the player does a goal for the first time, such as "Journal: campfire lit." */
    justDone: (done: string) => `Journal: ${done}.`,
    /** The key that opens and closes the journal panel. */
    key: "J",
    /** The HUD line that names the next goal, such as "Next (J): Light a campfire." */
    next: (goal: string) => `Next (J): ${goal}`,
    /** The heading over the goals not yet done. */
    toDo: "To do",
    /** The heading over the goals done. */
    done: "Done",
    hide: "Hide journal",
    close: "Close",
    /** The line the panel shows once every goal is done. */
    finished: "Your camp is yours now.",
    /** Each goal: what to do, one hint line that names the key and materials, and what the notice says once it is done. */
    goals: {
      pickUpSticks: {
        name: "Pick up sticks.",
        hint: "Sticks lie on the forest floor. Walk up to one and press E to pick it up.",
        done: "sticks picked up",
      },
      lightCampfire: {
        name: "Light a campfire.",
        hint: `Press B to build a campfire from ${CAMPFIRE_STICK_COST} sticks. Add a stick as fuel, then light it with the steel and flint.`,
        done: "campfire lit",
      },
      fellTree: {
        name: "Fell a tree.",
        hint: "Walk up to a tree and press E to chop it down with the axe.",
        done: "tree felled",
      },
      buildLeanTo: {
        name: "Build a lean-to.",
        hint: `Press B to build a lean-to from ${LEAN_TO_STICK_COST} sticks and ${LEAN_TO_BARK_COST} pieces of bark. Strip bark from a log with the drawknife.`,
        done: "lean-to built",
      },
      sleepOnBedroll: {
        name: "Sleep on a bedroll, anywhere.",
        hint: "Click the bedroll in your backpack to lay it down, then press E on it to sleep.",
        done: "slept on the bedroll",
      },
      cutPlank: {
        name: "Build a sawhorse and cut a plank.",
        hint: `Press B to build a sawhorse from ${SAWHORSE_LOG_COST} debarked logs. Press C to craft a saw, then cut a debarked log beside the sawhorse into planks.`,
        done: "first planks cut",
      },
      buildRoom: {
        name: "Build a first room.",
        hint: "Press B to lay foundations, close them in with log walls and a door frame, and put a roof frame over them. Then click each finished roof frame to lay the roof. Walls take debarked logs, and the roof takes planks.",
        done: "first room built",
      },
      makeRoomSnug: {
        name: "Make the room snug.",
        hint: "Press B to lay a plank floor on every square. Click the finished door frame to hang a door, and each finished window to hang shutters.",
        done: "the room is snug",
      },
      preserveFood: {
        name: "Preserve some food for winter.",
        hint: `Press B to build a drying rack from ${DRYING_RACK_STICK_COST} sticks and ${DRYING_RACK_CORD_COST} cords. Hang berries or mushrooms on it, and they dry in ${DRY_MINUTES / 60} hours. Hang raw fish on it beside a lit fire, and it smokes in ${SMOKE_MINUTES / 60} hours. Dried and smoked food never spoils.`,
        done: "first food preserved",
      },
    } satisfies Record<Goal, { name: string; hint: string; done: string }>,
  },
} as const;

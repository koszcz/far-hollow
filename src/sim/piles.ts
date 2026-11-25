import type { ApproachReach } from "./approach";
import { addToBackpack, countInBackpack, howManyFit, removeFromBackpack, type BackpackContent } from "./backpack";
import { entityWith, pileEntities, playerEntities, type Entity, type EntityStore } from "./entities";
import { standingHeightAt } from "./foundations";
import type { HandReach } from "./hand-reach";
import { type Terrain, type Valley } from "./valley";
import { groundDistance, nearestWithin, type GroundPoint } from "./ground-point";
import type { CommandRules, RuleGame } from "./command-rule";
import { putDown } from "./hand-reach";
import { addToPile, putInHolder, takeFromHolder, takeFromPile } from "./spoiling";

/** Things dropped this close to a pile of the same kind join it, in metres. */
export const JOIN_PILE_METRES = 1;
/** The player can pick up a pile from this far from its middle, in metres. */
const PICK_UP_REACH_METRES = 2;
/** How far apart dropped sticks lie, roughly, in metres. */
const DROPPED_STICK_SPACING_METRES = 0.12;
/** Dropped sticks lie no further than this from where they were dropped, in metres. */
const DROPPED_STICK_SPREAD_METRES = 0.9;
/** The turn between one dropped stick and the next, in radians, so they spread evenly round the spot. */
const GOLDEN_ANGLE_RADIANS = Math.PI * (3 - Math.sqrt(5));

/**
 * Where the `index`th of several sticks dropped at `spot` lies. The sticks spread out from the spot in a spiral,
 * so each lies apart from the others and all lie within 1 m of the spot.
 */
export function droppedStickSpot(spot: GroundPoint, index: number): GroundPoint {
  const distance = Math.min(DROPPED_STICK_SPREAD_METRES, DROPPED_STICK_SPACING_METRES * Math.sqrt(index));
  const angle = index * GOLDEN_ANGLE_RADIANS;
  return { x: spot.x + Math.cos(angle) * distance, z: spot.z + Math.sin(angle) * distance };
}

export type PileEntity = Entity & Required<Pick<Entity, "pile" | "position">>;

/** Why the player could not pick up a pile. */
export type PileRefusal = "backpackFull";

export interface Piles {
  /**
   * Drops all of one kind from the backpack at the player's feet, as one pile.
   * If a pile of the same kind lies within JOIN_PILE_METRES, they join that pile instead. Does nothing if the backpack holds none.
   * Sticks never form piles. Each one lies on the ground on its own, as a stick on the forest floor does.
   */
  drop(content: BackpackContent): void;
  /** Where the player walks to pick up a pile: onto it, or beside it if something blocks its spot. Undefined if the entity is not a pile. */
  reach(pileId: number): ApproachReach | undefined;
  /**
   * Has the player reach down for a pile within reach and put as much of it in the backpack as fits. The approach runs it once
   * they arrive. If none of it fits when the hand gets to it, the reach gives "backpackFull".
   */
  pickUp(pileId: number): void;
  /** The pile nearest the player that is within their reach, if any. */
  nearby(): PileEntity | undefined;
}

/**
 * Lets the player drop things from the backpack in piles on the ground, and pick them up again. Fresh food keeps its spoil times
 * as it moves. `now` reads the game minute on the clock.
 */
export function createPiles(entities: EntityStore, valley: Valley, hand: Pick<HandReach, "start">, now: () => number): Piles {
  const players = playerEntities(entities);
  const piles = pileEntities(entities);

  const pileById = (pileId: number): PileEntity | undefined => entityWith(entities, pileId, "pile", "position");

  /** The pile with this id, if it is within the player's reach. */
  function pileInReach(pileId: number, player: { position: GroundPoint }): PileEntity | undefined {
    const pile = pileById(pileId);
    return pile === undefined || groundDistance(pile.position, player.position) > PICK_UP_REACH_METRES ? undefined : pile;
  }

  return {
    drop(content) {
      for (const player of players) {
        if (player.backpack === undefined) continue;
        const count = countInBackpack(player.backpack, content);
        if (count === 0) continue;
        const spoilsAt = takeFromHolder(player.backpack, content, count, now());
        if (!removeFromBackpack(player.backpack, content, count)) continue;
        if (content === "stick") {
          for (let index = 0; index < count; index += 1) {
            const spot = droppedStickSpot(player.position, index);
            entities.add({ stick: true, position: { ...spot, y: standingHeightAt(entities, valley.terrain, spot) } });
          }
          continue;
        }
        addToPileAt(entities, valley.terrain, content, count, player.position, { spoilsAt, now: now() });
      }
    },
    reach(pileId) {
      const pile = pileById(pileId);
      return pile === undefined ? undefined : { target: pile.position, metres: PICK_UP_REACH_METRES, walk: { style: "onto", spot: pile.position } };
    },
    pickUp(pileId) {
      for (const picker of players) {
        const { backpack } = picker;
        const pile = pileInReach(pileId, picker);
        if (backpack === undefined || pile === undefined) continue;
        hand.start("low", pile.position, (): PileRefusal | undefined => {
          const still = pileInReach(pileId, picker);
          if (still === undefined) return undefined;
          const taken = howManyFit(backpack, still.pile.content, still.pile.count);
          if (taken === 0) return "backpackFull";
          putInHolder(backpack, still.pile.content, takeFromPile(still.pile, taken, now()), now());
          addToBackpack(backpack, still.pile.content, taken);
          still.pile.count -= taken;
          if (still.pile.count === 0) entities.remove(still);
          return undefined;
        });
      }
    },
    nearby() {
      const player = players.first;
      return player === undefined ? undefined : nearestWithin(player.position, piles, PICK_UP_REACH_METRES);
    },
  };
}

/**
 * Lays `count` of `content` on the ground at `spot`, as one pile.
 * If a pile of the same kind lies within JOIN_PILE_METRES of the spot, they join that pile instead.
 * For fresh food, `fresh` gives the spoil times of the food laid down, at game minute `now`. Food it does not cover gets its full keeping time.
 * Not for sticks, which never form piles.
 */
export function addToPileAt(
  entities: EntityStore,
  terrain: Terrain,
  content: BackpackContent,
  count: number,
  spot: GroundPoint,
  fresh?: { readonly spoilsAt: readonly number[]; readonly now: number },
): void {
  const near = nearestWithin(
    spot,
    pileEntities(entities).entities.filter((pile) => pile.pile.content === content),
    JOIN_PILE_METRES,
  );
  if (near !== undefined) {
    if (fresh !== undefined) addToPile(near.pile, fresh.spoilsAt, fresh.now);
    near.pile.count += count;
    return;
  }
  const { x, z } = spot;
  const pile: PileEntity["pile"] = { content, count: 0 };
  if (fresh !== undefined) addToPile(pile, fresh.spoilsAt, fresh.now);
  pile.count = count;
  entities.add({ pile, position: { x, y: standingHeightAt(entities, terrain, { x, z }), z } });
}

/** The rules for dropping things from the backpack into a pile and picking a pile up. */
export function pileRules(piles: Piles, { player, hand }: RuleGame): CommandRules<"dropFromBackpack" | "pickUpPile"> {
  return {
    dropFromBackpack: {
      start: "alongside",
      run: (command) => {
        if (countInBackpack(player.backpack, command.content) > 0)
          putDown(hand, () => {
            piles.drop(command.content);
          });
      },
    },
    pickUpPile: {
      start: "fresh",
      needsFreeHands: true,
      approach: {
        reach: (command) => piles.reach(command.pileId),
        act: (command) => {
          piles.pickUp(command.pileId);
        },
      },
    },
  };
}

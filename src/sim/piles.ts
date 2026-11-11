import { addToBackpack, countInBackpack, fitsInBackpack, removeFromBackpack, type Backpack, type BackpackContent } from "./backpack";
import { entityWith, pileEntities, playerEntities, setComponent, type Entity, type EntityStore } from "./entities";
import { standingHeightAt } from "./foundations";
import { groundDistance, nearestWithin, type GroundPoint, type Valley } from "./valley";
import type { Walking } from "./walking";

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
  /**
   * Sets the player walking to a pile to put as much of it in the backpack as fits.
   * Does nothing if the entity is not a pile. Returns "backpackFull", and does nothing, if none of it fits.
   */
  pickUp(pileId: number): PileRefusal | undefined;
  /** Stops the player walking to a pile. */
  cancel(): void;
  /** Picks up piles the player has reached. Returns "backpackFull" if none of a reached pile fit. Run it after walking has moved the player. */
  step(): PileRefusal | undefined;
  /** The pile nearest the player that is within their reach, if any. */
  nearby(): PileEntity | undefined;
}

/** Lets the player drop things from the backpack in piles on the ground, and pick them up again. */
export function createPiles(entities: EntityStore, walking: Walking, valley: Valley): Piles {
  const players = playerEntities(entities);
  const piles = pileEntities(entities);
  const pickers = entities.with("pileTask", "position", "backpack");

  const pileById = (pileId: number): PileEntity | undefined => entityWith(entities, pileId, "pile", "position");

  /** The nearest pile of `content` within JOIN_PILE_METRES of a spot, if any. */
  function nearestPileOf(content: BackpackContent, at: GroundPoint): PileEntity | undefined {
    return nearestWithin(at, piles.entities.filter((pile) => pile.pile.content === content), JOIN_PILE_METRES);
  }

  return {
    drop(content) {
      for (const player of players) {
        if (player.backpack === undefined) continue;
        const count = countInBackpack(player.backpack, content);
        if (count === 0 || !removeFromBackpack(player.backpack, content, count)) continue;
        if (content === "stick") {
          for (let index = 0; index < count; index += 1) {
            const spot = droppedStickSpot(player.position, index);
            entities.add({ stick: true, position: { ...spot, y: standingHeightAt(entities, valley.terrain, spot) } });
          }
          continue;
        }
        const near = nearestPileOf(content, player.position);
        if (near !== undefined) {
          near.pile.count += count;
          continue;
        }
        const { x, z } = player.position;
        entities.add({ pile: { content, count }, position: { x, y: standingHeightAt(entities, valley.terrain, { x, z }), z } });
      }
    },
    pickUp(pileId) {
      const pile = pileById(pileId);
      if (pile === undefined) return undefined;
      let refusal: PileRefusal | undefined;
      for (const player of players) {
        if (player.backpack === undefined) continue;
        if (howManyFit(player.backpack, pile.pile.content, pile.pile.count) === 0) {
          refusal = "backpackFull";
          continue;
        }
        walking.walkTo(pile.position);
        setComponent(entities, player, "pileTask", { pileId });
      }
      return refusal;
    },
    cancel() {
      for (const player of players) entities.removeComponent(player, "pileTask");
    },
    step() {
      let refusal: PileRefusal | undefined;
      // Copy the list first, because players who finish leave the query while it is being walked.
      for (const picker of [...pickers]) {
        if (picker.walkPath !== undefined) continue;
        const pile = pileById(picker.pileTask.pileId);
        entities.removeComponent(picker, "pileTask");
        if (pile === undefined || groundDistance(pile.position, picker.position) > PICK_UP_REACH_METRES) continue;
        const taken = howManyFit(picker.backpack, pile.pile.content, pile.pile.count);
        if (taken === 0) {
          refusal = "backpackFull";
          continue;
        }
        addToBackpack(picker.backpack, pile.pile.content, taken);
        pile.pile.count -= taken;
        if (pile.pile.count === 0) entities.remove(pile);
      }
      return refusal;
    },
    nearby() {
      const player = players.first;
      return player === undefined ? undefined : nearestWithin(player.position, piles, PICK_UP_REACH_METRES);
    },
  };
}

/** How many of `content`, up to `count`, fit in the backpack within its weight limit. */
function howManyFit(backpack: Backpack, content: BackpackContent, count: number): number {
  let fit = count;
  while (fit > 0 && !fitsInBackpack(backpack, content, fit)) fit -= 1;
  return fit;
}

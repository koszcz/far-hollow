import { addToBackpack, countInBackpack, howManyFit, removeFromBackpack, type BackpackContent } from "./backpack";
import { entityWith, pileEntities, playerEntities, setComponent, type Entity, type EntityStore } from "./entities";
import { standingHeightAt } from "./foundations";
import type { HandReach } from "./hand-reach";
import { groundDistance, nearestWithin, type GroundPoint, type Terrain, type Valley } from "./valley";
import { walkOntoOrWithinReach, type Walking } from "./walking";

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
   * Sets the player walking to a pile. Once there, they reach down and put as much of it in the backpack as fits.
   * Does nothing if the entity is not a pile. If none of it fits when the hand gets to it, the reach gives "backpackFull".
   */
  pickUp(pileId: number): void;
  /** Stops the player walking to a pile. */
  cancel(): void;
  /** Starts the player reaching for piles they have walked to. Run it after walking has moved the player. */
  step(): undefined;
  /** The pile nearest the player that is within their reach, if any. */
  nearby(): PileEntity | undefined;
}

/** Lets the player drop things from the backpack in piles on the ground, and pick them up again. */
export function createPiles(entities: EntityStore, walking: Walking, valley: Valley, hand: Pick<HandReach, "start">): Piles {
  const players = playerEntities(entities);
  const piles = pileEntities(entities);
  const pickers = entities.with("pileTask", "position", "backpack");

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
        if (count === 0 || !removeFromBackpack(player.backpack, content, count)) continue;
        if (content === "stick") {
          for (let index = 0; index < count; index += 1) {
            const spot = droppedStickSpot(player.position, index);
            entities.add({ stick: true, position: { ...spot, y: standingHeightAt(entities, valley.terrain, spot) } });
          }
          continue;
        }
        addToPileAt(entities, valley.terrain, content, count, player.position);
      }
    },
    pickUp(pileId) {
      const pile = pileById(pileId);
      if (pile === undefined) return;
      for (const player of players) {
        if (player.backpack === undefined) continue;
        walkOntoOrWithinReach(walking, pile.position, pile.position, PICK_UP_REACH_METRES);
        setComponent(entities, player, "pileTask", { pileId });
      }
    },
    cancel() {
      for (const player of players) entities.removeComponent(player, "pileTask");
    },
    step() {
      // Copy the list first, because players who finish leave the query while it is being walked.
      for (const picker of [...pickers]) {
        if (picker.walkPath !== undefined) continue;
        const { pileId } = picker.pileTask;
        entities.removeComponent(picker, "pileTask");
        const pile = pileInReach(pileId, picker);
        if (pile === undefined) continue;
        hand.start("low", pile.position, (): PileRefusal | undefined => {
          const still = pileInReach(pileId, picker);
          if (still === undefined) return undefined;
          const taken = howManyFit(picker.backpack, still.pile.content, still.pile.count);
          if (taken === 0) return "backpackFull";
          addToBackpack(picker.backpack, still.pile.content, taken);
          still.pile.count -= taken;
          if (still.pile.count === 0) entities.remove(still);
          return undefined;
        });
      }
      return undefined;
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
 * Not for sticks, which never form piles.
 */
export function addToPileAt(entities: EntityStore, terrain: Terrain, content: BackpackContent, count: number, spot: GroundPoint): void {
  const near = nearestWithin(
    spot,
    pileEntities(entities).entities.filter((pile) => pile.pile.content === content),
    JOIN_PILE_METRES,
  );
  if (near !== undefined) {
    near.pile.count += count;
    return;
  }
  const { x, z } = spot;
  entities.add({ pile: { content, count }, position: { x, y: standingHeightAt(entities, terrain, { x, z }), z } });
}

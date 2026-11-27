// Wood boxes: the player putting firewood in a wood box and taking it out again, and a fire taking its firewood from one.
// When the player adds firewood to a campfire or fireplace, the fire takes it from the wood box nearest it in the same room,
// before the backpack. A wood box never fuels a fire on its own. A box whose room breaks keeps its firewood, but serves
// no fire until the room is whole again. Rooms are worked out each time, so nothing here has to follow them.
import type { PlainNotice } from "./api-notice";
import type { Refusal } from "./api-refusal";
import type { WoodBoxView } from "./api-nearby";
import type { ApproachReach } from "./approach";
import { addToBackpack, countInBackpack, fitsInBackpack, howManyFit, removeFromBackpack, type Backpack } from "./backpack";
import { isOnGridSquare, snapToGridSquare } from "./build-grid";
import type { CommandRules, RuleGame } from "./command-rule";
import { entityWith, type Entity, type EntityStore } from "./entities";
import { playerEntities } from "./entity-queries";
import { WOOD_BOX_FIREWOOD_LIMIT, WOOD_BOX_REACH_METRES, WOOD_BOX_STAND_METRES } from "./furniture/wood-box";
import { groundDistance, nearestWithin, type GroundPoint } from "./ground-point";
import { goneRefusal } from "./refusals";
import { roomAround, type Room } from "./rooms";

/** A finished wood box, standing somewhere, with its firewood. */
type WoodBoxEntity = Entity & Required<Pick<Entity, "furniture" | "position" | "woodBox">>;

/** How many more pieces of firewood a wood box holding this many has room for. */
export function woodBoxRoom(firewood: number): number {
  return Math.max(0, WOOD_BOX_FIREWOOD_LIMIT - firewood);
}

/** Every finished wood box. */
function woodBoxes(entities: EntityStore): WoodBoxEntity[] {
  return entities.with("furniture", "position", "woodBox").entities.filter((piece) => piece.furniture === "woodBox");
}

/** Whether a wood box stands in this room. A box goes only wholly inside a room, so its middle is on one of the room's squares. */
function standsIn(box: WoodBoxEntity, room: Room): boolean {
  return room.some((square) => isOnGridSquare(square, box.position));
}

/**
 * The wood box a fire at this spot takes its next piece of firewood from: of the boxes in the fire's room that hold firewood,
 * the one nearest the fire. Undefined if the fire is in no room, or no box in its room holds firewood.
 */
function woodBoxFeedingFire(entities: EntityStore, fire: GroundPoint): WoodBoxEntity | undefined {
  const room = roomAround(entities, snapToGridSquare(fire));
  if (room === undefined) return undefined;
  let nearest: WoodBoxEntity | undefined;
  for (const box of woodBoxes(entities)) {
    if (box.woodBox.firewood <= 0 || !standsIn(box, room)) continue;
    if (nearest === undefined || groundDistance(box.position, fire) < groundDistance(nearest.position, fire)) nearest = box;
  }
  return nearest;
}

/** A wood box and the player's backpack, which the player moves firewood between. */
interface Move {
  readonly box: WoodBoxEntity;
  readonly backpack: Backpack;
}

/** Why the player could not make a move between this wood box and this backpack, given that the box still stands. */
type MoveRule = (box: WoodBoxEntity, backpack: Backpack) => Refusal | undefined;

/** Putting firewood in needs firewood in the backpack and room in the box. */
const putInRule: MoveRule = (box, backpack) => {
  if (countInBackpack(backpack, "firewood") <= 0) return { kind: "noContent", content: "firewood" };
  return woodBoxRoom(box.woodBox.firewood) <= 0 ? { kind: "woodBoxFull" } : undefined;
};

/** Taking firewood out needs firewood in the box and room in the backpack for one more. */
const takeRule: MoveRule = (box, backpack) => {
  if (box.woodBox.firewood <= 0) return { kind: "woodBoxEmpty" };
  return fitsInBackpack(backpack, "firewood", 1) ? undefined : { kind: "backpackFull" };
};

export interface WoodBoxes {
  /** Where the player walks to use a finished wood box: beside it, on their own side. Undefined if the entity is not one. */
  reach(woodBoxId: number): ApproachReach | undefined;
  /** Why the player could not put firewood in the box, wherever they stand: it is gone or full, or the backpack holds no firewood. */
  putInRefusal(woodBoxId: number): Refusal | undefined;
  /** Why the player could not take firewood from the box, wherever they stand: it is gone or empty, or no firewood fits in the backpack. */
  takeRefusal(woodBoxId: number): Refusal | undefined;
  /** Moves one firewood from the backpack into the box, or with `all` as many as fit. Does nothing if the refusal does not pass. */
  putIn(woodBoxId: number, all: boolean): PlainNotice | undefined;
  /** Moves as much of the box's firewood into the backpack as fits. Returns a notice if none fits. */
  take(woodBoxId: number): PlainNotice | undefined;
  /**
   * The entity id of the wood box a fire at this spot takes its next piece of firewood from: of the boxes in the fire's room
   * that hold firewood, the one nearest the fire. Undefined if the fire is in no room, or no box in its room holds firewood.
   */
  woodBoxFeedingFire(fire: GroundPoint): number | undefined;
  /** Takes one piece of firewood out of the wood box, for a fire. Does nothing if the box is gone or empty. */
  takeOneForFire(woodBoxId: number): void;
  /** The wood box nearest the player that is within their reach, if any, as the HUD shows it. */
  nearby(): WoodBoxView | undefined;
}

/** Lets the player keep firewood in wood boxes. */
export function createWoodBoxes(entities: EntityStore): WoodBoxes {
  const players = playerEntities(entities);

  const boxById = (woodBoxId: number): WoodBoxEntity | undefined => {
    const box = entityWith(entities, woodBoxId, "furniture", "position", "woodBox");
    return box?.furniture === "woodBox" ? box : undefined;
  };

  /** The player's backpack. A player with no backpack is treated as one whose backpack holds nothing. */
  const backpackOf = (): Backpack => players.first?.backpack ?? { contents: {} };

  /**
   * Checks one move between the wood box and the backpack against its rule: why the game refuses it, or else the move to make.
   * Gives neither if the entity is not a wood box, or the player has no backpack to move firewood into or out of.
   */
  function check(woodBoxId: number, rule: MoveRule): { readonly refusal?: Refusal; readonly move?: Move } {
    const gone = goneRefusal(entities, woodBoxId);
    if (gone !== undefined) return { refusal: gone };
    const box = boxById(woodBoxId);
    if (box === undefined) return {};
    const refusal = rule(box, backpackOf());
    if (refusal !== undefined) return { refusal };
    const backpack = players.first?.backpack;
    return backpack === undefined ? {} : { move: { box, backpack } };
  }

  return {
    reach(woodBoxId) {
      const box = boxById(woodBoxId);
      if (box === undefined) return undefined;
      return { target: box.position, metres: WOOD_BOX_REACH_METRES, walk: { style: "beside", standMetres: WOOD_BOX_STAND_METRES } };
    },
    putInRefusal: (woodBoxId) => check(woodBoxId, putInRule).refusal,
    takeRefusal: (woodBoxId) => check(woodBoxId, takeRule).refusal,
    putIn(woodBoxId, all) {
      const { move } = check(woodBoxId, putInRule);
      if (move === undefined) return undefined;
      const { box, backpack } = move;
      const moved = Math.min(all ? countInBackpack(backpack, "firewood") : 1, woodBoxRoom(box.woodBox.firewood));
      if (removeFromBackpack(backpack, "firewood", moved)) box.woodBox = { firewood: box.woodBox.firewood + moved };
      return undefined;
    },
    take(woodBoxId) {
      const { move } = check(woodBoxId, takeRule);
      if (move === undefined) return undefined;
      const { box, backpack } = move;
      const moved = howManyFit(backpack, "firewood", box.woodBox.firewood);
      if (moved <= 0 || !addToBackpack(backpack, "firewood", moved)) return "backpackFull";
      box.woodBox = { firewood: box.woodBox.firewood - moved };
      return undefined;
    },
    woodBoxFeedingFire(fire) {
      const box = woodBoxFeedingFire(entities, fire);
      return box === undefined ? undefined : entities.id(box);
    },
    takeOneForFire(woodBoxId) {
      const box = boxById(woodBoxId);
      if (box !== undefined) box.woodBox = { firewood: Math.max(0, box.woodBox.firewood - 1) };
    },
    nearby() {
      const player = players.first;
      const nearest = player === undefined ? undefined : nearestWithin(player.position, woodBoxes(entities), WOOD_BOX_REACH_METRES);
      const id = nearest === undefined ? undefined : entities.id(nearest);
      if (nearest === undefined || id === undefined) return undefined;
      return Object.freeze({ id, firewood: nearest.woodBox.firewood, limit: WOOD_BOX_FIREWOOD_LIMIT });
    },
  };
}

/** The rules for putting firewood in a wood box and taking it out. The player reaches into the box at waist height to do either. */
export function woodBoxRules(boxes: WoodBoxes, { entities, hand }: RuleGame): CommandRules<"putInWoodBox" | "takeFromWoodBox"> {
  const reachInto = (woodBoxId: number, act: () => PlainNotice | undefined): void => {
    hand.start("waist", entities.entity(woodBoxId)?.position, act);
  };
  return {
    putInWoodBox: {
      start: "fresh",
      refusal: (command) => boxes.putInRefusal(command.woodBoxId),
      approach: {
        reach: (command) => boxes.reach(command.woodBoxId),
        act: (command) => {
          reachInto(command.woodBoxId, () => boxes.putIn(command.woodBoxId, command.all));
        },
      },
    },
    takeFromWoodBox: {
      start: "fresh",
      refusal: (command) => boxes.takeRefusal(command.woodBoxId),
      approach: {
        reach: (command) => boxes.reach(command.woodBoxId),
        act: (command) => {
          reachInto(command.woodBoxId, () => boxes.take(command.woodBoxId));
        },
      },
    },
  };
}

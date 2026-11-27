import type { Command } from "./api-commands";
import type { GameView } from "./api-game-view";
import type { BlueprintView, CampfireView, DryingRackView, SledView, WoodpileView } from "./api-nearby";
import type { Refusal } from "./api-refusal";
import type { ThingInReach, ThingView } from "./api-scene-pick";
import type { Vec3 } from "./entities";
import type { GroundPoint } from "./ground-point";
import type { QuarterTurns } from "./quarter-turns";
import type { StructureKind } from "./structure-kind";

/** A room: foundation squares closed in by log walls, door frames, or windows, with a roof over every square. */
export interface RoomView {
  /** The middles of the room's foundation squares, in metres. */
  readonly squares: readonly GroundPoint[];
  /** Whether a lit campfire in the room warms all of it. */
  readonly heated: boolean;
  /** Whether the room is snug: a finished floor on every square, a finished door in every door frame, and closed shutters in every window. */
  readonly snug: boolean;
}

/** Where a blueprint would go, and whether its structure's placement rule allows it there. */
export interface PlacementCheck {
  /** The building-grid spot it snaps to, on the ground, in metres. */
  readonly spot: Readonly<Vec3>;
  /** The turn it takes there. This is the turn asked for, except for a roof, which takes the turn of the frame under it. */
  readonly turns: QuarterTurns;
  readonly allowed: boolean;
  /** Why it is not allowed there, when the game can say, such as a mushroom log lying there or a berry bush in the way. Missing when allowed, or when no reason is given. */
  readonly refusal?: Refusal;
}

/** A blueprint under the mouse that the player has not placed yet, as the placement check gives it. The scene shows it. */
export interface PlacingBlueprint extends PlacementCheck {
  readonly structure: StructureKind;
}

export interface GameClient {
  getView(): GameView;
  /**
   * Where a blueprint of `structure` facing `turns` would go if placed near `at`, and whether it is allowed there.
   * It only reads game state, so the blueprint under the mouse can follow it before the player clicks.
   */
  checkPlacement(structure: StructureKind, at: GroundPoint, turns: QuarterTurns): PlacementCheck;
  /** What a blueprint, given by its entity id, has and needs, or null if it is not a blueprint. It only reads game state. */
  describeBlueprint(blueprintId: number): BlueprintView | null;
  /** A finished campfire, given by its entity id, near or far, or null if it is not one. It only reads game state. */
  describeCampfire(campfireId: number): CampfireView | null;
  /** A finished woodpile, given by its entity id, near or far, or null if it is not one. It only reads game state. */
  describeWoodpile(woodpileId: number): WoodpileView | null;
  /** A finished sled, given by its entity id, near or far, or null if it is not one. It only reads game state. */
  describeSled(sledId: number): SledView | null;
  /** A finished drying rack, given by its entity id, near or far, or null if it is not one. It only reads game state. */
  describeDryingRack(rackId: number): DryingRackView | null;
  /** What a thing in the world is, given by its entity id, or null if it is gone or is none of the kinds ThingView names. It only reads game state. */
  describeThing(id: number): ThingView | null;
  /** The thing nearest the player within the reach of E, or null if nothing is in reach. It only reads game state. */
  nearestInReach(): ThingInReach | null;
  /** Every room in the valley, worked out from the finished pieces. It only reads game state. The debug overlay shows it. */
  describeRooms(): readonly RoomView[];
  /**
   * Why the game would turn this command away if it were sent now, or null if it has no reason to give.
   * It ignores how far away the thing is, since the player walks there first. It only reads game state.
   * The game checks the same rules again when it carries the command out, since things can change while the player walks.
   */
  refusal(command: Command): Refusal | null;
  send(command: Command): void;
  /** Calls the listener after each logic step. Returns a function that stops listening. */
  subscribe(listener: () => void): () => void;
}

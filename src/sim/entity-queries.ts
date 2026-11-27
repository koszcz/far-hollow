import type { Entity, EntityStore, Vec3 } from "./entities";
import type { Fire, FireKind } from "./fire";
/** Entities that can move, so rendering blends their position between logic steps. */
export function movingEntities(store: EntityStore) {
  return store.with("position", "previousPosition");
}

/** Standing trees. */
export function treeEntities(store: EntityStore) {
  return store.with("tree", "position");
}

/** Stumps left by felled trees. */
export function stumpEntities(store: EntityStore) {
  return store.with("stump", "position");
}

/** Trees growing back: stumps, saplings, and young trees. */
export function growingTreeEntities(store: EntityStore) {
  return store.with("growth", "position");
}

/** Logs lying on the ground. Logs on a shoulder are not entities. */
export function logEntities(store: EntityStore) {
  return store.with("log", "position");
}

/** Debarked logs lying on the ground. Debarked logs on a shoulder are not entities. */
export function debarkedLogEntities(store: EntityStore) {
  return store.with("debarkedLog", "position");
}

/** Sticks lying on the forest floor. Sticks in the backpack are not entities. */
export function stickEntities(store: EntityStore) {
  return store.with("stick", "position");
}

/** Pieces of bark lying on the ground. Bark in the backpack is not an entity. */
export function barkEntities(store: EntityStore) {
  return store.with("bark", "position");
}

/** Everything lying loose on the ground that the player can pick up: logs, debarked logs, sticks, bark, bedrolls, piles, and planted torches. */
export function lyingThings(store: EntityStore): (Entity & { position: Vec3 })[] {
  const queries = [logEntities, debarkedLogEntities, stickEntities, barkEntities, bedrollEntities, pileEntities, plantedTorchEntities];
  return queries.flatMap((query): (Entity & { position: Vec3 })[] => [...query(store)]);
}

/** Mushroom logs, with mushrooms or growing them back. */
export function mushroomLogEntities(store: EntityStore) {
  return store.with("mushroomLog", "position");
}

/** Berry bushes, mushroom patches, and mushroom logs, with food or growing back. */
export function forageSpotEntities(store: EntityStore) {
  return store.with("forageSpot", "position");
}

/** Structures placed but not finished. */
export function blueprintEntities(store: EntityStore) {
  return store.with("blueprint", "position");
}

/** Finished foundations. */
export function foundationEntities(store: EntityStore) {
  return store.with("foundation", "position");
}

/** Finished floors. */
export function floorEntities(store: EntityStore) {
  return store.with("floor", "position");
}

/** Finished log walls and door frames. */
export function edgePieceEntities(store: EntityStore) {
  return store.with("edgePiece", "position");
}

/** Finished doors. */
export function doorEntities(store: EntityStore) {
  return store.with("door", "position");
}

/** Finished shutters. */
export function shuttersEntities(store: EntityStore) {
  return store.with("shutters", "position");
}

/** Finished roof frames. */
export function roofFrameEntities(store: EntityStore) {
  return store.with("roofFrame", "position");
}

/** Finished cabin roof sections. */
export function cabinRoofEntities(store: EntityStore) {
  return store.with("cabinRoof", "position", "roof");
}

/** Finished fireplaces. */
export function fireplaceEntities(store: EntityStore) {
  return store.with("fireplace", "position");
}

/** Finished chimneys. */
export function chimneyEntities(store: EntityStore) {
  return store.with("chimney", "position");
}

/** A finished campfire or fireplace, which kind it is, and the fire it holds. Set the fire back on `entity[kind]` to change it. */
export interface HeldFire {
  readonly entity: Entity & { position: Vec3 };
  readonly kind: FireKind;
  readonly fire: Fire;
}

/** The fire an entity holds, if it is a finished campfire or fireplace. */
export function heldFireOf(entity: Entity | undefined): HeldFire | undefined {
  if (entity === undefined || !hasPosition(entity)) return undefined;
  if (entity.campfire !== undefined) return { entity, kind: "campfire", fire: entity.campfire };
  if (entity.fireplace !== undefined) return { entity, kind: "fireplace", fire: entity.fireplace };
  return undefined;
}

/** Every finished campfire and fireplace, with the fire it holds. */
export function heldFires(store: EntityStore): HeldFire[] {
  return [...campfireEntities(store), ...fireplaceEntities(store)].flatMap((entity) => heldFireOf(entity) ?? []);
}

function hasPosition(entity: Entity): entity is Entity & { position: Vec3 } {
  return entity.position !== undefined;
}

/** Finished campfires. */
export function campfireEntities(store: EntityStore) {
  return store.with("campfire", "position");
}

/** Lit torches planted in the ground or on a foundation. */
export function plantedTorchEntities(store: EntityStore) {
  return store.with("plantedTorch", "position");
}

/** Fish traps set in the river's water. */
export function fishTrapEntities(store: EntityStore) {
  return store.with("fishTrap", "position");
}

/** Bedrolls laid out on the ground. */
export function bedrollEntities(store: EntityStore) {
  return store.with("bedroll", "position");
}

/** The player. There is only ever one. */
export function playerEntities(store: EntityStore) {
  return store.with("player", "position", "previousPosition");
}

/** Everything that stops the player walking near it. */
export function walkBlockerEntities(store: EntityStore) {
  return store.with("blocksWalking", "position");
}

/** Everything that stops the player walking on certain squares, such as a lean-to's frame. */
export function walkBlockerSpotEntities(store: EntityStore) {
  return store.with("blocksWalkingSpots");
}

/** Everything that stops the player stepping across the edges between certain squares, such as a log wall. */
export function walkBlockerEdgeEntities(store: EntityStore) {
  return store.with("blocksWalkingEdges");
}

/** Everything with a roof. */
export function roofEntities(store: EntityStore) {
  return store.with("roof");
}

/** Finished woodpiles. */
export function woodpileEntities(store: EntityStore) {
  return store.with("woodpile", "position");
}

/** Finished pieces of furniture, of every kind. Code that needs one kind filters by `furniture`. Blueprints are not among them. */
export function furnitureEntities(store: EntityStore) {
  return store.with("furniture", "position");
}

/** Finished sleds. */
export function sledEntities(store: EntityStore) {
  return store.with("sled", "position");
}

/** Whether a sled is parked: no player drags it. A dragged sled is not parked. */
export function isParked(store: EntityStore, sled: Entity): boolean {
  const id = store.id(sled);
  return playerEntities(store).entities.every((player) => player.dragging?.sledId !== id);
}

/** Finished work stations, such as sawhorses. Blueprints are not among them. */
export function workStationEntities(store: EntityStore) {
  return store.with("workStation", "position");
}

/** Finished lean-tos. */
export function leanToEntities(store: EntityStore) {
  return store.with("leanTo", "position");
}

/** Piles of things the player dropped on the ground. */
export function pileEntities(store: EntityStore) {
  return store.with("pile", "position");
}

/** The valley's stick fall. There is only ever one. */
export function stickFallEntities(store: EntityStore) {
  return store.with("stickFall");
}

/** The changes of ground type, one for each tree spot that has had one. */
export function groundChangeEntities(store: EntityStore) {
  return store.with("groundChange");
}

/** The valley's weather. There is only ever one. */
export function rainEntities(store: EntityStore) {
  return store.with("rain");
}

/** Whether rain, not snow, falls in the valley now. False before the weather exists. */
export function isRaining(store: EntityStore): boolean {
  const weather = rainEntities(store).first;
  return weather?.rain.falling === true && weather.snow?.fallsAsSnow !== true;
}

/** Whether snow falls in the valley now, in place of rain. False before the weather exists. */
export function isSnowing(store: EntityStore): boolean {
  const weather = rainEntities(store).first;
  return weather?.rain.falling === true && weather.snow?.fallsAsSnow === true;
}

/** How deep the snow cover lies in the valley now, from 0 (none) to 1 (full). 0 before the weather exists. */
export function snowCoverDepth(store: EntityStore): number {
  return rainEntities(store).first?.snow?.cover.depth ?? 0;
}

# Pathfinding: walk the short way to things

## Problem

When the player acts on something out of reach, they often take a strange route to it.

- **Chopping a tree:** the player often walks round the tree and chops it from the far side.
- **Loading a sled:** in the forest, the player often weaves between trees to reach one exact spot beside the sled, when a much shorter walk would put them within reach.

## Causes

Both were measured on seed 42 on 2026-11-15.

### 1. The walk ends at the open cell nearest the target, not nearest the player

Chopping walks the player to the tree's centre (`src/sim/chopping.ts`). That spot is blocked, so `findPath` in `src/sim/pathfinding.ts` ends the walk at the open cell nearest the tree's centre. It never considers which side the player comes from.

The winning cell depends only on where the tree sits inside its 1 m cell. So for a given tree, the player always ends on the same side, wherever they start. Of the 12 trees nearest the start, 6 were chopped from the far side, at a cost of 2 to 4.5 m of extra walking.

### 2. "Walk beside" aims at one fixed spot

`walkBeside` in `src/sim/walking.ts` picks a single spot a fixed distance from the thing, on the straight line towards the player. The player walks to that exact spot, even when trees stand in the way and the player could act from much closer to where they are.

On open ground, this gives a straight walk. In 150 random forest trials with a sled, the worst walks were 1.5 to 1.9 times the direct route. If the fixed spot lands inside a tree's blocked area, cause 1 applies too. In one trial, the player ended up standing on the sled.

`walkBeside` is used by sleds, woodpiles, campfires, chests, stools, and crafting stations.

### 3. Some gaps between trees are closed on the walk map

Each tree blocks every cell whose centre lies within 1.2 m of the tree's centre. The player cannot step diagonally between two blocked cells. Together, these close some diagonal gaps between trees that look wide enough to walk through. This adds detours, but less often than causes 1 and 2.

## Solution

Add a pathfinding call that walks the player to the nearest spot, by walking distance, that lies within a given distance of a thing. Actions that walk to a thing use it instead of walking to one fixed spot.

## Tickets

1. `issues/01-chop-from-the-near-side.md`: the new pathfinding call, used for chopping.
2. `issues/02-walk-beside-the-short-way.md`: `walkBeside` uses it, which covers sleds, woodpiles, campfires, chests, stools, and stations.
3. `issues/03-other-walks-to-things.md`: the remaining actions that walk to a blocked thing.
4. `issues/04-gaps-between-trees.md`: open the diagonal gaps between trees. Needs the owner's decision.

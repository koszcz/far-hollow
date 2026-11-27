// Showcases for the land and what grows on it: ground, river, trees, undergrowth, and logs. The registry is src/render/showcases/index.ts.
import { crownColour, isBroadleaf } from "../autumn-leaves";
import { createTreeMaterial } from "../tree-batches";
import { TREE_COLOURS } from "../tree-model";
import { createSaplingShapes } from "../sapling-shape";
import { createFarTreeShape } from "../tree-far-shape";
import { createUndergrowthMaterial, undergrowthSway } from "../undergrowth-meshes";
import { SAPLING_SWAY, YOUNG_TREE_SWAY } from "../wind-sway";
import type { UndergrowthAsset } from "../undergrowth-models";
import { STAGE_FROM_RIVER_METRES, FOUR_ANGLES, type Showcase } from "./types";

/** Far tree shapes stand this far apart in the showcase, in metres. */
const FAR_TREE_SPACING_METRES = 5;
/** Saplings and young trees stand this far apart in the showcase, in metres. */
const SAPLING_SPACING_METRES = 2.2;

/** Undergrowth models stand this far apart in the showcase, in metres. */
const UNDERGROWTH_SPACING_METRES = 0.7;

/** Plays the wind swaying the stage, seen from the front, with nothing else moving. */
const SWAY_PLAY: NonNullable<Showcase["play"]> = {
  shot: { label: "swaying in the wind", yaw: 0, pitch: 12 },
  pose: () => undefined,
};

/**
 * Shows every model of one undergrowth asset in rows of `columns`, each in the game's colours and material.
 * The game draws the same models in batches, scattered by ground type.
 */
function undergrowthShowcase(asset: UndergrowthAsset, count: number, columns: number): Showcase {
  const rows = Math.ceil(count / columns);
  const width = (columns - 1) * UNDERGROWTH_SPACING_METRES;
  const depth = (rows - 1) * UNDERGROWTH_SPACING_METRES;
  const sway = undergrowthSway(asset);
  const showcase: Showcase = {
    radius: Math.max(1, Math.max(width, depth) * 0.9),
    focus: { x: 0, y: 0.15, z: 0 },
    shots: FOUR_ANGLES,
    build({ addProp, undergrowthShapes, windSway }) {
      undergrowthShapes
        .filter((shape) => shape.asset === asset)
        .forEach((shape, index) => {
          const x = (index % columns) * UNDERGROWTH_SPACING_METRES - width / 2;
          const z = Math.floor(index / columns) * UNDERGROWTH_SPACING_METRES - depth / 2;
          const material = createUndergrowthMaterial(shape);
          addProp(shape.geometry.clone(), sway === undefined ? material : windSway.sway(material, sway), x, z);
        });
    },
  };
  // Undergrowth that sways plays the wind live. Pebbles stay still, so they have only stills.
  return sway === undefined ? showcase : { ...showcase, play: SWAY_PLAY };
}

export const NATURE_SHOWCASES: Readonly<Record<string, Showcase>> = {
  // Framed so all three ground types show: river bank to the west, forest floor around a tree, and clearing between.
  terrain: { radius: 22, focus: { x: -5, y: 0, z: 4 }, shots: FOUR_ANGLES, build() {} },
  river: {
    radius: 16,
    focus: { x: -STAGE_FROM_RIVER_METRES, y: 0, z: 0 },
    shots: FOUR_ANGLES.map((shot) => ({ ...shot, pitch: shot.pitch + 15 })),
    build() {},
  },
  // The same stretch of river as "river", frozen as it is all winter, with full snow cover on the ground around it.
  "frozen-river": {
    radius: 16,
    focus: { x: -STAGE_FROM_RIVER_METRES, y: 0, z: 0 },
    shots: FOUR_ANGLES.map((shot) => ({ ...shot, pitch: shot.pitch + 15 })),
    build({ place }) {
      place(0, 0, { rain: { falling: false, changeAtMinutes: Infinity, changes: 0 }, snow: { fallsAsSnow: true, cover: { depth: 1 } } });
    },
  },
  trees: {
    radius: 7,
    focus: { x: 0, y: 3, z: 0 },
    shots: FOUR_ANGLES,
    build({ place }) {
      for (const [x, z] of [
        [-4, 0],
        [0, -1],
        [4, 0.5],
      ] as const)
        place(x, z, { tree: true });
    },
    play: SWAY_PLAY,
  },
  // Every tree type's far shape in a row, in the game's colours. The game draws these only far from the camera.
  "far-trees": {
    radius: 19,
    focus: { x: 0, y: 3, z: 0 },
    shots: FOUR_ANGLES,
    build({ addProp, treeShapes }) {
      treeShapes.forEach((shape, index) => {
        const x = (index - (treeShapes.length - 1) / 2) * FAR_TREE_SPACING_METRES;
        const far = createFarTreeShape(shape);
        addProp(far.trunk, createTreeMaterial(TREE_COLOURS.trunk[shape.trunkTone]), x, 0);
        addProp(far.crown, createTreeMaterial(TREE_COLOURS.crown[shape.crownTone]), x, 0);
      });
    },
  },
  // Every broadleaf tree type fully turned to its own autumn colour: its real shape in the front row and its far shape behind.
  // Pines keep their green, so they are left out.
  "autumn-trees": {
    radius: 12,
    focus: { x: 0, y: 3, z: -2 },
    shots: FOUR_ANGLES,
    build({ addProp, treeShapes }) {
      const broadleaf = treeShapes.filter((shape) => isBroadleaf(shape.name));
      broadleaf.forEach((shape, index) => {
        const x = (index - (broadleaf.length - 1) / 2) * FAR_TREE_SPACING_METRES;
        const far = createFarTreeShape(shape);
        const autumn = crownColour(shape, 1).getHex();
        addProp(shape.trunk.clone(), createTreeMaterial(TREE_COLOURS.trunk[shape.trunkTone]), x, 0);
        addProp(shape.crown.clone(), createTreeMaterial(autumn), x, 0);
        addProp(far.trunk, createTreeMaterial(TREE_COLOURS.trunk[shape.trunkTone]), x, -FAR_TREE_SPACING_METRES);
        addProp(far.crown, createTreeMaterial(autumn), x, -FAR_TREE_SPACING_METRES);
      });
    },
  },
  stumps: {
    radius: 1.6,
    focus: { x: 0, y: 0.25, z: 0 },
    shots: FOUR_ANGLES,
    build({ place }) {
      for (const [x, z] of [
        [-0.9, 0],
        [0.9, 0.2],
      ] as const)
        place(x, z, { stump: true });
    },
  },
  // Every tree type's young tree in the back row and its sapling in the middle row, in the game's colours.
  // In front, two felled trees with saplings growing from their stumps, as the game draws them.
  saplings: {
    radius: 9,
    focus: { x: 0, y: 1, z: 1 },
    shots: FOUR_ANGLES,
    build({ addProp, place, treeShapes, saplingModels, windSway }) {
      treeShapes.forEach((shape, index) => {
        const x = (index - (treeShapes.length - 1) / 2) * SAPLING_SPACING_METRES;
        const { sapling, youngTree } = createSaplingShapes(shape, saplingModels);
        for (const [part, z, look] of [
          [youngTree, -2, YOUNG_TREE_SWAY],
          [sapling, 1, SAPLING_SWAY],
        ] as const) {
          addProp(part.trunk, windSway.sway(createTreeMaterial(TREE_COLOURS.trunk[shape.trunkTone]), look), x, z);
          addProp(part.crown, windSway.sway(createTreeMaterial(TREE_COLOURS.crown[shape.crownTone]), look), x, z);
        }
      });
      for (const [x, z] of [
        [-1.5, 4],
        [1.5, 4.2],
      ] as const)
        place(x, z, { stump: true, growth: { stage: "sapling", minutesLeft: 60 }, blocksWalking: { radius: 1.2 } });
    },
    play: SWAY_PLAY,
  },
  sticks: {
    radius: 1.3,
    focus: { x: 0, y: 0.05, z: 0 },
    shots: FOUR_ANGLES,
    build({ place }) {
      // Each spot picks a different one of the four stick shapes.
      for (const [x, z] of [
        [-0.66, -0.45],
        [0.56, -0.5],
        [-0.46, 0.55],
        [0.68, 0.5],
      ] as const)
        place(x, z, { stick: true });
    },
  },
  "berry-bush": {
    radius: 1.5,
    focus: { x: 0, y: 0.4, z: 0 },
    shots: FOUR_ANGLES,
    build({ place }) {
      // With berries on the left, foraged and growing back on the right.
      place(-0.8, 0, { forageSpot: { food: "berries" } });
      place(0.8, 0, { forageSpot: { food: "berries" }, regrowing: { minutesLeft: 60 } });
    },
  },
  mushrooms: {
    radius: 0.5,
    focus: { x: 0, y: 0.15, z: 0 },
    shots: FOUR_ANGLES,
    build({ place }) {
      place(0, 0, { forageSpot: { food: "mushroom" } });
    },
  },
  "mushroom-log": {
    radius: 1.6,
    focus: { x: 0, y: 0.25, z: 0 },
    shots: FOUR_ANGLES,
    build({ place }) {
      // With mushrooms on the left, foraged and growing them back on the right.
      place(-0.6, 0, { mushroomLog: { heading: 0.3 }, forageSpot: { food: "mushroom" } });
      place(0.7, 0.2, { mushroomLog: { heading: 1.6 }, forageSpot: { food: "mushroom" }, regrowing: { minutesLeft: 60 } });
    },
  },
  grass: undergrowthShowcase("grass", 5, 5),
  ferns: undergrowthShowcase("ferns", 3, 3),
  flowers: undergrowthShowcase("flowers", 9, 3),
  pebbles: undergrowthShowcase("pebbles", 14, 5),
  logs: {
    radius: 2.2,
    focus: { x: 0, y: 0.7, z: 0 },
    shots: FOUR_ANGLES,
    build({ place, player }) {
      place(-0.8, 0.8, { log: { heading: 0.3 } });
      place(0.9, 0.6, { log: { heading: 1.8 } });
      player.setCarryingLog("log");
    },
  },
  "debarked-log": {
    radius: 1.6,
    focus: { x: 0, y: 0.5, z: 0 },
    shots: FOUR_ANGLES,
    build({ place, player }) {
      // A log beside the debarked ones, so the two compare in one view.
      place(-0.8, 0.8, { debarkedLog: { heading: 0.3 } });
      place(0.9, 0.6, { log: { heading: 1.8 } });
      place(0.3, -0.9, { debarkedLog: { heading: 1.2 } });
      player.setCarryingLog("debarkedLog");
    },
  },
};

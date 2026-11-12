// Showcases for the land and what grows on it: ground, river, trees, undergrowth, and logs. The registry is src/render/showcases/index.ts.
import * as THREE from "three";
import { TREE_COLOURS } from "../forest-meshes";
import { createFarTreeShape } from "../tree-far-shape";
import { createUndergrowthMaterial } from "../undergrowth-meshes";
import type { UndergrowthAsset } from "../undergrowth-models";
import { STAGE_FROM_RIVER_METRES, FOUR_ANGLES, type Showcase } from "./types";

/** Far tree shapes stand this far apart in the showcase, in metres. */
const FAR_TREE_SPACING_METRES = 5;

/** Undergrowth models stand this far apart in the showcase, in metres. */
const UNDERGROWTH_SPACING_METRES = 0.7;

/**
 * Shows every model of one undergrowth asset in rows of `columns`, each in the game's colours and material.
 * The game draws the same models in batches, scattered by ground type.
 */
function undergrowthShowcase(asset: UndergrowthAsset, count: number, columns: number): Showcase {
  const rows = Math.ceil(count / columns);
  const width = (columns - 1) * UNDERGROWTH_SPACING_METRES;
  const depth = (rows - 1) * UNDERGROWTH_SPACING_METRES;
  return {
    radius: Math.max(1, Math.max(width, depth) * 0.9),
    focus: { x: 0, y: 0.15, z: 0 },
    shots: FOUR_ANGLES,
    build({ addProp, undergrowthShapes }) {
      undergrowthShapes
        .filter((shape) => shape.asset === asset)
        .forEach((shape, index) => {
          const x = (index % columns) * UNDERGROWTH_SPACING_METRES - width / 2;
          const z = Math.floor(index / columns) * UNDERGROWTH_SPACING_METRES - depth / 2;
          addProp(shape.geometry.clone(), createUndergrowthMaterial(shape), x, z);
        });
    },
  };
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
        const material = (colour: number) => new THREE.MeshStandardMaterial({ color: colour, flatShading: true });
        addProp(far.trunk, material(TREE_COLOURS.trunk[shape.trunkTone]), x, 0);
        addProp(far.crown, material(TREE_COLOURS.crown[shape.crownTone]), x, 0);
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
  sticks: {
    radius: 1.3,
    focus: { x: 0, y: 0.05, z: 0 },
    shots: FOUR_ANGLES,
    build({ place }) {
      for (const [x, z] of [
        [-0.6, 0],
        [0.5, -0.4],
        [0.3, 0.6],
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

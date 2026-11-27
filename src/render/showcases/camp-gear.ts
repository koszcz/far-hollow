// Showcases for the player's own things: firewood, the player and backpack, bedrolls, the saw, the fishing rod, steel and flint, and the torch. The registry is src/render/showcases/index.ts.
import * as THREE from "three";
import { createFirewoodGeometry, FIREWOOD_COLOUR } from "../firewood-shape";
import { createSaw, SAW_TEETH_BELOW_GRIP_METRES } from "../saw-model";
import { createFishingRod, FISHING_ROD_LENGTH_METRES } from "../fishing-rod-model";
import { FOUR_ANGLES, NIGHT, type Showcase } from "./types";

export const CAMP_GEAR_SHOWCASES: Readonly<Record<string, Showcase>> = {
  firewood: {
    radius: 0.9,
    focus: { x: 0, y: 0.12, z: 0 },
    shots: FOUR_ANGLES,
    // One piece alone, a small pile, and the log it is split from, for size and colour.
    build({ place, addProp }) {
      const geometry = createFirewoodGeometry();
      const material = new THREE.MeshStandardMaterial({ color: FIREWOOD_COLOUR, flatShading: true, vertexColors: true });
      addProp(geometry, material, -0.45, 0.25, 0, 0.5);
      // Two pieces side by side, bark to bark, with a third resting in the groove between them.
      addProp(geometry, material, 0.31, 0.1, 0, 0);
      addProp(geometry, material, 0.47, 0.1, 0, Math.PI);
      addProp(geometry, material, 0.39, 0.12, 0.07, 0.04);
      place(0, -0.75, { log: { heading: Math.PI / 2 } });
    },
  },
  player: { radius: 1.1, focus: { x: 0, y: 0.9, z: 0 }, shots: FOUR_ANGLES, build() {} },
  // Close up and with empty hands, so nothing covers the backpack. The "logs" showcase shows the axe hanging on it.
  backpack: {
    radius: 0.85,
    focus: { x: 0, y: 0.85, z: 0 },
    shots: [
      { label: "front", yaw: 0, pitch: 12 },
      { label: "back", yaw: 180, pitch: 15 },
      { label: "back three-quarter", yaw: 215, pitch: 25 },
      { label: "side", yaw: 90, pitch: 12 },
    ],
    build() {},
  },
  bedroll: {
    radius: 1.3,
    focus: { x: 0, y: 0.1, z: 0 },
    shots: FOUR_ANGLES,
    build({ place }) {
      place(0, 0, { bedroll: true });
    },
  },
  "rolled-bedroll": {
    radius: 0.6,
    focus: { x: 0, y: 0.1, z: 0 },
    shots: FOUR_ANGLES,
    build({ place }) {
      place(0, 0, { pile: { content: "bedroll", count: 1 } });
    },
  },
  // The bow saw the player holds while sawing planks, standing on its teeth with its blade along z.
  "saw-model": {
    radius: 0.45,
    focus: { x: 0, y: 0.12, z: 0.27 },
    shots: FOUR_ANGLES,
    build({ addProp }) {
      // The stage disposes each part's shape and paint. Disposing a paint two lashings share twice does no harm.
      for (const { geometry, material, position } of createSaw().parts) {
        addProp(geometry, material, position.x, position.z, position.y + SAW_TEETH_BELOW_GRIP_METRES);
      }
    },
  },
  // The approved "fishing-rod" the player holds while fishing, lying along x with the butt to -x and the line tied at its tip.
  // It lies on its side, so its bow curves across the ground, as a held rod's bow would hang down.
  "fishing-rod": {
    radius: 1,
    focus: { x: 0, y: 0.03, z: 0 },
    shots: [
      { label: "whole rod, side", yaw: 0, pitch: 20 },
      { label: "whole rod, from above, showing the bow", yaw: 0, pitch: 80 },
      { label: "grip, spare line, and knots, close", yaw: 30, pitch: 35, radius: 0.45, focus: { x: -0.4, y: 0.02, z: 0 } },
      { label: "lashed joint and tip, close", yaw: -30, pitch: 35, radius: 0.5, focus: { x: 0.3, y: 0.02, z: 0 } },
    ],
    build({ addProp }) {
      // The rod points along +z from its butt and bows to -y. A quarter turn about z lays the bow flat, then it is
      // centred, and a quarter turn about y lays it along x.
      for (const { geometry, material } of createFishingRod().parts) {
        addProp(geometry.rotateZ(Math.PI / 2).translate(0, 0, -FISHING_ROD_LENGTH_METRES / 2), material, 0, 0, 0.018, Math.PI / 2);
      }
    },
  },
  "steel-and-flint": {
    radius: 0.12,
    focus: { x: 0, y: 0.008, z: 0 },
    shots: FOUR_ANGLES.map((shot) => ({ ...shot, radius: 0.16 })),
    build({ place }) {
      place(0, 0, { pile: { content: "steelAndFlint", count: 1 } });
    },
  },
  // The approved "torch": the lit torch in the player's hand at night, lighting the ground around them, torches planted in a row
  // at night, walking with it at night, and unlit torches lying in piles of 1 and 4.
  // Of the six planted torches, the three nearest the camera light the ground, after the torch in the hand. The rest only glow.
  torch: {
    radius: 2.4,
    focus: { x: 0, y: 1, z: 0 },
    shots: [
      { label: "a lit torch in the hand, at night", yaw: 25, pitch: 30, radius: 5, hour: NIGHT },
      { label: "planted torches at night: the 3 nearest light the ground", yaw: 90, pitch: 25, radius: 8, hour: NIGHT, focus: { x: -2, y: 0.3, z: -6 } },
      { label: "walking with a lit torch, at night", yaw: -50, pitch: 20, radius: 2.4, hour: NIGHT, seconds: 0.3 },
      { label: "unlit torches in piles of 1 and 4", yaw: 10, pitch: 45, radius: 1, focus: { x: 1.6, y: 0.05, z: 0 } },
    ],
    build({ place, movePlayer }) {
      movePlayer(0, 0, 0);
      place(1.2, -0.2, { pile: { content: "torch", count: 1 } });
      place(1.9, 0.2, { pile: { content: "torch", count: 4 } });
      for (let i = 0; i < 6; i += 1) place(-8 + i * 2.5, -6, { plantedTorch: { minutesLeft: 120 } });
    },
    pose({ player }, shot) {
      player.setWalking(shot.label.startsWith("walking") ? 0.6 : undefined);
      player.setMotion("torch", shot.seconds ?? 0);
    },
  },
};

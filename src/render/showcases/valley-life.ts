// Showcases for what lives in the valley only for looks: birds and fireflies. The registry is src/render/showcases/index.ts.
import { createBirdMaterial, createBirdShape, posedBirdGeometry, type BirdPose } from "../bird-shape";
import { NIGHT, NOON, type Showcase } from "./types";

/** The showcase's birds stand this far apart along x, in metres. Flying birds hang this high. */
const BIRD_SPACING_METRES = 0.6;
const FLYING_LIFT_METRES = 0.5;

/** Each bird the "birds" showcase poses, in order along x, with the view that looks at it. */
const BIRD_POSES: readonly { readonly label: string; readonly pose: BirdPose; readonly yaw: number; readonly pitch: number }[] = [
  { label: "flying, wings up", pose: { flying: true, flap: 1, peck: 0 }, yaw: 35, pitch: 20 },
  { label: "flying, wings down", pose: { flying: true, flap: -1, peck: 0 }, yaw: 150, pitch: 25 },
  { label: "on the ground, head up", pose: { flying: false, flap: 0, peck: 0 }, yaw: 60, pitch: 12 },
  { label: "pecking", pose: { flying: false, flap: 0, peck: 1 }, yaw: 100, pitch: 12 },
];

const birdX = (index: number): number => (index - (BIRD_POSES.length - 1) / 2) * BIRD_SPACING_METRES;
const birdLift = (pose: BirdPose): number => (pose.flying ? FLYING_LIFT_METRES : 0);

export const VALLEY_LIFE_SHOWCASES: Readonly<Record<string, Showcase>> = {
  birds: {
    radius: 0.13,
    focus: { x: 0, y: 0.06, z: 0 },
    shots: BIRD_POSES.map(({ label, pose, yaw, pitch }, index) => ({
      label,
      yaw,
      pitch,
      hour: NOON,
      focus: { x: birdX(index), y: birdLift(pose) + 0.06 },
    })),
    build({ addProp }) {
      const shape = createBirdShape();
      BIRD_POSES.forEach(({ pose }, index) => {
        addProp(posedBirdGeometry(shape, pose), createBirdMaterial(), birdX(index), 0, birdLift(pose));
      });
      for (const part of Object.values(shape)) part.dispose();
    },
  },
  fireflies: {
    radius: 6,
    focus: { x: 0, y: 1, z: 0 },
    fireflies: true,
    shots: [
      { label: "night, 22:00", yaw: 200, pitch: 8, hour: NIGHT, seconds: 0.6 },
      { label: "night, a moment later", yaw: 200, pitch: 8, hour: NIGHT, seconds: 1.8 },
      { label: "night, from above", yaw: 40, pitch: 35, hour: NIGHT, seconds: 3 },
      { label: "dusk, 19:30, fading in", yaw: 200, pitch: 8, hour: 19.5, seconds: 0.6 },
    ],
    build({ place }) {
      for (const [x, z] of [
        [-6, -5],
        [4, -7],
        [7, 2],
      ] as const)
        place(x, z, { tree: true });
    },
    // Fireflies drift and blink all night, so they play live at night.
    play: {
      shot: { label: "fireflies at night", yaw: 200, pitch: 8, hour: NIGHT },
      pose: () => undefined,
    },
  },
};

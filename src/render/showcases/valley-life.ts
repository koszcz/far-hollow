// Showcases for what lives in the valley only for looks: birds and fireflies. The registry is src/render/showcases/index.ts.
import type * as THREE from "three";
import { flightLegPose, flightPose, GROUND_REST_POSE, groundPose, LANDING_POSE, type BirdPose } from "../bird-motion";
import { createBirdMaterial, createBirdShape, posedBirdGeometry, type BirdShape } from "../bird-shape";
import { NIGHT, NOON, type Showcase } from "./types";

/** The showcase's birds stand this far apart along x, in metres. Flying birds hang this high. */
const BIRD_SPACING_METRES = 0.6;
const FLYING_LIFT_METRES = 0.5;

/** Each bird the "birds" showcase poses, in order along x, with the view that looks at it. */
const BIRD_POSES: readonly { readonly label: string; readonly pose: BirdPose; readonly flying: boolean; readonly yaw: number; readonly pitch: number }[] = [
  { label: "flying, top of the beat", pose: flightPose(0, 6, 0, false), flying: true, yaw: 35, pitch: 20 },
  { label: "flying, upstroke, tips bent", pose: flightPose(0, 6, 0.7, false), flying: true, yaw: 100, pitch: 10 },
  { label: "landing, wings spread", pose: LANDING_POSE, flying: true, yaw: 60, pitch: 15 },
  { label: "pecking", pose: { ...GROUND_REST_POSE, peck: 1 }, flying: false, yaw: 100, pitch: 12 },
];

/** The live loop: the bird pecks on the ground for this long, then flies up and around on the spot for this long. */
const PLAY_GROUND_SECONDS = 5;
const PLAY_FLIGHT_SECONDS = 3;
/** In the live loop, the bird pecks once in this period, so it looks left, hops, looks right, and rests once each. */
const PLAY_PECK_PERIOD_SECONDS = PLAY_GROUND_SECONDS / 4;
/** In the live loop, the bird beats its wings this many times a second and rises this high, in metres. */
const PLAY_BEATS_PER_SECOND = 6;
const PLAY_FLIGHT_METRES = 0.3;
/** The live loop's bird stands this far along z from the stills, where the play view looks. */
const PLAY_Z_METRES = 1.5;

const birdX = (index: number): number => (index - (BIRD_POSES.length - 1) / 2) * BIRD_SPACING_METRES;
const birdLift = (flying: boolean): number => (flying ? FLYING_LIFT_METRES : 0);

/** The bird in the live loop. Its shape stays the same, and each frame overwrites its geometry with the new pose. */
let playBird: { readonly shape: BirdShape; readonly geometry: THREE.BufferGeometry } | undefined;

/** The live loop's pose `seconds` after it began: pecking, then a take-off, a flight in bursts, and a landing. */
function playPose(seconds: number): BirdPose {
  const into = seconds % (PLAY_GROUND_SECONDS + PLAY_FLIGHT_SECONDS);
  if (into < PLAY_GROUND_SECONDS) return groundPose(into, PLAY_PECK_PERIOD_SECONDS, 0);
  const flown = into - PLAY_GROUND_SECONDS;
  const lastOnGround = groundPose(PLAY_GROUND_SECONDS, PLAY_PECK_PERIOD_SECONDS, 0);
  const pose = flightLegPose(flightPose(flown, PLAY_BEATS_PER_SECOND, 0, true), flown, lastOnGround, PLAY_FLIGHT_SECONDS - flown);
  const height = (PLAY_FLIGHT_METRES * (1 - Math.cos((flown / PLAY_FLIGHT_SECONDS) * Math.PI * 2))) / 2;
  // The bursts' rise and dip fade in after take-off and out before landing, so the bird leaves and meets the ground smoothly.
  const away = Math.sin((flown / PLAY_FLIGHT_SECONDS) * Math.PI);
  return { ...pose, lift: height + pose.lift * away };
}

export const VALLEY_LIFE_SHOWCASES: Readonly<Record<string, Showcase>> = {
  birds: {
    radius: 0.13,
    focus: { x: 0, y: 0.06, z: 0 },
    shots: BIRD_POSES.map(({ label, flying, yaw, pitch }, index) => ({
      label,
      yaw,
      pitch,
      hour: NOON,
      focus: { x: birdX(index), y: birdLift(flying) + 0.06 },
    })),
    build({ addProp }) {
      const shape = createBirdShape();
      BIRD_POSES.forEach(({ pose, flying }, index) => {
        addProp(posedBirdGeometry(shape, pose), createBirdMaterial(), birdX(index), 0, birdLift(flying));
      });
      const geometry = posedBirdGeometry(shape, playPose(0));
      addProp(geometry, createBirdMaterial(), 0, PLAY_Z_METRES);
      playBird = { shape, geometry };
    },
    // One bird pecks, looks around, and hops, then takes off, flies on the spot in bursts, and lands again.
    play: {
      shot: { label: "pecking, take-off, flight, and landing", yaw: 70, pitch: 12, hour: NOON, radius: 0.32, focus: { x: 0, y: 0.17, z: PLAY_Z_METRES } },
      pose(_stage, seconds) {
        if (playBird === undefined) return undefined;
        const posed = posedBirdGeometry(playBird.shape, playPose(seconds));
        for (const name of ["position", "normal"]) {
          const target = playBird.geometry.getAttribute(name);
          (target.array as Float32Array).set(posed.getAttribute(name).array);
          target.needsUpdate = true;
        }
        playBird.geometry.computeBoundingSphere();
        posed.dispose();
        return undefined;
      },
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

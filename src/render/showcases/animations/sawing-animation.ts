// The showcase of the "sawing-animation".
import { PLANKS_CRAFT_SECONDS } from "../../../sim/crafting";
import { SAW_STANCE_METRES, SAW_STROKE_SECONDS } from "../../player-saw-pose";
import type { Showcase } from "../types";

/** How long the player stands after sawing before the "sawing-animation" plays again, in seconds. */
const SAW_PLAY_REST_SECONDS = 1.2;

export const SAWING_ANIMATION_SHOWCASE: Showcase = {
  radius: 1.4,
  focus: { x: 0, y: 0.85, z: -0.25 },
  // Each view is a moment of one cut through the log, which takes as long as the game takes to cut planks.
  // Whole strokes are pulled back and half strokes pushed away. The blade sinks lower in each later view.
  shots: [
    { label: "pulled back, cut starting, side on", seconds: 1, yaw: 270, pitch: 0 },
    { label: "pushed away, cut starting", seconds: 1.5 },
    { label: "pushed away, from above", seconds: 4.5, yaw: 270, pitch: 85 },
    { label: "pulled back, cut nearly through", seconds: 7, yaw: 240 },
  ].map(({ label, seconds, yaw = 290, pitch = 10 }) => ({ label, yaw, pitch, seconds: seconds * SAW_STROKE_SECONDS })),
  build({ store, place, movePlayer }) {
    // A sawhorse with its beam along x, a debarked log beside it, and the player cutting planks there.
    const sawhorse = place(0, 0, { workStation: "sawhorse", facing: { turns: 0 } });
    place(0, 1.2, { debarkedLog: { heading: Math.PI / 2 } });
    const player = store.with("player").first;
    const stationId = store.id(sawhorse);
    if (player !== undefined && stationId !== undefined) store.addComponent(player, "craftTask", { recipe: "planks", secondsDone: 1, stationId });
    movePlayer(0, -SAW_STANCE_METRES, 0);
  },
  pose({ player }, shot) {
    // Start sawing afresh at time 0 for each view, so the view shows the cut `shot.seconds` in.
    const seconds = shot.seconds ?? 0;
    player.setSawing(undefined);
    player.setSawing({ nowSeconds: 0, progress: 0 });
    player.setSawing({ nowSeconds: seconds, progress: seconds / PLANKS_CRAFT_SECONDS });
  },
  // The player saws through the log for as long as the game takes, stands up, rests, then starts again.
  play: {
    shot: { label: "sawing through the log, then standing up", yaw: 250, pitch: 18, radius: 1.8 },
    pose({ player }, seconds) {
      const cycle = seconds % (PLANKS_CRAFT_SECONDS + SAW_PLAY_REST_SECONDS);
      player.setSawing(cycle < PLANKS_CRAFT_SECONDS ? { nowSeconds: cycle, progress: cycle / PLANKS_CRAFT_SECONDS } : undefined);
      return undefined;
    },
  },
};

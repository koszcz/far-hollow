// Builds the "sawing-animation" asset in asset-manifest.json: the player stands beside the sawhorse, facing the log
// that lies along its beam. The left hand rests on the log to hold it still. The right hand pushes the bow saw away
// and pulls it back in long, even strokes, across the log. The blade sinks from the top of the log to the bottom as
// the cut goes on. It is posed in code on top of the idle clip with the build pose's bones, so it has no clip of its
// own. A draft. The bow saw is the draft "saw-model", built by saw-model.ts.
import { scaleBuildPose, type BuildPose } from "./player-build-pose";
import { SAW_BLADE_LENGTH_METRES, SAW_TEETH_BELOW_GRIP_METRES } from "./saw-model";
import { BEAM_TOP_METRES } from "./sawhorse-meshes";

/** Seconds one stroke takes: push the saw away, then pull it back. */
export const SAW_STROKE_SECONDS = 1;
/** Seconds the player takes to step up to the sawhorse and lift the hands when sawing starts, and to step back when it stops. */
export const SAW_ENTER_SECONDS = 0.45;
/** How much bigger the saw is in the hand than true size. The player's head and beard are big for the body, like the axe. */
export const SAW_IN_HAND_SCALE = 1.3;
/** How far the player's feet stand from the middle of the sawhorse beam, across it, in metres. */
export const SAW_STANCE_METRES = 0.6;

/** How far right of the middle the saw cuts, in metres. The right hand holds the saw there. */
const CUT_SPREAD = 0.16;
/** How far left of the middle the left hand rests on the log, in metres. */
const STEADY_SPREAD = 0.24;
/** How far above the log's top the left wrist rests, in metres, so the palm lies on the wood. */
const PALM_ABOVE_LOG = 0.035;
/** How far the right hand moves on each stroke, along the saw, in metres. */
const STROKE_METRES = 0.3;

const smoothstep = (t: number): number => t * t * (3 - 2 * t);

/**
 * The sawing pose `seconds` after sawing began, `progress` of the way through the cut, from 0 to 1.
 * `logThickness` is how tall the log on the beam is, in metres.
 * Each stroke starts pulled back, pushes the saw away by half a stroke, and pulls it back, so strokes loop without a jump.
 * For the first `SAW_ENTER_SECONDS` the player lifts into the stroke from standing, so starting has no jump.
 */
export function sawPoseAt(seconds: number, progress: number, logThickness: number): BuildPose {
  const share = (((seconds / SAW_STROKE_SECONDS) % 1) + 1) % 1;
  // How far the saw is pushed away, from 0 (pulled back) to 1 (pushed away), easing at each end like a real stroke.
  const push = (1 - Math.cos(share * Math.PI * 2)) / 2;
  const logTop = BEAM_TOP_METRES + logThickness;
  const cut = Math.min(1, Math.max(0, progress));
  // The teeth sit in the bottom of the cut, which sinks from the top of the log to its underside.
  const teeth = logTop - cut * logThickness;
  const bladeIn = SAW_BLADE_LENGTH_METRES * SAW_IN_HAND_SCALE;
  // Pulled back, the far end of the blade still lies over the far side of the log. Pushed away, the near end still does.
  const pulledBack = SAW_STANCE_METRES + logThickness / 2 - bladeIn + 0.05;
  const pose: BuildPose = {
    hipsDrop: 0.03 + 0.04 * cut,
    hipsBack: 0.04,
    hipsLean: 0.12 + 0.05 * cut,
    // The shoulders follow the saw a little, rocking forward with each push.
    chestLean: 0.2 + 0.08 * push + 0.05 * cut,
    // The head bows to watch the cut.
    headTilt: 0.2,
    reach: 1,
    hands: { forward: SAW_STANCE_METRES, height: logTop + PALM_ABOVE_LOG, spread: STEADY_SPREAD },
    rightHand: {
      forward: pulledBack + STROKE_METRES * push,
      height: teeth + SAW_TEETH_BELOW_GRIP_METRES * SAW_IN_HAND_SCALE,
      spread: CUT_SPREAD,
    },
  };
  if (seconds >= SAW_ENTER_SECONDS) return pose;
  return scaleBuildPose(pose, smoothstep(Math.max(0, seconds) / SAW_ENTER_SECONDS));
}

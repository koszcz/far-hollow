// The showcase of the "chop-animation".
import { chopSecondsForTreeSize, treeSizeAt } from "../../../sim/tree-size";
import { CHOP_RAISED_SHARE, CHOP_STRIKE_SHARE, CHOP_SWING_SHARE, CHOP_SWINGS_PER_SECOND } from "../../player-mesh";
import { FALL_LANDS_SECONDS, FALL_SECONDS } from "../../tree-fall";
import type { Showcase } from "../types";

/** How long the felled tree lies still in the chop animation's live loop before it stands again, in seconds. */
const CHOP_PLAY_REST_SECONDS = 1.2;
/** How long the game takes to chop the showcase's tree, which stands at the middle of the scene. */
const SHOWCASE_CHOP_SECONDS = chopSecondsForTreeSize(treeSizeAt(0, 0));

export const CHOP_ANIMATION_SHOWCASE: Showcase = {
  radius: 1.4,
  focus: { x: 0, y: 1, z: 1.2 },
  shots: [
    { label: "axe raised", yaw: 90, pitch: 12, seconds: (CHOP_RAISED_SHARE + CHOP_SWING_SHARE) / 2 / CHOP_SWINGS_PER_SECOND },
    { label: "strike", yaw: 110, pitch: 45, seconds: (CHOP_STRIKE_SHARE + 0.01) / CHOP_SWINGS_PER_SECOND },
    { label: "tree falling", yaw: 90, pitch: 15, radius: 6, focus: { y: 3, z: -2 }, seconds: FALL_LANDS_SECONDS * 0.75 },
    { label: "tree bounces", yaw: 90, pitch: 15, radius: 6, focus: { y: 1.5, z: -3 }, seconds: FALL_LANDS_SECONDS + 0.08 },
  ],
  build({ place, movePlayer }) {
    place(0, 0, { tree: true });
    // The player stands south of the tree, facing it.
    movePlayer(0, 1.2, Math.PI);
  },
  pose({ store, player }, shot) {
    const falling = shot.label.startsWith("tree");
    player.setChopping(falling ? undefined : shot.seconds);
    const tree = store.with("tree").first;
    if (falling && tree !== undefined) store.removeComponent(tree, "tree");
  },
  // The player chops for as long as the game takes, the tree falls, and after a pause the tree stands again.
  play: {
    shot: { label: "chopping, then the fall", yaw: 80, pitch: 12, radius: 4.6, focus: { y: 1.8, z: -2.8 } },
    pose({ store, player }, seconds) {
      const cycle = seconds % (SHOWCASE_CHOP_SECONDS + FALL_SECONDS + CHOP_PLAY_REST_SECONDS);
      const tree = store.with("position").where((entity) => entity.player === undefined).first;
      if (tree === undefined) return undefined;
      const chopping = cycle < SHOWCASE_CHOP_SECONDS;
      player.setChopping(chopping ? cycle : undefined);
      if (chopping && tree.tree === undefined) store.addComponent(tree, "tree", true);
      if (!chopping && tree.tree !== undefined) store.removeComponent(tree, "tree");
      return undefined;
    },
  },
};

// How fast the player's clips and moves run, as KayKit made the clips and as the game plays them.
/** The Barbarian is modelled about 2.4 units tall with his hood. This scale makes him about 1.85 m tall in it. */
export const MODEL_SCALE = 0.78;

/** Seconds each clip lasts, as KayKit made them. The game plays each at its own speed. */
export const CHOP_CLIP_SECONDS = 1.1;
export const SPLIT_CLIP_SECONDS = 1.6333;

/**
 * Metres walked in one full loop of the walk clip, left foot and right foot. Each foot moves 0.6 model units against
 * the hips while it is planted, so the feet stay put on the ground when the clip keeps pace with this.
 */
export const STRIDE_METRES = 1.2 * MODEL_SCALE;

/** How many times a second the player swings the axe at a tree: once per loop of the chop clip. */
export const CHOP_SWINGS_PER_SECOND = 1 / CHOP_CLIP_SECONDS;
/**
 * Moments in each chopping swing, as shares of one swing: the axe is drawn back over the left side by
 * `CHOP_RAISED_SHARE`, starts across at `CHOP_SWING_SHARE`, and strikes the trunk at `CHOP_STRIKE_SHARE`.
 */
export const CHOP_RAISED_SHARE = 0.28;
export const CHOP_SWING_SHARE = 0.31;
export const CHOP_STRIKE_SHARE = 0.38;
/** How many times a second the player strikes down at a log when splitting: once per loop of the split clip. */
export const SPLIT_STRIKES_PER_SECOND = 1 / SPLIT_CLIP_SECONDS;

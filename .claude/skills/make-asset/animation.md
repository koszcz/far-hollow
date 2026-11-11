# Animation guidelines

Read this when the asset is an animation. It records what made the owner approve `walk-animation` and `chop-animation`. Their code in `src/render/player-mesh.ts` and `src/render/tree-fall.ts` is the worked example.

## 1. Start from the real motion

Before you write code, describe in one or two sentences how a real person or object makes this motion. Name the real technique. For example, felling a tree is a side swing at waist height, but splitting a log is an overhead lift and a straight drop. Put this description in the catalogue entry's `description`.

Read the descriptions of the other animation entries in `asset-manifest.json`. Each animation must read differently from its siblings at a glance, such as `chop-animation` and `split-animation`.

## 2. Split one cycle into phases

Divide one cycle into named phases. Most actions use these:

1. **Anticipation**: the wind-up, such as lifting the axe back. It takes about half the cycle.
2. **Hold**: a short pause at the top, about a tenth of the cycle.
3. **Action**: the fast part, such as the swing into the trunk. It takes a fifth of the cycle or less.
4. **Follow-through**: the impact jolt or bounce, which dies away before the cycle repeats.

Store where each phase ends as a share of the cycle, in a constant such as `CHOP_STRIKE_SHARE`. Export the shares the asset showcase needs to pick its key moments.

## 3. Pick an easing curve for each phase

Linear motion looks mechanical. Use it only for steady motion, such as a turning wheel. For each phase, use the matching curve:

| Phase | Curve | Example in code |
|---|---|---|
| Wind-up or lift | Ease in and out | `easeInOut(t)` |
| Strike or drop | Speed up into contact | `t ** 2` |
| Fall under gravity | Speed up from rest | `t ** 2.4` |
| Impact jolt | A shake that dies away | `(1 - t) ** 2 * Math.sin(t * Math.PI * 3)` |
| Landing | One bounce, then a smaller one | Two half sine waves, the second about a fifth as high |
| Settle into a pose | Smoothstep | `t * t * (3 - 2 * t)` |

## 4. Move the body in layers

- **Larger parts lead, smaller parts lag.** When chopping, the hips turn a little and the chest turns a lot. When walking, the elbows lag the shoulders.
- **Contact points stay fixed.** A planted foot stays still on the ground. Both hands stay on a two-handed tool. Place hands with `reachFor` and feet with `placeFoot`, both in `player-mesh.ts`, rather than tuning joint angles by eye.
- **Tools face the way they move.** An axe blade leads the swing.
- **Weight shows in the body.** The body dips, leans, or rocks back on impact.

## 5. Write every pose as named numbers

- Write each key pose as one object of named values, such as `CHOP_RAISED_POSE` and `CHOP_STRIKE_POSE`.
- Blend between key poses with one value from 0 to 1.
- Give each constant a comment that states its unit and direction. Use metres, radians, and seconds.
- Drive the motion from the clock time the game passes in, never from a frame count.

The owner asks for changes such as "lift the axe higher". With named poses, you change one number.

## 6. Remove every pop

A pop is a sudden jump between two frames. Check for these before you show the owner:

- **The loop seam**: the pose at the end of the cycle matches the pose at the start.
- **Entering and leaving**: when the animation stops, reset every rotation and position it set, and put held items back. Test each switch the game makes, such as walk to chop, chop to split, and chop to idle.
- **Slow motion**: watch the loop at `&speed=0.25`. Pops that hide at full speed show up there.

// The HUD's bars and gauges: the round need gauges, the labelled meters, and the colours they use.
import { HudIcon, type HudIconName } from "./hud-icons";
import { needPulses, needRingShare } from "./need-gauge";

/** Warmth's bar colour runs from this cold blue at 0 to the ember orange at 1. */
const COLD_RGB = [111, 168, 214] as const;
export const WARM_RGB = [232, 131, 58] as const;
/** A cool river blue for the thirst bar. */
export const THIRST_COLOUR = "#5aa9e6";
/** A berry red for the hunger bar. */
export const HUNGER_COLOUR = "#c8553d";
/** A dusk violet for the fatigue bar. */
export const FATIGUE_COLOUR = "#9a8fd6";

/** The colour of the warmth bar at `warmth`, from 0 (frozen) to 1 (fully warm). */
export function warmthColour(warmth: number): string {
  const t = Math.min(1, Math.max(0, warmth));
  const mix = (cold: number, warm: number): number => Math.round(cold + (warm - cold) * t);
  return `rgb(${mix(COLD_RGB[0], WARM_RGB[0])} ${mix(COLD_RGB[1], WARM_RGB[1])} ${mix(COLD_RGB[2], WARM_RGB[2])})`;
}

/** One row of a bar with an icon and a label. The progress of timed work, and campfire fuel, use it. */
export function Meter({ icon, label, value, colour }: { icon: HudIconName; label: string; value: number; colour: string }) {
  return (
    <label class="hud-meter" style={{ "--hud-bar": colour }}>
      <HudIcon name={icon} />
      <span class="hud-meter-label">{label}</span>
      <progress max={1} value={value} />
    </label>
  );
}

/**
 * One need as a round gauge: a ring in the need's colour that fills with its level, the need's icon inside, and its name below.
 * A low need pulses. A hidden progress bar in the label lets screen readers read the need's name and level.
 */
export function NeedGauge({ icon, label, value, colour }: { icon: HudIconName; label: string; value: number; colour: string }) {
  return (
    <label class={needPulses(value) ? "hud-need hud-need-low" : "hud-need"} style={{ "--hud-bar": colour, "--hud-level": needRingShare(value) }}>
      <span class="hud-need-ring">
        <HudIcon name={icon} />
      </span>
      <span class="hud-need-label">{label}</span>
      <progress class="hud-sr-only" max={1} value={value} />
    </label>
  );
}

/** The colour of the bar for timed work, such as chopping. */
export const WORK_BAR_COLOUR = "#d9c48a";

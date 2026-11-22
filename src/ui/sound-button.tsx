// The "sound-button" draft asset in asset-manifest.json: the Volume slider, and the small round sound button on the HUD
// that opens it. The start screen shows the same slider. The button's speaker icon is drawn in the HUD icons' line style.
import { useEffect, useState } from "preact/hooks";
import type { VolumeControl, VolumeSetting } from "../sound/volume-control";
import { strings } from "../strings";

/** A speaker with sound waves, and the same speaker crossed out when muted, on the HUD icons' 24 by 24 grid. */
const SPEAKER = "M4 9h4l5-4v14l-5-4H4z";
const SPEAKER_ICON = { on: `${SPEAKER}M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11`, muted: `${SPEAKER}M16 9.5l5 5M21 9.5l-5 5` } as const;

/** The player's Volume and mute as they are now, drawn again whenever they change. */
function useVolumeSetting(control: VolumeControl): VolumeSetting {
  const [setting, setSetting] = useState(control.setting());
  useEffect(
    () =>
      control.subscribe(() => {
        setSetting(control.setting());
      }),
    [control],
  );
  return setting;
}

/** The Volume slider, from silent to full. Moving it while muted unmutes, so the player hears the new Volume. */
export function VolumeSlider({ control }: { control: VolumeControl }) {
  const setting = useVolumeSetting(control);
  return (
    <label class="volume-slider">
      <span>{strings.sound.volume}</span>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={Math.round(setting.volume * 100)}
        onInput={(event) => {
          control.setVolume(Number(event.currentTarget.value) / 100);
          if (control.setting().muted) control.toggleMute();
        }}
      />
    </label>
  );
}

/** The round sound button at the top right of the HUD. It shows when sound is muted, and opens the Volume slider and a mute button. */
export function SoundButton({ control, startsOpen = false }: { control: VolumeControl; startsOpen?: boolean }) {
  const setting = useVolumeSetting(control);
  const [open, setOpen] = useState(startsOpen);
  const label = setting.muted ? strings.sound.buttonMuted : strings.sound.button;
  return (
    <div class="hud hud-sound">
      <div class="hud-panel">
        <button
          type="button"
          class="hud-button hud-icon-button"
          aria-label={label}
          aria-expanded={open}
          data-tip={label}
          data-muted={setting.muted}
          onClick={() => {
            setOpen(!open);
          }}
        >
          <svg class="hud-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d={setting.muted ? SPEAKER_ICON.muted : SPEAKER_ICON.on} />
          </svg>
        </button>
      </div>
      {open && (
        <div class="hud-panel hud-sound-panel">
          <VolumeSlider control={control} />
          <button
            type="button"
            class="hud-button"
            aria-pressed={setting.muted}
            onClick={() => {
              control.toggleMute();
            }}
          >
            {setting.muted ? strings.sound.unmute : strings.sound.mute} <kbd class="hud-key">{strings.sound.muteKey}</kbd>
          </button>
        </div>
      )}
    </div>
  );
}

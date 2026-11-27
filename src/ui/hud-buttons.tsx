// The HUD's square buttons: icon-only and icon-over-name.
import { HudIcon, type HudIconName } from "./hud-icons";

/** A square HUD button that shows only an icon. Its label shows when the player points at it, and screen readers read it. */
export function HudIconButton({
  icon,
  label,
  disabled = false,
  pressed,
  onClick,
}: {
  icon: HudIconName;
  label: string;
  disabled?: boolean;
  pressed?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" class="hud-button hud-icon-button" aria-label={label} aria-pressed={pressed} data-tip={label} disabled={disabled} onClick={onClick}>
      <HudIcon name={icon} />
    </button>
  );
}

/** A square HUD button that shows an icon over its name, and the key that does the same in its corner, such as "B" on Build. The build and craft buttons use it. */
export function HudToolButton({
  icon,
  label,
  shortcut,
  disabled = false,
  pressed,
  onClick,
}: {
  icon: HudIconName;
  label: string;
  shortcut: string;
  disabled?: boolean;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      class="hud-button hud-tool-button"
      aria-label={label}
      aria-keyshortcuts={shortcut}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
    >
      <HudIcon name={icon} />
      <span class="hud-tool-label">{label}</span>
      <kbd class="hud-key">{shortcut}</kbd>
    </button>
  );
}

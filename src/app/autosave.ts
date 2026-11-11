export interface AutosaveOptions {
  /** Saves the game. */
  save: () => void;
  /** How often to save while the game runs, in real milliseconds. */
  intervalMs: number;
  /** Where the browser reports the page being hidden or closed. In the game this is `window`. */
  page: EventTarget;
  /** Whether the page is hidden now. */
  isHidden: () => boolean;
}

/**
 * Saves at a regular interval, when the page is hidden, and when it is closed.
 * Returns a function that stops autosaving.
 */
export function startAutosave({ save, intervalMs, page, isHidden }: AutosaveOptions): () => void {
  const timer = setInterval(save, intervalMs);
  const onVisibilityChange = () => {
    if (isHidden()) save();
  };
  page.addEventListener("visibilitychange", onVisibilityChange);
  page.addEventListener("pagehide", save);
  return () => {
    clearInterval(timer);
    page.removeEventListener("visibilitychange", onVisibilityChange);
    page.removeEventListener("pagehide", save);
  };
}

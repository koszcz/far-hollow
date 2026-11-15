// Where the action menu's list goes on the page. src/ui/action-menu.tsx measures the list, then asks this file where to put it.

/** The gap between the click and the list, in pixels. */
export const MENU_GAP_PIXELS = 12;
/** How close the list may come to the window's edges, in pixels. */
export const MENU_MARGIN_PIXELS = 8;
/** How far above the click the list's top sits, in pixels, so the first row lines up with the pointer. */
const FIRST_ROW_OFFSET_PIXELS = 22;

export interface MenuPlacementInput {
  /** The click, in page pixels. */
  readonly x: number;
  readonly y: number;
  /** True to put the list wholly above the click, centred on it, such as above a hotbar cell. */
  readonly above: boolean;
  /** The list's size, in pixels. */
  readonly width: number;
  readonly height: number;
  /** The window's size, in pixels. */
  readonly viewWidth: number;
  readonly viewHeight: number;
}

/**
 * Where the list's top left corner goes, in page pixels.
 * Normally the list sits to the right of the click, with its first row level with the pointer. Near the right edge, it
 * flips to the left of the click. It always stays inside the window.
 */
export function placeActionMenu({ x, y, above, width, height, viewWidth, viewHeight }: MenuPlacementInput): { left: number; top: number } {
  if (above) {
    return {
      left: clamp(x - width / 2, MENU_MARGIN_PIXELS, viewWidth - MENU_MARGIN_PIXELS - width),
      top: clamp(y - MENU_GAP_PIXELS - height, MENU_MARGIN_PIXELS, viewHeight - MENU_MARGIN_PIXELS - height),
    };
  }
  const fitsRight = x + MENU_GAP_PIXELS + width <= viewWidth - MENU_MARGIN_PIXELS;
  const left = fitsRight ? x + MENU_GAP_PIXELS : x - MENU_GAP_PIXELS - width;
  return {
    left: clamp(left, MENU_MARGIN_PIXELS, viewWidth - MENU_MARGIN_PIXELS - width),
    top: clamp(y - FIRST_ROW_OFFSET_PIXELS, MENU_MARGIN_PIXELS, viewHeight - MENU_MARGIN_PIXELS - height),
  };
}

/** Keeps a value between min and max. If the range is empty, because the list is bigger than the window, the min wins. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(Math.min(value, max), min);
}

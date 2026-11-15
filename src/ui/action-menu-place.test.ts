import { describe, expect, it } from "bun:test";
import { MENU_GAP_PIXELS, MENU_MARGIN_PIXELS, placeActionMenu } from "./action-menu-place";

const VIEW = { viewWidth: 1280, viewHeight: 800 };
const SIZE = { width: 240, height: 200 };

describe("the action menu's place", () => {
  it("sits to the right of the click, with its first row level with the pointer", () => {
    const { left, top } = placeActionMenu({ x: 400, y: 300, above: false, ...SIZE, ...VIEW });
    expect(left).toBe(400 + MENU_GAP_PIXELS);
    expect(top).toBeLessThan(300);
    expect(top).toBeGreaterThan(300 - 40);
  });

  it("flips to the left of the click near the right edge", () => {
    const { left } = placeActionMenu({ x: 1200, y: 300, above: false, ...SIZE, ...VIEW });
    expect(left).toBe(1200 - MENU_GAP_PIXELS - SIZE.width);
  });

  it("moves up to stay inside the window near the bottom edge", () => {
    const { top } = placeActionMenu({ x: 400, y: 780, above: false, ...SIZE, ...VIEW });
    expect(top).toBe(VIEW.viewHeight - MENU_MARGIN_PIXELS - SIZE.height);
  });

  it("moves down to stay inside the window near the top edge", () => {
    const { top } = placeActionMenu({ x: 400, y: 2, above: false, ...SIZE, ...VIEW });
    expect(top).toBe(MENU_MARGIN_PIXELS);
  });

  it("sits wholly above the click, centred on it, when asked to", () => {
    const { left, top } = placeActionMenu({ x: 600, y: 700, above: true, ...SIZE, ...VIEW });
    expect(left).toBe(600 - SIZE.width / 2);
    expect(top).toBe(700 - MENU_GAP_PIXELS - SIZE.height);
  });

  it("stays inside the window above a hotbar cell near the left edge", () => {
    const { left } = placeActionMenu({ x: 20, y: 700, above: true, ...SIZE, ...VIEW });
    expect(left).toBe(MENU_MARGIN_PIXELS);
  });
});

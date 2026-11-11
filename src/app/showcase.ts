// The asset showcase page: /?asset=<id> on the dev server. See src/render/asset-showcase.ts.
import { SHOWCASE_ASSET_IDS, showAsset, type ShowOptions } from "../render/asset-showcase";
import { loadModelShapes } from "../render/model-shapes";

/**
 * Draws one asset in four views, labels each view, and marks the page ready for a screenshot.
 * With `play` set, an animation that supports it plays live in one view at `speed` times game speed.
 */
export async function startShowcase(id: string, options: ShowOptions = { play: false, speed: 1 }): Promise<void> {
  document.title = `Asset: ${id}`;
  const canvas = document.querySelector("#scene");
  const ui = document.querySelector("#ui");
  if (!(canvas instanceof HTMLCanvasElement) || !(ui instanceof HTMLDivElement)) throw new Error("Missing #scene or #ui");
  const shapes = await loadModelShapes();
  let shown = showAsset(canvas, id, shapes, options);
  document.querySelector("#loading")?.remove();
  // A new window size draws the views again from scratch.
  window.addEventListener("resize", () => {
    shown?.dispose();
    shown = showAsset(canvas, id, shapes, options);
  });
  if (shown === undefined) {
    ui.innerHTML = `<p class="showcase-missing">No showcase for "${id}". Try one of: ${SHOWCASE_ASSET_IDS.join(", ")}.</p>`;
  } else {
    ui.innerHTML = shown.labels.map((label, index) => `<span class="showcase-label showcase-label-${index}">${label}</span>`).join("");
    if (id === "hud" || id === "bark") {
      const { renderHudShowcase } = await import("../ui/hud-showcase");
      renderHudShowcase(ui, id);
    }
  }
  document.body.dataset.showcase = "ready";
}

// The asset showcase page: /?asset=<id> on the dev server. See src/render/asset-showcase.ts.
import { SHOWCASE_ASSET_IDS, showAsset } from "../render/asset-showcase";
import { loadStumpShape } from "../render/stump-model";
import { loadTreeShapes } from "../render/tree-model";

/** Draws one asset in four views, labels each view, and marks the page ready for a screenshot. */
export async function startShowcase(id: string): Promise<void> {
  document.title = `Asset: ${id}`;
  const canvas = document.querySelector("#scene");
  const ui = document.querySelector("#ui");
  if (!(canvas instanceof HTMLCanvasElement) || !(ui instanceof HTMLDivElement)) throw new Error("Missing #scene or #ui");
  const [treeShapes, stumpShape] = await Promise.all([loadTreeShapes(), loadStumpShape()]);
  let shown = showAsset(canvas, id, treeShapes, stumpShape);
  document.querySelector("#loading")?.remove();
  // The views are drawn once, so a new window size draws them again from scratch.
  window.addEventListener("resize", () => {
    shown?.dispose();
    shown = showAsset(canvas, id, treeShapes, stumpShape);
  });
  if (shown === undefined) {
    ui.innerHTML = `<p class="showcase-missing">No showcase for "${id}". Try one of: ${SHOWCASE_ASSET_IDS.join(", ")}.</p>`;
  } else {
    ui.innerHTML = shown.labels.map((label, index) => `<span class="showcase-label showcase-label-${index}">${label}</span>`).join("");
  }
  document.body.dataset.showcase = "ready";
}

// Starts the asset browser page: /?assets on the dev server. See src/ui/asset-browser.tsx.
import { h, render } from "preact";
import manifest from "../../asset-manifest.json";
import type { AssetManifest } from "../../scripts/asset-manifest";
import { SHOWCASE_FAMILIES } from "../render/showcases";
import { readAddress } from "../ui/asset-browser-address";
import { AssetBrowser } from "../ui/asset-browser";

/** Replaces the game's canvas with the asset browser, in the state the address records. */
export function startAssetBrowser(): void {
  document.title = "Asset browser";
  document.querySelector("#scene")?.remove();
  document.querySelector("#loading")?.remove();
  const ui = document.querySelector("#ui");
  if (!(ui instanceof HTMLDivElement)) throw new Error("Missing #ui");
  ui.classList.add("asset-browser-root");
  const families = SHOWCASE_FAMILIES.map((family) => ({ name: family.name, ids: Object.keys(family.showcases) }));
  const playable = new Set(
    SHOWCASE_FAMILIES.flatMap((family) =>
      Object.entries(family.showcases)
        .filter(([, showcase]) => showcase.play !== undefined)
        .map(([id]) => id),
    ),
  );
  render(h(AssetBrowser, { entries: (manifest as AssetManifest).assets, families, playable, start: readAddress(window.location.search) }), ui);
  document.body.dataset.assetBrowser = "ready";
}

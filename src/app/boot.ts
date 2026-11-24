// Starts the game. On the dev server, these address options open a review page instead:
// - /?asset=<id> opens the asset showcase of one asset. &play plays an animation live, and &speed=0.25 slows it down.
// - /?assets opens the asset browser, which lists every asset and shows the chosen one's showcase in a frame.
//   /?assets=<id> opens it with that asset chosen. It takes &play and &speed too, for example /?assets=bed&play&speed=0.25.
// The production build includes neither page.
// Crash reports start first, so they catch a crash while the game loads.
import { startCrashReports } from "./crash-reports";

startCrashReports();

const address = new URLSearchParams(window.location.search);
const showcaseId = import.meta.env.DEV ? address.get("asset") : null;
if (import.meta.env.DEV && showcaseId !== null) {
  const { startShowcase } = await import("./showcase");
  await startShowcase(showcaseId, { play: address.has("play"), speed: Number(address.get("speed") ?? "1") || 1 });
} else if (import.meta.env.DEV && address.has("assets")) {
  const { startAssetBrowser } = await import("./asset-browser");
  startAssetBrowser();
} else {
  await import("./main");
}

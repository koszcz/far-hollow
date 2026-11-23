// Starts the game, or, on the dev server with ?asset=<id> in the address, the asset showcase instead.
// Crash reports start first, so they catch a crash while the game loads.
import { startCrashReports } from "./crash-reports";

startCrashReports();

const address = new URLSearchParams(window.location.search);
const showcaseId = import.meta.env.DEV ? address.get("asset") : null;
if (import.meta.env.DEV && showcaseId !== null) {
  const { startShowcase } = await import("./showcase");
  await startShowcase(showcaseId, { play: address.has("play"), speed: Number(address.get("speed") ?? "1") || 1 });
} else {
  await import("./main");
}

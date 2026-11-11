// Starts the game, or, on the dev server with ?asset=<id> in the address, the asset showcase instead.
const address = new URLSearchParams(window.location.search);
const showcaseId = import.meta.env.DEV ? address.get("asset") : null;
if (import.meta.env.DEV && showcaseId !== null) {
  const { startShowcase } = await import("./showcase");
  await startShowcase(showcaseId, { play: address.has("play"), speed: Number(address.get("speed") ?? "1") || 1 });
} else {
  await import("./main");
}

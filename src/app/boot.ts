// Starts the game, or, on the dev server with ?asset=<id> in the address, the asset showcase instead.
const showcaseId = import.meta.env.DEV ? new URLSearchParams(window.location.search).get("asset") : null;
if (import.meta.env.DEV && showcaseId !== null) {
  const { startShowcase } = await import("./showcase");
  await startShowcase(showcaseId);
} else {
  await import("./main");
}

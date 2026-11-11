/**
 * Import rules between folders.
 * - Game logic (src/sim) never imports three.js, Preact, rendering, or UI (ADR 0001, ADR 0003).
 * - The UI (src/ui) reads state and sends commands only through src/sim/api.ts (ADR 0005).
 */
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "sim-stays-pure",
      comment: "Game logic must run without a browser. It cannot import three.js, Preact, rendering, UI, or the app.",
      severity: "error",
      from: { path: "^src/sim/" },
      to: { path: ["(^|/)node_modules/(@types/)?(three|preact)/", "^src/(render|ui|app)/"] },
    },
    {
      name: "ui-only-uses-sim-api",
      comment: "The UI may only use src/sim/api.ts, so it can read state and send commands but never change game state directly.",
      severity: "error",
      from: { path: "^src/ui/" },
      to: { path: "^src/sim/", pathNot: "^src/sim/api\\.ts$" },
    },
    {
      name: "ui-no-ecs-or-render",
      comment: "The UI cannot reach the entity store, three.js, or the renderer.",
      severity: "error",
      from: { path: "^src/ui/" },
      to: { path: ["(^|/)node_modules/(@types/)?(miniplex|three)/", "^src/(render|app)/"] },
    },
    {
      name: "render-no-ui",
      comment: "Rendering draws the 3D view only. It does not import the UI or the app.",
      severity: "error",
      from: { path: "^src/render/" },
      to: { path: ["(^|/)node_modules/(@types/)?preact/", "^src/(ui|app)/"] },
    },
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    exclude: { path: "\\.test\\.ts$" },
  },
};

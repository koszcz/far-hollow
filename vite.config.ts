import preact from "@preact/preset-vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // GitHub Pages serves the game from /<repo>/, so CI sets BASE_PATH.
  base: process.env.BASE_PATH ?? "/",
  plugins: [preact()],
  // The Claude preview gives each worktree's dev server a free port in PORT, so parallel sessions never collide.
  server: { port: Number(process.env.PORT) || 5173, strictPort: process.env.PORT !== undefined },
  test: {
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    // Simulation tests build a whole valley and step the game, about 1 to 2 seconds each on an idle machine.
    // Several worktrees often run the tests at once, which can slow one test past the 5-second default.
    testTimeout: 20_000,
  },
});

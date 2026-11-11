import preact from "@preact/preset-vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // GitHub Pages serves the game from /<repo>/, so CI sets BASE_PATH.
  base: process.env.BASE_PATH ?? "/",
  plugins: [preact()],
  test: {
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
  },
});

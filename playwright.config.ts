// Browser tests run on demand only (`bun run test:e2e`), never in the pre-commit hook.
// They use the Google Chrome already installed on the machine, so no browser download is needed.
import { defineConfig } from "@playwright/test";

const PORT = 5179;

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: "chrome",
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: "bun scripts/dev.ts",
    env: { PORT: String(PORT) },
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
  },
});

// Builds the game into dist/ with Bun's bundler.
// GitHub Pages serves the game from /<repo>/, so CI sets BASE_PATH.
import { cp, rm } from "node:fs/promises";

const base = process.env.BASE_PATH ?? "/";
const outdir = "dist";

await rm(outdir, { recursive: true, force: true });

const result = await Bun.build({
  entrypoints: ["./index.html"],
  outdir,
  target: "browser",
  minify: true,
  splitting: true,
  publicPath: base,
  define: {
    "import.meta.env.DEV": "false",
    "import.meta.env.PROD": "true",
    "import.meta.env.BASE_URL": JSON.stringify(base),
  },
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

// Files in public/ are served as they are, like Vite's public folder.
await cp("public", outdir, { recursive: true });

for (const output of result.outputs) {
  console.log(`${output.path.replace(`${process.cwd()}/`, "")}  ${(output.size / 1024).toFixed(1)} KB`);
}

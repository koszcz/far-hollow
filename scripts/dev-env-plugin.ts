// Bun's dev server does not fill in import.meta.env, so this plugin does.
// The game reads import.meta.env.DEV and import.meta.env.BASE_URL. The build script sets them with `define`.
import type { BunPlugin } from "bun";

const devEnvPlugin: BunPlugin = {
  name: "dev-import-meta-env",
  setup(build) {
    build.onLoad({ filter: /\/src\/.*\.tsx?$/ }, async ({ path }) => {
      const source = await Bun.file(path).text();
      return {
        contents: source.replaceAll("import.meta.env.DEV", "true").replaceAll("import.meta.env.BASE_URL", JSON.stringify("/")),
        loader: path.endsWith(".tsx") ? "tsx" : "ts",
      };
    });
  },
};

export default devEnvPlugin;

// Runs the game in Bun's dev server. Saving a file reloads the page.
import index from "../index.html";

const PUBLIC_DIR = `${import.meta.dir}/../public`;

// The Claude preview gives each worktree's dev server a free port in PORT, so parallel sessions never collide.
const server = Bun.serve({
  port: Number(process.env.PORT) || 5173,
  development: { hmr: true, console: true },
  routes: { "/": index },
  // Files in public/, such as the 3D models, are served as they are.
  async fetch(request) {
    const path = decodeURIComponent(new URL(request.url).pathname);
    const file = Bun.file(`${PUBLIC_DIR}${path}`);
    if (!path.includes("..") && (await file.exists())) return new Response(file);
    return new Response("Not found", { status: 404 });
  },
});

console.log(`Far Hollow dev server: ${server.url}`);

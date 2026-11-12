// Serves the finished build in dist/ so you can try it before deploying. Run `bun run build` first.
const DIST_DIR = `${import.meta.dir}/../dist`;

const server = Bun.serve({
  port: Number(process.env.PORT) || 4173,
  async fetch(request) {
    const path = decodeURIComponent(new URL(request.url).pathname);
    const file = Bun.file(`${DIST_DIR}${path.endsWith("/") ? `${path}index.html` : path}`);
    if (!path.includes("..") && (await file.exists())) return new Response(file);
    return new Response("Not found", { status: 404 });
  },
});

console.log(`Far Hollow build preview: ${server.url}`);

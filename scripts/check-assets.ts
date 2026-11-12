// Fails the build if any asset file in the project is not approved in asset-manifest.json,
// or if an entry breaks the catalogue rules. Draft assets built in code pass.
// See docs/adr/0006-tickets-add-draft-assets-owner-approves-final.md.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";
import { findBrokenEntries, findUnapprovedAssets, listDrafts, type AssetManifest } from "./asset-manifest";

const ROOT = join(import.meta.dirname, "..");
/** Folders that never hold game assets: installed packages, build output, and git data. */
const SKIPPED_FOLDERS = new Set(["node_modules", "dist", ".git"]);
/**
 * Folders, as paths from the project root, that hold files outside this checkout's game:
 * other git worktrees, and unpacked third-party packs, which git ignores.
 */
const SKIPPED_PATHS = new Set([".claude/worktrees", "third-party"]);
const ASSET_EXTENSIONS = new Set([
  // Models and animations
  ".glb",
  ".gltf",
  ".bin",
  ".fbx",
  ".obj",
  ".mtl",
  ".dae",
  ".blend",
  ".usdz",
  ".vrm",
  // Textures and images
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".avif",
  ".gif",
  ".svg",
  ".ktx2",
  ".basis",
  ".dds",
  ".tga",
  ".hdr",
  ".exr",
  // Sounds
  ".mp3",
  ".ogg",
  ".oga",
  ".opus",
  ".wav",
  ".m4a",
  ".aac",
  ".flac",
  ".webm",
]);

/** Lists every asset file under a folder, as paths from the project root with forward slashes. */
function listAssetFiles(folder: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) {
      const fromRoot = relative(ROOT, path).split(sep).join("/");
      if (!SKIPPED_FOLDERS.has(entry.name) && !SKIPPED_PATHS.has(fromRoot)) found.push(...listAssetFiles(path));
    } else if (entry.isFile() && ASSET_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
      found.push(relative(ROOT, path).split(sep).join("/"));
    }
  }
  return found;
}

const manifest = JSON.parse(readFileSync(join(ROOT, "asset-manifest.json"), "utf8")) as AssetManifest;
const files = listAssetFiles(ROOT);
const unapproved = findUnapprovedAssets(files, manifest);
const broken = findBrokenEntries(manifest, (path) => existsSync(join(ROOT, path)));

if (unapproved.length > 0) {
  console.error("These asset files are not approved in asset-manifest.json:");
  for (const { file, reason } of unapproved) {
    console.error(`  ${file} (${reason === "not-listed" ? "not listed" : "not approved"})`);
  }
}
if (broken.length > 0) {
  console.error("These entries in asset-manifest.json break the catalogue rules:");
  for (const problem of broken) console.error(`  ${problem}`);
}
if (unapproved.length > 0 || broken.length > 0) process.exit(1);
console.log(
  `Asset check passed: ${files.length} asset file(s), all approved. ${listDrafts(manifest).length} draft asset(s) waiting for polish (run \`make drafts\`).`,
);

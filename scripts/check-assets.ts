// Fails the build if any asset file in the project is not approved in asset-manifest.json.
// See docs/adr/0004-every-asset-needs-owner-approval.md.
import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";
import { findUnapprovedAssets, type AssetManifest } from "./asset-manifest";

const ROOT = join(import.meta.dirname, "..");
/** Folders that never hold game assets: installed packages, build output, and git data. */
const SKIPPED_FOLDERS = new Set(["node_modules", "dist", ".git"]);
const ASSET_EXTENSIONS = new Set([
  // Models and animations
  ".glb", ".gltf", ".bin", ".fbx", ".obj", ".mtl", ".dae", ".blend", ".usdz", ".vrm",
  // Textures and images
  ".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif", ".svg", ".ktx2", ".basis", ".dds", ".tga", ".hdr", ".exr",
  // Sounds
  ".mp3", ".ogg", ".oga", ".opus", ".wav", ".m4a", ".aac", ".flac", ".webm",
]);

/** Lists every asset file under a folder, as paths from the project root with forward slashes. */
function listAssetFiles(folder: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) {
      if (!SKIPPED_FOLDERS.has(entry.name)) found.push(...listAssetFiles(path));
    } else if (entry.isFile() && ASSET_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
      found.push(relative(ROOT, path).split(sep).join("/"));
    }
  }
  return found;
}

const manifest = JSON.parse(readFileSync(join(ROOT, "asset-manifest.json"), "utf8")) as AssetManifest;
const files = listAssetFiles(ROOT);
const problems = findUnapprovedAssets(files, manifest);

if (problems.length > 0) {
  console.error("These asset files are not approved in asset-manifest.json:");
  for (const { file, reason } of problems) {
    console.error(`  ${file} (${reason === "not-listed" ? "not listed" : "not approved"})`);
  }
  process.exit(1);
}
console.log(`Asset check passed: ${files.length} asset file(s), all approved.`);

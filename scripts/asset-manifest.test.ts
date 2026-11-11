import { describe, expect, it } from "vitest";
import { findUnapprovedAssets, type AssetManifest, type FileAssetEntry } from "./asset-manifest";

function fileEntry(file: string, status: FileAssetEntry["approval"]["status"]): FileAssetEntry {
  return {
    id: file,
    kind: "file",
    file,
    description: "Test asset",
    source: "https://example.com/pack",
    license: "CC0-1.0",
    approval: { status, by: "owner", date: "2026-11-11" },
  };
}

describe("findUnapprovedAssets", () => {
  it("reports an asset file that the manifest does not list", () => {
    const manifest: AssetManifest = { assets: [] };
    expect(findUnapprovedAssets(["public/assets/tree.glb"], manifest)).toEqual([
      { file: "public/assets/tree.glb", reason: "not-listed" },
    ]);
  });

  it("accepts a listed file the owner approved", () => {
    const manifest: AssetManifest = { assets: [fileEntry("public/assets/tree.glb", "approved")] };
    expect(findUnapprovedAssets(["public/assets/tree.glb"], manifest)).toEqual([]);
  });

  it("reports a listed file that is still pending or was rejected", () => {
    const manifest: AssetManifest = {
      assets: [fileEntry("public/assets/a.glb", "pending"), fileEntry("public/assets/b.png", "rejected")],
    };
    expect(findUnapprovedAssets(["public/assets/a.glb", "public/assets/b.png"], manifest)).toEqual([
      { file: "public/assets/a.glb", reason: "not-approved" },
      { file: "public/assets/b.png", reason: "not-approved" },
    ]);
  });
});

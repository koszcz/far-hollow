import { describe, expect, it } from "vitest";
import { findBrokenEntries, findUnapprovedAssets, listDrafts, type AssetManifest, type CodeAssetEntry, type FileAssetEntry } from "./asset-manifest";

function fileEntry(file: string, status: "pending" | "approved" | "rejected"): FileAssetEntry {
  return {
    id: file,
    kind: "file",
    file,
    code: [],
    description: "Test asset",
    source: "https://example.com/pack",
    license: "CC0-1.0",
    approval: status === "pending" ? { status } : { status, by: "owner", date: "2026-11-11" },
  };
}

function draftEntry(id: string, code: string[] = ["src/render/a.ts"], ticket = ".scratch/f/issues/01-a.md"): CodeAssetEntry {
  return {
    id,
    kind: "code",
    code,
    description: "Test draft",
    source: "Built in code in this project",
    license: "Project code",
    approval: { status: "draft", ticket },
  };
}

const everythingExists = () => true;

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

describe("findBrokenEntries", () => {
  it("accepts a draft whose ticket and code files exist", () => {
    expect(findBrokenEntries({ assets: [draftEntry("bedroll")] }, everythingExists)).toEqual([]);
  });

  it("reports a draft whose ticket or code file is missing", () => {
    const manifest: AssetManifest = { assets: [draftEntry("bedroll", ["src/render/gone.ts"], ".scratch/f/issues/99-gone.md")] };
    expect(findBrokenEntries(manifest, () => false)).toEqual([
      "bedroll: the draft's ticket .scratch/f/issues/99-gone.md does not exist",
      "bedroll: the code file src/render/gone.ts does not exist",
    ]);
  });

  it("reports a file listed as a draft, because drafts are built in code", () => {
    const entry = { ...fileEntry("public/assets/a.glb", "pending"), approval: { status: "draft", ticket: ".scratch/f/issues/01-a.md" } };
    expect(findBrokenEntries({ assets: [entry as unknown as FileAssetEntry] }, everythingExists)).toEqual([
      "public/assets/a.glb: a file cannot be a draft, because drafts are built in code",
    ]);
  });

  it("reports an id listed twice", () => {
    expect(findBrokenEntries({ assets: [draftEntry("pot"), draftEntry("pot")] }, everythingExists)).toEqual([
      "pot: the id is listed more than once",
    ]);
  });
});

describe("listDrafts", () => {
  it("returns only the draft assets, in catalogue order", () => {
    const manifest: AssetManifest = {
      assets: [draftEntry("pot"), fileEntry("public/assets/tree.glb", "approved"), draftEntry("bedroll")],
    };
    expect(listDrafts(manifest).map((entry) => entry.id)).toEqual(["pot", "bedroll"]);
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import { SHOWCASE_ASSET_IDS } from "./asset-showcase";

interface Entry {
  readonly id: string;
  readonly code: readonly string[];
}

const manifest = JSON.parse(readFileSync(join(import.meta.dirname, "../../asset-manifest.json"), "utf8")) as { assets: Entry[] };

describe("asset showcase", () => {
  it("can show every catalogue asset that has code", () => {
    const withCode = manifest.assets.filter((entry) => entry.code.length > 0).map((entry) => entry.id);
    expect(withCode.filter((id) => !SHOWCASE_ASSET_IDS.includes(id))).toEqual([]);
  });

  it("shows only assets in the catalogue", () => {
    const ids = manifest.assets.map((entry) => entry.id);
    expect(SHOWCASE_ASSET_IDS.filter((id) => !ids.includes(id))).toEqual([]);
  });
});

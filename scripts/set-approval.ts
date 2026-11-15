// Sets one asset's approval in asset-manifest.json, for the make-asset skill.
// See docs/adr/0006-tickets-add-draft-assets-owner-approves-final.md.
//
// Usage: bun scripts/set-approval.ts <id> <pending|approved>
//   pending    The asset is shown to the owner and waits for their decision.
//   approved   The owner approved the asset in chat. Records "by": "owner" and today's date.
//
// Only the owner's words in chat approve an asset. Run "approved" only after they do.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AssetManifest, AssetStatus } from "./asset-manifest";

const [id, status] = process.argv.slice(2);
if (id === undefined || (status !== "pending" && status !== "approved")) {
  console.error("Usage: bun scripts/set-approval.ts <id> <pending|approved>");
  process.exit(1);
}

const path = join(import.meta.dirname, "..", "asset-manifest.json");
const manifest = JSON.parse(readFileSync(path, "utf8")) as AssetManifest;
if (!manifest.assets.some((asset) => asset.id === id)) {
  console.error(`No asset with the id "${id}" in asset-manifest.json.`);
  process.exit(1);
}

// Format the date from local time, so an approval late in the evening gets the owner's date.
const now = new Date();
const today = [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((part) => String(part).padStart(2, "0")).join("-");
const approval: AssetStatus = status === "pending" ? { status: "pending" } : { status: "approved", by: "owner", date: today };

// Replace only this entry's approval object in the text. Rewriting the whole file would change the
// hand-made layout of other entries, and the formatter skips JSON files.
const text = readFileSync(path, "utf8");
const idAt = text.indexOf(`"id": ${JSON.stringify(id)}`);
const keyAt = text.indexOf('"approval":', idAt);
const nextIdAt = text.indexOf('"id":', idAt + 1);
if (idAt < 0 || keyAt < 0 || (nextIdAt >= 0 && keyAt > nextIdAt)) {
  console.error(`Could not find the approval of "${id}" in asset-manifest.json.`);
  process.exit(1);
}
const openAt = text.indexOf("{", keyAt);
const closeAt = text.indexOf("}", openAt);
const indent = text.slice(text.lastIndexOf("\n", keyAt) + 1, keyAt);
const fields = Object.entries(approval).map(([key, value]) => `${indent}  ${JSON.stringify(key)}: ${JSON.stringify(value)}`);
const updated = `${text.slice(0, openAt)}{\n${fields.join(",\n")}\n${indent}}${text.slice(closeAt + 1)}`;

// Check the result before saving it.
const check = (JSON.parse(updated) as AssetManifest).assets.find((asset) => asset.id === id);
if (JSON.stringify(check?.approval) !== JSON.stringify(approval)) {
  console.error(`Setting the approval of "${id}" went wrong. asset-manifest.json is unchanged.`);
  process.exit(1);
}
writeFileSync(path, updated);
console.log(`${id}: approval is now ${JSON.stringify(approval)}`);

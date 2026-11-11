// Lists the draft assets in asset-manifest.json, so the owner can pick one to polish with the make-asset skill.
// See docs/adr/0006-tickets-add-draft-assets-owner-approves-final.md.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { listDrafts, type AssetManifest } from "./asset-manifest";

const ROOT = join(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(join(ROOT, "asset-manifest.json"), "utf8")) as AssetManifest;
const drafts = listDrafts(manifest);

if (drafts.length === 0) {
  console.log("No draft assets.");
} else {
  console.log(`${drafts.length} draft asset(s):`);
  for (const draft of drafts) {
    const ticket = draft.approval.status === "draft" ? draft.approval.ticket : "";
    console.log(`  ${draft.id}: ${draft.description}`);
    console.log(`    code: ${draft.code.length > 0 ? draft.code.join(", ") : "(nothing draws it yet)"}`);
    console.log(`    ticket: ${ticket}`);
  }
}

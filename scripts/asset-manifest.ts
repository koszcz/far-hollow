// Types and checks for the asset catalogue, asset-manifest.json.
// See docs/adr/0006-tickets-add-draft-assets-owner-approves-final.md.

/** A rough asset that a ticket built in code. The owner has not approved it yet. */
export interface DraftStatus {
  status: "draft";
  /** The ticket that added the draft, as a path from the project root. */
  ticket: string;
}

/** An asset proposed to the owner and waiting for their decision. */
export interface PendingStatus {
  status: "pending";
}

/** The owner's decision on an asset. Only the project owner can approve or reject an asset. */
export interface OwnerDecision {
  status: "approved" | "rejected";
  by: "owner";
  /** Date of the decision, as YYYY-MM-DD. */
  date: string;
}

export type AssetStatus = DraftStatus | PendingStatus | OwnerDecision;

interface AssetEntryBase {
  id: string;
  description: string;
  source: string;
  license: string;
  /** The files that build, load, or draw the asset, as paths from the project root. Empty if nothing uses it yet. */
  code: string[];
}

/** An asset built in code. It has no file of its own. */
export interface CodeAssetEntry extends AssetEntryBase {
  kind: "code";
  approval: AssetStatus;
}

/** An asset stored as a file in the project, such as a model or a sound. A file is never a draft. */
export interface FileAssetEntry extends AssetEntryBase {
  kind: "file";
  /** Path from the project root, using forward slashes. */
  file: string;
  approval: PendingStatus | OwnerDecision;
}

export type AssetEntry = CodeAssetEntry | FileAssetEntry;

export interface AssetManifest {
  assets: AssetEntry[];
}

export interface UnapprovedAsset {
  file: string;
  reason: "not-listed" | "not-approved";
}

/** Returns every asset file that the manifest does not list as approved. */
export function findUnapprovedAssets(files: string[], manifest: AssetManifest): UnapprovedAsset[] {
  const statusByFile = new Map<string, AssetStatus["status"]>();
  for (const entry of manifest.assets) {
    if (entry.kind === "file") statusByFile.set(entry.file, entry.approval.status);
  }

  const problems: UnapprovedAsset[] = [];
  for (const file of files) {
    const status = statusByFile.get(file);
    if (status === undefined) problems.push({ file, reason: "not-listed" });
    else if (status !== "approved") problems.push({ file, reason: "not-approved" });
  }
  return problems;
}

/** Returns a message for every entry that breaks the catalogue rules, such as a draft file or a path that does not exist. */
export function findBrokenEntries(manifest: AssetManifest, pathExists: (path: string) => boolean): string[] {
  const problems: string[] = [];
  const seenIds = new Set<string>();
  for (const entry of manifest.assets) {
    if (seenIds.has(entry.id)) problems.push(`${entry.id}: the id is listed more than once`);
    seenIds.add(entry.id);

    const status: string = entry.approval.status;
    if (entry.kind === "file" && status === "draft") {
      problems.push(`${entry.id}: a file cannot be a draft, because drafts are built in code`);
    }
    if (entry.approval.status === "draft" && !pathExists(entry.approval.ticket)) {
      problems.push(`${entry.id}: the draft's ticket ${entry.approval.ticket} does not exist`);
    }
    for (const path of entry.code) {
      if (!pathExists(path)) problems.push(`${entry.id}: the code file ${path} does not exist`);
    }
  }
  return problems;
}

/** Returns every draft asset, in catalogue order. */
export function listDrafts(manifest: AssetManifest): CodeAssetEntry[] {
  return manifest.assets.filter(
    (entry): entry is CodeAssetEntry => entry.kind === "code" && entry.approval.status === "draft",
  );
}

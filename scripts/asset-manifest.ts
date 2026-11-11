// Types and checks for the asset catalogue, asset-manifest.json.
// See docs/adr/0006-tickets-add-draft-assets-owner-approves-final.md.

/** A rough asset that a ticket added, built in code or from a third-party file the owner let in. The owner has not approved it yet. */
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

/**
 * An asset stored as a file in the project, such as a model or a sound.
 * A file is a draft only when the owner let the third-party file into the game first, recorded in fileApproval.
 * Then the file's license is known, and the owner still decides on the asset's look later.
 */
export interface FileAssetEntry extends AssetEntryBase {
  kind: "file";
  /** Path from the project root, using forward slashes. */
  file: string;
  approval: AssetStatus;
  /** The owner's decision to let a draft's third-party file into the game. Only a draft file has it. */
  fileApproval?: OwnerDecision;
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
    if (entry.kind !== "file") continue;
    statusByFile.set(entry.file, isDraftFileLetIn(entry) ? "approved" : entry.approval.status);
  }

  const problems: UnapprovedAsset[] = [];
  for (const file of files) {
    const status = statusByFile.get(file);
    if (status === undefined) problems.push({ file, reason: "not-listed" });
    else if (status !== "approved") problems.push({ file, reason: "not-approved" });
  }
  return problems;
}

/** Whether an entry is a draft whose third-party file the owner has let into the game. */
function isDraftFileLetIn(entry: FileAssetEntry): boolean {
  return entry.approval.status === "draft" && entry.fileApproval?.status === "approved";
}

/** Returns a message for every entry that breaks the catalogue rules, such as a draft file or a path that does not exist. */
export function findBrokenEntries(manifest: AssetManifest, pathExists: (path: string) => boolean): string[] {
  const problems: string[] = [];
  const seenIds = new Set<string>();
  for (const entry of manifest.assets) {
    if (seenIds.has(entry.id)) problems.push(`${entry.id}: the id is listed more than once`);
    seenIds.add(entry.id);

    if (entry.kind === "file" && entry.approval.status === "draft" && !isDraftFileLetIn(entry)) {
      problems.push(`${entry.id}: a draft file needs the owner's approval of the file in fileApproval`);
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
export function listDrafts(manifest: AssetManifest): AssetEntry[] {
  return manifest.assets.filter((entry) => entry.approval.status === "draft");
}

export interface AssetApproval {
  status: "approved" | "pending" | "rejected";
  /** Who decided. Only the project owner can approve an asset. */
  by: "owner";
  /** Date of the decision, as YYYY-MM-DD. */
  date: string;
}

interface AssetEntryBase {
  id: string;
  description: string;
  source: string;
  license: string;
  approval: AssetApproval;
}

/** An asset built in code. It has no file of its own. */
export interface CodeAssetEntry extends AssetEntryBase {
  kind: "code";
}

/** An asset stored as a file in the project, such as a model or a sound. */
export interface FileAssetEntry extends AssetEntryBase {
  kind: "file";
  /** Path from the project root, using forward slashes. */
  file: string;
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
  const statusByFile = new Map<string, AssetApproval["status"]>();
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

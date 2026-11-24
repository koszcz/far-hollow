// The asset browser's list: catalogue entries grouped by showcase family, searched, and filtered. Pure functions only.
// The page is src/ui/asset-browser.tsx.
import type { AssetEntry } from "../../scripts/asset-manifest";

/** The group for catalogue assets that no showcase family draws. */
export const NO_SHOWCASE_GROUP = "no showcase";

/** One showcase family, by name, with the ids of the assets it shows. */
export interface FamilyIds {
  readonly name: string;
  readonly ids: readonly string[];
}

/** One group of the sidebar: a family name and its assets, in catalogue order. */
export interface AssetGroup {
  readonly name: string;
  readonly entries: readonly AssetEntry[];
}

/** What the sidebar shows: the search text and whether only assets that are not approved show. */
export interface ListFilter {
  readonly search: string;
  readonly notApproved: boolean;
}

/** Whether the search text is in the asset's id or description, ignoring case. Empty text matches every asset. */
export function matchesSearch(entry: AssetEntry, search: string): boolean {
  const text = search.trim().toLowerCase();
  return text === "" || entry.id.toLowerCase().includes(text) || entry.description.toLowerCase().includes(text);
}

/** Whether the asset still waits for the owner: a draft, or pending their decision. */
export function isNotApproved(entry: AssetEntry): boolean {
  return entry.approval.status === "draft" || entry.approval.status === "pending";
}

/** Whether the asset shows under this filter. */
export function passesFilter(entry: AssetEntry, filter: ListFilter): boolean {
  return matchesSearch(entry, filter.search) && (!filter.notApproved || isNotApproved(entry));
}

/**
 * Groups the entries that pass the filter by showcase family, in the families' order, then the assets with no showcase.
 * Groups left empty by the filter are left out.
 */
export function groupAssets(entries: readonly AssetEntry[], families: readonly FamilyIds[], filter: ListFilter): AssetGroup[] {
  const shown = entries.filter((entry) => passesFilter(entry, filter));
  const inFamily = new Set(families.flatMap((family) => family.ids));
  const groups = families.map((family) => ({ name: family.name, entries: shown.filter((entry) => family.ids.includes(entry.id)) }));
  groups.push({ name: NO_SHOWCASE_GROUP, entries: shown.filter((entry) => !inFamily.has(entry.id)) });
  return groups.filter((group) => group.entries.length > 0);
}

/**
 * The asset `step` places after `current` in the groups as listed, top to bottom. Stops at either end.
 * When `current` is not listed, returns the first asset.
 */
export function neighbourId(groups: readonly AssetGroup[], current: string, step: 1 | -1): string | undefined {
  const ids = groups.flatMap((group) => group.entries.map((entry) => entry.id));
  const index = ids.indexOf(current);
  if (index === -1) return ids[0];
  return ids[Math.min(ids.length - 1, Math.max(0, index + step))];
}

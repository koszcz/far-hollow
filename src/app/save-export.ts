// Turns a save slot's saved game into a file the player can keep outside the browser.

import { describeSave } from "../sim/save";
import { strings } from "../strings";

/** A file to put on the player's computer: its name and its text. */
export interface ExportFile {
  readonly name: string;
  readonly text: string;
}

/**
 * The file that holds a slot's saved game, exactly as stored, as readable JSON.
 * Returns undefined for an empty slot, which has nothing to export. Slots are numbered from 0.
 */
export function saveExportFile(slot: number, stored: unknown): ExportFile | undefined {
  const summary = describeSave(stored);
  if (summary.state === "empty") return undefined;
  const name = summary.state === "filled" ? strings.startScreen.exportFileName(slot + 1, summary.day) : strings.startScreen.brokenExportFileName(slot + 1);
  return { name, text: JSON.stringify(stored, null, 2) };
}

/** How long a download link stays valid after the click, in milliseconds. */
const DOWNLOAD_LINK_LIFETIME_MS = 10_000;

/** Puts a file in the player's downloads, the way the browser saves any downloaded file. */
export function downloadFile(file: ExportFile): void {
  const url = URL.createObjectURL(new Blob([file.text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  // Some browsers start the download after click() returns, so the link stays valid a little longer.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, DOWNLOAD_LINK_LIFETIME_MS);
}

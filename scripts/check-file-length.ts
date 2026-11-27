// Fails the build if a tracked CSS file is longer than the cap. Oxlint does not read CSS,
// so this script does the job of its `max-lines` rule for stylesheets.
// See .scratch/file-length/spec.md.
import { readFileSync } from "node:fs";

/**
 * Longest allowed CSS file, in lines. It is the length of the longest CSS file, src/app/styles/hud-needs-and-hotbar.css.
 * Lower this cap whenever a split brings the longest file down. Never raise it.
 */
export const CSS_CAP = 429;

export type FileLength = { path: string; lines: number };

/** Count every line of a text, blank lines included. */
export function countLines(text: string): number {
  if (text === "") return 0;
  const breaks = text.split("\n").length - 1;
  return text.endsWith("\n") ? breaks : breaks + 1;
}

/** True for a CSS file this check covers: any `.css` file outside `.scratch/`. */
export function isCheckedCss(path: string): boolean {
  return path.endsWith(".css") && !path.startsWith(".scratch/");
}

/** The files that are over the cap. */
export function findLongFiles(files: FileLength[], cap: number): FileLength[] {
  return files.filter((file) => file.lines > cap);
}

if (import.meta.main) {
  const root = new URL("..", import.meta.url).pathname;
  const listed = Bun.spawnSync(["git", "ls-files", "-z"], { cwd: root }).stdout.toString();
  const files = listed
    .split("\0")
    .filter(isCheckedCss)
    .map((path) => ({ path, lines: countLines(readFileSync(root + path, "utf8")) }));
  const long = findLongFiles(files, CSS_CAP);
  for (const file of long) {
    console.error(`${file.path} has ${file.lines} lines, over the CSS cap of ${CSS_CAP}.`);
  }
  if (long.length > 0) process.exit(1);
}

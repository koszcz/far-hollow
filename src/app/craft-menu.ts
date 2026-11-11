/** What a key press does to the craft menu: open it, close it, or nothing. */
export type CraftKeyResult = "open" | "close" | "ignore";

/**
 * What a key press does to the craft menu, given whether it is open and the key's `KeyboardEvent.code`.
 * C opens and closes it. Escape closes it. Other keys do nothing here.
 * The menu is input state, not game state. Only choosing a recipe sends a command.
 */
export function pressCraftKey(open: boolean, code: string): CraftKeyResult {
  if (code === "KeyC") return open ? "close" : "open";
  if (code === "Escape" && open) return "close";
  return "ignore";
}

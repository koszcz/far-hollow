/**
 * Whether the craft menu is open after a key press, given whether it was open and the key's `KeyboardEvent.code`.
 * C opens and closes it. Escape closes it. Undefined if the key does nothing here.
 * The menu is input state, not game state. Only choosing a recipe sends a command.
 */
export function pressCraftKey(open: boolean, code: string): boolean | undefined {
  if (code === "KeyC") return !open;
  if (code === "Escape" && open) return false;
  return undefined;
}

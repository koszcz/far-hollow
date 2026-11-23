/** What a key press does to the journal panel: open it, close it, or nothing. */
export type JournalKeyResult = "open" | "close" | "ignore";

/**
 * What a key press does to the journal panel, given whether it is open, whether the game has a journal, and the key's
 * `KeyboardEvent.code`. J opens and closes it. Escape closes it. The playground has no journal, so J does nothing there.
 * The panel is input state, not game state. Only the hide toggle sends a command.
 */
export function pressJournalKey({ open, hasJournal }: { open: boolean; hasJournal: boolean }, code: string): JournalKeyResult {
  if (!hasJournal) return "ignore";
  if (code === "KeyJ") return open ? "close" : "open";
  if (code === "Escape" && open) return "close";
  return "ignore";
}

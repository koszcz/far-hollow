import { describe, expect, it } from "bun:test";
import { pressJournalKey } from "./journal-key";

describe("the journal key", () => {
  it("opens the journal panel with J, and closes it with J again", () => {
    expect(pressJournalKey({ open: false, hasJournal: true }, "KeyJ")).toBe("open");
    expect(pressJournalKey({ open: true, hasJournal: true }, "KeyJ")).toBe("close");
  });

  it("closes the open panel with Escape", () => {
    expect(pressJournalKey({ open: true, hasJournal: true }, "Escape")).toBe("close");
  });

  it("ignores other keys, and Escape while the panel is shut", () => {
    expect(pressJournalKey({ open: false, hasJournal: true }, "KeyC")).toBe("ignore");
    expect(pressJournalKey({ open: false, hasJournal: true }, "Escape")).toBe("ignore");
  });

  it("does nothing in the playground, which has no journal", () => {
    expect(pressJournalKey({ open: false, hasJournal: false }, "KeyJ")).toBe("ignore");
  });
});

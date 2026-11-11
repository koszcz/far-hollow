import { describe, expect, it } from "vitest";
import { pressCraftKey } from "./craft-menu";

describe("the craft menu key", () => {
  it("opens the craft menu with C, and closes it with C again", () => {
    expect(pressCraftKey(false, "KeyC")).toBe(true);
    expect(pressCraftKey(true, "KeyC")).toBe(false);
  });

  it("closes the open menu with Escape", () => {
    expect(pressCraftKey(true, "Escape")).toBe(false);
  });

  it("ignores other keys, and Escape while the menu is shut", () => {
    expect(pressCraftKey(false, "KeyB")).toBeUndefined();
    expect(pressCraftKey(false, "Escape")).toBeUndefined();
  });
});

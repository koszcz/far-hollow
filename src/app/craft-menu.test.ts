import { describe, expect, it } from "vitest";
import { pressCraftKey } from "./craft-menu";

describe("the craft menu key", () => {
  it("opens the craft menu with C, and closes it with C again", () => {
    expect(pressCraftKey(false, "KeyC")).toBe("open");
    expect(pressCraftKey(true, "KeyC")).toBe("close");
  });

  it("closes the open menu with Escape", () => {
    expect(pressCraftKey(true, "Escape")).toBe("close");
  });

  it("ignores other keys, and Escape while the menu is shut", () => {
    expect(pressCraftKey(false, "KeyB")).toBe("ignore");
    expect(pressCraftKey(false, "Escape")).toBe("ignore");
  });
});

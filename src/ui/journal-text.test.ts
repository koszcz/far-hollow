import { describe, expect, it } from "bun:test";
import { GOALS } from "../sim/api";
import { journalLineText, journalSections } from "./journal-text";

describe("the journal's HUD line", () => {
  it("names the first goal not yet done", () => {
    expect(journalLineText({ done: [], hidden: false, justDone: null })).toBe("Next (J): Pick up sticks.");
    expect(journalLineText({ done: ["pickUpSticks", "fellTree"], hidden: false, justDone: null })).toBe("Next (J): Light a campfire.");
  });

  it("goes away while the journal is hidden, in the playground, and for good once every goal is done", () => {
    expect(journalLineText({ done: [], hidden: true, justDone: null })).toBeNull();
    expect(journalLineText(null)).toBeNull();
    expect(journalLineText({ done: [...GOALS], hidden: false, justDone: null })).toBeNull();
  });
});

describe("the journal panel's sections", () => {
  it("lists the goals not yet done first ones first, each with its hint, then the goals done", () => {
    const sections = journalSections({ done: ["fellTree", "pickUpSticks"], hidden: false, justDone: null });

    expect(sections.toDo.map((goal) => goal.name)).toEqual([
      "Light a campfire.",
      "Build a lean-to.",
      "Sleep on a bedroll, anywhere.",
      "Build a sawhorse and cut a plank.",
      "Build a first room.",
      "Make the room snug.",
    ]);
    expect(sections.toDo[0]?.hint).toContain("Press B");
    expect(sections.done.map((goal) => goal.name)).toEqual(["Pick up sticks.", "Fell a tree."]);
    expect(sections.finished).toBeNull();
  });

  it("shows the closing line once every goal is done", () => {
    const sections = journalSections({ done: [...GOALS], hidden: false, justDone: null });

    expect(sections.toDo).toEqual([]);
    expect(sections.finished).toBe("Your camp is yours now.");
  });
});

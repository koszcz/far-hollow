import { describe, expect, it } from "bun:test";
import { CSS_CAP, countLines, findLongFiles, isCheckedCss } from "./check-file-length";

describe("findLongFiles", () => {
  it("passes a file at the cap", () => {
    expect(findLongFiles([{ path: "a.css", lines: CSS_CAP }], CSS_CAP)).toEqual([]);
  });

  it("fails a file one line over the cap and names it", () => {
    const long = { path: "b.css", lines: CSS_CAP + 1 };
    expect(findLongFiles([{ path: "a.css", lines: 3 }, long], CSS_CAP)).toEqual([long]);
  });
});

describe("countLines", () => {
  it("counts every line, including blank ones", () => {
    expect(countLines("a\n\nb\n")).toBe(3);
    expect(countLines("a\nb")).toBe(2);
    expect(countLines("")).toBe(0);
  });
});

describe("isCheckedCss", () => {
  it("checks CSS files and skips .scratch", () => {
    expect(isCheckedCss("src/app/style.css")).toBe(true);
    expect(isCheckedCss(".scratch/x/demo.css")).toBe(false);
    expect(isCheckedCss("src/app/main.ts")).toBe(false);
  });
});

import { describe, expect, it } from "bun:test";
import { createGame } from "../sim/game";
import { BUILD_TABS, entriesInTab } from "./build-tabs";

describe("the build menu's tabs", () => {
  const menu = createGame({ seed: 42 }).client.getView().buildMenu;
  const listed = (tab: (typeof BUILD_TABS)[number]) => entriesInTab(menu, tab).map(({ structure }) => structure);

  it("are Camp, Shelter, and Furniture, in that order", () => {
    expect(BUILD_TABS).toEqual(["camp", "shelter", "furniture"]);
  });

  it("list the campfire, lean-to, woodpile, sawhorse, and sled under Camp", () => {
    expect(listed("camp")).toEqual(["campfire", "leanTo", "woodpile", "sawhorse", "sled"]);
  });

  it("list the foundation, floor, log wall, door frame, window, roof frame, and fireplace under Shelter", () => {
    expect(listed("shelter")).toEqual(["foundation", "floor", "logWall", "doorFrame", "window", "roofFrame", "fireplace"]);
  });

  it("list the chest, shelf, bed, table, stool, rain barrel, and drying rack under Furniture", () => {
    expect(listed("furniture")).toEqual(["chest", "shelf", "bed", "table", "stool", "rainBarrel", "dryingRack"]);
  });
});

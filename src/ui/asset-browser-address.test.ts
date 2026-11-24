import { describe, expect, it } from "bun:test";
import { readAddress, showcaseAddress, writeAddress } from "./asset-browser-address";

describe("asset browser address", () => {
  it("reads the chosen asset, play, and speed", () => {
    expect(readAddress("?assets=bed&play&speed=0.25")).toEqual({ asset: "bed", play: true, speed: 0.25 });
  });

  it("reads a bare /?assets as no asset, still views, at normal speed", () => {
    expect(readAddress("?assets")).toEqual({ asset: undefined, play: false, speed: 1 });
  });

  it("reads a speed it does not offer as normal speed", () => {
    expect(readAddress("?assets=bed&play&speed=3").speed).toBe(1);
    expect(readAddress("?assets=bed&speed=fast").speed).toBe(1);
  });

  it("writes the chosen asset, play, and speed", () => {
    expect(writeAddress({ asset: "bed", play: true, speed: 0.25 })).toBe("?assets=bed&play&speed=0.25");
    expect(writeAddress({ asset: "bed", play: false, speed: 1 })).toBe("?assets=bed");
    expect(writeAddress({ asset: undefined, play: false, speed: 1 })).toBe("?assets");
  });

  it("reads back what it writes", () => {
    for (const address of [
      { asset: "walk-animation", play: true, speed: 2 },
      { asset: "sound-rain-roof", play: false, speed: 0.5 },
      { asset: "bed", play: false, speed: 1 },
    ] as const) {
      expect(readAddress(writeAddress(address))).toEqual(address);
    }
  });

  it("opens the bare showcase with play and speed only while playing", () => {
    expect(showcaseAddress("bed", true, 0.25)).toBe("/?asset=bed&play&speed=0.25");
    expect(showcaseAddress("bed", true, 1)).toBe("/?asset=bed&play");
    expect(showcaseAddress("bed", false, 0.25)).toBe("/?asset=bed");
  });
});

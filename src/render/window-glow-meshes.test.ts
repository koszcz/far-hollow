import * as THREE from "three";
import { describe, expect, it } from "bun:test";
import { MORNING_HOUR, NIGHT_START_HOUR } from "../sim/clock";
import { createEntityStore } from "../sim/entities";
import { daylightAt } from "./daylight";
import { createWindowGlowMeshes, windowGlowStrength } from "./window-glow-meshes";

describe("how strongly a firelit window glows", () => {
  it("is off by day, full at night, and fades in at dusk and out at dawn with the daylight", () => {
    expect(windowGlowStrength(daylightAt(12))).toBe(0);
    expect(windowGlowStrength(daylightAt(0))).toBe(1);
    const dusk = windowGlowStrength(daylightAt(NIGHT_START_HOUR - 1));
    const dawn = windowGlowStrength(daylightAt(MORNING_HOUR + 1));
    for (const twilight of [dusk, dawn]) {
      expect(twilight).toBeGreaterThan(0);
      expect(twilight).toBeLessThan(1);
    }
    expect(windowGlowStrength(daylightAt(NIGHT_START_HOUR - 0.5))).toBeGreaterThan(dusk);
  });
});

describe("drawing the glow", () => {
  it("draws nothing for a valley with no firelit window", () => {
    const meshes = createWindowGlowMeshes(createEntityStore());
    meshes.update(0);
    let shown = 0;
    meshes.group.traverseVisible((object) => {
      if (object instanceof THREE.Mesh) shown += 1;
    });
    expect(shown).toBe(0);
    meshes.dispose();
  });
});

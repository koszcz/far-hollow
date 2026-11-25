import * as THREE from "three";
import { describe, expect, it } from "bun:test";
import { nightHoursOf } from "../sim/season";
import { createEntityStore } from "../sim/entities";
import { cabinCutaway } from "./cabin-cutaway";
import { daylightAt } from "./daylight";
import { FADED_OPACITY } from "./structure-look";
import { createWindowGlowMeshes, windowGlowFlicker, windowGlowStrength } from "./window-glow-meshes";

const SPRING = nightHoursOf("spring");
const NIGHT_START_HOUR = SPRING.nightStartHour;
const MORNING_HOUR = SPRING.morningHour;

describe("how strongly a firelit window glows", () => {
  it("is off by day, full at night, and fades in at dusk and out at dawn with the daylight", () => {
    expect(windowGlowStrength(daylightAt(12, SPRING))).toBe(0);
    expect(windowGlowStrength(daylightAt(0, SPRING))).toBe(1);
    const dusk = windowGlowStrength(daylightAt(NIGHT_START_HOUR - 1, SPRING));
    const dawn = windowGlowStrength(daylightAt(MORNING_HOUR + 1, SPRING));
    for (const twilight of [dusk, dawn]) {
      expect(twilight).toBeGreaterThan(0);
      expect(twilight).toBeLessThan(1);
    }
    expect(windowGlowStrength(daylightAt(NIGHT_START_HOUR - 0.5, SPRING))).toBeGreaterThan(dusk);
  });
});

describe("the firelight's flicker", () => {
  it("stays near full strength and changes smoothly, with no jump between frames", () => {
    const frame = 1 / 60;
    for (let seconds = 0; seconds < 20; seconds += frame) {
      const now = windowGlowFlicker(seconds, 0);
      expect(now).toBeGreaterThan(0.8);
      expect(now).toBeLessThan(1.2);
      expect(Math.abs(windowGlowFlicker(seconds + frame, 0) - now)).toBeLessThan(0.03);
    }
  });

  it("is out of step in two windows", () => {
    expect(windowGlowFlicker(3, 0)).not.toBeCloseTo(windowGlowFlicker(3, 2));
  });
});

describe("drawing the glow", () => {
  it("draws nothing for a valley with no firelit window", () => {
    const meshes = createWindowGlowMeshes(createEntityStore());
    meshes.update({ daylight: 0, nowSeconds: 0 });
    let shown = 0;
    meshes.group.traverseVisible((object) => {
      if (object instanceof THREE.Mesh) shown += 1;
    });
    expect(shown).toBe(0);
    meshes.dispose();
  });

  it("fades with its window when the window stands between the camera and the player", () => {
    const window = { edgePiece: "window" as const, facing: { turns: 0 as const }, position: { x: 0, y: 0, z: 0 } };
    const entities = createEntityStore();
    const meshes = createWindowGlowMeshes(entities, () => [{ window, outward: 0 }]);
    const outside = { x: 0, y: 1, z: 5 };
    const inside = { x: 0, y: 0, z: -2 };

    meshes.update({ daylight: 0, nowSeconds: 0, cutaway: cabinCutaway(entities, outside, outside) });
    const clear = glowOpacities(meshes.group);
    meshes.update({ daylight: 0, nowSeconds: 0, cutaway: cabinCutaway(entities, outside, inside) });
    const faded = glowOpacities(meshes.group);

    expect(clear.length).toBeGreaterThan(0);
    expect(faded.length).toBe(clear.length);
    faded.forEach((opacity, i) => {
      expect(opacity).toBeCloseTo((clear[i] ?? 0) * FADED_OPACITY);
    });
    meshes.dispose();
  });
});

/** The opacity of each glow mesh shown in `group`. */
function glowOpacities(group: THREE.Object3D): number[] {
  const opacities: number[] = [];
  group.traverseVisible((object) => {
    if (object instanceof THREE.Mesh) opacities.push((object.material as THREE.Material).opacity);
  });
  return opacities;
}

import * as THREE from "three";
import { describe, expect, it } from "bun:test";
import { MORNING_HOUR, NIGHT_START_HOUR } from "../sim/clock";
import { createEntityStore } from "../sim/entities";
import { daylightAt } from "./daylight";
import { FADED_OPACITY } from "./structure-look";
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

  it("fades with its window when the window stands between the camera and the player", () => {
    const window = { edgePiece: "window" as const, facing: { turns: 0 as const }, position: { x: 0, y: 0, z: 0 } };
    const meshes = createWindowGlowMeshes(createEntityStore(), () => [{ window, outward: 0 }]);
    const outside = { x: 0, y: 1, z: 5 };
    const inside = { x: 0, y: 0, z: -2 };

    meshes.update(0, { camera: outside, player: outside });
    const clear = glowOpacities(meshes.group);
    meshes.update(0, { camera: outside, player: inside });
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

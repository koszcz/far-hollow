import * as THREE from "three";
import { describe, expect, it } from "bun:test";
import { TREE_COLOURS } from "./forest-meshes";
import { createStickGeometry, STICK_COLOUR } from "./stick-shape";

/** The forest floor's base colour, from ground-texture.ts. */
const FOREST_FLOOR_COLOUR = 0x4f3d2a;
/** The stick bark colour before this change, from the approved asset. */
const OLD_STICK_COLOUR = 0x8a6440;
/** How tall the old stick stood at its foot, in metres, measured from the approved asset. */
const OLD_FOOT_THICKNESS_METRES = 0.093;

/** Hue, saturation, and lightness of a hex colour as written, each from 0 to 1. */
function hsl(hex: number) {
  const result = { h: 0, s: 0, l: 0 };
  new THREE.Color()
    .setRGB(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255, THREE.LinearSRGBColorSpace)
    .getHSL(result, THREE.LinearSRGBColorSpace);
  return result;
}

describe("stick look", () => {
  it("has pale bark, much lighter than the forest floor and the tree trunks", () => {
    const stick = hsl(STICK_COLOUR);
    expect(stick.l).toBeGreaterThan(hsl(FOREST_FLOOR_COLOUR).l + 0.25);
    expect(stick.l).toBeGreaterThan(hsl(TREE_COLOURS.trunk.light).l + 0.2);
    expect(stick.l).toBeGreaterThan(hsl(OLD_STICK_COLOUR).l);
  });

  it("has grey-tan bark, duller than the old brown bark", () => {
    const stick = hsl(STICK_COLOUR);
    // Tan: a warm hue between orange and yellow.
    expect(stick.h).toBeGreaterThan(20 / 360);
    expect(stick.h).toBeLessThan(55 / 360);
    // Grey: far less colourful than the old bark.
    expect(stick.s).toBeLessThan(0.25);
    expect(stick.s).toBeLessThan(hsl(OLD_STICK_COLOUR).s);
  });

  it("is slightly thicker than before at its foot", () => {
    const geometry = createStickGeometry();
    const positions = geometry.getAttribute("position");
    // The foot is the end at x = -0.45. Measure how tall the stick is there.
    let low = Infinity;
    let high = -Infinity;
    for (let i = 0; i < positions.count; i += 1) {
      if (positions.getX(i) > -0.4) continue;
      low = Math.min(low, positions.getY(i));
      high = Math.max(high, positions.getY(i));
    }
    const thickness = high - low;
    expect(thickness).toBeGreaterThan(OLD_FOOT_THICKNESS_METRES * 1.15);
    expect(thickness).toBeLessThan(OLD_FOOT_THICKNESS_METRES * 1.6);
  });

  it("keeps its crooked length and two side twigs", () => {
    const geometry = createStickGeometry();
    geometry.computeBoundingBox();
    const box = geometry.boundingBox ?? new THREE.Box3();
    expect(box.max.x - box.min.x).toBeCloseTo(0.9, 1);
    // The twigs reach out sideways beyond the bends of the main branch.
    expect(box.max.z).toBeGreaterThan(0.2);
    expect(box.min.z).toBeLessThan(-0.1);
  });
});

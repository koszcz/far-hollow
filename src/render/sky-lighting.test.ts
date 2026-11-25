import * as THREE from "three";
import { describe, expect, it } from "bun:test";
import { nightHoursOf } from "../sim/season";
import { castsSunShadow, sunDirectionAt } from "./sky-lighting";
import { fadedOut, seeThrough } from "./structure-look";

const box = new THREE.BoxGeometry(1, 1, 1);

describe("which meshes cast the sun's shadow", () => {
  it("counts solid meshes, and pieces faded out between the camera and the player, so a faded wall keeps the room in shade", () => {
    expect(castsSunShadow(new THREE.Mesh(box, new THREE.MeshStandardMaterial()))).toBe(true);
    expect(castsSunShadow(new THREE.Mesh(box, fadedOut(0x886644, 0.2)))).toBe(true);
  });

  it("leaves out see-through blueprints and invisible meshes", () => {
    expect(castsSunShadow(new THREE.Mesh(box, seeThrough(0xbfe3ff, 0.35)))).toBe(false);
    expect(castsSunShadow(new THREE.Mesh(box, new THREE.MeshBasicMaterial({ visible: false })))).toBe(false);
  });
});

describe("the sun's path", () => {
  const heightAt = (hour: number, season: "spring" | "summer" | "winter") => sunDirectionAt(hour, nightHoursOf(season), new THREE.Vector3()).y;

  it("rises at morning and sets at nightfall, by the season's night hours", () => {
    expect(heightAt(8, "winter")).toBeCloseTo(0, 5);
    expect(heightAt(17, "winter")).toBeCloseTo(0, 5);
    expect(heightAt(7, "winter")).toBeLessThan(0);
    expect(heightAt(18, "winter")).toBeLessThan(0);
    expect(heightAt(5, "summer")).toBeCloseTo(0, 5);
    expect(heightAt(21, "summer")).toBeCloseTo(0, 5);
    expect(heightAt(20.5, "summer")).toBeGreaterThan(0);
  });

  it("stands highest halfway through the day", () => {
    expect(heightAt(12.5, "winter")).toBeCloseTo(heightAt(13, "spring"), 5);
    expect(heightAt(12.5, "winter")).toBeGreaterThan(heightAt(11, "winter"));
  });
});

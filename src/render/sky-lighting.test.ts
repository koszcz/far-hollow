import * as THREE from "three";
import { describe, expect, it } from "bun:test";
import { castsSunShadow } from "./sky-lighting";
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

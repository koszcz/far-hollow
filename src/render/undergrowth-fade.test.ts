import * as THREE from "three";
import { describe, expect, it } from "bun:test";
import { fadeAtEdges } from "./undergrowth-fade";
import { createWindSway, UNDERGROWTH_SWAY } from "./wind-sway";

/** The vertex shader three.js would compile for `material`, after the material's own changes. */
function compiledVertexShader(material: THREE.Material): { vertexShader: string; uniforms: Record<string, unknown> } {
  const shader = {
    vertexShader: THREE.ShaderLib.standard.vertexShader,
    fragmentShader: "",
    uniforms: {},
  } as unknown as THREE.WebGLProgramParametersWithUniforms;
  material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
  return shader;
}

describe("undergrowth fading out at its edge", () => {
  it("shrinks each plant toward its foot near the edge, with the camera's focus as a uniform", () => {
    const focus = { value: new THREE.Vector2(3, 4) };
    const material = new THREE.MeshStandardMaterial();
    fadeAtEdges(material, focus);
    const shader = compiledVertexShader(material);
    expect(shader.uniforms.undergrowthFocus).toBe(focus);
    expect(shader.vertexShader).toContain("uniform vec2 undergrowthFocus;");
    expect(shader.vertexShader).toContain("transformed *= 1.0 - smoothstep(");
  });

  it("still applies when the plant also sways, and the sway bends the shrunken plant, so it never pops in", () => {
    const material = new THREE.MeshStandardMaterial();
    fadeAtEdges(material, { value: new THREE.Vector2() });
    createWindSway().sway(material, UNDERGROWTH_SWAY);
    const { vertexShader, uniforms } = compiledVertexShader(material);
    expect(uniforms.undergrowthFocus).toBeDefined();
    expect(uniforms.windStrength).toBeDefined();
    const shrink = vertexShader.lastIndexOf("transformed *=");
    const sway = vertexShader.indexOf("transformed += inverse( mat3( windModel ) ) * windOffset;");
    expect(shrink).toBeGreaterThan(-1);
    expect(sway).toBeGreaterThan(shrink);
    // The sway grows with the height and spread of the shrunken shape, so a plant shrunk to nothing does not sway at all.
    const point = vertexShader.indexOf("vec3 windPoint");
    expect(point).toBeGreaterThan(shrink);
    expect(vertexShader.slice(point, vertexShader.indexOf("\n", point))).toContain("transformed");
  });
});

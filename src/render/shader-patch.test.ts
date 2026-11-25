import { describe, expect, it } from "bun:test";
import * as THREE from "three";
import { chainShaderPatch } from "./shader-patch";
import { addTreeSeeThrough } from "./tree-see-through";
import { createWindSway, TREE_SWAY } from "./wind-sway";

/** Runs a material's shader hook on a stand-in for the standard shader, and returns the shader it leaves. */
function compile(material: THREE.Material): THREE.WebGLProgramParametersWithUniforms {
  const shader = {
    uniforms: {},
    vertexShader: "#include <common>\n#include <begin_vertex>\n#include <project_vertex>",
    fragmentShader: "#include <common>\n#include <clipping_planes_fragment>",
  } as unknown as THREE.WebGLProgramParametersWithUniforms;
  material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
  return shader;
}

describe("chainShaderPatch", () => {
  it("runs every patch on a material, in the order they were added", () => {
    const material = new THREE.MeshStandardMaterial();
    chainShaderPatch(material, "first", (shader) => {
      shader.vertexShader += "\n// first";
    });
    chainShaderPatch(material, "second", (shader) => {
      shader.vertexShader += "\n// second";
    });
    expect(compile(material).vertexShader).toEndWith("// first\n// second");
  });

  it("names every patch in the material's shader cache key, so three.js does not share the shader with an unpatched material", () => {
    const material = new THREE.MeshStandardMaterial();
    chainShaderPatch(material, "first", () => {});
    chainShaderPatch(material, "second", () => {});
    const key = material.customProgramCacheKey();
    expect(key).toContain("first");
    expect(key).toContain("second");
    expect(key).not.toBe(new THREE.MeshStandardMaterial().customProgramCacheKey());
  });

  it("asks three.js to compile the material again", () => {
    const material = new THREE.MeshStandardMaterial();
    const versionBefore = material.version;
    chainShaderPatch(material, "first", () => {});
    expect(material.version).toBeGreaterThan(versionBefore);
  });
});

describe("tree shader patches", () => {
  it("keep the wind sway when the see-through is added after it", () => {
    const material = createWindSway().sway(new THREE.MeshStandardMaterial(), TREE_SWAY);
    addTreeSeeThrough([material]);
    const shader = compile(material);
    expect(shader.uniforms.windTime).toBeDefined();
    expect(shader.uniforms.seeThroughPlayer).toBeDefined();
    expect(material.customProgramCacheKey()).toContain("wind-sway");
  });
});

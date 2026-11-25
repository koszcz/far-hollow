// Adds a change to a material's shader without losing the changes made before it.
// three.js lets a material change its shader in one hook, `onBeforeCompile`. Several looks change the same tree shader,
// such as the wind sway, the see-through, and the snow cover. Each one runs the hook that was there before it, then its own change.
import type * as THREE from "three";

/** One change to a material's shader. It edits the shader text and adds its uniforms. */
export type ShaderPatch = (shader: THREE.WebGLProgramParametersWithUniforms, renderer: THREE.WebGLRenderer) => void;

/**
 * Adds `patch` to the changes `material` makes to its shader, after the ones it already makes, and returns the material.
 * `key` names the patch and anything that changes its shader text. three.js shares a compiled shader between materials
 * with the same cache key, so the key keeps a patched material from sharing an unpatched one's shader.
 */
export function chainShaderPatch<M extends THREE.Material>(material: M, key: string, patch: ShaderPatch): M {
  const before = material.onBeforeCompile.bind(material);
  const beforeKey = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    before(shader, renderer);
    patch(shader, renderer);
  };
  material.customProgramCacheKey = () => `${beforeKey}|${key}`;
  material.needsUpdate = true;
  return material;
}

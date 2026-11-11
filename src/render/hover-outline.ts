// Draws a thin, soft outline around the thing under the pointer, so the player can see what a click would act on.
import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

/** A warm off-white that reads on bark, leaves, and grass by day and by night. */
const OUTLINE_COLOUR = 0xfff1d0;
/** How solid the outline is, from 0 (invisible) to 1 (solid). Kept low so the outline stays subtle. */
const OUTLINE_OPACITY = 0.6;
/** How thick the outline is on screen, in CSS pixels, whatever the distance. */
const OUTLINE_WIDTH_PIXELS = 2;

/** One shape to outline: its geometry, placed in the world by its matrix. */
export interface OutlinePart {
  readonly geometry: THREE.BufferGeometry;
  readonly matrix: THREE.Matrix4;
}

export interface HoverOutline {
  /** Outlines these parts this frame. An empty list hides the outline. */
  show(parts: readonly OutlinePart[]): void;
  /** Keeps the outline the same width in pixels when the canvas changes size. */
  setViewSize(widthPixels: number, heightPixels: number): void;
  dispose(): void;
}

/**
 * The outline is a copy of each shape, pushed outward along its surface by a fixed number of pixels on screen.
 * Only the copy's back faces draw, so the shape itself covers it everywhere but a thin rim at its edge.
 */
export function createHoverOutline(scene: THREE.Scene): HoverOutline {
  const viewSize = new THREE.Vector2(1, 1);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      colour: { value: new THREE.Color(OUTLINE_COLOUR) },
      opacity: { value: OUTLINE_OPACITY },
      widthPixels: { value: OUTLINE_WIDTH_PIXELS },
      viewSize: { value: viewSize },
    },
    vertexShader: /* glsl */ `
      uniform float widthPixels;
      uniform vec2 viewSize;
      void main() {
        vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        vec3 viewNormal = normalize(normalMatrix * normal);
        vec2 direction = (projectionMatrix * vec4(viewNormal, 0.0)).xy;
        float length2 = dot(direction, direction);
        if (length2 > 0.0) {
          clip.xy += direction * inversesqrt(length2) * widthPixels * 2.0 / viewSize * clip.w;
        }
        gl_Position = clip;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 colour;
      uniform float opacity;
      void main() {
        gl_FragColor = vec4(colour, opacity);
      }
    `,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
  });

  // Shapes with hard edges have split normals there. Pushing those apart would tear gaps in the outline,
  // so each shape gets a welded copy with smooth normals.
  const welded = new Map<THREE.BufferGeometry, THREE.BufferGeometry>();
  function weldedCopy(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
    let copy = welded.get(geometry);
    if (copy === undefined) {
      const bare = new THREE.BufferGeometry();
      bare.setAttribute("position", geometry.getAttribute("position"));
      if (geometry.index !== null) bare.setIndex(geometry.index);
      copy = mergeVertices(bare);
      copy.computeVertexNormals();
      welded.set(geometry, copy);
    }
    return copy;
  }

  const meshes: THREE.Mesh[] = [];
  function meshAt(index: number): THREE.Mesh {
    let mesh = meshes[index];
    if (mesh === undefined) {
      mesh = new THREE.Mesh(undefined, material);
      mesh.matrixAutoUpdate = false;
      mesh.frustumCulled = false;
      // Draw after the see-through blueprints, so the rim sits on top of them.
      mesh.renderOrder = 1;
      scene.add(mesh);
      meshes.push(mesh);
    }
    return mesh;
  }

  return {
    show(parts) {
      parts.forEach((part, index) => {
        const mesh = meshAt(index);
        mesh.geometry = weldedCopy(part.geometry);
        mesh.matrix.copy(part.matrix);
        mesh.matrixWorldNeedsUpdate = true;
        mesh.visible = true;
      });
      for (let i = parts.length; i < meshes.length; i += 1) {
        const mesh = meshes[i];
        if (mesh !== undefined) mesh.visible = false;
      }
    },
    setViewSize(widthPixels, heightPixels) {
      viewSize.set(widthPixels, heightPixels);
    },
    dispose() {
      for (const mesh of meshes) scene.remove(mesh);
      for (const copy of welded.values()) copy.dispose();
      material.dispose();
    },
  };
}

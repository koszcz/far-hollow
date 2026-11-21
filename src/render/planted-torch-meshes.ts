// Draws torches planted in the ground with the code-built "torch" (draft) in asset-manifest.json, added by torch ticket 02.
// Each one stands upright, its butt pushed a little into the ground or the foundation deck, and burns with the approved
// "fire-effect" at a small size on its head, as the torch in the player's hand does. A soft glow round the flame shows
// from far away. It is a picture, not a light, so it lights nothing.
// Only a few torches cast real light on the ground. torch-lights.ts holds those lights, and flames() tells it where each flame is.
// The pivot of each torch is the spot where it stands.
import * as THREE from "three";
import { plantedTorchEntities, type Entity, type EntityStore } from "../sim/entities";
import { createFireMaker, type Fire } from "./fire-effect";
import type { OutlinePart } from "./hover-outline";
import { createTorchFlame, createTorchShape, TORCH_FLAME_HEIGHT_METRES } from "./torch-shape";
import type { TorchFlame } from "./torch-lights";

/** A planted torch's butt sinks this far into the ground, in metres. */
const SUNK_METRES = 0.08;
/** The glow round the flame is this wide, in metres, and this strong at its middle. */
const GLOW_SIZE_METRES = 0.9;
const GLOW_OPACITY = 0.55;
const GLOW_COLOUR = 0xffa552;
/** How many pixels wide the glow's picture is. It is soft, so a small one looks smooth. */
const GLOW_TEXTURE_PIXELS = 32;
/** Clicks on a planted torch hit an invisible upright box this wide, so the thin stick is easy to hit, in metres. */
const PICK_WIDTH_METRES = 0.35;
/** The middle of the flame and its glow stands this high above the spot where the torch stands, in metres. */
const FLAME_ABOVE_GROUND_METRES = TORCH_FLAME_HEIGHT_METRES - SUNK_METRES + 0.08;

export interface PlantedTorchMeshes {
  readonly group: THREE.Group;
  /** Brings every planted torch up to date with game state, its flame burning at `nowSeconds`. */
  update(nowSeconds: number): void;
  /** Where each planted torch's flame is in the world, for the torch lights. The list and its flames are reused each frame. */
  flames(): readonly TorchFlame[];
  /** What a ray from the camera hits first among planted torches, and how far away. */
  pick(raycaster: THREE.Raycaster): { hit: { kind: "plantedTorch"; entity: Entity }; distance: number } | undefined;
  /** The stick and head of a planted torch, placed in the world. Empty once it is gone. */
  outlineOf(entity: Entity): OutlinePart[];
  dispose(): void;
}

/** What draws one planted torch: its group, its meshes, its click box, its fire, and the flame that the torch lights use. */
interface TorchDrawing {
  readonly root: THREE.Group;
  readonly parts: THREE.Mesh[];
  readonly picker: THREE.Mesh;
  readonly fire: Fire;
  readonly flame: TorchFlame;
}

/** A round, soft spot of light that fades to nothing at its edge. */
function createGlowTexture(): THREE.DataTexture {
  const size = GLOW_TEXTURE_PIXELS;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (x + 0.5) / size - 0.5;
      const dy = (y + 0.5) / size - 0.5;
      const fade = Math.max(0, 1 - Math.hypot(dx, dy) * 2);
      const index = (y * size + x) * 4;
      data.set([255, 255, 255, Math.round(255 * fade * fade)], index);
    }
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.needsUpdate = true;
  return texture;
}

export function createPlantedTorchMeshes(entities: EntityStore): PlantedTorchMeshes {
  const group = new THREE.Group();
  const shape = createTorchShape();
  const fireMaker = createFireMaker();
  const glowTexture = createGlowTexture();
  // The glow gives off its own light, so it ignores the scene's lights, and adds to what is behind it.
  const glowMaterial = new THREE.SpriteMaterial({
    map: glowTexture,
    color: GLOW_COLOUR,
    transparent: true,
    opacity: GLOW_OPACITY,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const pickGeometry = new THREE.BoxGeometry(PICK_WIDTH_METRES, TORCH_FLAME_HEIGHT_METRES + 0.2, PICK_WIDTH_METRES);
  pickGeometry.translate(0, (TORCH_FLAME_HEIGHT_METRES + 0.2) / 2, 0);
  const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });

  const torches = plantedTorchEntities(entities);
  const drawn = new Map<Entity, TorchDrawing>();
  const pickers: THREE.Mesh[] = [];
  const flames: TorchFlame[] = [];
  const hits: THREE.Intersection[] = [];

  function draw(entity: Entity & { position: { x: number; y: number; z: number } }): TorchDrawing {
    const existing = drawn.get(entity);
    if (existing !== undefined) return existing;
    const root = new THREE.Group();
    const parts = shape.parts.map(({ geometry, material }) => {
      const part = new THREE.Mesh(geometry, material);
      part.castShadow = true;
      part.position.y = -SUNK_METRES;
      root.add(part);
      return part;
    });
    const fire = createTorchFlame(fireMaker);
    fire.group.position.y -= SUNK_METRES;
    root.add(fire.group);
    const glow = new THREE.Sprite(glowMaterial);
    glow.scale.setScalar(GLOW_SIZE_METRES);
    glow.position.y = FLAME_ABOVE_GROUND_METRES;
    root.add(glow);
    const picker = new THREE.Mesh(pickGeometry, pickMaterial);
    picker.userData.entity = entity;
    root.add(picker);
    pickers.push(picker);
    root.position.set(entity.position.x, entity.position.y, entity.position.z);
    group.add(root);
    const id = entities.id(entity) ?? 0;
    const flame = {
      position: new THREE.Vector3(entity.position.x, entity.position.y + FLAME_ABOVE_GROUND_METRES, entity.position.z),
      seed: id * 1.7,
      aboveGroundMetres: FLAME_ABOVE_GROUND_METRES,
    };
    const drawing = { root, parts, picker, fire, flame };
    drawn.set(entity, drawing);
    return drawing;
  }

  return {
    group,
    update(nowSeconds) {
      const seen = new Set<Entity>();
      flames.length = 0;
      for (const torch of torches) {
        const drawing = draw(torch);
        // A torch dropped off a foundation that was taken down stands lower.
        drawing.root.position.y = torch.position.y;
        drawing.flame.position.y = torch.position.y + FLAME_ABOVE_GROUND_METRES;
        drawing.fire.animate(nowSeconds, 1, drawing.flame.seed);
        flames.push(drawing.flame);
        seen.add(torch);
      }
      for (const [entity, drawing] of [...drawn]) {
        if (seen.has(entity)) continue;
        group.remove(drawing.root);
        pickers.splice(pickers.indexOf(drawing.picker), 1);
        drawn.delete(entity);
      }
    },
    flames() {
      return flames;
    },
    pick(raycaster) {
      hits.length = 0;
      raycaster.intersectObjects(pickers, false, hits);
      hits.sort((a, b) => a.distance - b.distance);
      const first = hits[0];
      const entity = first?.object.userData.entity as Entity | undefined;
      if (first === undefined || entity?.plantedTorch === undefined) return undefined;
      return { hit: { kind: "plantedTorch", entity }, distance: first.distance };
    },
    outlineOf(entity) {
      const drawing = drawn.get(entity);
      if (drawing === undefined) return [];
      drawing.root.updateMatrixWorld(true);
      return drawing.parts.map((mesh) => ({ geometry: mesh.geometry, matrix: mesh.matrixWorld }));
    },
    dispose() {
      shape.dispose();
      fireMaker.dispose();
      glowTexture.dispose();
      glowMaterial.dispose();
      pickGeometry.dispose();
      pickMaterial.dispose();
    },
  };
}

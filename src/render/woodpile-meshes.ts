// Draws woodpiles and woodpile blueprints with the code-built "woodpile" (draft) in asset-manifest.json.
// A woodpile is two rails of debarked log lying on the ground, with what it holds stacked across them:
// logs at the bottom, then debarked logs, then firewood, two pieces end to end in each place. Each layer holds four.
// It fills from empty, with only the rails, to full, five layers high.
// A blueprint, and the blueprint under the mouse while placing, shows the rails see-through. The one under the mouse turns red
// where the woodpile is not allowed.
import * as THREE from "three";
import { facingRadians, NOT_ALLOWED_COLOUR } from "./structure-look";
import { blueprintEntities, woodpileEntities, type Entity, type EntityStore, type WoodpileWood } from "../sim/entities";
import { WOODPILE_CAPACITY } from "../sim/woodpiles";
import { DEBARKED_LOG_COLOUR } from "./debarked-log-shape";
import { createFirewoodGeometry, FIREWOOD_COLOUR, FIREWOOD_LENGTH_METRES } from "./firewood-shape";
import type { OutlinePart } from "./hover-outline";
import { LOG_COLOUR } from "./log-shape";

/** The rails run along x, this far either side of the middle, in metres. The wood lies across them, along z. */
const RAIL_OFFSET_METRES = 0.3;
const RAIL_LENGTH_METRES = 1;
const RAIL_RADIUS_METRES = 0.05;
/** Each log in the pile is this long and this thick, in metres. */
const PILED_LOG_LENGTH_METRES = 0.95;
const PILED_LOG_RADIUS_METRES = 0.11;
/** Each layer holds this many logs or pairs of firewood side by side. */
const PLACES_PER_LAYER = 4;
/** Places in a layer sit this far apart, in metres. */
const PLACE_SPACING_METRES = 0.24;
/** Layers sit this far apart, in metres. */
const LAYER_SPACING_METRES = 0.21;
const BLUEPRINT_COLOUR = 0xbfe3ff;
/** How see-through a blueprint is, from 0 (invisible) to 1 (solid). */
const BLUEPRINT_OPACITY = 0.35;
/** Clicks on a woodpile or its blueprint hit an invisible box this big, in metres. */
const PICK_SIZE_METRES = 1;
const PICK_HEIGHT_METRES = 1.1;

/** What a click on a woodpile or a woodpile blueprint landed on. */
export type WoodpileHit = { kind: "blueprint"; entity: Entity } | { kind: "woodpile"; entity: Entity };

export interface WoodpileMeshes {
  readonly group: THREE.Group;
  /** Brings every woodpile and woodpile blueprint up to date with game state. */
  update(): void;
  /** What a ray from the camera hits first among woodpiles and their blueprints, and how far away. */
  pick(raycaster: THREE.Raycaster): { hit: WoodpileHit; distance: number } | undefined;
  /** The rails and wood of a woodpile or blueprint, placed in the world. Empty once it is gone. */
  outlineOf(hit: WoodpileHit): OutlinePart[];
  /** Shows a woodpile blueprint under the mouse at a spot, red where it is not allowed. Undefined hides it. */
  showPlacingBlueprint(placingBlueprint: { spot: { x: number; y: number; z: number }; turns: number; allowed: boolean } | undefined): void;
  dispose(): void;
}

interface Drawn {
  readonly root: THREE.Group;
  readonly parts: THREE.Mesh[];
  readonly picker: THREE.Mesh;
  /** What it was drawn with, so it is redrawn only when that changes. */
  readonly key: string;
}

/** Where each place in the pile is, bottom layer first, as an offset from the woodpile's middle. */
function placeOffset(index: number): THREE.Vector3 {
  const layer = Math.floor(index / PLACES_PER_LAYER);
  const column = index % PLACES_PER_LAYER;
  const x = (column - (PLACES_PER_LAYER - 1) / 2) * PLACE_SPACING_METRES;
  const y = RAIL_RADIUS_METRES * 2 + PILED_LOG_RADIUS_METRES + layer * LAYER_SPACING_METRES;
  return new THREE.Vector3(x, y, 0);
}

export function createWoodpileMeshes(entities: EntityStore): WoodpileMeshes {
  const group = new THREE.Group();
  const railGeometry = new THREE.CylinderGeometry(RAIL_RADIUS_METRES, RAIL_RADIUS_METRES, RAIL_LENGTH_METRES, 7);
  railGeometry.rotateZ(Math.PI / 2);
  const logGeometry = new THREE.CylinderGeometry(PILED_LOG_RADIUS_METRES, PILED_LOG_RADIUS_METRES, PILED_LOG_LENGTH_METRES, 8);
  logGeometry.rotateX(Math.PI / 2);
  const firewoodGeometry = createFirewoodGeometry();
  const pickGeometry = new THREE.BoxGeometry(PICK_SIZE_METRES, PICK_HEIGHT_METRES, PICK_SIZE_METRES);
  pickGeometry.translate(0, PICK_HEIGHT_METRES / 2, 0);

  const railMaterial = new THREE.MeshStandardMaterial({ color: DEBARKED_LOG_COLOUR, flatShading: true });
  const logMaterial = new THREE.MeshStandardMaterial({ color: LOG_COLOUR, flatShading: true });
  const debarkedLogMaterial = new THREE.MeshStandardMaterial({ color: DEBARKED_LOG_COLOUR, flatShading: true });
  const firewoodMaterial = new THREE.MeshStandardMaterial({ color: FIREWOOD_COLOUR, flatShading: true, vertexColors: true });
  const blueprintMaterial = new THREE.MeshStandardMaterial({ color: BLUEPRINT_COLOUR, transparent: true, opacity: BLUEPRINT_OPACITY, depthWrite: false });
  const notAllowedMaterial = new THREE.MeshStandardMaterial({ color: NOT_ALLOWED_COLOUR, transparent: true, opacity: BLUEPRINT_OPACITY, depthWrite: false });
  const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });

  const drawn = new Map<Entity, Drawn>();
  const pickers: THREE.Mesh[] = [];
  const hits: THREE.Intersection[] = [];
  const blueprints = blueprintEntities(entities);
  const woodpiles = woodpileEntities(entities);

  /** Adds the two rails to `root` in one material. */
  function addRails(root: THREE.Group, material: THREE.Material): THREE.Mesh[] {
    return [-RAIL_OFFSET_METRES, RAIL_OFFSET_METRES].map((z) => {
      const rail = new THREE.Mesh(railGeometry, material);
      rail.position.set(0, RAIL_RADIUS_METRES, z);
      root.add(rail);
      return rail;
    });
  }

  /** Adds the wood stacked on a woodpile to `root`: logs first, then debarked logs, then firewood. */
  function addWood(root: THREE.Group, contents: Readonly<Record<WoodpileWood, number>>): THREE.Mesh[] {
    const kinds: WoodpileWood[] = [
      ...Array.from({ length: contents.log }, (): WoodpileWood => "log"),
      ...Array.from({ length: contents.debarkedLog }, (): WoodpileWood => "debarkedLog"),
      ...Array.from({ length: contents.firewood }, (): WoodpileWood => "firewood"),
    ].slice(0, WOODPILE_CAPACITY);
    const parts: THREE.Mesh[] = [];
    kinds.forEach((kind, index) => {
      const place = placeOffset(index);
      if (kind === "firewood") {
        // Two pieces end to end fill one place, resting on their flat face.
        for (const side of [-1, 1]) {
          const piece = new THREE.Mesh(firewoodGeometry, firewoodMaterial);
          piece.position.set(place.x, place.y - PILED_LOG_RADIUS_METRES, (side * FIREWOOD_LENGTH_METRES) / 2);
          root.add(piece);
          parts.push(piece);
        }
        return;
      }
      const log = new THREE.Mesh(logGeometry, kind === "log" ? logMaterial : debarkedLogMaterial);
      log.position.copy(place);
      root.add(log);
      parts.push(log);
    });
    return parts;
  }

  function keyOf(entity: Entity): string {
    if (entity.blueprint !== undefined) return "blueprint";
    const contents = entity.woodpile;
    return contents === undefined ? "" : `${contents.log},${contents.debarkedLog},${contents.firewood}`;
  }

  function draw(entity: Entity): void {
    const position = entity.position;
    if (position === undefined) return;
    const root = new THREE.Group();
    const isBlueprint = entity.blueprint !== undefined;
    const parts = addRails(root, isBlueprint ? blueprintMaterial : railMaterial);
    if (!isBlueprint && entity.woodpile !== undefined) parts.push(...addWood(root, entity.woodpile));
    for (const part of parts) {
      part.castShadow = !isBlueprint;
      part.receiveShadow = !isBlueprint;
    }
    const picker = new THREE.Mesh(pickGeometry, pickMaterial);
    picker.userData.entity = entity;
    root.add(picker);
    pickers.push(picker);
    root.position.set(position.x, position.y, position.z);
    root.rotation.y = facingRadians(entity.facing?.turns ?? 0);
    group.add(root);
    drawn.set(entity, { root, parts, picker, key: keyOf(entity) });
  }

  function forget(entity: Entity): void {
    const item = drawn.get(entity);
    if (item === undefined) return;
    group.remove(item.root);
    pickers.splice(pickers.indexOf(item.picker), 1);
    drawn.delete(entity);
  }

  /** The blueprint that follows the mouse before the player places it. Hidden until placing starts. */
  const placingBlueprint = new THREE.Group();
  placingBlueprint.visible = false;
  const placingRails = addRails(placingBlueprint, blueprintMaterial);
  group.add(placingBlueprint);

  return {
    group,
    update() {
      const seen = new Set<Entity>();
      const current = [...woodpiles, ...blueprints.entities.filter(({ blueprint }) => blueprint.structure === "woodpile")];
      for (const entity of current) {
        seen.add(entity);
        if (drawn.get(entity)?.key === keyOf(entity)) continue;
        forget(entity);
        draw(entity);
      }
      for (const entity of [...drawn.keys()]) if (!seen.has(entity)) forget(entity);
    },
    pick(raycaster) {
      hits.length = 0;
      raycaster.intersectObjects(pickers, false, hits);
      hits.sort((a, b) => a.distance - b.distance);
      const first = hits[0];
      const entity = first?.object.userData.entity as Entity | undefined;
      if (first === undefined || entity === undefined) return undefined;
      if (entity.blueprint !== undefined) return { hit: { kind: "blueprint", entity }, distance: first.distance };
      if (entity.woodpile !== undefined) return { hit: { kind: "woodpile", entity }, distance: first.distance };
      return undefined;
    },
    outlineOf(hit) {
      const item = drawn.get(hit.entity);
      if (item === undefined) return [];
      item.root.updateMatrixWorld(true);
      return item.parts.map((mesh) => ({ geometry: mesh.geometry, matrix: mesh.matrixWorld }));
    },
    showPlacingBlueprint(placement) {
      placingBlueprint.visible = placement !== undefined;
      if (placement === undefined) return;
      placingBlueprint.position.set(placement.spot.x, placement.spot.y, placement.spot.z);
      placingBlueprint.rotation.y = facingRadians(placement.turns);
      for (const rail of placingRails) rail.material = placement.allowed ? blueprintMaterial : notAllowedMaterial;
    },
    dispose() {
      for (const geometry of [railGeometry, logGeometry, firewoodGeometry, pickGeometry]) geometry.dispose();
      for (const material of [railMaterial, logMaterial, debarkedLogMaterial, firewoodMaterial, blueprintMaterial, notAllowedMaterial, pickMaterial]) {
        material.dispose();
      }
    },
  };
}

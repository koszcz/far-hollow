// Draws woodpiles and woodpile blueprints with the code-built "woodpile" in asset-manifest.json. The owner approved the asset.
// A woodpile is two rails of debarked log lying on the ground, held in by two stakes at each end.
// What it holds is stacked across the rails: logs at the bottom, then debarked logs, then firewood.
// Logs and debarked logs use the approved shapes from log-shape.ts and debarked-log-shape.ts.
// Firewood uses the approved shape from firewood-shape.ts, two pieces end to end in each place, bark facing out on both sides.
// Each layer holds four. Each layer sits half a place over, in the gaps of the one below, like a real stack.
// It fills from empty, with only the rails and stakes, to full, five layers high.
// A blueprint, and the blueprint under the mouse while placing, shows the rails and stakes see-through.
// The one under the mouse turns red where the woodpile is not allowed.
import * as THREE from "three";
import { facingRadians, NOT_ALLOWED_COLOUR } from "./structure-look";
import { blueprintEntities, woodpileEntities, type Entity, type EntityStore, type WoodpileWood } from "../sim/entities";
import { WOODPILE_CAPACITY } from "../sim/woodpiles";
import { createDebarkedLogGeometry, DEBARKED_LOG_COLOUR } from "./debarked-log-shape";
import { createFirewoodGeometry, FIREWOOD_COLOUR, FIREWOOD_LENGTH_METRES } from "./firewood-shape";
import type { OutlinePart } from "./hover-outline";
import { LOG_COLOUR, LOG_CUT_COLOUR, type LogShape } from "./log-shape";

/** The rails run along x, this far either side of the middle, in metres. The wood lies across them, along z. */
const RAIL_OFFSET_METRES = 0.3;
/** A rail is a debarked log this much thinner than a whole one. */
const RAIL_THICKNESS_SCALE = 0.5;
/** A rail is this much longer than a whole log, so it reaches past the stakes. */
const RAIL_LENGTH_SCALE = 1.35;
/** The second rail rolls this far about its length. */
const RAIL_SECOND_ROLL_RADIANS = 2.4;
/** Each layer holds this many logs or pairs of firewood side by side. */
const PLACES_PER_LAYER = 4;
/** How many layers a full woodpile has. */
const LAYERS = Math.ceil(WOODPILE_CAPACITY / PLACES_PER_LAYER);
/** Places in a layer sit this much further apart than the logs are thick, so logs do not overlap. */
const PLACE_GAP_METRES = 0.01;
/** Logs roll about their length by these angles, in radians, one per place, so their branch stubs do not line up. */
const LOG_ROLLS: readonly number[] = [0, 2.1, 4.3, 1.2, 3.4, 5.5, 0.6, 2.8, 4.9, 1.7];
/** Logs and firewood sit this far along their length from the middle, in metres, one per place, so their ends are uneven. */
const END_JITTER_METRES: readonly number[] = [0.02, -0.03, 0.01, 0.035, -0.015, 0.025, -0.035, 0, 0.03, -0.02, 0.015];
/** The stakes at each end: thicker at the foot, a little taller than a full woodpile, and leaning out a little. */
const STAKE_TOP_RADIUS_METRES = 0.03;
const STAKE_FOOT_RADIUS_METRES = 0.045;
const STAKE_ABOVE_FULL_METRES = 0.08;
const STAKE_LEAN_RADIANS = 0.06;
const BLUEPRINT_COLOUR = 0xbfe3ff;
/** How see-through a blueprint is, from 0 (invisible) to 1 (solid). */
const BLUEPRINT_OPACITY = 0.35;
/** Clicks on a woodpile or its blueprint hit an invisible box this big, in metres. */
const PICK_SIZE_METRES = 1.4;
const PICK_HEIGHT_METRES = 1.2;

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

/** logShape is the loaded log, from loadLogShape. */
export function createWoodpileMeshes(entities: EntityStore, logShape: LogShape): WoodpileMeshes {
  const group = new THREE.Group();
  const logRadius = logShape.restHeight;
  const placeSpacing = logRadius * 2 + PLACE_GAP_METRES;
  /** How far each layer sits above the one below: logs resting in the gaps sit lower than logs resting on top. */
  const layerSpacing = (placeSpacing * Math.sqrt(3)) / 2;
  const railRadius = logRadius * RAIL_THICKNESS_SCALE;
  /** The middle of the bottom layer, above the ground. */
  const bottomLayerHeight = railRadius * 2 + logRadius;
  /** The middle of the stack's widest place, either side, from the middle. */
  const stackHalfWidth = (PLACES_PER_LAYER / 2 - 0.25) * placeSpacing + logRadius;
  const stakeHeight = bottomLayerHeight + (LAYERS - 1) * layerSpacing + logRadius + STAKE_ABOVE_FULL_METRES;

  /** Where each place in the pile is, bottom layer first, as an offset from the woodpile's middle. */
  function placeOffset(index: number): THREE.Vector3 {
    const layer = Math.floor(index / PLACES_PER_LAYER);
    const column = index % PLACES_PER_LAYER;
    // Even layers sit a quarter place left of the middle and odd layers a quarter place right, so each rests in the gaps below.
    const shift = layer % 2 === 0 ? -0.25 : 0.25;
    const x = (column - (PLACES_PER_LAYER - 1) / 2 + shift) * placeSpacing;
    const y = bottomLayerHeight + layer * layerSpacing;
    return new THREE.Vector3(x, y, 0);
  }

  const railGeometry = createDebarkedLogGeometry(logShape.geometry);
  railGeometry.scale(RAIL_THICKNESS_SCALE, RAIL_THICKNESS_SCALE, RAIL_LENGTH_SCALE);
  railGeometry.rotateY(Math.PI / 2);
  const debarkedLogGeometry = createDebarkedLogGeometry(logShape.geometry);
  const stakeGeometry = new THREE.CylinderGeometry(STAKE_TOP_RADIUS_METRES, STAKE_FOOT_RADIUS_METRES, stakeHeight, 6);
  stakeGeometry.translate(0, stakeHeight / 2, 0);
  const firewoodGeometry = createFirewoodGeometry();
  // Firewood lies with its bark on +x. Centre it on x, so a pair mirrored about the middle fills one place.
  firewoodGeometry.computeBoundingBox();
  const firewoodBox = firewoodGeometry.boundingBox ?? new THREE.Box3();
  firewoodGeometry.translate(-(firewoodBox.min.x + firewoodBox.max.x) / 2, 0, 0);
  const pickGeometry = new THREE.BoxGeometry(PICK_SIZE_METRES, PICK_HEIGHT_METRES, PICK_SIZE_METRES);
  pickGeometry.translate(0, PICK_HEIGHT_METRES / 2, 0);

  const logMaterials = [
    new THREE.MeshStandardMaterial({ color: LOG_COLOUR, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: LOG_CUT_COLOUR, flatShading: true }),
  ];
  const debarkedLogMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, vertexColors: true });
  const stakeMaterial = new THREE.MeshStandardMaterial({ color: DEBARKED_LOG_COLOUR, flatShading: true });
  const firewoodMaterial = new THREE.MeshStandardMaterial({ color: FIREWOOD_COLOUR, flatShading: true, vertexColors: true });
  const blueprintMaterial = new THREE.MeshStandardMaterial({ color: BLUEPRINT_COLOUR, transparent: true, opacity: BLUEPRINT_OPACITY, depthWrite: false });
  const notAllowedMaterial = new THREE.MeshStandardMaterial({ color: NOT_ALLOWED_COLOUR, transparent: true, opacity: BLUEPRINT_OPACITY, depthWrite: false });
  const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });

  const drawn = new Map<Entity, Drawn>();
  const pickers: THREE.Mesh[] = [];
  const hits: THREE.Intersection[] = [];
  const blueprints = blueprintEntities(entities);
  const woodpiles = woodpileEntities(entities);

  /** Adds the two rails and four stakes to `root`. A blueprint draws them all in `blueprint`. */
  function addFrame(root: THREE.Group, blueprint?: THREE.Material): THREE.Mesh[] {
    const parts: THREE.Mesh[] = [];
    for (const z of [-RAIL_OFFSET_METRES, RAIL_OFFSET_METRES]) {
      const rail = new THREE.Mesh(railGeometry, blueprint ?? debarkedLogMaterial);
      rail.position.set(0, railRadius, z);
      // Roll the two rails differently about their length, so their knots and bark scraps do not match.
      rail.rotation.x = z < 0 ? 0 : RAIL_SECOND_ROLL_RADIANS;
      parts.push(rail);
      for (const side of [-1, 1]) {
        const stake = new THREE.Mesh(stakeGeometry, blueprint ?? stakeMaterial);
        stake.position.set(side * (stackHalfWidth + STAKE_FOOT_RADIUS_METRES), 0, z);
        stake.rotation.z = -side * STAKE_LEAN_RADIANS;
        parts.push(stake);
      }
    }
    for (const part of parts) root.add(part);
    return parts;
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
      const jitter = END_JITTER_METRES[index % END_JITTER_METRES.length] ?? 0;
      if (kind === "firewood") {
        // Two pieces end to end fill one place, resting on a split face low in the gap below, bark out on opposite sides.
        for (const side of [-1, 1]) {
          const piece = new THREE.Mesh(firewoodGeometry, firewoodMaterial);
          piece.position.set(place.x, place.y - logRadius * 0.75, (side * FIREWOOD_LENGTH_METRES) / 2 + jitter);
          piece.rotation.y = side < 0 ? 0 : Math.PI;
          root.add(piece);
          parts.push(piece);
        }
        return;
      }
      const log: THREE.Mesh = kind === "log" ? new THREE.Mesh(logShape.geometry, logMaterials) : new THREE.Mesh(debarkedLogGeometry, debarkedLogMaterial);
      log.position.set(place.x, place.y, jitter);
      log.rotation.z = LOG_ROLLS[index % LOG_ROLLS.length] ?? 0;
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
    const parts = addFrame(root, isBlueprint ? blueprintMaterial : undefined);
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
  const placingParts = addFrame(placingBlueprint, blueprintMaterial);
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
      for (const part of placingParts) part.material = placement.allowed ? blueprintMaterial : notAllowedMaterial;
    },
    dispose() {
      // The log geometry belongs to the loaded log shape, which others draw too, so it stays.
      for (const geometry of [railGeometry, debarkedLogGeometry, stakeGeometry, firewoodGeometry, pickGeometry]) geometry.dispose();
      for (const material of [...logMaterials, debarkedLogMaterial, stakeMaterial, firewoodMaterial, blueprintMaterial, notAllowedMaterial, pickMaterial]) {
        material.dispose();
      }
    },
  };
}

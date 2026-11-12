// Draws sleds and sled blueprints: the draft "sled" asset in asset-manifest.json, built in code. Added by sled ticket 01.
// Sled ticket 02 added the logs lying on a finished sled.
// A sled is two log runners with their bark on, lying side by side, and four sticks laid across them.
// Its runners run along x when it faces the default way.
// Construction has one stage per material: a runner for each log, then a cross piece for each stick.
// Each part fades in above its place and is set down, like the sticks of a campfire.
// A blueprint shows the parts see-through. A runner whose log has been delivered shows pale and half solid.
// While the player places a sled from the build menu, a see-through copy follows the mouse. It turns red where it is not allowed.
// A finished sled shows the logs and debarked logs lying on it, along the runners, from empty to full:
// logs first, then debarked logs, stacked in a pyramid: three side by side on the cross pieces, two in the gaps above, and one on top.
// They use the approved shapes from log-shape.ts and debarked-log-shape.ts, the "logs" and "debarked-log" assets.
import * as THREE from "three";
import { buildLift, buildOpacity, facingRadians, NOT_ALLOWED_COLOUR, seeThrough } from "./structure-look";
import { blueprintEntities, sledEntities, type CarriedLog, type Entity, type EntityStore, type Vec3 } from "../sim/entities";
import { SLED_CAPACITY } from "../sim/sleds";
import { SLED_LENGTH_METRES, SLED_LOG_COST, SLED_STICK_COST, SLED_WIDTH_METRES } from "../sim/structures";
import { createDebarkedLogGeometry } from "./debarked-log-shape";
import { LOG_COLOUR, LOG_CUT_COLOUR, type LogShape } from "./log-shape";
import { STICK_COLOUR } from "./stick-shape";
import type { OutlinePart } from "./hover-outline";

const BLUEPRINT_COLOUR = 0xbfe3ff;
/** How see-through the parts of a blueprint not yet built are, from 0 (invisible) to 1 (solid). */
const BLUEPRINT_OPACITY = 0.35;
/** A runner whose log has been delivered is this solid, so it stands out from the parts still needed. */
const DELIVERED_OPACITY = 0.7;
/** The radius of each runner, in metres. */
const RUNNER_RADIUS_METRES = 0.1;
/** Each runner has this many sides. */
const RUNNER_SIDES = 8;
/** The radius of each cross piece, in metres. */
const CROSS_RADIUS_METRES = 0.03;
/** Each cross piece has this many sides. */
const CROSS_SIDES = 5;
/** The cross pieces stand this far in from the ends of the runners, in metres. */
const CROSS_INSET_METRES = 0.3;
/** The bottom layer of the load holds this many logs side by side. Each layer above rests in the gaps, one fewer. */
const LOGS_PER_BOTTOM_LAYER = 3;
/** Logs in a layer sit this much further apart than they are thick, in metres, so they do not overlap. */
const LOG_GAP_METRES = 0.01;
/** Logs roll about their length by these angles, in radians, one per place, so their branch stubs do not line up. */
const LOG_ROLLS: readonly number[] = [0, 2.1, 4.3, 1.2, 3.4, 5.5];
/** Logs sit this far along their length from the middle, in metres, one per place, so their ends are uneven. */
const END_JITTER_METRES: readonly number[] = [0.03, -0.04, 0.01, -0.02, 0.04, -0.01];

/** What a click on a sled or a sled blueprint landed on. */
export type SledHit = { kind: "blueprint"; entity: Entity } | { kind: "sled"; entity: Entity };

export interface SledMeshes {
  readonly group: THREE.Group;
  /** Brings every sled and sled blueprint up to date with game state. */
  update(): void;
  /** What a ray from the camera hits first among sleds and sled blueprints, and how far away. */
  pick(raycaster: THREE.Raycaster): { hit: SledHit; distance: number } | undefined;
  /** The parts of a sled or sled blueprint, placed in the world. Empty once it is gone. */
  outlineOf(hit: SledHit): OutlinePart[];
  /** Shows a sled blueprint under the mouse at `spot`, facing `turns`, red where it is not allowed. Undefined hides it. */
  showPlacingBlueprint(placingBlueprint: { spot: Vec3; turns: number; allowed: boolean } | undefined): void;
  dispose(): void;
}

/** One round part lying along x: its radius, length, sides, and middle. A runner is a log. A cross piece is a stick turned along z. */
interface Part {
  readonly radius: number;
  readonly length: number;
  readonly sides: number;
  readonly middle: THREE.Vector3;
  readonly alongZ: boolean;
}

/** One stage of construction: its mesh, with its own see-through copy of the wood for fading in. */
interface Stage {
  readonly root: THREE.Group;
  readonly mesh: THREE.Mesh;
  readonly fading: THREE.MeshStandardMaterial[];
}

interface Drawn {
  readonly root: THREE.Group;
  readonly stages: Stage[];
  readonly picker: THREE.Mesh;
  /** The logs lying on a finished sled, and the load they show, such as "2,1". */
  readonly load: THREE.Group;
  loadKey: string;
}

/** The parts in the order construction lays them: a runner for each log, then a cross piece for each stick. */
function sledParts(): Part[] {
  const runnerZ = SLED_WIDTH_METRES / 2 - RUNNER_RADIUS_METRES;
  const runners = Array.from({ length: SLED_LOG_COST }, (_, i): Part => {
    const side = -1 + (2 * i) / Math.max(1, SLED_LOG_COST - 1);
    return {
      radius: RUNNER_RADIUS_METRES,
      length: SLED_LENGTH_METRES,
      sides: RUNNER_SIDES,
      middle: new THREE.Vector3(0, RUNNER_RADIUS_METRES, side * runnerZ),
      alongZ: false,
    };
  });
  const span = SLED_LENGTH_METRES - 2 * CROSS_INSET_METRES;
  const crossY = 2 * RUNNER_RADIUS_METRES + CROSS_RADIUS_METRES;
  const crosses = Array.from({ length: SLED_STICK_COST }, (_, i): Part => {
    const x = -span / 2 + (span * i) / Math.max(1, SLED_STICK_COST - 1);
    return { radius: CROSS_RADIUS_METRES, length: SLED_WIDTH_METRES, sides: CROSS_SIDES, middle: new THREE.Vector3(x, crossY, 0), alongZ: true };
  });
  return [...runners, ...crosses];
}

/** `logShape` is the loaded log model, which the logs lying on a sled use. */
export function createSledMeshes(entities: EntityStore, logShape: LogShape): SledMeshes {
  const group = new THREE.Group();
  const parts = sledParts();
  const geometries = parts.map(({ radius, length, sides, alongZ }) => {
    const geometry = new THREE.CylinderGeometry(radius, radius, length, sides);
    // A cylinder stands along y. Lay it along x, or along z for a cross piece.
    if (alongZ) geometry.rotateX(Math.PI / 2);
    else geometry.rotateZ(Math.PI / 2);
    return geometry;
  });
  const height = 2 * RUNNER_RADIUS_METRES + 2 * CROSS_RADIUS_METRES;
  const pickGeometry = new THREE.BoxGeometry(SLED_LENGTH_METRES, height, SLED_WIDTH_METRES).translate(0, height / 2, 0);

  // A cylinder's groups are its side, then its two ends. A runner shows bark on its side and pale cut ends.
  const barkMaterial = new THREE.MeshStandardMaterial({ color: LOG_COLOUR, flatShading: true });
  const cutMaterial = new THREE.MeshStandardMaterial({ color: LOG_CUT_COLOUR, flatShading: true });
  const stickMaterial = new THREE.MeshStandardMaterial({ color: STICK_COLOUR, flatShading: true });
  const solidMaterials = parts.map(({ alongZ }) => (alongZ ? [stickMaterial, stickMaterial, stickMaterial] : [barkMaterial, cutMaterial, cutMaterial]));
  const blueprintMaterial = seeThrough(BLUEPRINT_COLOUR, BLUEPRINT_OPACITY);
  const deliveredMaterial = seeThrough(LOG_COLOUR, DELIVERED_OPACITY);
  const notAllowedMaterial = seeThrough(NOT_ALLOWED_COLOUR, BLUEPRINT_OPACITY);
  const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });

  // The log shape lies along z. On a sled the logs lie along the runners, along x.
  const logGeometry = logShape.geometry.clone().rotateY(Math.PI / 2);
  const debarkedLogGeometry = createDebarkedLogGeometry(logShape.geometry).rotateY(Math.PI / 2);
  const logMaterials = [
    new THREE.MeshStandardMaterial({ color: LOG_COLOUR, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: LOG_CUT_COLOUR, flatShading: true }),
  ];
  const debarkedLogMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, vertexColors: true });
  const logRadius = logShape.restHeight;
  const logSpacing = 2 * logRadius + LOG_GAP_METRES;
  /** The middle of the bottom layer of logs, above the ground: resting on the cross pieces. */
  const bottomLayerHeight = 2 * RUNNER_RADIUS_METRES + 2 * CROSS_RADIUS_METRES + logRadius;
  /** How far each layer sits above the one below, resting in its gaps. */
  const layerSpacing = (logSpacing * Math.sqrt(3)) / 2;

  /** Where the log in each place lies, as an offset from the sled's middle: the bottom layer first, then each layer above. */
  function loadPlace(index: number): THREE.Vector3 {
    let layer = 0;
    let inLayer = index;
    while (inLayer >= LOGS_PER_BOTTOM_LAYER - layer && LOGS_PER_BOTTOM_LAYER - layer > 1) {
      inLayer -= LOGS_PER_BOTTOM_LAYER - layer;
      layer += 1;
    }
    const across = LOGS_PER_BOTTOM_LAYER - layer;
    const z = (inLayer - (across - 1) / 2) * logSpacing;
    return new THREE.Vector3(END_JITTER_METRES[index] ?? 0, bottomLayerHeight + layer * layerSpacing, z);
  }

  /** Shows the logs and debarked logs lying on a finished sled: logs first, then debarked logs. */
  function showLoad(item: Drawn, contents: Readonly<Record<CarriedLog, number>> | undefined): void {
    const key = contents === undefined ? "" : `${contents.log},${contents.debarkedLog}`;
    if (key === item.loadKey) return;
    item.loadKey = key;
    item.load.clear();
    if (contents === undefined) return;
    const kinds: CarriedLog[] = [
      ...Array.from({ length: contents.log }, (): CarriedLog => "log"),
      ...Array.from({ length: contents.debarkedLog }, (): CarriedLog => "debarkedLog"),
    ].slice(0, SLED_CAPACITY);
    kinds.forEach((kind, index) => {
      const log = kind === "log" ? new THREE.Mesh(logGeometry, logMaterials) : new THREE.Mesh(debarkedLogGeometry, debarkedLogMaterial);
      log.position.copy(loadPlace(index));
      log.rotation.x = LOG_ROLLS[index] ?? 0;
      log.castShadow = true;
      log.receiveShadow = true;
      item.load.add(log);
    });
  }

  const drawn = new Map<Entity, Drawn>();
  const pickers: THREE.Mesh[] = [];
  const blueprints = blueprintEntities(entities);
  const sleds = sledEntities(entities);

  /** Adds every part, one per stage, to `root`, all in one material. */
  function addStages(root: THREE.Group): Stage[] {
    return parts.map(({ middle }, index) => {
      const stageRoot = new THREE.Group();
      root.add(stageRoot);
      const fading = (solidMaterials[index] ?? []).map((material) => {
        const copy = material.clone();
        copy.transparent = true;
        return copy;
      });
      const mesh = new THREE.Mesh(geometries[index], blueprintMaterial);
      mesh.position.copy(middle);
      mesh.castShadow = true;
      stageRoot.add(mesh);
      return { root: stageRoot, mesh, fading };
    });
  }

  const placingBlueprint = new THREE.Group();
  placingBlueprint.visible = false;
  const placingStages = addStages(placingBlueprint);
  group.add(placingBlueprint);

  function draw(entity: Entity & { position: Vec3 }): Drawn {
    const existing = drawn.get(entity);
    if (existing !== undefined) return existing;
    const root = new THREE.Group();
    const stages = addStages(root);
    const picker = new THREE.Mesh(pickGeometry, pickMaterial);
    picker.userData.entity = entity;
    root.add(picker);
    pickers.push(picker);
    const load = new THREE.Group();
    root.add(load);
    group.add(root);
    const result = { root, stages, picker, load, loadKey: "" };
    drawn.set(entity, result);
    return result;
  }

  /**
   * Shows how far construction has gone. Built stages are solid and in place, the stage being built fades in and is set down,
   * runners whose log has been delivered wait half solid, and the rest show see-through.
   */
  function showProgress(item: Drawn, entity: Entity & { position: Vec3 }, progress: number, delivered: number): void {
    item.root.position.set(entity.position.x, entity.position.y, entity.position.z);
    item.root.rotation.y = facingRadians(entity.facing?.turns ?? 0);
    const stagesDone = progress * parts.length;
    item.stages.forEach((stage, index) => {
      const share = Math.min(1, Math.max(0, stagesDone - index));
      if (share <= 0) {
        stage.mesh.material = index < Math.min(delivered, SLED_LOG_COST) ? deliveredMaterial : blueprintMaterial;
        stage.root.position.y = 0;
        return;
      }
      const opacity = buildOpacity(share);
      for (const material of stage.fading) material.opacity = opacity;
      stage.mesh.material = opacity < 1 ? stage.fading : (solidMaterials[index] ?? blueprintMaterial);
      stage.root.position.y = buildLift(share);
    });
  }

  function disposeFading(stages: readonly Stage[]): void {
    for (const stage of stages) for (const material of stage.fading) material.dispose();
  }

  function forget(entity: Entity): void {
    const item = drawn.get(entity);
    if (item === undefined) return;
    group.remove(item.root);
    disposeFading(item.stages);
    pickers.splice(pickers.indexOf(item.picker), 1);
    drawn.delete(entity);
  }

  const hits: THREE.Intersection[] = [];

  return {
    group,
    update() {
      const seen = new Set<Entity>();
      for (const entity of blueprints) {
        if (entity.blueprint.structure !== "sled") continue;
        const item = draw(entity);
        showProgress(item, entity, entity.blueprint.progress, entity.blueprint.delivered.log ?? 0);
        showLoad(item, undefined);
        seen.add(entity);
      }
      for (const entity of sleds) {
        const item = draw(entity);
        showProgress(item, entity, 1, SLED_LOG_COST);
        showLoad(item, entity.sled);
        seen.add(entity);
      }
      for (const entity of [...drawn.keys()]) if (!seen.has(entity)) forget(entity);
    },
    pick(raycaster) {
      hits.length = 0;
      raycaster.intersectObjects(pickers, false, hits);
      hits.sort((a, b) => a.distance - b.distance);
      for (const hit of hits) {
        const entity = hit.object.userData.entity as Entity | undefined;
        if (entity?.blueprint !== undefined) return { hit: { kind: "blueprint", entity }, distance: hit.distance };
        if (entity?.sled !== undefined) return { hit: { kind: "sled", entity }, distance: hit.distance };
      }
      return undefined;
    },
    outlineOf(hit) {
      const item = drawn.get(hit.entity);
      if (item === undefined) return [];
      item.root.updateMatrixWorld(true);
      const loaded = item.load.children.filter((child): child is THREE.Mesh => child instanceof THREE.Mesh);
      return [...item.stages.map(({ mesh }) => mesh), ...loaded].map((mesh) => ({ geometry: mesh.geometry, matrix: mesh.matrixWorld }));
    },
    showPlacingBlueprint(shown) {
      placingBlueprint.visible = shown !== undefined;
      if (shown === undefined) return;
      const material = shown.allowed ? blueprintMaterial : notAllowedMaterial;
      for (const stage of placingStages) {
        stage.root.position.y = 0;
        stage.mesh.material = material;
      }
      placingBlueprint.position.set(shown.spot.x, shown.spot.y, shown.spot.z);
      placingBlueprint.rotation.y = facingRadians(shown.turns);
    },
    dispose() {
      for (const item of [
        ...geometries,
        pickGeometry,
        barkMaterial,
        cutMaterial,
        stickMaterial,
        blueprintMaterial,
        deliveredMaterial,
        notAllowedMaterial,
        pickMaterial,
        logGeometry,
        debarkedLogGeometry,
        ...logMaterials,
        debarkedLogMaterial,
      ]) {
        item.dispose();
      }
      disposeFading(placingStages);
      for (const item of drawn.values()) disposeFading(item.stages);
    },
  };
}

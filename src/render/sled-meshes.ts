// Draws sleds and sled blueprints: the "sled" asset in asset-manifest.json, built in code. The owner approved the asset.
// A sled is two log runners with their bark on, lying side by side, and four crooked sticks laid across them.
// Each runner is the approved Kenney log from log-shape.ts, the "logs" asset, stretched to the sled's length.
// The front of each runner curves up and narrows, like a skid. The front is the end that leads when the sled is dragged.
// Dark rope lashes each stick to each runner. A rope of light hemp, the same as the "sled-rope", runs in a V from the
// runner tips to a loop at the front.
// Its runners run along x when it faces the default way, with the front towards +x.
// Construction has one stage per material: a runner for each log, then a cross piece for each stick.
// The last cross piece brings the tow rope with it.
// Each part fades in above its place and is set down, like the sticks of a campfire.
// A blueprint shows the parts see-through. A runner whose log has been delivered shows pale and half solid.
// While the player places a sled from the build menu, a see-through copy follows the mouse. It turns red where it is not allowed.
// A finished sled shows the logs and debarked logs lying on it, along the runners, from empty to full:
// logs first, then debarked logs, stacked in a pyramid: three side by side on the cross pieces, two in the gaps above, and one on top.
// They use the approved shapes from log-shape.ts and debarked-log-shape.ts, the "logs" and "debarked-log" assets.
// The planks on a sled are the "sled-planks" asset, drawn by sled-plank-meshes.ts on top of the logs.
// A sled the player has dragged points the way it was last dragged, and a dragged sled
// moves smoothly between logic steps with the player.
// While the player drags a sled, its flat tow rope hides. The approved "sled-rope", drawn by sled-rope.ts, takes its place:
// a V from the runner tips to a knot, lifted toward the player's hand, and a rope from the knot to the hand.
import * as THREE from "three";
import { buildLift, buildOpacity, NOT_ALLOWED_COLOUR, seeThrough } from "./structure-look";
import { type CarriedLog, type Entity, type EntityStore, type SledLoad, type Vec3 } from "../sim/entities";
import { blueprintEntities, sledEntities } from "../sim/entity-queries";
import { SLED_CAPACITY } from "../sim/sleds";
import { SLED_LENGTH_METRES, SLED_WIDTH_METRES } from "../sim/structure-shapes";
import { SLED_LOG_COST } from "../sim/structure-freely-placed";
import { createDebarkedLogGeometry } from "./debarked-log-shape";
import { LOG_COLOUR, LOG_CUT_COLOUR, type LogShape } from "./log-shape";
import { createSledPlankShapes } from "./sled-plank-meshes";
import { CROSS_RADIUS_METRES, RUNNER_RADIUS_METRES, runnerTipsAt, SLED_STICK_COLOUR, sledParts } from "./sled-body-shapes";
import { createSledRope, type RopeHold, type RunnerTips } from "./sled-rope";
import type { OutlinePart } from "./hover-outline";
import { quarterTurnsToRadians, type QuarterTurns } from "../sim/quarter-turns";

const BLUEPRINT_COLOUR = 0xbfe3ff;
/** How see-through the parts of a blueprint not yet built are, from 0 (invisible) to 1 (solid). */
const BLUEPRINT_OPACITY = 0.35;
/** A runner whose log has been delivered is this solid, so it stands out from the parts still needed. */
const DELIVERED_OPACITY = 0.7;
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
  /**
   * Brings every sled and sled blueprint up to date with game state.
   * `nowSeconds` is the time the frame shows, so the dragged rope eases taut or slack.
   * `player` is where the player is drawn this frame. The sled they drag is drawn moved as far as they are, so it keeps up smoothly.
   * `ropeHold` is where the player holds the rope while dragging. The dragged sled's tow rope lifts from its runner tips toward it.
   */
  update(nowSeconds: number, player?: Vec3, ropeHold?: RopeHold): void;
  /** What a ray from the camera hits first among sleds and sled blueprints, and how far away. */
  pick(raycaster: THREE.Raycaster): { hit: SledHit; distance: number } | undefined;
  /** The parts of a sled or sled blueprint, placed in the world. Empty once it is gone. */
  outlineOf(hit: SledHit): OutlinePart[];
  /** Shows a sled blueprint under the mouse at `spot`, facing `turns`, red where it is not allowed. Undefined hides it. */
  showPlacingBlueprint(placingBlueprint: { spot: Vec3; turns: QuarterTurns; allowed: boolean } | undefined): void;
  dispose(): void;
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
  /** The logs and planks lying on a finished sled, and the load they show, such as "2,1,8". */
  readonly load: THREE.Group;
  loadKey: string;
}

/** `logShape` is the loaded log model, which the logs lying on a sled use. */
export function createSledMeshes(entities: EntityStore, logShape: LogShape): SledMeshes {
  const group = new THREE.Group();
  // A runner draws bark on its side and pale cut ends, like the log shape it is made from.
  const barkMaterial = new THREE.MeshStandardMaterial({ color: LOG_COLOUR, flatShading: true });
  const cutMaterial = new THREE.MeshStandardMaterial({ color: LOG_CUT_COLOUR, flatShading: true });
  const stickMaterial = new THREE.MeshStandardMaterial({ color: SLED_STICK_COLOUR, flatShading: true, vertexColors: true });
  const parts = sledParts(logShape, { bark: barkMaterial, cut: cutMaterial, stick: stickMaterial });
  const geometries = parts.map(({ geometry }) => geometry);
  const solidMaterials = parts.map(({ solid }) => solid);
  // A dragged sled draws its last cross piece without the flat tow rope, because sled-rope.ts draws it lifted.
  const towlessParts = sledParts(logShape, { bark: barkMaterial, cut: cutMaterial, stick: stickMaterial }, false);
  const towlessLastCross = towlessParts.pop()?.geometry;
  for (const part of towlessParts) part.geometry.dispose();
  const height = 2 * RUNNER_RADIUS_METRES + 2 * CROSS_RADIUS_METRES;
  const pickGeometry = new THREE.BoxGeometry(SLED_LENGTH_METRES, height, SLED_WIDTH_METRES).translate(0, height / 2, 0);

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

  const plankShapes = createSledPlankShapes();

  /** Shows the logs, debarked logs, and planks lying on a finished sled: logs first, then debarked logs, then planks on top. */
  function showLoad(item: Drawn, contents: Readonly<SledLoad> | undefined): void {
    const key = contents === undefined ? "" : `${contents.log},${contents.debarkedLog},${contents.plank}`;
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
    const logsTop = kinds.reduce((top, _kind, index) => Math.max(top, loadPlace(index).y + logRadius), 2 * RUNNER_RADIUS_METRES + 2 * CROSS_RADIUS_METRES);
    plankShapes.addPlanks(item.load, contents.plank, logsTop);
  }

  const drawn = new Map<Entity, Drawn>();
  const pickers: THREE.Mesh[] = [];
  const blueprints = blueprintEntities(entities);
  const sleds = sledEntities(entities);
  const draggers = entities.with("player", "position", "dragging");
  const rope = createSledRope();
  group.add(rope.group);

  /** Adds every part, one per stage, to `root`, all in one material. */
  function addStages(root: THREE.Group): Stage[] {
    return parts.map(({ middle }, index) => {
      const stageRoot = new THREE.Group();
      root.add(stageRoot);
      const solid = solidMaterials[index] ?? [];
      const fading = (Array.isArray(solid) ? solid : [solid]).map((material) => {
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
    item.root.rotation.y = entity.dragHeading ?? quarterTurnsToRadians(entity.facing?.turns ?? 0);
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
      const fading = stage.fading.length === 1 ? stage.fading[0] : stage.fading;
      stage.mesh.material = opacity < 1 && fading !== undefined ? fading : (solidMaterials[index] ?? blueprintMaterial);
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
  const dragged = new Map<Drawn, THREE.BufferGeometry>();

  return {
    group,
    update(nowSeconds, player, ropeHold) {
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
      // The player is drawn between logic steps. Move the sled they drag by as much, so it does not lag a step behind them.
      let tips: RunnerTips | undefined;
      for (const dragger of draggers) {
        const sled = entities.entity(dragger.dragging.sledId);
        const item = sled === undefined ? undefined : drawn.get(sled);
        if (item === undefined) continue;
        if (player !== undefined) {
          item.root.position.x += player.x - dragger.position.x;
          item.root.position.z += player.z - dragger.position.z;
        }
        tips = runnerTipsAt(item.root.position, item.root.rotation.y);
        if (towlessLastCross !== undefined) dragged.set(item, towlessLastCross);
      }
      // Only the dragged sled hides its flat tow rope. Every other sled shows its own.
      for (const item of drawn.values()) {
        const last = item.stages.at(-1);
        const geometry = dragged.get(item) ?? geometries.at(-1);
        if (last !== undefined && geometry !== undefined && last.mesh.geometry !== geometry) last.mesh.geometry = geometry;
      }
      dragged.clear();
      rope.show(ropeHold, tips, nowSeconds);
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
      placingBlueprint.rotation.y = quarterTurnsToRadians(shown.turns);
    },
    dispose() {
      for (const item of [
        ...geometries,
        ...(towlessLastCross === undefined ? [] : [towlessLastCross]),
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
      plankShapes.dispose();
      rope.dispose();
      disposeFading(placingStages);
      for (const item of drawn.values()) disposeFading(item.stages);
    },
  };
}

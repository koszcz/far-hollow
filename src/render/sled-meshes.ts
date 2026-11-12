// Draws sleds and sled blueprints: the "sled" asset in asset-manifest.json, built in code. The owner approved the asset.
// A sled is two log runners with their bark on, lying side by side, and four crooked sticks laid across them.
// Each runner is the approved Kenney log from log-shape.ts, the "logs" asset, stretched to the sled's length.
// The front of each runner curves up and narrows, like a skid. The front is the end that leads when the sled is dragged.
// Dark rope lashes each stick to each runner, and a rope runs in a V from the runner tips to a loop at the front.
// Its runners run along x when it faces the default way, with the front towards +x.
// Construction has one stage per material: a runner for each log, then a cross piece for each stick.
// The last cross piece brings the tow rope with it.
// Each part fades in above its place and is set down, like the sticks of a campfire.
// A blueprint shows the parts see-through. A runner whose log has been delivered shows pale and half solid.
// While the player places a sled from the build menu, a see-through copy follows the mouse. It turns red where it is not allowed.
// A finished sled shows the logs and debarked logs lying on it, along the runners, from empty to full:
// logs first, then debarked logs, stacked in a pyramid: three side by side on the cross pieces, two in the gaps above, and one on top.
// They use the approved shapes from log-shape.ts and debarked-log-shape.ts, the "logs" and "debarked-log" assets.
// A sled the player has dragged points the way it was last dragged, and a dragged sled
// moves smoothly between logic steps with the player.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { buildLift, buildOpacity, facingRadians, NOT_ALLOWED_COLOUR, seeThrough } from "./structure-look";
import { blueprintEntities, sledEntities, type CarriedLog, type Entity, type EntityStore, type Vec3 } from "../sim/entities";
import { SLED_CAPACITY } from "../sim/sleds";
import { SLED_LENGTH_METRES, SLED_LOG_COST, SLED_STICK_COST, SLED_WIDTH_METRES } from "../sim/structures";
import { createDebarkedLogGeometry } from "./debarked-log-shape";
import { LOG_COLOUR, LOG_CUT_COLOUR, LOG_LENGTH_METRES, type LogShape } from "./log-shape";
import { createStickSegment, STICK_COLOUR } from "./stick-shape";
import type { OutlinePart } from "./hover-outline";

const BLUEPRINT_COLOUR = 0xbfe3ff;
/** How see-through the parts of a blueprint not yet built are, from 0 (invisible) to 1 (solid). */
const BLUEPRINT_OPACITY = 0.35;
/** A runner whose log has been delivered is this solid, so it stands out from the parts still needed. */
const DELIVERED_OPACITY = 0.7;
/** How far each runner's middle sits above the ground, in metres: its radius. */
const RUNNER_RADIUS_METRES = 0.1;
/** Each runner starts to curve up this far from its middle, in metres. */
const RUNNER_BEND_START_METRES = 0.62;
/** The front tip of each runner rises this far above the rest of it, in metres. */
const RUNNER_TIP_LIFT_METRES = 0.13;
/** The front tip of each runner is this much thinner than the rest, as a share of its thickness. */
const RUNNER_TIP_TAPER = 0.3;
/** The runner is cut into this many rings along its bend, so the bend is smooth. */
const RUNNER_BEND_RINGS = 6;
/** The radius of each cross piece at its thick end, in metres. Its thin end is a little thinner. */
const CROSS_RADIUS_METRES = 0.032;
/** Each cross piece has this many sides. */
const CROSS_SIDES = 6;
/** The cross pieces stand this far in from the ends of the runners, in metres. */
const CROSS_INSET_METRES = 0.3;
/** How far each cross piece bends sideways at its middle, in metres, one per cross piece, so they look like branches. */
const CROSS_BENDS: readonly number[] = [0.025, -0.02, 0.015, -0.025];
/** The rope colour: darker than the bark, so the lashings show. */
const ROPE_COLOUR = 0x3d3128;
/** The thickness of the rope, as a radius in metres. */
const ROPE_RADIUS_METRES = 0.011;
/** Each lashing crosses the runner at this angle from straight across, in radians, so the two wraps make an X. */
const LASHING_TILT = 0.45;
/** The tow rope's V meets this far in front of the sled's middle, in metres. */
const TOW_KNOT_METRES = SLED_LENGTH_METRES / 2 + 0.3;
/** The radius of the loop at the end of the tow rope, in metres. */
const TOW_LOOP_RADIUS_METRES = 0.06;
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
   * `player` is where the player is drawn this frame. The sled they drag is drawn moved as far as they are, so it keeps up smoothly.
   */
  update(player?: Vec3): void;
  /** What a ray from the camera hits first among sleds and sled blueprints, and how far away. */
  pick(raycaster: THREE.Raycaster): { hit: SledHit; distance: number } | undefined;
  /** The parts of a sled or sled blueprint, placed in the world. Empty once it is gone. */
  outlineOf(hit: SledHit): OutlinePart[];
  /** Shows a sled blueprint under the mouse at `spot`, facing `turns`, red where it is not allowed. Undefined hides it. */
  showPlacingBlueprint(placingBlueprint: { spot: Vec3; turns: number; allowed: boolean } | undefined): void;
  dispose(): void;
}

/** One part of the sled: its shape, the materials it draws with when solid, and where its middle sits. */
interface Part {
  readonly geometry: THREE.BufferGeometry;
  readonly solid: THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[];
  readonly middle: THREE.Vector3;
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

/**
 * Splits every triangle of `geometry` that crosses one of the planes x = `cuts`, so the shape gets a ring of corners there.
 * `geometry` must not be indexed. Every attribute is blended along each cut edge. Groups are kept.
 */
function sliceAcrossX(geometry: THREE.BufferGeometry, cuts: readonly number[]): THREE.BufferGeometry {
  const names = Object.keys(geometry.attributes);
  const attributes = names.map((name) => geometry.getAttribute(name));
  const sizes = attributes.map((attribute) => attribute.itemSize);
  const width = sizes.reduce((sum, size) => sum + size, 0);
  type Corner = number[];
  const cornerAt = (index: number): Corner =>
    attributes.flatMap((attribute) => Array.from({ length: attribute.itemSize }, (_, k) => attribute.array[index * attribute.itemSize + k] ?? 0));
  const blend = (a: Corner, b: Corner, t: number): Corner => a.map((value, k) => value + ((b[k] ?? 0) - value) * t);
  const xAt = sizes.slice(0, names.indexOf("position")).reduce((sum, size) => sum + size, 0);
  const xOf = (corner: Corner): number => corner[xAt] ?? 0;

  function split(triangle: Corner[], cut: number): Corner[][] {
    const above = triangle.map((corner) => xOf(corner) > cut);
    const count = above.filter(Boolean).length;
    if (count === 0 || count === 3) return [triangle];
    // Turn the triangle, keeping its winding, so its lone corner comes first.
    const lone = above.findIndex((side) => side === (count === 1));
    const [a, b, c] = [0, 1, 2].map((k) => triangle[(lone + k) % 3] ?? []) as [Corner, Corner, Corner];
    const ab = blend(a, b, (cut - xOf(a)) / (xOf(b) - xOf(a)));
    const ac = blend(a, c, (cut - xOf(a)) / (xOf(c) - xOf(a)));
    return [
      [a, ab, ac],
      [ab, b, c],
      [ab, c, ac],
    ];
  }

  const groups = geometry.groups.length > 0 ? geometry.groups : [{ start: 0, count: geometry.getAttribute("position").count, materialIndex: 0 }];
  const corners: Corner[] = [];
  const result = new THREE.BufferGeometry();
  for (const group of groups) {
    const first = corners.length;
    for (let i = group.start; i < group.start + group.count; i += 3) {
      let triangles: Corner[][] = [[cornerAt(i), cornerAt(i + 1), cornerAt(i + 2)]];
      for (const cut of cuts) triangles = triangles.flatMap((triangle) => split(triangle, cut));
      for (const triangle of triangles) corners.push(...triangle);
    }
    result.addGroup(first, corners.length - first, group.materialIndex ?? 0);
  }
  let offset = 0;
  names.forEach((name, n) => {
    const size = sizes[n] ?? 1;
    const array = new Float32Array(corners.length * size);
    corners.forEach((corner, i) => {
      array.set(corner.slice(offset, offset + size), i * size);
    });
    result.setAttribute(name, new THREE.BufferAttribute(array, size));
    offset += size;
  });
  if (offset !== width) throw new Error("sliceAcrossX lost an attribute");
  return result;
}

/**
 * One runner, centred on the origin and lying along x, with its front at +x: the log shape stretched to the sled's length.
 * Its front curves up and narrows like a skid. `rolled` turns it half over, so the two runners' branch stubs point outwards.
 */
function createRunnerGeometry(logShape: LogShape, rolled: boolean): THREE.BufferGeometry {
  const thickness = RUNNER_RADIUS_METRES / logShape.restHeight;
  const log = logShape.geometry.clone();
  // The log shape lies along z and is 1 m long. Stretch it to the sled's length, then lay it along x.
  log.scale(thickness, thickness, SLED_LENGTH_METRES / LOG_LENGTH_METRES);
  log.rotateY(Math.PI / 2);
  if (rolled) log.rotateX(Math.PI);
  const flat = log.index === null ? log : log.toNonIndexed();
  const tip = SLED_LENGTH_METRES / 2;
  const cuts = Array.from({ length: RUNNER_BEND_RINGS }, (_, i) => RUNNER_BEND_START_METRES + ((tip - RUNNER_BEND_START_METRES) * i) / RUNNER_BEND_RINGS);
  const runner = sliceAcrossX(flat, cuts);
  for (const geometry of new Set([log, flat])) geometry.dispose();
  const position = runner.getAttribute("position");
  for (let i = 0; i < position.count; i += 1) {
    const along = Math.min(1, Math.max(0, (position.getX(i) - RUNNER_BEND_START_METRES) / (tip - RUNNER_BEND_START_METRES)));
    const shrink = 1 - RUNNER_TIP_TAPER * along;
    position.setY(i, position.getY(i) * shrink + RUNNER_TIP_LIFT_METRES * along * along);
    position.setZ(i, position.getZ(i) * shrink);
  }
  runner.computeVertexNormals();
  return runner;
}

/** The colour that, multiplied by the stick colour, gives `colour`. Stick parts draw with vertex colours on the stick material. */
function tintOverStick(colour: number): THREE.Color {
  const target = new THREE.Color(colour);
  const stick = new THREE.Color(STICK_COLOUR);
  return new THREE.Color(target.r / stick.r, target.g / stick.g, target.b / stick.b);
}

/** Gives every corner of `geometry` the colour `colour`, and drops attributes the stick parts do not share. */
function paint(geometry: THREE.BufferGeometry, colour: THREE.Color): THREE.BufferGeometry {
  geometry.deleteAttribute("uv");
  const count = geometry.getAttribute("position").count;
  const colours = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) colours.set([colour.r, colour.g, colour.b], i * 3);
  geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  return geometry;
}

/** A straight length of rope from `from` to `to`. */
function ropeBetween(from: THREE.Vector3, to: THREE.Vector3): THREE.BufferGeometry {
  const direction = to.clone().sub(from);
  const rope = new THREE.CylinderGeometry(ROPE_RADIUS_METRES, ROPE_RADIUS_METRES, direction.length(), 5);
  rope.translate(0, direction.length() / 2, 0);
  rope.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()));
  rope.translate(from.x, from.y, from.z);
  return paint(rope, tintOverStick(ROPE_COLOUR));
}

/** Two wraps of rope in an X around a runner and the cross piece on it, centred where they cross, at height 0. */
function lashing(runnerZ: number): THREE.BufferGeometry[] {
  const top = 2 * RUNNER_RADIUS_METRES + 2 * CROSS_RADIUS_METRES;
  return [LASHING_TILT, -LASHING_TILT].map((tilt) => {
    // The wrap stands across the runner, around it and the cross piece, from just under the ground to just over the stick.
    const across = RUNNER_RADIUS_METRES * 1.3;
    const up = top / 2 + ROPE_RADIUS_METRES;
    const points = Array.from({ length: 12 }, (_, k) => {
      const angle = (2 * Math.PI * k) / 12;
      return new THREE.Vector3(0, Math.sin(angle) * up, Math.cos(angle) * across);
    });
    const wrap = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, true), 16, ROPE_RADIUS_METRES, 4, true);
    wrap.rotateY(tilt);
    wrap.translate(0, top / 2, runnerZ);
    return paint(wrap, tintOverStick(ROPE_COLOUR));
  });
}

/** The tow rope: a V from the two runner tips, meeting in a knot in front of the sled, with a loop beyond it. Height 0 is the ground. */
function towRope(runnerZ: number): THREE.BufferGeometry[] {
  const tipX = SLED_LENGTH_METRES / 2 - 0.04;
  const tipY = RUNNER_RADIUS_METRES + RUNNER_TIP_LIFT_METRES;
  const knot = new THREE.Vector3(TOW_KNOT_METRES, ROPE_RADIUS_METRES, 0);
  const loop = new THREE.TorusGeometry(TOW_LOOP_RADIUS_METRES, ROPE_RADIUS_METRES, 4, 10);
  loop.rotateX(Math.PI / 2);
  loop.translate(TOW_KNOT_METRES + TOW_LOOP_RADIUS_METRES, ROPE_RADIUS_METRES, 0);
  return [
    ropeBetween(new THREE.Vector3(tipX, tipY, -runnerZ), knot),
    ropeBetween(new THREE.Vector3(tipX, tipY, runnerZ), knot),
    paint(loop, tintOverStick(ROPE_COLOUR)),
  ];
}

/**
 * The parts in the order construction lays them: a runner for each log, then a cross piece for each stick.
 * Each cross piece comes with its lashings, and the last one with the tow rope.
 */
function sledParts(
  logShape: LogShape,
  materials: { bark: THREE.MeshStandardMaterial; cut: THREE.MeshStandardMaterial; stick: THREE.MeshStandardMaterial },
): Part[] {
  const runnerZ = SLED_WIDTH_METRES / 2 - RUNNER_RADIUS_METRES;
  const runners = Array.from({ length: SLED_LOG_COST }, (_, i): Part => {
    const side = -1 + (2 * i) / Math.max(1, SLED_LOG_COST - 1);
    return {
      geometry: createRunnerGeometry(logShape, side > 0),
      solid: [materials.bark, materials.cut],
      middle: new THREE.Vector3(0, RUNNER_RADIUS_METRES, side * runnerZ),
    };
  });
  const span = SLED_LENGTH_METRES - 2 * CROSS_INSET_METRES;
  const crossY = 2 * RUNNER_RADIUS_METRES;
  const crosses = Array.from({ length: SLED_STICK_COST }, (_, i): Part => {
    const x = -span / 2 + (span * i) / Math.max(1, SLED_STICK_COST - 1);
    const bend = CROSS_BENDS[i % CROSS_BENDS.length] ?? 0;
    // Thick ends alternate sides, like sticks laid by hand. Each piece rests on the runners at height 0.
    const flip = i % 2 === 0 ? 1 : -1;
    const half = SLED_WIDTH_METRES / 2;
    const thin = CROSS_RADIUS_METRES * 0.8;
    const foot = new THREE.Vector3(0, CROSS_RADIUS_METRES, -flip * half);
    const knee = new THREE.Vector3(bend, (CROSS_RADIUS_METRES + thin) / 2, 0);
    const end = new THREE.Vector3(0, thin, flip * half);
    const pieces = [
      createStickSegment(foot, knee, CROSS_RADIUS_METRES, (CROSS_RADIUS_METRES + thin) / 2, CROSS_SIDES, true, false),
      createStickSegment(
        knee.clone().addScaledVector(knee.clone().sub(foot).normalize(), -0.02),
        end,
        (CROSS_RADIUS_METRES + thin) / 2,
        thin,
        CROSS_SIDES,
        false,
        true,
      ),
      ...[-runnerZ, runnerZ].flatMap((z) => lashing(z).map((wrap) => wrap.translate(0, -crossY, 0))),
      ...(i === SLED_STICK_COST - 1 ? towRope(runnerZ).map((rope) => rope.translate(-x, -crossY, 0)) : []),
    ];
    for (const piece of pieces) if (piece.hasAttribute("uv")) piece.deleteAttribute("uv");
    const geometry = mergeGeometries(pieces);
    for (const piece of pieces) piece.dispose();
    return { geometry, solid: materials.stick, middle: new THREE.Vector3(x, crossY, 0) };
  });
  return [...runners, ...crosses];
}

/** `logShape` is the loaded log model, which the logs lying on a sled use. */
export function createSledMeshes(entities: EntityStore, logShape: LogShape): SledMeshes {
  const group = new THREE.Group();
  // A runner draws bark on its side and pale cut ends, like the log shape it is made from.
  const barkMaterial = new THREE.MeshStandardMaterial({ color: LOG_COLOUR, flatShading: true });
  const cutMaterial = new THREE.MeshStandardMaterial({ color: LOG_CUT_COLOUR, flatShading: true });
  const stickMaterial = new THREE.MeshStandardMaterial({ color: STICK_COLOUR, flatShading: true, vertexColors: true });
  const parts = sledParts(logShape, { bark: barkMaterial, cut: cutMaterial, stick: stickMaterial });
  const geometries = parts.map(({ geometry }) => geometry);
  const solidMaterials = parts.map(({ solid }) => solid);
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
  const draggers = entities.with("player", "position", "dragging");

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
    item.root.rotation.y = entity.dragHeading ?? facingRadians(entity.facing?.turns ?? 0);
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

  return {
    group,
    update(player) {
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
      for (const dragger of player === undefined ? [] : draggers) {
        const sled = entities.entity(dragger.dragging.sledId);
        const item = sled === undefined ? undefined : drawn.get(sled);
        if (item === undefined || player === undefined) continue;
        item.root.position.x += player.x - dragger.position.x;
        item.root.position.z += player.z - dragger.position.z;
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

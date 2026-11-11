// Draws sawhorses and sawhorse blueprints: the "sawhorse" asset in asset-manifest.json, built in code. The owner approved the asset.
// A sawhorse is a beam of debarked log resting on two pairs of crossed legs, cut from debarked logs too.
// Every part is painted like the approved debarked log of debarked-log-shape.ts: drawknife streaks, a few bark scraps
// near the ends, and cut ends that darken towards the heartwood. The parts are too thin to show knots.
// Its beam runs along x when it faces the default way.
// Construction has one stage per debarked log. The first stands up the legs, and the second lays the beam across them.
// Each part fades in above its place and is set down, like the sticks of a campfire.
// A blueprint shows the parts see-through. A part whose debarked log has been delivered shows pale and half solid.
// While the player places a sawhorse from the build menu, a see-through copy follows the mouse. It turns red where it is not allowed.
import * as THREE from "three";
import { buildLift, buildOpacity, facingRadians, NOT_ALLOWED_COLOUR, seeThrough } from "./structure-look";
import { blueprintEntities, workStationEntities, type Entity, type EntityStore, type Vec3 } from "../sim/entities";
import { SAWHORSE_LENGTH_METRES, SAWHORSE_LOG_COST, SAWHORSE_WIDTH_METRES, structureKindOf } from "../sim/structures";
import { createDebarkedLogGeometry, DEBARKED_LOG_COLOUR } from "./debarked-log-shape";
import type { OutlinePart } from "./hover-outline";

const BLUEPRINT_COLOUR = 0xbfe3ff;
/** How see-through the parts of a blueprint not yet built are, from 0 (invisible) to 1 (solid). */
const BLUEPRINT_OPACITY = 0.35;
/** A part whose log has been delivered is this solid, so it stands out from the parts still needed. */
const DELIVERED_OPACITY = 0.7;
/** How high the top of the beam is above the ground, in metres. */
const BEAM_TOP_METRES = 0.75;
/** The radius of the beam, in metres. */
const BEAM_RADIUS_METRES = 0.09;
/** The radius of each leg, in metres. */
const LEG_RADIUS_METRES = 0.045;
/** The legs reach this far above the beam's middle, where they cross, so the crossed tops cradle the beam, in metres. */
const LEG_TOP_ABOVE_BEAM_METRES = 0.08;
/** Each pair of legs stands this far in from the ends of the beam, in metres. */
const LEG_INSET_METRES = 0.15;
/** The beam has this many sides. A few flat sides look hewn. */
const BEAM_SIDES = 8;
/** Each leg has this many sides. */
const LEG_SIDES = 6;
/**
 * Each part is painted at this radius, close to a whole debarked log's, then thinned to its own.
 * So its cut ends darken to the heartwood in the same proportion as a debarked log's, in metres.
 */
const PAINT_RADIUS_METRES = 0.14;

/** What a click on a sawhorse or sawhorse blueprint landed on. */
export type SawhorseHit = { kind: "blueprint"; entity: Entity } | { kind: "sawhorse"; entity: Entity };

export interface SawhorseMeshes {
  readonly group: THREE.Group;
  /** Brings every sawhorse and sawhorse blueprint up to date with game state. */
  update(): void;
  /** What a ray from the camera hits first among sawhorses and sawhorse blueprints, and how far away. */
  pick(raycaster: THREE.Raycaster): { hit: SawhorseHit; distance: number } | undefined;
  /** The parts of a sawhorse or sawhorse blueprint, placed in the world. Empty once it is gone. */
  outlineOf(hit: SawhorseHit): OutlinePart[];
  /** Shows a sawhorse blueprint under the mouse at `spot`, facing `turns`, red where it is not allowed. Undefined hides it. */
  showPlacingBlueprint(placingBlueprint: { spot: Vec3; turns: number; allowed: boolean } | undefined): void;
  dispose(): void;
}

/** One round piece of wood: its radius and length, where its middle is, and which way its length runs. */
interface Part {
  readonly radius: number;
  readonly length: number;
  readonly middle: THREE.Vector3;
  readonly direction: THREE.Vector3;
}

/** One stage of construction: the meshes it adds, with their own see-through copy of the wood for fading in. */
interface Stage {
  readonly root: THREE.Group;
  readonly meshes: THREE.Mesh[];
  readonly fading: THREE.MeshStandardMaterial;
}

interface Drawn {
  readonly root: THREE.Group;
  readonly stages: Stage[];
  readonly picker: THREE.Mesh;
}

/** A piece of wood from `from` to `to`. */
function partBetween(from: THREE.Vector3, to: THREE.Vector3, radius: number): Part {
  const along = to.clone().sub(from);
  return { radius, length: along.length(), middle: from.clone().add(to).multiplyScalar(0.5), direction: along.normalize() };
}

/** A round piece of debarked log, `length` long and `radius` thick, standing along y around its middle. */
function debarkedPartGeometry(radius: number, length: number, sides: number): THREE.BufferGeometry {
  // Its sides are single long faces, so no corner falls inside the debarked log's knot bands and it gets no knots.
  const cylinder = new THREE.CylinderGeometry(PAINT_RADIUS_METRES, PAINT_RADIUS_METRES, length, sides);
  // The painting expects a log lying along z. Paint it there, then stand it back up along y at its own thickness.
  cylinder.rotateX(Math.PI / 2);
  const painted = createDebarkedLogGeometry(cylinder);
  cylinder.dispose();
  painted.rotateX(-Math.PI / 2);
  painted.scale(radius / PAINT_RADIUS_METRES, 1, radius / PAINT_RADIUS_METRES);
  painted.computeVertexNormals();
  return painted;
}

/** The legs, two crossed pairs, one near each end of the beam. Each leg runs from one side's foot up past the beam to the other side. */
function legParts(): Part[] {
  const beamMiddle = BEAM_TOP_METRES - BEAM_RADIUS_METRES;
  const footZ = SAWHORSE_WIDTH_METRES / 2;
  const topZ = footZ * (LEG_TOP_ABOVE_BEAM_METRES / beamMiddle);
  const topY = beamMiddle + LEG_TOP_ABOVE_BEAM_METRES;
  const endX = SAWHORSE_LENGTH_METRES / 2 - LEG_INSET_METRES;
  return [-endX, endX].flatMap((x) =>
    [1, -1].map((side) => partBetween(new THREE.Vector3(x, 0, side * footZ), new THREE.Vector3(x, topY, -side * topZ), LEG_RADIUS_METRES)),
  );
}

/** The beam, lying along x in the crook of the crossed legs. */
function beamPart(): Part {
  const y = BEAM_TOP_METRES - BEAM_RADIUS_METRES;
  const half = SAWHORSE_LENGTH_METRES / 2;
  return partBetween(new THREE.Vector3(-half, y, 0), new THREE.Vector3(half, y, 0), BEAM_RADIUS_METRES);
}

export function createSawhorseMeshes(entities: EntityStore): SawhorseMeshes {
  const group = new THREE.Group();
  const stageParts = [legParts(), [beamPart()]];
  const up = new THREE.Vector3(0, 1, 0);
  const geometries = stageParts.map((parts) =>
    parts.map(({ radius, length }) => debarkedPartGeometry(radius, length, radius === BEAM_RADIUS_METRES ? BEAM_SIDES : LEG_SIDES)),
  );
  const pickGeometry = new THREE.BoxGeometry(SAWHORSE_LENGTH_METRES, BEAM_TOP_METRES, SAWHORSE_WIDTH_METRES).translate(0, BEAM_TOP_METRES / 2, 0);

  // The wood carries its colours on each corner, painted by debarked-log-shape.ts.
  const woodMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, vertexColors: true });
  const blueprintMaterial = seeThrough(BLUEPRINT_COLOUR, BLUEPRINT_OPACITY);
  const deliveredMaterial = seeThrough(DEBARKED_LOG_COLOUR, DELIVERED_OPACITY);
  const notAllowedMaterial = seeThrough(NOT_ALLOWED_COLOUR, BLUEPRINT_OPACITY);
  const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });

  const drawn = new Map<Entity, Drawn>();
  const pickers: THREE.Mesh[] = [];
  const blueprints = blueprintEntities(entities);
  const stations = workStationEntities(entities);

  /** Adds the parts of every stage to `root`, all in one material. */
  function addStages(root: THREE.Group): Stage[] {
    return stageParts.map((parts, stage) => {
      const stageRoot = new THREE.Group();
      root.add(stageRoot);
      const fading = woodMaterial.clone();
      fading.transparent = true;
      const meshes = parts.map(({ middle, direction }, i) => {
        const mesh = new THREE.Mesh(geometries[stage]?.[i], blueprintMaterial);
        mesh.position.copy(middle);
        mesh.quaternion.setFromUnitVectors(up, direction);
        mesh.castShadow = true;
        stageRoot.add(mesh);
        return mesh;
      });
      return { root: stageRoot, meshes, fading };
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
    group.add(root);
    const result = { root, stages, picker };
    drawn.set(entity, result);
    return result;
  }

  /**
   * Shows how far construction has gone. Built stages are solid and in place, the stage being built fades in and is set down,
   * stages whose log has been delivered wait half solid, and the rest show see-through.
   */
  function showProgress(item: Drawn, entity: Entity & { position: Vec3 }, progress: number, delivered: number): void {
    item.root.position.set(entity.position.x, entity.position.y, entity.position.z);
    item.root.rotation.y = facingRadians(entity.facing?.turns ?? 0);
    const stagesDone = progress * SAWHORSE_LOG_COST;
    item.stages.forEach((stage, index) => {
      const share = Math.min(1, Math.max(0, stagesDone - index));
      if (share <= 0) {
        for (const mesh of stage.meshes) mesh.material = index < delivered ? deliveredMaterial : blueprintMaterial;
        stage.root.position.y = 0;
        return;
      }
      const opacity = buildOpacity(share);
      stage.fading.opacity = opacity;
      for (const mesh of stage.meshes) mesh.material = opacity < 1 ? stage.fading : woodMaterial;
      stage.root.position.y = buildLift(share);
    });
  }

  function disposeFading(stages: readonly Stage[]): void {
    for (const stage of stages) stage.fading.dispose();
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
        if (entity.blueprint.structure !== "sawhorse") continue;
        showProgress(draw(entity), entity, entity.blueprint.progress, entity.blueprint.delivered.debarkedLog ?? 0);
        seen.add(entity);
      }
      // Each kind of work station draws its own.
      for (const entity of stations) {
        if (structureKindOf(entity) !== "sawhorse") continue;
        showProgress(draw(entity), entity, 1, SAWHORSE_LOG_COST);
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
        if (entity?.workStation === "sawhorse") return { hit: { kind: "sawhorse", entity }, distance: hit.distance };
      }
      return undefined;
    },
    outlineOf(hit) {
      const item = drawn.get(hit.entity);
      if (item === undefined) return [];
      item.root.updateMatrixWorld(true);
      return item.stages.flatMap(({ meshes }) => meshes).map((mesh) => ({ geometry: mesh.geometry, matrix: mesh.matrixWorld }));
    },
    showPlacingBlueprint(shown) {
      placingBlueprint.visible = shown !== undefined;
      if (shown === undefined) return;
      const material = shown.allowed ? blueprintMaterial : notAllowedMaterial;
      for (const stage of placingStages) {
        stage.root.position.y = 0;
        for (const mesh of stage.meshes) mesh.material = material;
      }
      placingBlueprint.position.set(shown.spot.x, shown.spot.y, shown.spot.z);
      placingBlueprint.rotation.y = facingRadians(shown.turns);
    },
    dispose() {
      for (const item of [...geometries.flat(), pickGeometry, woodMaterial, blueprintMaterial, deliveredMaterial, notAllowedMaterial, pickMaterial]) {
        item.dispose();
      }
      disposeFading(placingStages);
      for (const item of drawn.values()) disposeFading(item.stages);
    },
  };
}

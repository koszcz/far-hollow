// Draws foundations and foundation blueprints: the "foundation" asset in asset-manifest.json, built in code and approved by the owner.
// A foundation is a deck of debarked logs laid side by side over one building-grid square. The deck logs rest on two
// cross beams, and each beam rests on a leg at each end, so a leg stands under each corner.
// The legs reach down to the ground, so on a slope the legs on the low side are longer.
// Each deck log is a little thicker or thinner, longer or shorter, and turned a little differently, so the deck looks hand-built.
// The deck logs and beams show darker cut ends.
// A blueprint shows the deck, beams, and legs see-through. Each debarked log the player has delivered shows pale and half solid
// in its place, so the blueprint shows how many logs it has and how many it still needs.
// Construction has one stage per log. Each delivered log stays where it waits and turns solid during its stage.
// During the first stage, the legs and beams fade in under the deck.
// While the player places a foundation from the build menu, a see-through copy follows the mouse. It turns red where it is not allowed.
import * as THREE from "three";
import { BUILD_GRID_METRES } from "../sim/build-grid";
import { foundationEntities, blueprintEntities, type Entity, type EntityStore, type Vec3 } from "../sim/entities";
import { FOUNDATION_DECK_THICKNESS_METRES, foundationLegs } from "../sim/foundations";
import { FOUNDATION_LOG_COST } from "../sim/structures";
import { DEBARKED_LOG_COLOUR, DEBARKED_LOG_CUT_COLOUR } from "./debarked-log-shape";
import type { OutlinePart } from "./hover-outline";
import { BUILD_LOWERED_SHARE, deliveredOpacity, NOT_ALLOWED_COLOUR, pickFinished, seeThrough } from "./structure-look";

const BLUEPRINT_COLOUR = 0xbfe3ff;
/** How see-through the parts of a blueprint not yet built are, from 0 (invisible) to 1 (solid). */
const BLUEPRINT_OPACITY = 0.35;
/** A delivered log waiting in its place is this solid, so it stands out from the parts still needed. */
const DELIVERED_OPACITY = 0.7;
/** The legs and beams are a little darker than the deck, as if cut from the heart of the log. */
const LEG_COLOUR = 0xb8966a;
const LEG_RADIUS_METRES = 0.08;
/** Each deck log is as thick as the deck. The logs lie along x, side by side across z. */
const DECK_LOG_RADIUS_METRES = FOUNDATION_DECK_THICKNESS_METRES / 2;
/**
 * The two beams run along z, under the ends of the deck logs, one over each pair of legs.
 * Each beam is notched into the logs above it: its middle sits at the underside of the deck.
 */
const BEAM_RADIUS_METRES = 0.065;
/**
 * How each deck log differs from a plain one: its thickness and length as shares of the plain log,
 * how far it sits off the middle along its length, and how far it is turned about its length, in radians.
 * Fixed, so every foundation looks the same and nothing changes from frame to frame.
 */
const DECK_LOG_LOOKS = [
  { thickness: 0.94, length: 1.06, shift: 0.03, turn: 0.2 },
  { thickness: 1, length: 1.02, shift: -0.04, turn: 0.9 },
  { thickness: 0.9, length: 1.08, shift: 0.01, turn: 0.5 },
  { thickness: 0.97, length: 1.03, shift: -0.02, turn: 1.3 },
] as const;
/** A leg shorter than this still shows, so a foundation on flat ground does not float. */
const SHORTEST_LEG_METRES = 0.02;
/** How far each leg's foot reaches below the ground, in metres. */
const LEG_FOOT_SINK_METRES = 0.04;

/** What a click on a foundation blueprint landed on. Finished foundations are walked on, not clicked. */
export type FoundationHit = { kind: "blueprint"; entity: Entity };

export interface FoundationMeshes {
  readonly group: THREE.Group;
  /** Brings every foundation and foundation blueprint up to date with game state. */
  update(): void;
  /** What a ray from the camera hits first among foundation blueprints, and how far away. */
  pick(raycaster: THREE.Raycaster): { hit: FoundationHit; distance: number } | undefined;
  /** The logs and legs of a foundation blueprint, placed in the world. Empty once it is gone. */
  /** The finished piece the ray meets first, with how far away it is, or undefined if it meets none. The action menu uses it. */
  pickFinished(raycaster: THREE.Raycaster): { entity: Entity; distance: number } | undefined;
  outlineOf(hit: FoundationHit): OutlinePart[];
  /** Shows a foundation blueprint under the mouse with its deck top at `spot`, red where it is not allowed. Undefined hides it. */
  showPlacingBlueprint(placingBlueprint: { spot: Vec3; allowed: boolean } | undefined): void;
  dispose(): void;
}

/** A deck log or beam with its own see-through copies of the wood and cut ends, for fading in. */
interface FadingLog {
  readonly mesh: THREE.Mesh;
  readonly fading: THREE.MeshStandardMaterial[];
}

interface Drawn {
  readonly root: THREE.Group;
  /** Each deck log, with its own see-through copy of the wood for fading in. */
  readonly logs: FadingLog[];
  readonly beams: THREE.Mesh[];
  readonly legs: THREE.Mesh[];
  /** See-through copies of the leg wood and cut ends, which the legs and beams share while they fade in. */
  readonly fadingLegWood: THREE.MeshStandardMaterial;
  readonly fadingLegCut: THREE.MeshStandardMaterial;
  readonly picker: THREE.Mesh;
}

interface Parts {
  readonly logs: THREE.Mesh[];
  readonly beams: THREE.Mesh[];
  readonly legs: THREE.Mesh[];
}

/** `groundAt` gives the height of the ground at a spot, so the legs reach it. */
export function createFoundationMeshes(entities: EntityStore, groundAt: (x: number, z: number) => number): FoundationMeshes {
  const group = new THREE.Group();
  // Cylinder groups are the side, then the two ends, so a list of three materials gives the ends their own colour.
  const logGeometry = new THREE.CylinderGeometry(DECK_LOG_RADIUS_METRES, DECK_LOG_RADIUS_METRES, BUILD_GRID_METRES, 9).rotateZ(Math.PI / 2);
  const beamGeometry = new THREE.CylinderGeometry(BEAM_RADIUS_METRES, BEAM_RADIUS_METRES, BUILD_GRID_METRES, 7).rotateX(Math.PI / 2);
  // One metre tall with its top at the origin, so scaling it makes a leg of any length hanging down from the beam.
  const legGeometry = new THREE.CylinderGeometry(LEG_RADIUS_METRES, LEG_RADIUS_METRES * 1.2, 1, 7).translate(0, -0.5, 0);
  const pickGeometry = new THREE.BoxGeometry(BUILD_GRID_METRES, FOUNDATION_DECK_THICKNESS_METRES * 2, BUILD_GRID_METRES);
  const woodMaterial = new THREE.MeshStandardMaterial({
    color: DEBARKED_LOG_COLOUR,
    flatShading: true,
  });
  const cutMaterial = new THREE.MeshStandardMaterial({
    color: DEBARKED_LOG_CUT_COLOUR,
    flatShading: true,
  });
  const legMaterial = new THREE.MeshStandardMaterial({
    color: LEG_COLOUR,
    flatShading: true,
  });
  const logMaterials = [woodMaterial, cutMaterial, cutMaterial];
  const beamMaterials = [legMaterial, cutMaterial, cutMaterial];
  const blueprintMaterial = seeThrough(BLUEPRINT_COLOUR, BLUEPRINT_OPACITY);
  const deliveredMaterial = seeThrough(DEBARKED_LOG_COLOUR, DELIVERED_OPACITY);
  const notAllowedMaterial = seeThrough(NOT_ALLOWED_COLOUR, BLUEPRINT_OPACITY);
  const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });

  const drawn = new Map<Entity, Drawn>();
  const pickers: THREE.Mesh[] = [];
  const blueprints = blueprintEntities(entities);
  const foundations = foundationEntities(entities);

  /** Adds the deck logs, beams, and legs to `root`, all in one material. */
  function addParts(root: THREE.Group): Parts {
    const make = (geometry: THREE.BufferGeometry, count: number) =>
      Array.from({ length: count }, () => {
        const mesh = new THREE.Mesh(geometry, blueprintMaterial);
        mesh.castShadow = true;
        root.add(mesh);
        return mesh;
      });
    return {
      logs: make(logGeometry, FOUNDATION_LOG_COST),
      beams: make(beamGeometry, 2),
      legs: make(legGeometry, 4),
    };
  }

  /**
   * Lays the deck logs side by side on two beams over the legs.
   * Stretches each leg from under its beam down into the ground.
   */
  function fit(root: THREE.Group, parts: Parts, deck: Vec3): void {
    root.position.set(deck.x, deck.y, deck.z);
    parts.logs.forEach((mesh, i) => {
      const look = DECK_LOG_LOOKS[i % DECK_LOG_LOOKS.length] ?? DECK_LOG_LOOKS[0];
      const across = -BUILD_GRID_METRES / 2 + ((i + 0.5) * BUILD_GRID_METRES) / parts.logs.length;
      // Each log rests on the beams, so a thinner log sits with its underside level with the others.
      const middle = -FOUNDATION_DECK_THICKNESS_METRES + DECK_LOG_RADIUS_METRES * look.thickness;
      mesh.position.set(look.shift, middle, across);
      mesh.scale.set(look.length, look.thickness, look.thickness);
      mesh.rotation.x = look.turn;
    });
    const legs = foundationLegs(deck, groundAt);
    // The legs stand in two pairs, one pair at each end of the deck logs. Each beam spans one pair.
    [legs[0], legs[2]].forEach((leg, i) => {
      const mesh = parts.beams[i];
      if (mesh === undefined || leg === undefined) return;
      mesh.position.set(leg.x - deck.x, leg.top - deck.y, 0);
      mesh.rotation.z = i * 0.7;
    });
    legs.forEach((leg, i) => {
      const mesh = parts.legs[i];
      if (mesh === undefined) return;
      const top = leg.top - BEAM_RADIUS_METRES;
      mesh.position.set(leg.x - deck.x, top - deck.y, leg.z - deck.z);
      // The foot sinks a little into the ground, so no gap shows on a slope.
      mesh.scale.y = Math.max(SHORTEST_LEG_METRES, top - leg.bottom) + LEG_FOOT_SINK_METRES;
    });
  }

  const placingBlueprint = new THREE.Group();
  placingBlueprint.visible = false;
  const placingParts = addParts(placingBlueprint);
  group.add(placingBlueprint);

  function draw(entity: Entity & { position: Vec3 }): Drawn {
    const existing = drawn.get(entity);
    if (existing !== undefined) return existing;
    const root = new THREE.Group();
    const parts = addParts(root);
    const logs = parts.logs.map((mesh) => {
      const side = woodMaterial.clone();
      const cut = cutMaterial.clone();
      side.transparent = true;
      cut.transparent = true;
      return { mesh, fading: [side, cut, cut] };
    });
    const picker = new THREE.Mesh(pickGeometry, pickMaterial);
    picker.position.y = -FOUNDATION_DECK_THICKNESS_METRES / 2;
    picker.userData.entity = entity;
    root.add(picker);
    pickers.push(picker);
    group.add(root);
    const fadingLegWood = legMaterial.clone();
    const fadingLegCut = cutMaterial.clone();
    fadingLegWood.transparent = true;
    fadingLegCut.transparent = true;
    const result = {
      root,
      logs,
      beams: parts.beams,
      legs: parts.legs,
      fadingLegWood,
      fadingLegCut,
      picker,
    };
    drawn.set(entity, result);
    return result;
  }

  /**
   * Shows how far construction has gone. Built logs are solid. The log of the stage under way stays in its place and turns
   * from half solid to solid. Delivered logs wait half solid in their places, and the rest show see-through.
   * The legs and beams fade in during the first stage, from see-through to solid.
   */
  function showProgress(item: Drawn, deck: Vec3, progress: number, delivered: number): void {
    const stagesDone = progress * item.logs.length;
    item.logs.forEach(({ mesh, fading }, index) => {
      const share = Math.min(1, Math.max(0, stagesDone - index));
      if (share <= 0) {
        mesh.material = index < delivered ? deliveredMaterial : blueprintMaterial;
        return;
      }
      const opacity = deliveredOpacity(DELIVERED_OPACITY, share);
      for (const material of fading) material.opacity = opacity;
      mesh.material = opacity < 1 ? fading : logMaterials;
    });
    const frameOpacity = towardsSolid(BLUEPRINT_OPACITY, stagesDone / BUILD_LOWERED_SHARE);
    item.fadingLegWood.opacity = frameOpacity;
    item.fadingLegCut.opacity = frameOpacity;
    const legLook = progress <= 0 ? blueprintMaterial : frameOpacity < 1 ? item.fadingLegWood : legMaterial;
    const beamLook = progress <= 0 ? blueprintMaterial : frameOpacity < 1 ? [item.fadingLegWood, item.fadingLegCut, item.fadingLegCut] : beamMaterials;
    for (const leg of item.legs) leg.material = legLook;
    for (const beam of item.beams) beam.material = beamLook;
    fit(
      item.root,
      {
        logs: item.logs.map(({ mesh }) => mesh),
        beams: item.beams,
        legs: item.legs,
      },
      deck,
    );
  }

  function disposeFading(item: Drawn): void {
    for (const { fading } of item.logs) for (const material of new Set(fading)) material.dispose();
    item.fadingLegWood.dispose();
    item.fadingLegCut.dispose();
  }

  function forget(entity: Entity): void {
    const item = drawn.get(entity);
    if (item === undefined) return;
    group.remove(item.root);
    disposeFading(item);
    pickers.splice(pickers.indexOf(item.picker), 1);
    drawn.delete(entity);
  }

  const hits: THREE.Intersection[] = [];

  return {
    group,
    update() {
      const seen = new Set<Entity>();
      for (const entity of blueprints) {
        if (entity.blueprint.structure !== "foundation") continue;
        showProgress(draw(entity), entity.position, entity.blueprint.progress, entity.blueprint.delivered.debarkedLog ?? 0);
        seen.add(entity);
      }
      for (const entity of foundations) {
        // A finished foundation is walked on, so pick skips it and clicks reach the ground under it.
        showProgress(draw(entity), entity.position, 1, FOUNDATION_LOG_COST);
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
      }
      return undefined;
    },
    pickFinished(raycaster) {
      return pickFinished(raycaster, pickers);
    },
    outlineOf(hit) {
      const item = drawn.get(hit.entity);
      if (item === undefined) return [];
      item.root.updateMatrixWorld(true);
      return [...item.logs.map(({ mesh }) => mesh), ...item.beams, ...item.legs].map((mesh) => ({ geometry: mesh.geometry, matrix: mesh.matrixWorld }));
    },
    showPlacingBlueprint(shown) {
      placingBlueprint.visible = shown !== undefined;
      if (shown === undefined) return;
      const material = shown.allowed ? blueprintMaterial : notAllowedMaterial;
      for (const mesh of [...placingParts.logs, ...placingParts.beams, ...placingParts.legs]) mesh.material = material;
      fit(placingBlueprint, placingParts, shown.spot);
    },
    dispose() {
      for (const item of [
        logGeometry,
        beamGeometry,
        legGeometry,
        pickGeometry,
        woodMaterial,
        cutMaterial,
        legMaterial,
        blueprintMaterial,
        deliveredMaterial,
        notAllowedMaterial,
        pickMaterial,
      ]) {
        item.dispose();
      }
      for (const item of drawn.values()) disposeFading(item);
    },
  };
}

/** An opacity that eases from `start` up to solid as `share` goes from 0 to 1. */
function towardsSolid(start: number, share: number): number {
  const t = Math.min(1, Math.max(0, share));
  return start + (1 - start) * t * t * (3 - 2 * t);
}

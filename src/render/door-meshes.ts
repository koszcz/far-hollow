// Draws doors and door blueprints: the draft "door" asset in asset-manifest.json, built in code. Added by floors-and-doors ticket 02.
// A door is three upright planks hung in a finished door frame, with two battens across their inside face and a small iron
// latch on the outside. It fills the doorway between the frame's posts, and turns on hinges at its left post.
// Construction has one stage per plank. The battens and latch go on with the last plank. Each plank fades in above its place
// and is set down, like the parts of plank furniture.
// A blueprint shows the planks see-through. A plank the blueprint already has shows pale and half solid.
// A finished door swings open, away from the player, while they are near the middle of its frame, and shuts once they leave.
// door-swing.ts times the swing. A door between the camera and the player fades out with its frame.
// While the player places a door from the build menu, a see-through copy follows the mouse. It turns red where it is not allowed.
import * as THREE from "three";
import { isDoorOpen } from "../sim/doors";
import { blueprintEntities, doorEntities, type Entity, type EntityStore, type Vec3 } from "../sim/entities";
import { quarterTurnsToRadians, type QuarterTurns } from "../sim/quarter-turns";
import { DOOR_PLANK_COST } from "../sim/structures";
import { DOORWAY_HEIGHT_METRES, DOORWAY_WIDTH_METRES, isBetweenCameraAndPlayer } from "./edge-piece-meshes";
import { DOOR_OPEN_RADIANS, doorSwingRadians } from "./door-swing";
import type { OutlinePart } from "./hover-outline";
import { PLANK_WOOD_COLOUR } from "./plank-furniture-meshes";
import { buildLift, buildOpacity, NOT_ALLOWED_COLOUR, pickFinished, seeThrough } from "./structure-look";

const BLUEPRINT_COLOUR = 0xbfe3ff;
/** How see-through the parts of a blueprint not yet built are, from 0 (invisible) to 1 (solid). */
const BLUEPRINT_OPACITY = 0.35;
/** A plank the blueprint already has is this solid, so it stands out from the planks still needed. */
const DELIVERED_OPACITY = 0.7;
/** A door between the camera and the player is this solid, as its frame is. */
const FADED_OPACITY = 0.2;
/** How much darker or lighter each plank is than plank wood, so the three planks differ a little. */
const PLANK_SHADES = [1, 0.92, 1.04] as const;
/** The battens across the planks are a little darker than the planks. */
const BATTEN_SHADE = 0.82;
/** The dark iron of the latch. */
const IRON_COLOUR = 0x3a3633;

/** The gap the door leaves to each post, and under the lintel, in metres, so it swings free. */
const GAP_METRES = 0.01;
/** The door is this wide and tall, in metres. */
const DOOR_WIDTH_METRES = DOORWAY_WIDTH_METRES - 2 * GAP_METRES;
const DOOR_HEIGHT_METRES = DOORWAY_HEIGHT_METRES - 2 * GAP_METRES;
/** How thick each plank is, in metres. */
const PLANK_THICKNESS_METRES = 0.04;
/** The thin gap between two planks, in metres. */
const PLANK_GAP_METRES = 0.004;
/** How thick each batten is, and how tall, in metres. */
const BATTEN_THICKNESS_METRES = 0.03;
const BATTEN_HEIGHT_METRES = 0.1;
/** How far each batten's middle sits from the top or bottom of the door, in metres. */
const BATTEN_INSET_METRES = 0.32;
/** How thick the invisible box that catches clicks is, across the doorway, in metres. Thicker than its frame's, so a click in the doorway finds the door. */
const PICK_THICKNESS_METRES = 0.45;

/** What a click on a door blueprint landed on. A finished door is found with `pickFinished`. */
export type DoorHit = { kind: "blueprint"; entity: Entity };

/** What one frame of drawing needs to know. Without `player`, every door stays shut. Without `camera` too, no door fades. */
export interface DoorFrame {
  readonly nowSeconds: number;
  readonly camera?: Vec3 | undefined;
  readonly player?: Vec3 | undefined;
}

export interface DoorMeshes {
  readonly group: THREE.Group;
  /** Brings every door and door blueprint up to date with game state, and swings each door toward open or shut. */
  update(frame: DoorFrame): void;
  /** What a ray from the camera hits first among door blueprints, and how far away. */
  pick(raycaster: THREE.Raycaster): { hit: DoorHit; distance: number } | undefined;
  /** The finished door a ray hits first, and how far away. */
  pickFinished(raycaster: THREE.Raycaster): { entity: Entity; distance: number } | undefined;
  /** The parts of a door or door blueprint, placed in the world. Empty once it is gone. */
  outlineOf(hit: { readonly entity: Entity }): OutlinePart[];
  /** Shows a door blueprint under the mouse at `spot`, facing `turns`, red where it is not allowed. Undefined hides it. */
  showPlacingBlueprint(placingBlueprint: { spot: Vec3; turns: QuarterTurns; allowed: boolean } | undefined): void;
  dispose(): void;
}

/** One box-shaped part of the door: its size and middle, in metres, with the hinge at the origin and the door shut along +x. */
interface DoorPart {
  readonly size: readonly [number, number, number];
  readonly at: readonly [number, number, number];
  readonly kind: "plank" | "batten" | "latch";
  readonly shade: number;
}

const PLANK_WIDTH_METRES = DOOR_WIDTH_METRES / DOOR_PLANK_COST;

/** The parts each stage of construction adds, in order: one plank each, and the battens and latch with the last. */
const STAGES: readonly (readonly DoorPart[])[] = Array.from({ length: DOOR_PLANK_COST }, (_, index) => {
  const plank: DoorPart = {
    size: [PLANK_WIDTH_METRES - PLANK_GAP_METRES, DOOR_HEIGHT_METRES, PLANK_THICKNESS_METRES],
    at: [PLANK_WIDTH_METRES * (index + 0.5), GAP_METRES + DOOR_HEIGHT_METRES / 2, 0],
    kind: "plank",
    shade: PLANK_SHADES[index % PLANK_SHADES.length] ?? 1,
  };
  if (index < DOOR_PLANK_COST - 1) return [plank];
  const battenZ = -(PLANK_THICKNESS_METRES + BATTEN_THICKNESS_METRES) / 2;
  const batten = (y: number): DoorPart => ({
    size: [DOOR_WIDTH_METRES - 0.03, BATTEN_HEIGHT_METRES, BATTEN_THICKNESS_METRES],
    at: [DOOR_WIDTH_METRES / 2, y, battenZ],
    kind: "batten",
    shade: BATTEN_SHADE,
  });
  return [
    plank,
    batten(GAP_METRES + BATTEN_INSET_METRES),
    batten(GAP_METRES + DOOR_HEIGHT_METRES - BATTEN_INSET_METRES),
    {
      size: [0.03, 0.07, 0.03],
      at: [DOOR_WIDTH_METRES - 0.07, GAP_METRES + DOOR_HEIGHT_METRES * 0.5, PLANK_THICKNESS_METRES / 2 + 0.015],
      kind: "latch",
      shade: 1,
    },
  ];
});

/** One part's mesh, its solid material, and its own see-through copy for fading in. */
interface Part {
  readonly mesh: THREE.Mesh;
  readonly plan: DoorPart;
  readonly solid: THREE.MeshStandardMaterial;
  readonly fading: THREE.MeshStandardMaterial;
}

/**
 * How a finished door last began to swing: toward open or shut, when, from how far turned, and which way.
 * `side` is 1 when it opens toward -z on its own axes, away from a player in front of it, and -1 the other way.
 */
interface Swing {
  open: boolean;
  startedAt: number;
  fromRadians: number;
  side: 1 | -1;
}

interface Drawn {
  readonly root: THREE.Group;
  /** Turns on the hinges. The parts hang from it. */
  readonly leaf: THREE.Group;
  readonly stages: Part[][];
  readonly picker: THREE.Mesh;
  swing?: Swing;
}

export function createDoorMeshes(entities: EntityStore): DoorMeshes {
  const group = new THREE.Group();
  const geometries = new Map<DoorPart, THREE.BoxGeometry>();
  for (const plan of STAGES.flat()) geometries.set(plan, new THREE.BoxGeometry(...plan.size));
  const pickGeometry = new THREE.BoxGeometry(DOORWAY_WIDTH_METRES, DOORWAY_HEIGHT_METRES, PICK_THICKNESS_METRES).translate(0, DOORWAY_HEIGHT_METRES / 2, 0);
  const solids = new Map<DoorPart, THREE.MeshStandardMaterial>();
  for (const plan of STAGES.flat()) {
    const color = plan.kind === "latch" ? new THREE.Color(IRON_COLOUR) : new THREE.Color(PLANK_WOOD_COLOUR).multiplyScalar(plan.shade);
    solids.set(plan, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: plan.kind === "latch" ? 0.6 : 0.9 }));
  }
  const blueprintMaterial = seeThrough(BLUEPRINT_COLOUR, BLUEPRINT_OPACITY);
  const deliveredMaterial = seeThrough(PLANK_WOOD_COLOUR, DELIVERED_OPACITY);
  const notAllowedMaterial = seeThrough(NOT_ALLOWED_COLOUR, BLUEPRINT_OPACITY);
  const fadedMaterial = seeThrough(PLANK_WOOD_COLOUR, FADED_OPACITY);
  const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });

  const drawn = new Map<Entity, Drawn>();
  const pickers: THREE.Mesh[] = [];
  const blueprints = blueprintEntities(entities);
  const doors = doorEntities(entities);
  const players = entities.with("player", "position");

  /** Adds a door's leaf, hinged at the left post, and every part on it, see-through, to `root`. */
  function addLeaf(root: THREE.Group): { leaf: THREE.Group; stages: Part[][] } {
    const leaf = new THREE.Group();
    leaf.position.x = -DOOR_WIDTH_METRES / 2;
    root.add(leaf);
    const stages = STAGES.map((parts) =>
      parts.map((plan) => {
        const mesh = new THREE.Mesh(geometries.get(plan), blueprintMaterial);
        mesh.position.set(...plan.at);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        leaf.add(mesh);
        const solid = solids.get(plan) ?? blueprintMaterial;
        const fading = solid.clone();
        fading.transparent = true;
        return { mesh, plan, solid, fading };
      }),
    );
    return { leaf, stages };
  }

  const placing = new THREE.Group();
  placing.visible = false;
  const placingLeaf = addLeaf(placing);
  group.add(placing);

  function draw(entity: Entity & { position: Vec3 }): Drawn {
    const existing = drawn.get(entity);
    if (existing !== undefined) return existing;
    const root = new THREE.Group();
    const { leaf, stages } = addLeaf(root);
    const picker = new THREE.Mesh(pickGeometry, pickMaterial);
    picker.userData.entity = entity;
    root.add(picker);
    pickers.push(picker);
    group.add(root);
    const result: Drawn = { root, leaf, stages, picker };
    drawn.set(entity, result);
    return result;
  }

  /** Puts a door at its frame's edge middle, facing the frame's way. */
  function place(item: { root: THREE.Group }, spot: Vec3, turns: QuarterTurns): void {
    item.root.position.set(spot.x, spot.y, spot.z);
    item.root.rotation.y = quarterTurnsToRadians(turns);
  }

  /**
   * Shows how far construction has gone. Laid planks are solid and in place, the plank being laid fades in and is set down,
   * planks the blueprint already has wait half solid, and the rest show see-through.
   */
  function showProgress(item: Drawn, progress: number, delivered: number): void {
    const stagesDone = progress * DOOR_PLANK_COST;
    item.stages.forEach((parts, index) => {
      const share = Math.min(1, Math.max(0, stagesDone - index));
      for (const { mesh, plan, solid, fading } of parts) {
        const [x, y, z] = plan.at;
        if (share <= 0) {
          mesh.material = index < delivered ? deliveredMaterial : blueprintMaterial;
          mesh.position.set(x, y, z);
          continue;
        }
        const opacity = buildOpacity(share);
        fading.opacity = opacity;
        mesh.material = opacity < 1 ? fading : solid;
        mesh.position.set(x, y + buildLift(share), z);
      }
    });
  }

  /** Which way a door at `root` opens so it swings away from a player at `player`: 1 toward its -z, -1 toward its +z. */
  function sideAwayFrom(root: THREE.Group, player: Vec3 | undefined): 1 | -1 {
    if (player === undefined) return 1;
    root.updateMatrixWorld(true);
    const local = root.worldToLocal(new THREE.Vector3(player.x, player.y, player.z));
    return local.z >= 0 ? 1 : -1;
  }

  /**
   * Turns a finished door's leaf toward open or shut at `nowSeconds`. A door seen for the first time counts as having begun
   * to swing toward where it stands now at time 0, from the other end, so it is already there in the game. An asset showcase,
   * whose clock starts at 0, shows it part way.
   */
  function swing(item: Drawn, entity: Entity & { position: Vec3 }, player: Vec3 | undefined, nowSeconds: number): void {
    const open = player !== undefined && isDoorOpen(entity.position, player);
    item.swing ??= { open, startedAt: 0, fromRadians: open ? 0 : DOOR_OPEN_RADIANS, side: sideAwayFrom(item.root, player) };
    const state = item.swing;
    if (state.open !== open) {
      state.fromRadians = doorSwingRadians(state.fromRadians, state.open, nowSeconds - state.startedAt);
      state.startedAt = nowSeconds;
      state.open = open;
      // A shut door opens away from the player. One still part way open keeps swinging the way it was.
      if (open && state.fromRadians === 0) state.side = sideAwayFrom(item.root, player);
    }
    item.leaf.rotation.y = state.side * doorSwingRadians(state.fromRadians, state.open, nowSeconds - state.startedAt);
  }

  function fade(item: Drawn, faded: boolean): void {
    for (const { mesh, solid } of item.stages.flat()) mesh.material = faded ? fadedMaterial : solid;
  }

  function disposeFading(stages: readonly Part[][]): void {
    for (const { fading } of stages.flat()) fading.dispose();
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
    update({ nowSeconds, camera, player }) {
      // Without a drawn player, as in an asset showcase, the doors answer to the player in game state.
      const near = player ?? players.first?.position;
      const seen = new Set<Entity>();
      for (const entity of blueprints) {
        if (entity.blueprint.structure !== "door") continue;
        const item = draw(entity);
        place(item, entity.position, entity.facing?.turns ?? 0);
        item.leaf.rotation.y = 0;
        showProgress(item, entity.blueprint.progress, entity.blueprint.delivered.plank ?? 0);
        seen.add(entity);
      }
      for (const entity of doors) {
        const item = draw(entity);
        const turns = entity.facing?.turns ?? 0;
        place(item, entity.position, turns);
        showProgress(item, 1, DOOR_PLANK_COST);
        swing(item, entity, near, nowSeconds);
        fade(item, camera !== undefined && player !== undefined && isBetweenCameraAndPlayer(entity.position, turns, camera, player));
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
      return item.stages.flat().map(({ mesh }) => ({ geometry: mesh.geometry, matrix: mesh.matrixWorld }));
    },
    showPlacingBlueprint(shown) {
      placing.visible = shown !== undefined;
      if (shown === undefined) return;
      const material = shown.allowed ? blueprintMaterial : notAllowedMaterial;
      for (const { mesh, plan } of placingLeaf.stages.flat()) {
        mesh.material = material;
        mesh.position.set(...plan.at);
      }
      place({ root: placing }, shown.spot, shown.turns);
    },
    dispose() {
      for (const item of [
        ...geometries.values(),
        pickGeometry,
        ...solids.values(),
        blueprintMaterial,
        deliveredMaterial,
        notAllowedMaterial,
        fadedMaterial,
        pickMaterial,
      ]) {
        item.dispose();
      }
      disposeFading(placingLeaf.stages);
      for (const item of drawn.values()) disposeFading(item.stages);
    },
  };
}

// Draws doors and door blueprints: the approved "door" asset in asset-manifest.json, built in code.
// A door is three upright hand-sawn planks hung in a finished door frame. The planks butt together with no gap. Each differs
// a little in shade and in how far it stands proud. Two battens and a diagonal brace cross the inside face. On the
// outside, two iron strap hinges reach in from the left post, and an iron ring latch hangs near the free edge.
// It reaches into both posts and up into the lintel, so no gap shows round it, even where the posts lean and taper.
// It turns on its hinges at the inner face of the left post's foot.
// Construction has one stage per plank. The battens, brace, hinges, and latch go on with the last plank. Each plank fades in above its place
// and is set down, like the parts of plank furniture.
// A blueprint shows the planks see-through. A plank the blueprint already has shows pale and half solid.
// A finished door swings open, away from the player, while they are near the middle of its frame, and shuts once they leave.
// door-swing.ts times the swing, and how its latch ring lifts off the face and taps back. A door between the camera and the player fades out with its frame.
// While the player places a door from the build menu, a see-through copy follows the mouse. It turns red where it is not allowed.
import * as THREE from "three";
import { isDoorOpen } from "../sim/doors";
import { blueprintEntities, doorEntities, type Entity, type EntityStore, type Vec3 } from "../sim/entities";
import { quarterTurnsToRadians, type QuarterTurns } from "../sim/quarter-turns";
import { DOOR_PLANK_COST } from "../sim/structures";
import { DOORWAY_HEIGHT_METRES, DOORWAY_WIDTH_METRES, isBetweenCameraAndPlayer } from "./edge-piece-meshes";
import { DOOR_OPEN_RADIANS, doorSwingRadians, latchRingRadians } from "./door-swing";
import { PLANK_WOOD_COLOUR } from "./plank-furniture-meshes";
import {
  BLUEPRINT_COLOUR,
  BLUEPRINT_OPACITY,
  buildLift,
  buildOpacity,
  DELIVERED_OPACITY,
  NOT_ALLOWED_COLOUR,
  pickBlueprint,
  pickFinished,
  fadedOut,
  seeThrough,
  type BuildingPieceMeshes,
  FADED_OPACITY,
} from "./structure-look";

/**
 * How each plank differs from the next, so the door reads as hand-sawn: how much darker or lighter it is than plank wood,
 * and how far it stands proud of or back from the others, in metres.
 */
const PLANK_LOOKS = [
  { shade: 1, proud: 0 },
  { shade: 0.92, proud: 0.003 },
  { shade: 1.04, proud: -0.002 },
] as const;
/** The battens and brace across the planks are a little darker than the planks. */
const BATTEN_SHADE = 0.82;
/** The dark iron of the hinges and the latch. */
const IRON_COLOUR = 0x3a3633;

/** How far the door reaches into each post past the posts' feet, in metres. It covers the gap where a post leans and tapers away. */
const POST_OVERLAP_METRES = 0.06;
/** How far the door reaches up into the lintel, in metres. */
const LINTEL_OVERLAP_METRES = 0.05;
/** The gap under the door to the floor, in metres, so it swings free. */
const FLOOR_GAP_METRES = 0.005;
/** The door is this wide and tall, in metres, counting the parts hidden in the posts and lintel. */
const DOOR_WIDTH_METRES = DOORWAY_WIDTH_METRES + 2 * POST_OVERLAP_METRES;
const DOOR_HEIGHT_METRES = DOORWAY_HEIGHT_METRES - FLOOR_GAP_METRES + LINTEL_OVERLAP_METRES;
/** How thick each plank is, in metres. */
const PLANK_THICKNESS_METRES = 0.04;
/** How thick each batten is, and how tall, in metres. */
const BATTEN_THICKNESS_METRES = 0.03;
const BATTEN_HEIGHT_METRES = 0.1;
/** Each batten stops this short of the door's edges, in metres in all, half at each end. */
const BATTEN_SHORTFALL_METRES = 0.03;
/** How far each batten's middle sits from the top or bottom of the door, in metres. */
const BATTEN_INSET_METRES = 0.32;
/** How thick the diagonal brace is, and how wide, in metres. Thinner than a batten, so the battens cover its ends. */
const BRACE_THICKNESS_METRES = 0.024;
const BRACE_WIDTH_METRES = 0.08;
/** How far each end of the brace sits in from the door's edge, in metres. */
const BRACE_INSET_METRES = 0.06;
/** Each strap hinge's length across the door, height, and thickness, in metres. */
const STRAP_SIZE_METRES: readonly [number, number, number] = [0.3, 0.036, 0.006];
/** The round knuckle each strap hinge turns on: its radius and height, in metres. */
const KNUCKLE_RADIUS_METRES = 0.012;
const KNUCKLE_HEIGHT_METRES = 0.06;
/** The latch's backplate: width, height, and thickness, in metres. */
const LATCH_PLATE_SIZE_METRES: readonly [number, number, number] = [0.036, 0.06, 0.006];
/** The ring that hangs from the backplate: its radius and the thickness of its iron, in metres. */
const RING_RADIUS_METRES = 0.03;
const RING_TUBE_METRES = 0.005;
/** How far the middle of the latch sits in from the door's free edge, in metres. */
const LATCH_INSET_METRES = 0.07;
/** How thick the invisible box that catches clicks is, across the doorway, in metres. Thicker than its frame's, so a click in the doorway finds the door. */
const PICK_THICKNESS_METRES = 0.45;

/** What one frame of drawing needs to know. Without `player`, every door stays shut. Without `camera` too, no door fades. */
export interface DoorFrame {
  readonly nowSeconds: number;
  readonly camera?: Vec3 | undefined;
  readonly player?: Vec3 | undefined;
}

/** Its update also swings each door toward open or shut. Its blueprint under the mouse faces the way the frame does. */
export type DoorMeshes = BuildingPieceMeshes<DoorFrame>;

/**
 * One part of the door: its size and middle, in metres, with the door shut along +x. The origin is the hinge, at the
 * inner face of the left post's foot. The doorway runs from 0 to DOORWAY_WIDTH_METRES. The door reaches past both ends into the posts.
 * A box's size is its width, height, and depth. A knuckle is an upright cylinder: radius, height, and radius.
 * A ring faces out of the door: its radius, its iron's thickness, and 0. Its `at` is the top of the ring, where it hangs.
 * `tilt` turns the part about the front-to-back axis, in radians.
 */
interface DoorPart {
  readonly shape: "box" | "knuckle" | "ring";
  readonly size: readonly [number, number, number];
  readonly at: readonly [number, number, number];
  readonly kind: "plank" | "batten" | "iron";
  readonly shade: number;
  readonly tilt?: number;
}

const PLANK_WIDTH_METRES = DOOR_WIDTH_METRES / DOOR_PLANK_COST;
/** The door's outside face, in metres along its own z. The hinges and latch sit on it. */
const OUTSIDE_Z = PLANK_THICKNESS_METRES / 2;
/** The middle of each batten, in metres up from the floor. */
const LOWER_BATTEN_Y = FLOOR_GAP_METRES + BATTEN_INSET_METRES;
const UPPER_BATTEN_Y = DOORWAY_HEIGHT_METRES - BATTEN_INSET_METRES;

/** One upright plank, `index` from the hinge side. The planks butt together, and the outer two reach into the posts. */
function plankPart(index: number): DoorPart {
  const look = PLANK_LOOKS[index % PLANK_LOOKS.length] ?? PLANK_LOOKS[0];
  return {
    shape: "box",
    size: [PLANK_WIDTH_METRES, DOOR_HEIGHT_METRES, PLANK_THICKNESS_METRES],
    at: [PLANK_WIDTH_METRES * (index + 0.5) - POST_OVERLAP_METRES, FLOOR_GAP_METRES + DOOR_HEIGHT_METRES / 2, look.proud],
    kind: "plank",
    shade: look.shade,
  };
}

/** A batten across the inside face, its middle `y` metres up. It spans the doorway, not the parts hidden in the posts. */
function battenPart(y: number): DoorPart {
  return {
    shape: "box",
    size: [DOORWAY_WIDTH_METRES - BATTEN_SHORTFALL_METRES, BATTEN_HEIGHT_METRES, BATTEN_THICKNESS_METRES],
    at: [DOORWAY_WIDTH_METRES / 2, y, -(PLANK_THICKNESS_METRES + BATTEN_THICKNESS_METRES) / 2],
    kind: "batten",
    shade: BATTEN_SHADE,
  };
}

/** The diagonal brace on the inside face. It rises from the lower batten at the hinge side to the upper batten at the free side. Its ends hide under the battens. */
function bracePart(): DoorPart {
  const fromX = BRACE_INSET_METRES;
  const toX = DOORWAY_WIDTH_METRES - BRACE_INSET_METRES;
  const rise = UPPER_BATTEN_Y - LOWER_BATTEN_Y;
  const run = toX - fromX;
  return {
    shape: "box",
    size: [Math.hypot(run, rise), BRACE_WIDTH_METRES, BRACE_THICKNESS_METRES],
    at: [(fromX + toX) / 2, (LOWER_BATTEN_Y + UPPER_BATTEN_Y) / 2, -(PLANK_THICKNESS_METRES + BRACE_THICKNESS_METRES) / 2],
    kind: "batten",
    shade: BATTEN_SHADE,
    tilt: Math.atan2(rise, run),
  };
}

/** A strap hinge on the outside face, level with a batten at `y`: an iron strap from the hinge side, and the knuckle it turns on. */
function hingeParts(y: number): DoorPart[] {
  return [
    {
      shape: "box",
      size: STRAP_SIZE_METRES,
      at: [STRAP_SIZE_METRES[0] / 2, y, OUTSIDE_Z + STRAP_SIZE_METRES[2] / 2],
      kind: "iron",
      shade: 1,
    },
    {
      shape: "knuckle",
      size: [KNUCKLE_RADIUS_METRES, KNUCKLE_HEIGHT_METRES, KNUCKLE_RADIUS_METRES],
      at: [0, y, OUTSIDE_Z],
      kind: "iron",
      shade: 1,
    },
  ];
}

/** The latch on the outside face near the free edge: a backplate with an iron ring hanging from it. */
function latchParts(): DoorPart[] {
  const x = DOORWAY_WIDTH_METRES - LATCH_INSET_METRES;
  const y = DOORWAY_HEIGHT_METRES * 0.5;
  return [
    {
      shape: "box",
      size: LATCH_PLATE_SIZE_METRES,
      at: [x, y, OUTSIDE_Z + LATCH_PLATE_SIZE_METRES[2] / 2],
      kind: "iron",
      shade: 1,
    },
    {
      shape: "ring",
      size: [RING_RADIUS_METRES, RING_TUBE_METRES, 0],
      // The ring hangs from the top of the plate and stands just off it. Its middle is the point it hangs from, so it swings there.
      at: [x, y + LATCH_PLATE_SIZE_METRES[1] / 2, OUTSIDE_Z + LATCH_PLATE_SIZE_METRES[2] + RING_TUBE_METRES],
      kind: "iron",
      shade: 1,
    },
  ];
}

/** The parts each stage of construction adds, in order: one plank each, and the battens, brace, hinges, and latch with the last. */
const STAGES: readonly (readonly DoorPart[])[] = Array.from({ length: DOOR_PLANK_COST }, (_, index) => {
  const plank = plankPart(index);
  if (index < DOOR_PLANK_COST - 1) return [plank];
  return [
    plank,
    battenPart(LOWER_BATTEN_Y),
    battenPart(UPPER_BATTEN_Y),
    bracePart(),
    ...hingeParts(LOWER_BATTEN_Y),
    ...hingeParts(UPPER_BATTEN_Y),
    ...latchParts(),
  ];
});

/** Builds one part's shape, centred on its own middle. */
function partGeometry(plan: DoorPart): THREE.BufferGeometry {
  if (plan.shape === "knuckle") return new THREE.CylinderGeometry(plan.size[0], plan.size[0], plan.size[1], 8);
  if (plan.shape === "ring") return new THREE.TorusGeometry(plan.size[0], plan.size[1], 6, 16).translate(0, -plan.size[0], 0);
  return new THREE.BoxGeometry(...plan.size);
}

/** One part's mesh, its solid material, and its own see-through copy for fading in. */
interface Part {
  readonly mesh: THREE.Mesh;
  readonly plan: DoorPart;
  readonly solid: THREE.MeshStandardMaterial;
  readonly fading: THREE.MeshStandardMaterial;
}

/**
 * How a finished door last began to swing: toward open or shut, when, from how far turned, which way, and how far its
 * latch ring had lifted off the face then.
 * `side` is 1 when it opens toward -z on its own axes, away from a player in front of it, and -1 the other way.
 */
interface Swing {
  open: boolean;
  startedAt: number;
  fromRadians: number;
  side: 1 | -1;
  ringFromRadians: number;
}

interface Drawn {
  readonly root: THREE.Group;
  /** Turns on the hinges. The parts hang from it. */
  readonly leaf: THREE.Group;
  readonly stages: Part[][];
  /** The latch ring. It swings about its x axis, where it hangs. */
  readonly ring: THREE.Mesh | undefined;
  readonly picker: THREE.Mesh;
  swing?: Swing;
}

export function createDoorMeshes(entities: EntityStore): DoorMeshes {
  const group = new THREE.Group();
  const geometries = new Map<DoorPart, THREE.BufferGeometry>();
  for (const plan of STAGES.flat()) geometries.set(plan, partGeometry(plan));
  const pickGeometry = new THREE.BoxGeometry(DOORWAY_WIDTH_METRES, DOORWAY_HEIGHT_METRES, PICK_THICKNESS_METRES).translate(0, DOORWAY_HEIGHT_METRES / 2, 0);
  const solids = new Map<DoorPart, THREE.MeshStandardMaterial>();
  for (const plan of STAGES.flat()) {
    const iron = plan.kind === "iron";
    const color = iron ? new THREE.Color(IRON_COLOUR) : new THREE.Color(PLANK_WOOD_COLOUR).multiplyScalar(plan.shade);
    solids.set(plan, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: iron ? 0.55 : 0.9, metalness: iron ? 0.3 : 0 }));
  }
  const blueprintMaterial = seeThrough(BLUEPRINT_COLOUR, BLUEPRINT_OPACITY);
  const deliveredMaterial = seeThrough(PLANK_WOOD_COLOUR, DELIVERED_OPACITY);
  const notAllowedMaterial = seeThrough(NOT_ALLOWED_COLOUR, BLUEPRINT_OPACITY);
  const fadedMaterial = fadedOut(PLANK_WOOD_COLOUR, FADED_OPACITY);
  const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });

  const drawn = new Map<Entity, Drawn>();
  const pickers: THREE.Mesh[] = [];
  const blueprints = blueprintEntities(entities);
  const doors = doorEntities(entities);
  const players = entities.with("player", "position");

  /** Adds a door's leaf, hinged at the left post, and every part on it, see-through, to `root`. */
  function addLeaf(root: THREE.Group): { leaf: THREE.Group; stages: Part[][] } {
    const leaf = new THREE.Group();
    leaf.position.x = -DOORWAY_WIDTH_METRES / 2;
    root.add(leaf);
    const stages = STAGES.map((parts) =>
      parts.map((plan) => {
        const mesh = new THREE.Mesh(geometries.get(plan), blueprintMaterial);
        mesh.position.set(...plan.at);
        mesh.rotation.z = plan.tilt ?? 0;
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
    const ring = stages.flat().find(({ plan }) => plan.shape === "ring")?.mesh;
    const picker = new THREE.Mesh(pickGeometry, pickMaterial);
    picker.userData.entity = entity;
    root.add(picker);
    pickers.push(picker);
    group.add(root);
    const result: Drawn = { root, leaf, stages, ring, picker };
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
    item.swing ??= { open, startedAt: 0, fromRadians: open ? 0 : DOOR_OPEN_RADIANS, side: sideAwayFrom(item.root, player), ringFromRadians: 0 };
    const state = item.swing;
    if (state.open !== open) {
      const since = nowSeconds - state.startedAt;
      state.ringFromRadians = latchRingRadians(state.fromRadians, state.open, since, state.ringFromRadians);
      state.fromRadians = doorSwingRadians(state.fromRadians, state.open, since);
      state.startedAt = nowSeconds;
      state.open = open;
      // A shut door opens away from the player. One still part way open keeps swinging the way it was.
      if (open && state.fromRadians === 0) state.side = sideAwayFrom(item.root, player);
    }
    const since = nowSeconds - state.startedAt;
    item.leaf.rotation.y = state.side * doorSwingRadians(state.fromRadians, state.open, since);
    // A turn about +x swings the ring's foot toward -z, into the door, so a lift off the outside face is a negative turn.
    if (item.ring !== undefined) item.ring.rotation.x = -latchRingRadians(state.fromRadians, state.open, since, state.ringFromRadians);
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
        if (item.ring !== undefined) item.ring.rotation.x = 0;
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
      return pickBlueprint(raycaster, pickers);
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

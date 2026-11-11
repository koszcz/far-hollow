// Draws cabin roof sections and their blueprints: the "roof" asset in asset-manifest.json, approved, built in code.
// A roof section covers one foundation square at the top of the walls. Debarked-log rafters with pale cut ends run across
// the square, and curled, ragged strips of bark, like the lean-to's, lie over them like shingles. The bark reaches a little
// past the square's edges, so the sections beside it overlap. The roof slopes down to the front (+z) to shed rain.
// Sections one behind another, finished or planned, share one slope: each sits higher by the rise of the sections in front
// of it. The front section's rafters rest on the top of the front wall. Where a section's side or back has no section
// beside it, debarked logs stacked on the wall fill the gap up to the bark, their top logs cut to the slope, so no gap is
// left for rain or wind. Each strip of bark is laid a little less steep than the roof, so its ragged lower edge lifts over
// the strip below it, in the same section or the one in front.
// Each section slopes down the way it faces. Where two roofs sloping at right angles meet, the corner section becomes a hip
// or a valley, as roof-layout.ts works out. Those two corner pieces are a draft (the "roof-corners" asset). A hip or valley
// has a rafter along each low edge and one along the line where its two slopes meet. Its bark is laid on both slopes, from
// the eaves up, each strip cut along that line and reaching a little past it, so on a hip each slope laps over the ridge and
// on a valley each slope tucks under the other. Where a section's edge stands above its wall or a lower roof beside it,
// logs fill the gap the same way as on the open sides. The bark carries a grain painted in code: streaks along
// its length, a few deep cracks, and a knot here and there, so it reads as bark and not as brown boards.
// Construction has one stage per log, then one per strip of bark: the rafters go up first, then the bark covers them.
// A blueprint shows see-through. Each debarked log the player has delivered shows pale and half solid in its place.
// The part being built fades in above its place, is lowered, and set down, like the logs of a foundation.
// When the player stands under a cabin roof, that roof and every section joined to it hide, so the player stays in view.
// While the player places a roof from the build menu, a see-through copy follows the mouse. It turns red where it is not allowed.
import * as THREE from "three";
import { BUILD_GRID_METRES } from "../sim/build-grid";
import { blueprintEntities, cabinRoofEntities, type Entity, type EntityStore, type Vec3 } from "../sim/entities";
import { turnOffset, type QuarterTurns } from "../sim/structure-kind";
import { roofAbove } from "../sim/roofs";
import { ROOF_BARK_COST, ROOF_LOG_COST } from "../sim/structures";
import { BUILD_FADE_SHARE, buildLift } from "./campfire-meshes";
import { DEBARKED_LOG_COLOUR, DEBARKED_LOG_CUT_COLOUR } from "./debarked-log-shape";
import { EDGE_PIECE_HEIGHT_METRES } from "./edge-piece-meshes";
import type { OutlinePart } from "./hover-outline";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { BARK_COLOURS, barkStrip, seededRandom } from "./lean-to-meshes";
import { ALONE, gridCell, roofPlaces, roofTopAt, shapeTop, type RoofPlace, type RoofShape } from "./roof-layout";
import { facingRadians, NOT_ALLOWED_COLOUR, pickFinished } from "./structure-look";

const BLUEPRINT_COLOUR = 0xbfe3ff;
/** How see-through the parts of a blueprint not yet built are, from 0 (invisible) to 1 (solid). */
const BLUEPRINT_OPACITY = 0.35;
/** A delivered log waiting in its place is this solid, so it stands out from the parts still needed. */
const DELIVERED_OPACITY = 0.7;
const RAFTER_RADIUS_METRES = 0.07;
/** A rafter is this much thinner at one end than the other, in metres, like a log from a young tree. */
const RAFTER_TAPER_METRES = 0.012;
/** A rafter has this many flat sides, like the other debarked logs. */
const RAFTER_SIDES = 7;
/** The rafters reach this far past the walls at the front and back, in metres. */
const RAFTER_OVERHANG_METRES = 0.12;
/** The bark reaches this far past each side of the square, in metres, so the sections beside it overlap. */
const BARK_OVERHANG_METRES = 0.1;
const BARK_THICKNESS_METRES = 0.04;
/** Each bark strip is this much longer than its share of the roof, so the strips overlap like shingles. */
const BARK_OVERLAP = 1.75;
/**
 * Roof bark is pressed flatter than the lean-to's and trimmed neater, so the roof reads as one tight cover:
 * its edges curl up this far, its lower edge frays this far, and it wavers this far, in metres.
 */
const ROOF_BARK_SHAPE = { curl: 0.01, fray: 0.025, waver: 0.004 };
/** The bark grain is painted this many pixels wide and high. One picture covers this many metres of bark along and across. */
const GRAIN_PIXELS = { wide: 512, high: 256 };
const GRAIN_METRES = { along: 0.6, across: 0.3 };
/** Each bark strip lies this much less steep than the roof, in radians, so its lower edge lifts over the strip below it. */
const BARK_KICK_RADIANS = 0.04;
/** Each bark strip lies this much above the rafters, in metres, so its tilted upper edge stays clear of them. */
const BARK_LIFT_METRES = 0.012;
/** The logs that fill the gaps between the walls and the roof are this thick, like the logs of a log wall, in metres. */
const FILL_RADIUS_METRES = 0.1;
/** Logs fill a gap under an edge only where it is this much more than the rafters' thickness, in metres. */
const FILL_GAP_METRES = 0.01;
/**
 * The four edges of a section, drawn unturned: back (-z), front (+z), left (-x), and right (+x).
 * Each runs along `axis`, at `across` half a square from the middle. `startEdge` and `endEdge` are the edges at its -end and +end.
 */
const EDGES = [
  { axis: "x", across: -1, startEdge: 2, endEdge: 3 },
  { axis: "x", across: 1, startEdge: 2, endEdge: 3 },
  { axis: "z", across: -1, startEdge: 0, endEdge: 1 },
  { axis: "z", across: 1, startEdge: 0, endEdge: 1 },
] as const;
/** A fill log is cut into this many lengths, so its top can follow the slope of the roof. */
const FILL_LENGTHS = 12;
/** How steeply each roof section slopes down to the front, in radians. */
const ROOF_SLOPE_RADIANS = THREE.MathUtils.degToRad(12);
/** All roof sections share this seed, so they all have the same ragged bark and crooked rafters, and line up. */
const ROOF_SEED = 20261112;
/** Corner bark reaches this far past the line where its two slopes meet, in metres, so the slopes lap. */
const CORNER_LAP_METRES = 0.06;
/** On a hip or valley, the bark on the slope down to +x lies this much higher, in metres, so the two slopes do not flicker. */
const CORNER_FACE_LIFT_METRES = 0.006;
/** How thick the invisible slab that catches clicks on a blueprint is, in metres. */
const PICK_THICKNESS_METRES = 0.3;

/** What a click on a roof blueprint landed on. Finished roofs are not clicked. */
export type RoofHit = { kind: "blueprint"; entity: Entity };

export interface RoofMeshes {
  readonly group: THREE.Group;
  /**
   * Brings every roof section and roof blueprint up to date with game state.
   * Finished sections above the player standing at `player` hide. Without it, nothing hides.
   */
  update(view?: { player: Vec3 }): void;
  /** What a ray from the camera hits first among roof blueprints, and how far away. */
  pick(raycaster: THREE.Raycaster): { hit: RoofHit; distance: number } | undefined;
  /** The parts of a roof blueprint, placed in the world. Empty once it is gone. */
  /** The finished piece the ray meets first, with how far away it is, or undefined if it meets none. The right-click menu uses it. */
  pickFinished(raycaster: THREE.Raycaster): { entity: Entity; distance: number } | undefined;
  outlineOf(hit: RoofHit): OutlinePart[];
  /**
   * Shows a roof blueprint under the mouse over the deck at `spot`, sloping down the way `turns` faces, red where it is not
   * allowed. Undefined hides it.
   */
  showPlacingBlueprint(placingBlueprint: { spot: Vec3; turns: QuarterTurns; allowed: boolean } | undefined): void;
  dispose(): void;
}

/** One part of a roof section: its shape, its finished material, and where it rests, from the middle of the deck below. */
interface PartPlan {
  readonly geometry: THREE.BufferGeometry;
  readonly wood: THREE.MeshStandardMaterial;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

interface Drawn {
  readonly root: THREE.Group;
  /** The shape its parts were made for. A section whose shape changes is drawn again. */
  readonly shape: RoofShape;
  /** One part for each stage of construction, in order, each with its own see-through copy of its material for fading in. */
  readonly parts: { mesh: THREE.Mesh; fading: THREE.MeshStandardMaterial; plan: PartPlan }[];
  /** The logs that fill the gaps under its open sides and back. They go up with the last rafter. */
  readonly fill: THREE.Mesh;
  readonly picker: THREE.Mesh;
}

/**
 * Sections in odd columns, across the slope, lie this much higher, in metres. Bark that overlaps a neighbour's at the same height flickers,
 * because the screen cannot tell which is on top.
 */
const ODD_COLUMN_LIFT_METRES = 0.012;

export function createRoofMeshes(entities: EntityStore): RoofMeshes {
  const group = new THREE.Group();
  const random = seededRandom(ROOF_SEED);
  const jitter = (size: number) => (random() * 2 - 1) * size;
  const pickGeometry = new THREE.BoxGeometry(BUILD_GRID_METRES, PICK_THICKNESS_METRES, BUILD_GRID_METRES);
  const woodMaterial = new THREE.MeshStandardMaterial({ color: DEBARKED_LOG_COLOUR, flatShading: true, vertexColors: true });
  const grain = paintBarkGrain(seededRandom(ROOF_SEED + 1));
  const barkMaterials = BARK_COLOURS.map((color) => new THREE.MeshStandardMaterial({ color, flatShading: true, vertexColors: true, map: grain }));
  const see = (color: number, opacity: number) => new THREE.MeshStandardMaterial({ color, transparent: true, opacity, depthWrite: false });
  const blueprintMaterial = see(BLUEPRINT_COLOUR, BLUEPRINT_OPACITY);
  const deliveredMaterial = see(DEBARKED_LOG_COLOUR, DELIVERED_OPACITY);
  const notAllowedMaterial = see(NOT_ALLOWED_COLOUR, BLUEPRINT_OPACITY);
  const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });

  const rafterY = EDGE_PIECE_HEIGHT_METRES + RAFTER_RADIUS_METRES;
  const barkY = EDGE_PIECE_HEIGHT_METRES + 2 * RAFTER_RADIUS_METRES + BARK_THICKNESS_METRES / 2;
  // The rafters rest on the top of the front wall, at z = +half a square, and rise towards the back.
  const frontWallZ = BUILD_GRID_METRES / 2;
  const rise = (z: number) => (frontWallZ - z) * Math.tan(ROOF_SLOPE_RADIANS);
  // Strips of bark run along x, side by side down the slope, from the front of the roof up to the back.
  const barkSpan = BUILD_GRID_METRES + 2 * BARK_OVERHANG_METRES;
  const stripShare = barkSpan / ROOF_BARK_COST;
  const stripLength = (stripShare / Math.cos(ROOF_SLOPE_RADIANS)) * BARK_OVERLAP;
  /** The parts each stage adds, in order: the rafters, then the strips of bark. */
  const STAGES: readonly PartPlan[] = [
    ...Array.from({ length: ROOF_LOG_COST }, (_, i) => {
      const z = jitter(0.03);
      return {
        geometry: rafterLog(jitter).rotateX(ROOF_SLOPE_RADIANS),
        wood: woodMaterial,
        x: -BUILD_GRID_METRES / 2 + RAFTER_RADIUS_METRES + (i * (BUILD_GRID_METRES - 2 * RAFTER_RADIUS_METRES)) / Math.max(1, ROOF_LOG_COST - 1),
        y: rafterY + rise(z),
        z,
      };
    }),
    ...Array.from({ length: ROOF_BARK_COST }, (_, i) => {
      // A bark strip is made with its ragged lower edge at -z. Turned round, that edge points down the slope, to the front,
      // and laps over the strip laid before it.
      const geometry = barkStrip(barkSpan + jitter(0.03), stripLength, i % BARK_COLOURS.length, jitter, ROOF_BARK_SHAPE);
      spreadGrain(geometry, barkSpan, stripLength, jitter);
      geometry.rotateY(Math.PI + jitter(0.01));
      geometry.rotateZ(jitter(0.006));
      geometry.rotateX(ROOF_SLOPE_RADIANS - BARK_KICK_RADIANS);
      const z = barkSpan / 2 - (i + 0.5) * stripShare;
      return {
        geometry,
        wood: barkMaterials[i % barkMaterials.length] ?? woodMaterial,
        x: jitter(0.01),
        y: barkY + BARK_LIFT_METRES + rise(z),
        z,
      };
    }),
  ];

  /** One section's rise over the section in front of it, in metres. */
  const sectionRise = BUILD_GRID_METRES * Math.tan(ROOF_SLOPE_RADIANS);
  /** The underside of the bark at (x, z), in a section's own frame, drawn unturned. The fill logs reach up to it. */
  const barkUnderside = (shape: RoofShape) => (x: number, z: number) =>
    EDGE_PIECE_HEIGHT_METRES + 2 * RAFTER_RADIUS_METRES + shapeTop(shape, x / BUILD_GRID_METRES, z / BUILD_GRID_METRES) * sectionRise;
  /** The parts of each shape, made once and shared. The corner pieces are made only when a roof first needs one. */
  const stagesByShape = new Map<RoofShape, readonly PartPlan[]>([["straight", STAGES]]);
  function stagesOf(shape: RoofShape): readonly PartPlan[] {
    const known = stagesByShape.get(shape);
    if (known !== undefined) return known;
    const made = cornerStages(shape === "hip" ? "hip" : "valley");
    stagesByShape.set(shape, made);
    return made;
  }

  /**
   * The parts of a hip or valley, drawn sloping down to +z and +x, in the order construction adds them.
   * Each slope is drawn like a straight section in its own frame: turns 0 for the slope down to +z, and turns 3 for the
   * slope down to +x. In those frames the line where the slopes meet runs along x = z and x = -z.
   */
  function cornerStages(shape: "hip" | "valley"): PartPlan[] {
    const cornerRandom = seededRandom(ROOF_SEED + (shape === "hip" ? 2 : 3));
    const wobble = (size: number) => (cornerRandom() * 2 - 1) * size;
    // On a hip, the slope down to +z covers the part left of its meeting line, and the slope down to +x the part right of it.
    // On a valley it is the other way round.
    const downZ = { turns: 0 as QuarterTurns, side: shape === "hip" ? -1 : 1, meets: (z: number) => z };
    const downX = { turns: 3 as QuarterTurns, side: shape === "hip" ? 1 : -1, meets: (z: number) => -z };
    const faces = [downZ, downX];
    const half = BUILD_GRID_METRES / 2;
    /** A part made in a slope's own frame, turned into the corner's frame. */
    const turned = (geometry: THREE.BufferGeometry, turns: QuarterTurns, at: { x: number; y: number; z: number }) => {
      geometry.rotateY(facingRadians(turns));
      const offset = turnOffset({ x: at.x, z: at.z }, turns);
      return { x: offset.x, y: at.y, z: offset.z, geometry };
    };
    const edgeRafter = (face: (typeof faces)[number]) => {
      const z = wobble(0.03);
      const placed = turned(rafterLog(wobble).rotateX(ROOF_SLOPE_RADIANS), face.turns, { x: face.side * (half - RAFTER_RADIUS_METRES), y: rafterY + rise(z), z });
      return { ...placed, wood: woodMaterial };
    };
    // The rafter under the meeting line runs corner to corner, from the high corner at -x -z down to the low one at +x +z.
    const diagonal = rafterLog(wobble, Math.SQRT2 * BUILD_GRID_METRES)
      .rotateX(Math.atan(Math.tan(ROOF_SLOPE_RADIANS) / Math.SQRT2))
      .rotateY(Math.PI / 4);
    const rafters: PartPlan[] = [edgeRafter(downZ), { geometry: diagonal, wood: woodMaterial, x: 0, y: rafterY + rise(0), z: 0 }, edgeRafter(downX)];
    const bark = Array.from({ length: ROOF_BARK_COST }, (_, i) => {
      const strips = faces.map((face, f) => {
        const geometry = barkStrip(barkSpan + wobble(0.03), stripLength, i % BARK_COLOURS.length, wobble, ROOF_BARK_SHAPE);
        spreadGrain(geometry, barkSpan, stripLength, wobble);
        geometry.rotateY(Math.PI + wobble(0.01));
        geometry.rotateZ(wobble(0.006));
        geometry.rotateX(ROOF_SLOPE_RADIANS - BARK_KICK_RADIANS);
        const z = barkSpan / 2 - (i + 0.5) * stripShare;
        geometry.translate(wobble(0.01), barkY + BARK_LIFT_METRES + rise(z) + f * CORNER_FACE_LIFT_METRES, z);
        // Cut the strip along the meeting line, a little past it, so the two slopes lap.
        const positions = geometry.getAttribute("position");
        for (let v = 0; v < positions.count; v += 1) {
          const limit = face.meets(positions.getZ(v)) - face.side * CORNER_LAP_METRES;
          const x = positions.getX(v);
          positions.setX(v, face.side < 0 ? Math.min(x, limit) : Math.max(x, limit));
        }
        geometry.computeVertexNormals();
        return turned(geometry, face.turns, { x: 0, y: 0, z: 0 }).geometry;
      });
      const geometry = mergeGeometries(strips);
      for (const strip of strips) strip.dispose();
      return { geometry, wood: barkMaterials[i % barkMaterials.length] ?? woodMaterial, x: 0, y: 0, z: 0 };
    });
    return [...rafters, ...bark];
  }

  /** The fill for each shape and set of edge heights, made once and shared. */
  const fills = new Map<string, THREE.BufferGeometry>();

  const drawn = new Map<Entity, Drawn>();
  const pickers: THREE.Mesh[] = [];
  const blueprints = blueprintEntities(entities);
  const finished = cabinRoofEntities(entities);

  /**
   * The logs that fill the gaps between the roof and what is under its edges, for a section of `shape`, drawn unturned.
   * `floors` gives, for each edge in EDGES order, the height the logs rest on in the section's own frame: the top of the
   * wall, or of a lower roof beside it. Undefined leaves that edge open, because the roof rests on it.
   */
  function fillFor(shape: RoofShape, floors: readonly (number | undefined)[]): THREE.BufferGeometry {
    const name = `${shape}:${floors.map((floor) => floor?.toFixed(3) ?? "-").join(",")}`;
    const known = fills.get(name);
    if (known !== undefined) return known;
    const ceiling = barkUnderside(shape);
    const half = BUILD_GRID_METRES / 2;
    const logs: THREE.BufferGeometry[] = [];
    EDGES.forEach((edge, index) => {
      const floor = floors[index];
      if (floor === undefined) return;
      // A log reaches past an end where the edge meeting it there is filled too, so the two stacks meet at the corner.
      const from = -half - (floors[edge.startEdge] === undefined ? 0 : FILL_RADIUS_METRES);
      const to = half + (floors[edge.endEdge] === undefined ? 0 : FILL_RADIUS_METRES);
      const across = edge.across * half;
      const under = (t: number) => (edge.axis === "x" ? ceiling(t, across) : ceiling(across, t));
      const top = Math.max(...samples(from, to).map(under));
      logs.push(...fillStack(floor, top, (bottom) => {
        // The log stops where the bark comes down to its bottom.
        const reach = stretchAbove(from, to, (t) => under(t) - bottom);
        return reach === undefined ? undefined : cutLog(bottom, reach.from, reach.to, edge.axis, across, ceiling);
      }));
    });
    const geometry = logs.length === 0 ? new THREE.BufferGeometry() : mergeGeometries(logs);
    for (const log of logs) log.dispose();
    fills.set(name, geometry);
    return geometry;
  }

  /**
   * Which edges of a section need fill logs, and the height each rests on, in the section's own frame.
   * `floorAt` gives the height of what is under a point on an edge, from the section's deck: the wall top, or a lower roof's
   * bark. An edge is left open where the roof already rests on it, with only the rafters between.
   */
  function fillFloors(shape: RoofShape, raised: number, floorAt: (edge: number, x: number, z: number) => number): (number | undefined)[] {
    const ceiling = barkUnderside(shape);
    const half = BUILD_GRID_METRES / 2;
    return EDGES.map((edge, index) => {
      const points = samples(-half, half).map((t) => (edge.axis === "x" ? { x: t, z: edge.across * half } : { x: edge.across * half, z: t }));
      const floor = Math.min(...points.map(({ x, z }) => floorAt(index, x, z))) - raised;
      const gap = Math.max(...points.map(({ x, z }) => ceiling(x, z))) - floor;
      return gap > 2 * RAFTER_RADIUS_METRES + FILL_GAP_METRES ? floor : undefined;
    });
  }

  /** The fill of a section alone, resting on walls on every side. */
  const aloneFill = () => fillFor("straight", fillFloors("straight", 0, () => EDGE_PIECE_HEIGHT_METRES));

  /** Adds every part of a roof section of `shape` to `root`, see-through. */
  function addParts(root: THREE.Group, shape: RoofShape): Drawn["parts"] {
    return stagesOf(shape).map((plan) => {
      const mesh = new THREE.Mesh(plan.geometry, blueprintMaterial);
      mesh.castShadow = true;
      mesh.position.set(plan.x, plan.y, plan.z);
      root.add(mesh);
      const fading = plan.wood.clone();
      fading.transparent = true;
      return { mesh, fading, plan };
    });
  }

  const placingBlueprint = new THREE.Group();
  placingBlueprint.visible = false;
  const placingParts = addParts(placingBlueprint, "straight");
  const placingFill = new THREE.Mesh(aloneFill(), blueprintMaterial);
  placingBlueprint.add(placingFill);
  group.add(placingBlueprint);

  function draw(entity: Entity & { position: Vec3 }, shape: RoofShape): Drawn {
    const existing = drawn.get(entity);
    if (existing?.shape === shape) return existing;
    if (existing !== undefined) forget(entity);
    const root = new THREE.Group();
    const parts = addParts(root, shape);
    const fill = new THREE.Mesh(aloneFill(), blueprintMaterial);
    fill.castShadow = true;
    root.add(fill);
    const picker = new THREE.Mesh(pickGeometry, pickMaterial);
    picker.position.y = EDGE_PIECE_HEIGHT_METRES + PICK_THICKNESS_METRES / 2;
    picker.userData.entity = entity;
    root.add(picker);
    pickers.push(picker);
    group.add(root);
    const result = { root, shape, parts, fill, picker };
    drawn.set(entity, result);
    return result;
  }

  /** How much higher a section's frame sits than its deck, in metres. */
  const raisedBy = (place: RoofPlace) => place.inFront * sectionRise + (place.lifted ? ODD_COLUMN_LIFT_METRES : 0);

  /**
   * Shows how far construction has gone. Built parts are solid and in place, the part being built moves through its stage,
   * rafters whose log has been delivered wait half solid in their places, and the rest show see-through.
   */
  function showProgress(item: Drawn, progress: number, delivered: number, place: RoofPlace, fill: THREE.BufferGeometry): void {
    const stagesDone = progress * item.parts.length;
    item.root.position.y += raisedBy(place);
    item.root.rotation.y = facingRadians(place.drawTurns);
    item.fill.geometry = fill;
    item.parts.forEach(({ mesh, fading, plan }, index) => {
      const share = Math.min(1, Math.max(0, stagesDone - index));
      if (share <= 0) {
        mesh.material = index < Math.min(delivered, ROOF_LOG_COST) ? deliveredMaterial : blueprintMaterial;
        mesh.position.y = plan.y;
      } else {
        fading.opacity = Math.min(1, share / BUILD_FADE_SHARE);
        mesh.material = fading.opacity < 1 ? fading : plan.wood;
        mesh.position.y = plan.y + buildLift(share);
      }
      // The fill goes up with the last rafter.
      if (index === ROOF_LOG_COST - 1) {
        item.fill.material = mesh.material;
        item.fill.position.y = mesh.position.y - plan.y;
      }
    });
  }

  type Section = Entity & { position: Vec3 };

  /**
   * The fill of each section, from what is under its edges: a lower roof beside it, or else the wall.
   * The fill logs rest on a lower roof's bark and reach up to this section's bark.
   */
  function fillsOf(sections: readonly Section[], places: Map<Section, RoofPlace>): Map<Section, THREE.BufferGeometry> {
    const byCell = new Map<string, Section>();
    const cellName = (point: { x: number; z: number }) => {
      const { column, row } = gridCell(point);
      return `${column},${row}`;
    };
    for (const section of sections) byCell.set(cellName(section.position), section);
    const result = new Map<Section, THREE.BufferGeometry>();
    for (const section of sections) {
      const place = places.get(section) ?? ALONE;
      const world = (x: number, z: number) => {
        const offset = turnOffset({ x, z }, place.drawTurns);
        return { x: section.position.x + offset.x, z: section.position.z + offset.z };
      };
      const neighbours = EDGES.map(({ axis, across }) => byCell.get(cellName(world(axis === "x" ? 0 : across * BUILD_GRID_METRES, axis === "x" ? across * BUILD_GRID_METRES : 0))));
      const floors = fillFloors(place.shape, raisedBy(place), (edge, x, z) => {
        const beside = neighbours[edge];
        const besidePlace = beside === undefined ? undefined : places.get(beside);
        if (beside === undefined || besidePlace === undefined) return EDGE_PIECE_HEIGHT_METRES;
        const barkTop = EDGE_PIECE_HEIGHT_METRES + 2 * RAFTER_RADIUS_METRES + BARK_THICKNESS_METRES + roofTopAt(besidePlace, beside.position, world(x, z)) * sectionRise;
        return beside.position.y - section.position.y + (besidePlace.lifted ? ODD_COLUMN_LIFT_METRES : 0) + barkTop;
      });
      result.set(section, fillFor(place.shape, floors));
    }
    return result;
  }

  function forget(entity: Entity): void {
    const item = drawn.get(entity);
    if (item === undefined) return;
    group.remove(item.root);
    for (const { fading } of item.parts) fading.dispose();
    pickers.splice(pickers.indexOf(item.picker), 1);
    drawn.delete(entity);
  }

  const hits: THREE.Intersection[] = [];

  return {
    group,
    update(view) {
      const seen = new Set<Entity>();
      const roofBlueprints = [...blueprints].filter((entity) => entity.blueprint.structure === "roof");
      const sections: Section[] = [...roofBlueprints, ...finished];
      const laid = sections.map((entity) => ({ entity, position: entity.position, turns: entity.facing?.turns ?? 0 }));
      const placesOfLaid = roofPlaces(laid);
      const places = new Map(laid.map((section) => [section.entity, placesOfLaid.get(section) ?? ALONE]));
      const fillOf = fillsOf(sections, places);
      const show = (entity: Section, progress: number, delivered: number, visible: boolean) => {
        const place = places.get(entity) ?? ALONE;
        const item = draw(entity, place.shape);
        item.root.position.set(entity.position.x, entity.position.y, entity.position.z);
        item.root.visible = visible;
        showProgress(item, progress, delivered, place, fillOf.get(entity) ?? aloneFill());
        seen.add(entity);
      };
      for (const entity of roofBlueprints) show(entity, entity.blueprint.progress, entity.blueprint.delivered.debarkedLog ?? 0, true);
      const hidden = new Set(view === undefined ? [] : roofAbove(entities, view.player));
      for (const entity of finished) show(entity, 1, ROOF_LOG_COST, !hidden.has(entity));
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
      return pickFinished(raycaster, pickers, isShown);
    },
    outlineOf(hit) {
      const item = drawn.get(hit.entity);
      if (item === undefined) return [];
      item.root.updateMatrixWorld(true);
      return item.parts.map(({ mesh }) => ({ geometry: mesh.geometry, matrix: mesh.matrixWorld }));
    },
    showPlacingBlueprint(shown) {
      placingBlueprint.visible = shown !== undefined;
      if (shown === undefined) return;
      const material = shown.allowed ? blueprintMaterial : notAllowedMaterial;
      for (const mesh of [...placingParts.map(({ mesh }) => mesh), placingFill]) mesh.material = material;
      placingBlueprint.position.set(shown.spot.x, shown.spot.y, shown.spot.z);
      placingBlueprint.rotation.y = facingRadians(shown.turns);
    },
    dispose() {
      for (const item of [
        ...[...stagesByShape.values()].flatMap((stages) => stages.map(({ geometry }) => geometry)), ...fills.values(), pickGeometry, woodMaterial, ...barkMaterials, blueprintMaterial, deliveredMaterial, notAllowedMaterial,
        pickMaterial,
      ]) {
        item.dispose();
      }
      grain?.dispose();
      for (const item of drawn.values()) for (const { fading } of item.parts) fading.dispose();
      for (const { fading } of placingParts) fading.dispose();
    },
  };
}

/**
 * One rafter: a debarked log lying along z, reaching `span` plus an overhang at each end, faceted and a little tapered, with pale cut ends.
 * It carries a colour per corner, so draw it with `vertexColors: true` and the material colour set to the log colour.
 */
function rafterLog(jitter: (size: number) => number, span = BUILD_GRID_METRES): THREE.BufferGeometry {
  const length = span + 2 * RAFTER_OVERHANG_METRES + jitter(0.04);
  const thick = RAFTER_RADIUS_METRES + jitter(0.006);
  const geometry = new THREE.CylinderGeometry(thick - RAFTER_TAPER_METRES, thick, length, RAFTER_SIDES, 1)
    .rotateY(random01(jitter) * Math.PI)
    .rotateX(Math.PI / 2 + jitter(0.015))
    .rotateY(jitter(0.03));
  // After the turn onto its side, the cut ends face along z.
  return paleLog(geometry, (normal) => Math.abs(normal.z));
}

/**
 * Colours a debarked log's corners: its cut ends pale, where `endness` of a corner's normal is near 1, and its sides plain.
 * Draw it with `vertexColors: true` and the material colour set to the log colour.
 */
function paleLog(geometry: THREE.BufferGeometry, endness: (normal: THREE.Vector3) => number): THREE.BufferGeometry {
  const normals = geometry.getAttribute("normal");
  const side = new THREE.Color(1, 1, 1);
  const log = new THREE.Color(DEBARKED_LOG_COLOUR);
  const cutColour = new THREE.Color(DEBARKED_LOG_CUT_COLOUR);
  const cut = new THREE.Color(cutColour.r / log.r, cutColour.g / log.g, cutColour.b / log.b);
  const colours = new Float32Array(normals.count * 3);
  const normal = new THREE.Vector3();
  for (let i = 0; i < normals.count; i += 1) {
    const colour = endness(normal.fromBufferAttribute(normals, i)) > 0.9 ? cut : side;
    colours.set([colour.r, colour.g, colour.b], i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  return geometry;
}


/** A number from 0 up to 1, from a jitter that gives numbers from -size to size. */
function random01(jitter: (size: number) => number): number {
  return (jitter(1) + 1) / 2;
}

/**
 * Stacks fill logs from `bottom` up to `top`. `log` makes the log whose bottom is at a height, or nothing if it would not fit.
 */
function fillStack(
  bottom: number, top: number, log: (bottom: number) => THREE.BufferGeometry | undefined,
): THREE.BufferGeometry[] {
  const logs: THREE.BufferGeometry[] = [];
  for (let at = bottom; at < top - 0.005; at += 2 * FILL_RADIUS_METRES) {
    const made = log(at);
    if (made !== undefined) logs.push(made);
  }
  return logs;
}

/** How many points along an edge are checked for the height of the roof and of what is under it. */
const EDGE_SAMPLES = 25;

/** Evenly spaced points from `from` to `to`, both included. */
function samples(from: number, to: number): number[] {
  return Array.from({ length: EDGE_SAMPLES }, (_, i) => from + ((to - from) * i) / (EDGE_SAMPLES - 1));
}

/**
 * The stretch from `from` to `to` where `height` is above 0, with its ends where it crosses 0, or undefined if it never is.
 * A gap in the middle is filled over, so a log runs the whole stretch.
 */
function stretchAbove(from: number, to: number, height: (t: number) => number): { from: number; to: number } | undefined {
  const points = samples(from, to);
  const above = points.map((t) => height(t) > FILL_GAP_METRES / 2);
  const first = above.indexOf(true);
  const last = above.lastIndexOf(true);
  if (first < 0) return undefined;
  /** Where the height crosses 0 between a point that is not above, `outside`, and the next point that is, `inside`. */
  const crossing = (outside: number, inside: number) => {
    const out = height(outside);
    const into = height(inside);
    return outside + ((inside - outside) * out) / (out - into);
  };
  const step = (to - from) / (EDGE_SAMPLES - 1);
  const firstPoint = from + first * step;
  const lastPoint = from + last * step;
  const start = first === 0 ? from : crossing(firstPoint - step, firstPoint);
  const end = last === points.length - 1 ? to : crossing(lastPoint + step, lastPoint);
  return end - start > FILL_RADIUS_METRES ? { from: start, to: end } : undefined;
}

/**
 * A fill log resting at height `bottom`, running along `axis` from `from` to `to`, its middle at `across` on the other axis.
 * Its top is cut down to the bark's underside, so the top log of a stack fills the gap under the slope exactly.
 */
function cutLog(
  bottom: number, from: number, to: number, axis: "x" | "z", across: number, ceiling: (x: number, z: number) => number,
): THREE.BufferGeometry {
  const geometry = new THREE.CylinderGeometry(FILL_RADIUS_METRES, FILL_RADIUS_METRES, to - from, RAFTER_SIDES, FILL_LENGTHS);
  // The cylinder stands along y. Lay it along its axis.
  if (axis === "x") geometry.rotateZ(Math.PI / 2);
  else geometry.rotateX(Math.PI / 2);
  const middle = (from + to) / 2;
  geometry.translate(axis === "x" ? middle : across, bottom + FILL_RADIUS_METRES, axis === "x" ? across : middle);
  const positions = geometry.getAttribute("position");
  for (let i = 0; i < positions.count; i += 1) {
    positions.setY(i, Math.max(bottom, Math.min(positions.getY(i), ceiling(positions.getX(i), positions.getZ(i)))));
  }
  geometry.computeVertexNormals();
  return paleLog(geometry, (normal) => Math.abs(axis === "x" ? normal.x : normal.z));
}

/**
 * Lays the bark grain over a strip `width` long and `length` deep: one picture for each GRAIN_METRES, starting at a
 * different place on each strip, so no two strips show the same marks.
 */
function spreadGrain(geometry: THREE.BufferGeometry, width: number, length: number, jitter: (size: number) => number): void {
  const uvs = geometry.getAttribute("uv");
  const start = { u: jitter(0.5) + 0.5, v: jitter(0.5) + 0.5 };
  for (let i = 0; i < uvs.count; i += 1) {
    uvs.setXY(i, start.u + (uvs.getX(i) * width) / GRAIN_METRES.along, start.v + (uvs.getY(i) * length) / GRAIN_METRES.across);
  }
}

/**
 * Paints bark grain that repeats without seams: pale, so it only darkens the bark's colour in streaks along its length,
 * a few deep cracks, and a knot here and there. Without a page to paint on, as in tests, the bark has no grain.
 */
function paintBarkGrain(random: () => number): THREE.Texture | null {
  if (typeof document === "undefined") return null;
  const { wide, high } = GRAIN_PIXELS;
  const canvas = document.createElement("canvas");
  canvas.width = wide;
  canvas.height = high;
  const context = canvas.getContext("2d");
  if (context === null) return null;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, wide, high);
  context.lineCap = "round";
  /** Draws a mark, and again across each edge it might cross, so the picture repeats without seams. */
  const wrapped = (draw: (x: number, y: number) => void, x: number, y: number) => {
    for (const shiftX of [-wide, 0, wide]) for (const shiftY of [-high, 0, high]) draw(x + shiftX, y + shiftY);
  };
  /** A wavy line along the bark, `long` pixels, `thick` pixels wide. */
  const streak = (colour: string, long: number, thick: number) => {
    const startX = random() * wide;
    const startY = random() * high;
    const sway = (random() - 0.5) * 6;
    wrapped((x, y) => {
      context.strokeStyle = colour;
      context.lineWidth = thick;
      context.beginPath();
      context.moveTo(x, y);
      context.bezierCurveTo(x + long / 3, y + sway, x + (2 * long) / 3, y - sway, x + long, y + sway / 2);
      context.stroke();
    }, startX, startY);
  };
  for (let i = 0; i < 140; i += 1) streak(`rgba(40, 24, 12, ${0.12 + random() * 0.2})`, 60 + random() * 260, 1 + random() * 2);
  for (let i = 0; i < 50; i += 1) streak(`rgba(255, 236, 210, ${0.1 + random() * 0.15})`, 40 + random() * 160, 1 + random() * 1.5);
  for (let i = 0; i < 9; i += 1) streak(`rgba(25, 14, 6, ${0.45 + random() * 0.2})`, 120 + random() * 300, 2 + random() * 2);
  for (let i = 0; i < 3; i += 1) {
    const radius = 6 + random() * 6;
    wrapped((x, y) => {
      context.fillStyle = "rgba(255, 236, 210, 0.35)";
      context.beginPath();
      context.ellipse(x, y, radius * 2.4, radius * 1.4, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "rgba(25, 14, 6, 0.7)";
      context.beginPath();
      context.ellipse(x, y, radius * 1.2, radius * 0.7, 0, 0, Math.PI * 2);
      context.fill();
    }, random() * wide, random() * high);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  // three.js lowers this to what the graphics card supports.
  texture.anisotropy = 8;
  return texture;
}

/** Whether a picker and everything holding it are shown. The roof hidden over the player cannot be picked. */
function isShown(object: THREE.Object3D): boolean {
  for (let at: THREE.Object3D | null = object.parent; at !== null; at = at.parent) if (!at.visible) return false;
  return true;
}

// The shapes every showcase shares: its views, the stage it builds on, and the common framings.
import * as THREE from "three";
import { type Entity, type EntityStore, type Vec3 } from "../../sim/entities";
import { type PotMesh } from "../pot-shape";
import type { TreeShape } from "../tree-model";
import { type PlayerMesh } from "../player-mesh";
import type { UndergrowthShape } from "../undergrowth-models";

/** Midday, so colours show as they do in daylight. */
export const NOON = 12;
export const NIGHT = 22;
/** Props stand this far east of the river's middle, on the flat valley floor. */
export const STAGE_FROM_RIVER_METRES = 25;

/** How long the built campfire rests before the "campfire-build-animation" plays again, in seconds. */
export const BUILD_PLAY_REST_SECONDS = 1.5;

export const FOUR_ANGLES: readonly Shot[] = [
  { label: "front", yaw: 0, pitch: 12 },
  { label: "side", yaw: 90, pitch: 12 },
  { label: "back three-quarter", yaw: 215, pitch: 25 },
  { label: "from above", yaw: 40, pitch: 60 },
];

/** One of the four views. Angles are in degrees. Yaw 0 looks at the front of the player, from +z. */
export interface Shot {
  readonly label: string;
  readonly yaw: number;
  readonly pitch: number;
  /** Overrides the showcase's framing for this view. */
  readonly radius?: number;
  readonly focus?: Partial<Vec3>;
  readonly hour?: number;
  /** For animations: the moment shown, in seconds since the motion began. */
  readonly seconds?: number;
}

export interface Stage {
  readonly store: EntityStore;
  readonly player: PlayerMesh;
  /** Adds an entity standing on the ground at this offset from the stage's middle, in metres. */
  readonly place: (x: number, z: number, entity: Entity) => Entity;
  /** Moves the player to this offset from the stage's middle and turns them to face `heading`, in radians. */
  readonly movePlayer: (x: number, z: number, heading: number) => void;
  /** Stands a pot on the ground at this offset from the stage's middle, in metres. It is not an entity. */
  readonly placePot: (x: number, z: number) => PotMesh;
  /**
   * Adds a shape that no entity draws yet, standing on the ground at this offset from the stage's middle.
   * `lift` raises it, in metres, and `heading` turns it about the vertical, in radians. The showcase disposes it.
   */
  readonly addProp: (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, z: number, lift?: number, heading?: number) => void;
  /** Every loaded undergrowth model, from loadUndergrowthShapes. */
  readonly undergrowthShapes: readonly UndergrowthShape[];
  /** Every loaded tree type, from loadTreeShapes. */
  readonly treeShapes: readonly TreeShape[];
}

export interface Showcase {
  /** How far from the focus the camera keeps everything in view, in metres. */
  readonly radius: number;
  /** What the camera looks at, as an offset from the stage's middle, in metres. */
  readonly focus: Vec3;
  readonly shots: readonly Shot[];
  build(stage: Stage): void;
  /** Poses an animation for one view, before it draws. */
  pose?(stage: Stage, shot: Shot): void;
  /** Plays the animation live in one view. */
  readonly play?: {
    readonly shot: Shot;
    /** Poses the animation `seconds` after it began. Returns how far the camera moves to follow it, in metres. */
    pose(stage: Stage, seconds: number): Partial<Vec3> | undefined;
  };
}

// Gathers the shapes of the "grass", "ferns", "flowers", and "pebbles" assets in asset-manifest.json.
// All four are approved and built in code, with no files: grass-shape.ts, fern-shape.ts, flower-shape.ts,
// and pebble-shape.ts build them. undergrowth-meshes.ts draws the shapes.
import type * as THREE from "three";
import { buildFerns } from "./fern-shape";
import { buildFlowerClumps } from "./flower-shape";
import { buildGrassTufts } from "./grass-shape";
import { buildPebbles } from "./pebble-shape";

/** The four undergrowth assets. */
export const UNDERGROWTH_ASSETS = ["grass", "ferns", "flowers", "pebbles"] as const;
export type UndergrowthAsset = (typeof UNDERGROWTH_ASSETS)[number];

/**
 * One undergrowth model in metres, with the pivot at the middle of its foot on the ground.
 * Each corner has a vertex colour in the game's colours.
 */
export interface UndergrowthShape {
  /** The model's name, such as "grass_tuftA". undergrowth-meshes.ts picks models by name. */
  readonly name: string;
  /** The asset the model belongs to. */
  readonly asset: UndergrowthAsset;
  readonly geometry: THREE.BufferGeometry;
  /**
   * True when the model is lit by its own normals instead of shaded flat. Every undergrowth model is, so it lights
   * like the ground and its shady sides never turn black.
   */
  readonly ownNormals?: boolean;
}

/** Builds every undergrowth model. It returns a promise, like the other model loaders. */
export function loadUndergrowthShapes(): Promise<UndergrowthShape[]> {
  const grass = buildGrassTufts().map((tuft): UndergrowthShape => ({ ...tuft, asset: "grass", ownNormals: true }));
  const ferns = buildFerns().map((fern): UndergrowthShape => ({ ...fern, asset: "ferns", ownNormals: true }));
  const flowers = buildFlowerClumps().map((clump): UndergrowthShape => ({ ...clump, asset: "flowers", ownNormals: true }));
  const pebbles = buildPebbles().map((stone): UndergrowthShape => ({ ...stone, asset: "pebbles", ownNormals: true }));
  return Promise.resolve([...grass, ...ferns, ...flowers, ...pebbles]);
}

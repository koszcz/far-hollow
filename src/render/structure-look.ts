// What every structure's meshes share: the red of a blueprint that is not allowed where the player is placing it,
// how a structure turns the way it faces, and how a click finds a finished structure.
import type * as THREE from "three";
import type { Entity } from "../sim/entities";

/** A blueprint the player is placing shows in this red where its placement rule refuses the spot. */
export const NOT_ALLOWED_COLOUR = 0xe0614f;

/** How far round a structure facing `turns` quarter turns is drawn, in radians. Quarter turns go clockwise seen from above. */
export function facingRadians(turns: number): number {
  return -turns * (Math.PI / 2);
}

const hits: THREE.Intersection[] = [];

/**
 * The nearest finished structure a ray hits, and how far away it is. Each of `pickers` holds its entity in `userData.entity`.
 * Blueprints are skipped, and so is any picker that `isShown` says is hidden.
 */
export function pickFinished(
  raycaster: THREE.Raycaster,
  pickers: readonly THREE.Object3D[],
  isShown: (picker: THREE.Object3D) => boolean = () => true,
): { entity: Entity; distance: number } | undefined {
  hits.length = 0;
  raycaster.intersectObjects([...pickers], false, hits);
  hits.sort((a, b) => a.distance - b.distance);
  for (const hit of hits) {
    const entity = hit.object.userData.entity as Entity | undefined;
    if (entity !== undefined && entity.blueprint === undefined && isShown(hit.object)) return { entity, distance: hit.distance };
  }
  return undefined;
}

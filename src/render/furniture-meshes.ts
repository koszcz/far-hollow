// The meshes of each piece of furniture, by its kind. structure-meshes.ts loops over them to update, pick, outline,
// and show the blueprint under the mouse, so it names no piece.
import type { EntityStore } from "../sim/entities";
import type { FurnitureKind } from "../sim/structure-kind";
import { createBedMeshes } from "./bed-meshes";
import { createChestMeshes } from "./chest-meshes";
import type { FurnitureMeshes } from "./plank-furniture-meshes";
import { createRainBarrelMeshes } from "./rain-barrel-meshes";
import { createShelfMeshes } from "./shelf-meshes";
import { createStoolMeshes } from "./stool-meshes";
import { createTableMeshes } from "./table-meshes";
import { createWoodBoxMeshes } from "./wood-box-meshes";

/** Makes the meshes of each piece of furniture. TypeScript reports a piece with no entry. */
export const FURNITURE_MESHES: { readonly [Kind in FurnitureKind]: (entities: EntityStore) => FurnitureMeshes } = {
  chest: createChestFurnitureMeshes,
  shelf: createShelfMeshes,
  bed: createBedMeshes,
  table: createTableMeshes,
  stool: createStoolMeshes,
  rainBarrel: createRainBarrelMeshes,
  woodBox: createWoodBoxMeshes,
};

/** The chest's own approved meshes, in chest-meshes.ts, as FurnitureMeshes. */
function createChestFurnitureMeshes(entities: EntityStore): FurnitureMeshes {
  const chests = createChestMeshes(entities);
  return {
    group: chests.group,
    update: () => {
      chests.update();
    },
    pick(raycaster) {
      const found = chests.pick(raycaster);
      return found && { hit: { kind: found.hit.kind === "blueprint" ? "blueprint" : "finished", entity: found.hit.entity }, distance: found.distance };
    },
    outlineOf: (entity) => chests.outlineOf({ kind: entity.blueprint === undefined ? "chest" : "blueprint", entity }),
    showPlacingBlueprint: (shown) => {
      chests.showPlacingBlueprint(shown);
    },
    dispose: () => {
      chests.dispose();
    },
  };
}

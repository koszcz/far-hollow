// Picks the build menu icon of each structure from the icon assets that draw them.
// It sits apart from build-icons.tsx because furniture-icons.tsx points at the chest's icon there, and an import loop would follow.
import type { StructureKind } from "../sim/api";
import { ShadedIcon } from "./backpack-icons";
import { STRUCTURE_DRAWINGS } from "./build-icons";
import { FIREPLACE_DRAWING } from "./fireplace-icon";
import { DOOR_DRAWING } from "./floor-and-door-icons";
import { FURNITURE_DRAWINGS, hasFurnitureIcon } from "./furniture-icons";
import type { BackpackIconDrawing } from "./icon-drawing";
import { SLED_DRAWING } from "./sled-icons";

/** The drawing of one structure's icon. The action queue draws it too. */
export function structureDrawing(structure: StructureKind): BackpackIconDrawing {
  if (structure === "sled") return SLED_DRAWING;
  if (structure === "fireplace") return FIREPLACE_DRAWING;
  if (structure === "door") return DOOR_DRAWING;
  return hasFurnitureIcon(structure) ? FURNITURE_DRAWINGS[structure] : STRUCTURE_DRAWINGS[structure];
}

/** Draws the icon for one structure in the build menu. Screen readers skip it, because a text label always goes with it. */
export function StructureIcon({ structure }: { structure: StructureKind }) {
  return <ShadedIcon drawing={structureDrawing(structure)} className="build-icon" />;
}

// Picks the build menu icon of each structure from the icon assets that draw them.
// It sits apart from build-icons.tsx because furniture-icons.tsx points at the chest's icon there, and an import loop would follow.
import type { StructureKind } from "../sim/api";
import { ShadedIcon } from "./backpack-icons";
import { STRUCTURE_DRAWINGS } from "./build-icons";
import { FURNITURE_DRAWINGS, hasFurnitureIcon } from "./furniture-icons";
import { SLED_DRAWING } from "./sled-icons";

/** Draws the icon for one structure in the build menu. Screen readers skip it, because a text label always goes with it. */
export function StructureIcon({ structure }: { structure: StructureKind }) {
  const drawing = structure === "sled" ? SLED_DRAWING : hasFurnitureIcon(structure) ? FURNITURE_DRAWINGS[structure] : STRUCTURE_DRAWINGS[structure];
  return <ShadedIcon drawing={drawing} className="build-icon" />;
}

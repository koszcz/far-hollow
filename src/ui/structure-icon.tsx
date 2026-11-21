// Picks the build menu icon of each structure from the icon assets that draw them.
// It sits apart from build-icons.tsx because furniture-icons.tsx points at the chest's icon there, and an import loop would follow.
import type { StructureKind } from "../sim/api";
import { ShadedIcon } from "./backpack-icons";
import { STRUCTURE_DRAWINGS } from "./build-icons";
import { FIREPLACE_DRAWING } from "./fireplace-icon";
import { DOOR_DRAWING, FLOOR_DRAWING } from "./floor-and-door-icons";
import { FURNITURE_DRAWINGS } from "./furniture-icons";
import type { BackpackIconDrawing } from "./icon-drawing";
import { SLED_DRAWING } from "./sled-icons";

/**
 * Every structure's icon. The approved "build-icons" asset draws most of them. The sled's, the fireplace's, the floor's, the door's,
 * and each piece of furniture's come from their own icon assets. TypeScript reports a structure with no icon.
 */
const STRUCTURE_ICONS: Readonly<Record<StructureKind, BackpackIconDrawing>> = {
  ...STRUCTURE_DRAWINGS,
  sled: SLED_DRAWING,
  fireplace: FIREPLACE_DRAWING,
  floor: FLOOR_DRAWING,
  door: DOOR_DRAWING,
  ...FURNITURE_DRAWINGS,
};

/** The drawing of one structure's icon. The action queue draws it too. */
export function structureDrawing(structure: StructureKind): BackpackIconDrawing {
  return STRUCTURE_ICONS[structure];
}

/** Draws the icon for one structure in the build menu. Screen readers skip it, because a text label always goes with it. */
export function StructureIcon({ structure }: { structure: StructureKind }) {
  return <ShadedIcon drawing={structureDrawing(structure)} className="build-icon" />;
}

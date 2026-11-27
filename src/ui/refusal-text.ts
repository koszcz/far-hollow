// The words for why the game refuses a command. A greyed-out action shows them, and so do notices about the action queue.
import type { BuildLack, Refusal } from "../sim/api-refusal";
import type { RecipeLack } from "../sim/api";
import { strings } from "../strings";

/** Says why the game refuses a command, as a greyed-out action shows it, such as "needs the axe". */
export function refusalText(refusal: Refusal): string {
  const reasons = strings.actionReasons;
  switch (refusal.kind) {
    case "needsTool":
      return reasons.needsTool(strings.backpackContents[refusal.tool]);
    case "noContent":
      return reasons.noContent[refusal.content];
    case "cannotBuildYet":
      return buildLackText(refusal.lacks);
    case "cannotCraftYet":
      return strings.craftMenu.needs(refusal.lacks.map(lackingText));
    default:
      return reasons[refusal.kind];
  }
}

/** Why the player cannot build a blueprint's next stage. */
function buildLackText(lacks: BuildLack): string {
  const reasons = strings.actionReasons;
  if (lacks.kind === "tool") return reasons.needsTool(strings.backpackContents[lacks.tool]);
  switch (lacks.material) {
    case "stick":
    case "bark":
    case "plank":
      return reasons.noContent[lacks.material];
    case "cord":
      return reasons.noCord;
    case "stone":
      return reasons.noStone;
    case "log":
    case "debarkedLog":
      return reasons.bringFirst[lacks.material];
  }
}

/** Names one thing a recipe lacks, such as "the saw". */
export function lackingText(lack: RecipeLack): string {
  switch (lack.kind) {
    case "tool":
      return strings.craftMenu.lacking.tool(strings.backpackContents[lack.tool]);
    case "station":
      return strings.craftMenu.lacking.station(strings.buildMenu.structures[lack.station]);
    case "materials":
      return strings.craftMenu.lacking.materials;
  }
}

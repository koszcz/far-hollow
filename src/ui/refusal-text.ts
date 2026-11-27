// The words for why the game refuses a command. A greyed-out action shows them, and so do notices about the action queue.
import type { BuildLack, Refusal } from "../sim/api-refusal";
import type { RecipeLack } from "../sim/api";
import { actionsText } from "../strings/actions";
import { backpackText } from "../strings/backpack";
import { workText } from "../strings/work";

/** Says why the game refuses a command, as a greyed-out action shows it, such as "needs the axe". */
export function refusalText(refusal: Refusal): string {
  const reasons = actionsText.actionReasons;
  switch (refusal.kind) {
    case "needsTool":
      return reasons.needsTool(backpackText.backpackContents[refusal.tool]);
    case "noContent":
      return reasons.noContent[refusal.content];
    case "cannotBuildYet":
      return buildLackText(refusal.lacks);
    case "cannotCraftYet":
      return workText.craftMenu.needs(refusal.lacks.map(lackingText));
    default:
      return reasons[refusal.kind];
  }
}

/** Why the player cannot build a blueprint's next stage. */
function buildLackText(lacks: BuildLack): string {
  const reasons = actionsText.actionReasons;
  if (lacks.kind === "tool") return reasons.needsTool(backpackText.backpackContents[lacks.tool]);
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
      return workText.craftMenu.lacking.tool(backpackText.backpackContents[lack.tool]);
    case "station":
      return workText.craftMenu.lacking.station(workText.buildMenu.structures[lack.station]);
    case "materials":
      return workText.craftMenu.lacking.materials;
  }
}

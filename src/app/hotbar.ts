// What a click on a hotbar cell and a number key send. The cells and their order come from src/ui/hotbar-cells.ts.
import type { Command } from "../sim/api";
import { hotbarCells, type HotbarTarget } from "../ui/hotbar-cells";
import { actionsFor, mainAction, type ActionReader } from "./thing-actions";

/**
 * The command a left-click on a hotbar cell sends: its main action, such as eating berries or dropping the log on the shoulder.
 * With a chest open, it puts one in the chest, or all of that kind if shift is held. A backpack content with no use sends nothing.
 */
export function clickHotbarCell(target: HotbarTarget, reader: ActionReader, shiftKey: boolean): Command | undefined {
  const actions = actionsFor(target, reader);
  const main = mainAction(actions);
  if (shiftKey && main?.id === "putInChest") return actions.find(({ id }) => id === "putInChest:all")?.command;
  return main?.command;
}

/** The number keys 1 to 9, on the main row or the number pad, as `KeyboardEvent.code`. */
const NUMBER_KEY = /^(?:Digit|Numpad)([1-9])$/;

/**
 * The command a key press sends: 1 to 9 use the backpack cell with that number. The shoulder cell has no number.
 * Other keys, and every key while the player types in a form field, send nothing.
 */
export function pressHotbarKey(code: string, reader: ActionReader, { typing }: { readonly typing: boolean }): Command | undefined {
  if (typing) return undefined;
  const number = NUMBER_KEY.exec(code)?.[1];
  if (number === undefined) return undefined;
  const cell = hotbarCells(reader.getView()).find(({ target, key }) => target.kind === "backpackContent" && key === number);
  return cell === undefined ? undefined : clickHotbarCell(cell.target, reader, false);
}

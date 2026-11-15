// What a number key sends. A click on a hotbar cell opens the action menu instead. The cells and their order come from src/ui/hotbar-cells.ts.
import { queued, type Command } from "../sim/api";
import { hotbarCells, type HotbarTarget } from "../ui/hotbar-cells";
import { actionsFor, mainAction, type ActionReader } from "./thing-actions";

/**
 * The command a hotbar cell's main action sends, such as eating berries or dropping the log on the shoulder.
 * With a chest open, it puts one in the chest. A backpack content with no use sends nothing.
 */
export function mainHotbarCommand(target: HotbarTarget, reader: ActionReader): Command | undefined {
  return mainAction(actionsFor(target, reader))?.command;
}

/** The number keys 1 to 9, on the main row or the number pad, as `KeyboardEvent.code`. */
const NUMBER_KEY = /^(?:Digit|Numpad)([1-9])$/;

/**
 * The command a key press sends: 1 to 9 use the backpack cell with that number. The shoulder cell has no number.
 * With `shift` held, the command goes to the end of the action queue. The game runs a command it never queues, such as putting
 * one in an open chest, as if Shift were not held.
 * Other keys, and every key while the player types in a form field, send nothing.
 */
export function pressHotbarKey(
  code: string,
  reader: ActionReader,
  { typing, shift = false }: { readonly typing: boolean; readonly shift?: boolean },
): Command | undefined {
  if (typing) return undefined;
  const number = NUMBER_KEY.exec(code)?.[1];
  if (number === undefined) return undefined;
  const cell = hotbarCells(reader.getView()).find(({ target, key }) => target.kind === "backpackContent" && key === number);
  const command = cell === undefined ? undefined : mainHotbarCommand(cell.target, reader);
  return command === undefined || !shift ? command : queued(command);
}

// How long each notice the game shows the player, such as a refusal or a collapse, stays on screen.
// A new notice needs its kind in Notice, an entry here, its shape in the save check, and its text in the strings file.
// TypeScript reports a missing one.
import type { GameNotice } from "./api";

/** How many game minutes each notice shows for. One game minute is one real second. */
export const NOTICE_MINUTES: Readonly<Record<GameNotice, number>> = {
  collapsed: 30,
  survivedFirstNight: 30,
  backpackFull: 4,
  holdsUpPiece: 4,
  stillHoldsSomething: 4,
  chestFull: 4,
  saveBroken: 10,
  putLogDownFirst: 4,
  letGoFirst: 4,
  noLogBesideStation: 4,
  cannotCraftYet: 4,
};

// The notices the game shows the player, such as a refusal or a collapse, and how long each shows.
// A new notice needs its name in GameNotice, an entry here, and its text in the strings file. TypeScript reports a missing one.
// The save check reads its list of notices from here.
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
  noLogBesideStation: 4,
};

/** Every kind of notice. */
export const NOTICE_KINDS = Object.keys(NOTICE_MINUTES) as readonly GameNotice[];

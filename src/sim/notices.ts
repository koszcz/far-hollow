// How long each notice the game shows the player, such as a refusal or a collapse, stays on screen.
// A new notice needs its kind in Notice, an entry here, its shape in the save check, and its text in the strings file.
// TypeScript reports a missing one.
import type { GameNotice, Notice, PlainNotice, PlainRefusal, Refusal } from "./api";

/** How many game minutes each notice shows for. One game minute is one real second. */
export const NOTICE_MINUTES: Readonly<Record<GameNotice, number>> = {
  collapsed: 30,
  survivedFirstNight: 30,
  backpackFull: 4,
  holdsUpPiece: 4,
  stillHoldsSomething: 4,
  chestFull: 4,
  shelfFull: 4,
  saveBroken: 10,
  putLogDownFirst: 4,
  letGoFirst: 4,
  noLogBesideStation: 4,
  cannotCraftYet: 4,
  fishGotAway: 4,
  droppedBesideStation: 4,
  queueFull: 4,
  cannotQueue: 4,
  actionSkipped: 4,
  refused: 4,
};

/** The refusals that have a plain notice of their own. Each refusal that stops taking something down says to empty it first. */
const PLAIN_NOTICE_OF: Partial<Readonly<Record<PlainRefusal, PlainNotice>>> = {
  letGoFirst: "letGoFirst",
  putLogDownFirst: "putLogDownFirst",
  holdsUpPiece: "holdsUpPiece",
  backpackFull: "backpackFull",
  emptyFirst: "stillHoldsSomething",
  potOnFire: "stillHoldsSomething",
  fishOnFire: "stillHoldsSomething",
  fireNotOut: "stillHoldsSomething",
};

/** The notice the game shows when it refuses a command the player sent. A refusal with a notice of its own shows that notice. */
export function refusedNotice(refusal: Refusal): Notice {
  if (refusal.kind === "cannotCraftYet") return refusal;
  const plain = Object.hasOwn(PLAIN_NOTICE_OF, refusal.kind) ? PLAIN_NOTICE_OF[refusal.kind as PlainRefusal] : undefined;
  return plain === undefined ? { kind: "refused", refusal } : { kind: plain };
}

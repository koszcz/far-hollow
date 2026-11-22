/**
 * A trap's catch: whether a set trap holds a catch, and how long until it catches the next one.
 * A trap waits a time drawn from a range, then holds one catch. It catches nothing more, and its next wait does not run,
 * until the player takes the catch. Each wait is drawn from the trap's own seed, and drawn again after each catch.
 * The fish trap uses it, and the snare can later. Each function returns a new catch. The caller assigns it back. See ADR 0009.
 */
import { createRandom, scramble } from "./random";

/** The shortest and longest wait for a catch, in game minutes. */
export interface CatchRange {
  readonly minMinutes: number;
  readonly maxMinutes: number;
}

/**
 * A trap's catch. `holding` says whether it holds one now. `minutesToNext` is the game minutes left until the next catch,
 * which count down only while it holds none. `draws` is how many waits have been drawn so far.
 */
export interface TrapCatch {
  readonly holding: boolean;
  readonly minutesToNext: number;
  readonly draws: number;
}

/** Mixes the draw number into the seed, so each draw gets its own random wait. */
const DRAW_SEED_STEP = 0x9e3779b9;

/** The wait for catch number `draw`, counting from 0, from a trap's seed, in whole game minutes within the range. */
export function catchWaitMinutes(range: CatchRange, seed: number, draw: number): number {
  const random = createRandom(scramble(seed + Math.imul(draw + 1, DRAW_SEED_STEP)));
  return Math.round(range.minMinutes + random() * (range.maxMinutes - range.minMinutes));
}

/** A newly set trap: empty, waiting its first drawn time. */
export function firstCatch(range: CatchRange, seed: number): TrapCatch {
  return { holding: false, minutesToNext: catchWaitMinutes(range, seed, 0), draws: 1 };
}

/**
 * The catch after this many game minutes. An empty trap whose wait runs out holds one catch, and the next wait is drawn.
 * A trap that holds a catch stays as it is.
 */
export function passCatchTime(trapCatch: TrapCatch, minutes: number, range: CatchRange, seed: number): TrapCatch {
  if (trapCatch.holding) return trapCatch;
  const left = trapCatch.minutesToNext - minutes;
  if (left > 0) return { ...trapCatch, minutesToNext: left };
  return { holding: true, minutesToNext: catchWaitMinutes(range, seed, trapCatch.draws), draws: trapCatch.draws + 1 };
}

/** The catch once the player takes what the trap holds: empty, with the next wait about to run. */
export function takeCatch(trapCatch: TrapCatch): TrapCatch {
  return { ...trapCatch, holding: false };
}

/** Whether the trap holds a catch now. */
export function isHolding(trapCatch: TrapCatch): boolean {
  return trapCatch.holding;
}

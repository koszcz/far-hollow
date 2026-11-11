// Turns the text a player types on the new-game screen into a seed.

/** Seeds are whole numbers from 0 up to, but not including, this. */
const SEED_LIMIT = 2 ** 32;

/**
 * Returns the seed for typed text, or undefined if the text is blank.
 * A whole number in range is used as it is. Any other text is turned into a seed with the FNV-1a hash, so a word works too.
 */
export function seedFromText(text: string): number | undefined {
  const trimmed = text.trim();
  if (trimmed === "") return undefined;
  if (/^\d+$/.test(trimmed)) {
    const number = Number(trimmed);
    if (number < SEED_LIMIT) return number;
  }
  let hash = 0x811c9dc5;
  for (const character of trimmed) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** A random seed for a new game. */
export function randomSeed(): number {
  return Math.floor(Math.random() * SEED_LIMIT);
}

// Small helpers that turn numbers and lists into words, shared by the player-facing text modules.

/** A weight in kilograms, to one decimal place at most, such as "5.5" or "10". */
export function kilogramsText(kilograms: number): string {
  return `${Number(kilograms.toFixed(1))}`;
}

/** A list in words, such as "a, b and c". */
export function listText(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** The text with its first letter in capitals. */
export function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** A stretch of game minutes in hours and minutes, such as "2 h 10 min", "3 h", or "40 min". */
export function hoursText(minutes: number): string {
  const whole = Math.max(0, Math.ceil(minutes));
  const hours = Math.floor(whole / 60);
  const left = whole % 60;
  return hours === 0 ? `${left} min` : left === 0 ? `${hours} h` : `${hours} h ${left} min`;
}

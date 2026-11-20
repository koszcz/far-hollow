/**
 * Material counts: how many of each kind a holder holds, such as a backpack, a chest, a woodpile, a sled, or a blueprint.
 * A kind that is missing from the record counts as zero. No count ever drops below zero.
 * Each function returns a new record. The caller assigns it back to the component. See ADR 0009.
 */

/** How many of each kind something holds. A kind that is missing counts as zero. */
export type Counts<K extends string> = Partial<Record<K, number>>;

/** How many of `kind` the counts hold. */
export function countOf<K extends string>(counts: Readonly<Counts<K>>, kind: K): number {
  return counts[kind] ?? 0;
}

/** The counts with `amount` more of `kind`. */
export function addCount<K extends string, T extends Counts<K>>(counts: Readonly<T>, kind: K, amount: number): T {
  return { ...counts, [kind]: countOf<K>(counts, kind) + amount };
}

/** The counts with `amount` fewer of `kind`. A count never drops below zero, so taking more than there is leaves zero. */
export function takeCount<K extends string, T extends Counts<K>>(counts: Readonly<T>, kind: K, amount: number): T {
  return { ...counts, [kind]: Math.max(0, countOf<K>(counts, kind) - amount) };
}

/** How many the counts hold across every kind. */
export function totalCount<K extends string>(counts: Readonly<Counts<K>>): number {
  let total = 0;
  for (const kind of Object.keys(counts) as K[]) total += countOf(counts, kind);
  return total;
}

/** The sum across every kind of its count times `weights` for that kind, such as how much one of it weighs. */
export function weightedTotal<K extends string>(counts: Readonly<Counts<K>>, weights: Readonly<Record<K, number>>): number {
  let total = 0;
  for (const kind of Object.keys(counts) as K[]) total += countOf(counts, kind) * weights[kind];
  return total;
}

/** True if the counts hold nothing of any kind. */
export function holdsNone<K extends string>(counts: Readonly<Counts<K>>): boolean {
  return (Object.keys(counts) as K[]).every((kind) => countOf(counts, kind) <= 0);
}

/** The counts without the kinds they hold none of. */
export function withoutEmptyKinds<K extends string>(counts: Readonly<Counts<K>>): Counts<K> {
  return Object.fromEntries((Object.keys(counts) as K[]).filter((kind) => countOf(counts, kind) > 0).map((kind) => [kind, countOf(counts, kind)])) as Counts<K>;
}

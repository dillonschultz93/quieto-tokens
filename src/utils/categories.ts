/**
 * Canonical ordering for the six categories the CLI knows how to generate.
 * Every place that iterates or sorts categories (`json-writer`, diff output,
 * pruner, `buildConfig`, outros) must go through {@link sortCategoriesCanonical}
 * so the order is stable across runs — deterministic diffs matter more than
 * any particular aesthetic.
 *
 * Categories not present in this tuple fall to the end, sorted alphabetically.
 * That keeps us forward-compatible with a future "user-defined categories"
 * epic without requiring churn here.
 */
export const CANONICAL_CATEGORY_ORDER: readonly string[] = Object.freeze([
  "color",
  "spacing",
  "typography",
  "shadow",
  "border",
  "animation",
]);

export function sortCategoriesCanonical(names: readonly string[]): string[] {
  const rank = (c: string): number => {
    const idx = CANONICAL_CATEGORY_ORDER.indexOf(c);
    return idx === -1 ? CANONICAL_CATEGORY_ORDER.length : idx;
  };
  return [...names].sort((a, b) => {
    const diff = rank(a) - rank(b);
    if (diff !== 0) return diff;
    return a.localeCompare(b);
  });
}

/**
 * The three categories `quieto-tokens add` knows how to generate. Matches
 * the shape of {@link CategoryConfigs}; used by `parseAddArgs` and the
 * command dispatcher.
 */
export const ADDABLE_CATEGORIES: readonly ("shadow" | "border" | "animation")[] =
  Object.freeze(["shadow", "border", "animation"]);

export type AddableCategory = (typeof ADDABLE_CATEGORIES)[number];

export function isAddableCategory(value: unknown): value is AddableCategory {
  return (
    typeof value === "string" &&
    (value === "shadow" || value === "border" || value === "animation")
  );
}

import type { LoadedTokenSystem } from "./token-loader.js";

export interface TokenSummary {
  totalByTier: { primitive: number; semantic: number; component: number };
  byCategory: Record<
    string,
    { primitive: number; semantic: number; component: number }
  >;
  themeCount: number;
  themeNames: string[];
}

function ensureCategory(
  map: Record<
    string,
    { primitive: number; semantic: number; component: number }
  >,
  cat: string,
): { primitive: number; semantic: number; component: number } {
  if (!map[cat]) {
    map[cat] = { primitive: 0, semantic: 0, component: 0 };
  }
  return map[cat];
}

export function computeSummary(system: LoadedTokenSystem): TokenSummary {
  const byCategory: TokenSummary["byCategory"] = Object.create(null);
  let totalPrimitive = 0;
  let totalSemantic = 0;
  let totalComponent = 0;

  for (const t of system.primitives) {
    totalPrimitive++;
    ensureCategory(byCategory, t.category).primitive++;
  }

  const seenSemantic = new Set<string>();
  for (const theme of system.themes) {
    for (const t of theme.semantics) {
      const key = `${t.category}:${t.path.join(".")}`;
      if (!seenSemantic.has(key)) {
        seenSemantic.add(key);
        totalSemantic++;
        ensureCategory(byCategory, t.category).semantic++;
      }
    }
  }

  for (const t of system.components) {
    totalComponent++;
    ensureCategory(byCategory, t.category).component++;
  }

  return {
    totalByTier: {
      primitive: totalPrimitive,
      semantic: totalSemantic,
      component: totalComponent,
    },
    byCategory,
    themeCount: system.themes.length,
    themeNames: system.themes.map((t) => t.name),
  };
}

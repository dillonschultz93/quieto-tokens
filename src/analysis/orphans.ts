import type { LoadedTokenSystem } from "./token-loader.js";

export interface OrphanedToken {
  path: string[];
  category: string;
}

const PURE_DTCG_REF_RE = /^\{([^}]+)\}$/;

function extractPureReference(value: string): string | null {
  const match = PURE_DTCG_REF_RE.exec(value);
  return match ? match[1]! : null;
}

export function detectOrphans(system: LoadedTokenSystem): OrphanedToken[] {
  const referencedPaths = new Set<string>();

  for (const theme of system.themes) {
    for (const t of theme.semantics) {
      const ref = extractPureReference(t.$value);
      if (ref) referencedPaths.add(ref);
    }
  }

  const orphans: OrphanedToken[] = [];
  for (const t of system.primitives) {
    const dotPath = t.path.join(".");
    if (!referencedPaths.has(dotPath)) {
      orphans.push({ path: t.path, category: t.category });
    }
  }

  return orphans;
}

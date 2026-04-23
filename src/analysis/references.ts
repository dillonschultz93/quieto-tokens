import type { LoadedTokenSystem } from "./token-loader.js";

export interface BrokenReference {
  tokenPath: string[];
  tier: "semantic" | "component";
  referenceValue: string;
  theme?: string;
}

const PURE_DTCG_REF_RE = /^\{([^}]+)\}$/;

function extractPureReference(value: string): string | null {
  const match = PURE_DTCG_REF_RE.exec(value);
  return match ? match[1]! : null;
}

function resolvesToPrimitive(
  refPath: string,
  primitivePaths: Set<string>,
  semanticLookup: Map<string, string>,
): boolean {
  const seen = new Set<string>();
  let current: string | null = refPath;
  while (current) {
    if (primitivePaths.has(current)) return true;
    if (seen.has(current)) return false;
    seen.add(current);
    const nextValue = semanticLookup.get(current);
    if (!nextValue) return false;
    const nextRef = extractPureReference(nextValue);
    if (!nextRef) return false;
    current = nextRef;
  }
  return false;
}

export function detectBrokenReferences(
  system: LoadedTokenSystem,
): BrokenReference[] {
  const primitivePaths = new Set<string>();
  for (const t of system.primitives) {
    primitivePaths.add(t.path.join("."));
  }

  const broken: BrokenReference[] = [];

  for (const theme of system.themes) {
    const semanticLookup = new Map<string, string>();
    for (const t of theme.semantics) {
      semanticLookup.set(t.path.join("."), t.$value);
    }
    for (const t of theme.semantics) {
      const ref = extractPureReference(t.$value);
      if (!ref) continue;
      if (!resolvesToPrimitive(ref, primitivePaths, semanticLookup)) {
        broken.push({
          tokenPath: t.path,
          tier: "semantic",
          referenceValue: `{${ref}}`,
          theme: theme.name,
        });
      }
    }
  }

  for (const t of system.components) {
    const ref = extractPureReference(t.$value);
    if (!ref) continue;
    if (primitivePaths.has(ref)) continue;
    // Component tokens may reference semantic tokens. Because components are
    // theme-agnostic, treat a reference as valid if it can resolve to a
    // primitive in at least one theme.
    let ok = false;
    for (const theme of system.themes) {
      const semanticLookup = new Map<string, string>();
      for (const s of theme.semantics) {
        semanticLookup.set(s.path.join("."), s.$value);
      }
      if (resolvesToPrimitive(ref, primitivePaths, semanticLookup)) {
        ok = true;
        break;
      }
    }
    if (!ok) {
      broken.push({
        tokenPath: t.path,
        tier: "component",
        referenceValue: `{${ref}}`,
      });
    }
  }

  return broken;
}

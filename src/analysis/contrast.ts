import { contrastRatio, meetsWcagAA } from "../utils/contrast.js";
import type { LoadedTokenSystem } from "./token-loader.js";

export interface ContrastPair {
  backgroundPath: string[];
  contentPath: string[];
  backgroundHex: string;
  contentHex: string;
  ratio: number;
  passAA: boolean;
  theme: string;
}

const DTCG_REF_RE = /^\{([^}]+)\}$/;

function resolveHex(
  value: string,
  primitiveLookup: Map<string, string>,
  semanticLookup: Map<string, string>,
  seenSemantic: Set<string> = new Set(),
): string | null {
  const refMatch = DTCG_REF_RE.exec(value);
  if (refMatch) {
    const refPath = refMatch[1]!;
    if (seenSemantic.has(refPath)) return null;
    const fromSemantic = semanticLookup.get(refPath);
    if (fromSemantic) {
      const nextSeen = new Set(seenSemantic);
      nextSeen.add(refPath);
      return resolveHex(fromSemantic, primitiveLookup, semanticLookup, nextSeen);
    }
    const fromPrimitive = primitiveLookup.get(refPath);
    if (fromPrimitive) return fromPrimitive;
    return null;
  }
  if (/^#[0-9a-fA-F]{6,8}$/.test(value)) return value;
  return null;
}

export function analyzeContrast(
  system: LoadedTokenSystem,
): ContrastPair[] {
  const primitiveLookup = new Map<string, string>();
  for (const t of system.primitives) {
    if (t.$type === "color") {
      primitiveLookup.set(t.path.join("."), t.$value);
    }
  }

  const pairs: ContrastPair[] = [];

  for (const theme of system.themes) {
    const semanticLookup = new Map<string, string>();
    for (const t of theme.semantics) {
      if (t.$type === "color") {
        semanticLookup.set(t.path.join("."), t.$value);
      }
    }

    const backgrounds = theme.semantics.filter(
      (t) => t.$type === "color" && t.path.includes("background"),
    );
    const contents = theme.semantics.filter(
      (t) =>
        t.$type === "color" &&
        (t.path.includes("content") || t.path.includes("text")),
    );

    for (const bg of backgrounds) {
      const bgRole = extractRole(bg.path, "background");
      for (const fg of contents) {
        const fgRole = extractRole(fg.path, "content") ?? extractRole(fg.path, "text");
        if (bgRole !== null && bgRole === fgRole) {
          const bgHex = resolveHex(bg.$value, primitiveLookup, semanticLookup);
          const fgHex = resolveHex(fg.$value, primitiveLookup, semanticLookup);
          if (bgHex && fgHex) {
            const ratio = contrastRatio(fgHex, bgHex);
            pairs.push({
              backgroundPath: bg.path,
              contentPath: fg.path,
              backgroundHex: bgHex,
              contentHex: fgHex,
              ratio: Math.round(ratio * 10) / 10,
              passAA: meetsWcagAA(fgHex, bgHex),
              theme: theme.name,
            });
          }
        }
      }
    }
  }

  return pairs;
}

function extractRole(path: string[], keyword: string): string | null {
  const idx = path.indexOf(keyword);
  if (idx < 0 || idx >= path.length - 1) return null;
  return path.slice(idx + 1).join(".");
}

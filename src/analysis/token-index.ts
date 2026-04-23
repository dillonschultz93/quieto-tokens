import type { LoadedTokenSystem } from "./token-loader.js";
import type { PrimitiveToken, SemanticToken, ComponentToken } from "../types/tokens.js";

export interface TokenEntry {
  cssVar: string; // e.g., "var(--quieto-color-blue-500)"
  rawValue: string; // e.g., "#3b82f6"
  tokenPath: string[];
  category: string;
  tier: string;
}

export interface TokenIndex {
  colorsByHex: Map<string, TokenEntry>; // lowercase hex → entry
  spacingByPx: Map<number, TokenEntry>; // px value → entry
  typographyByValue: Map<string, TokenEntry>; // value string → entry
}

function cssVarForToken(token: {
  tier: "primitive" | "semantic" | "component";
  path: string[];
}): string {
  const prefix = "quieto";
  let tierSegment: string[] = [];
  let tokenPath = [...token.path];

  if (token.tier === "component") {
    tierSegment = ["component"];
    if (tokenPath.length > 0 && tokenPath[tokenPath.length - 1] === "default") {
      tokenPath = tokenPath.slice(0, -1);
    }
  } else if (token.tier === "semantic") {
    tierSegment = ["semantic"];
  }

  const name = [prefix, ...tierSegment, ...tokenPath]
    .filter((s) => typeof s === "string" && s.length > 0)
    .join("-");
  return `var(--${name})`;
}

function normalizeHex(input: string): string | null {
  const s = input.trim();
  if (!s.startsWith("#")) return null;
  const h = s.slice(1);
  if (![3, 4, 6, 8].includes(h.length)) return null;
  const hex = h.toLowerCase();
  if (!/^[0-9a-f]+$/.test(hex)) return null;
  if (hex.length === 3) {
    const [r, g, b] = hex.split("");
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  if (hex.length === 4) {
    const [r, g, b] = hex.slice(0, 3).split("");
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  if (hex.length === 8) {
    return `#${hex.slice(0, 6)}`;
  }
  return `#${hex}`;
}

function dimensionToPx(value: string): number | null {
  const s = value.trim();
  const m = s.match(/^(\d+(?:\.\d+)?)(px|rem|em)\b/i);
  if (!m) return null;
  const n = Number.parseFloat(m[1]!);
  if (!Number.isFinite(n)) return null;
  const unit = m[2]!.toLowerCase();
  if (unit === "px") return n;
  // Per story spec: rem × 16. Treat em the same for this migration heuristic.
  return n * 16;
}

function tokenEntryFor(token: PrimitiveToken | SemanticToken | ComponentToken): TokenEntry {
  return {
    cssVar: cssVarForToken(token),
    rawValue: token.$value,
    tokenPath: token.path,
    category: token.category,
    tier: token.tier,
  };
}

export function buildTokenIndex(system: LoadedTokenSystem): TokenIndex {
  const colorsByHex = new Map<string, TokenEntry>();
  const spacingByPx = new Map<number, TokenEntry>();
  const typographyByValue = new Map<string, TokenEntry>();

  for (const t of system.primitives) {
    const entry = tokenEntryFor(t);

    if (t.category === "color" || t.$type === "color") {
      const hex = normalizeHex(t.$value);
      if (hex) colorsByHex.set(hex, { ...entry, rawValue: hex });
      continue;
    }

    if (t.category === "spacing") {
      const px = dimensionToPx(t.$value);
      if (px !== null) spacingByPx.set(px, entry);
      continue;
    }

    if (t.category === "typography") {
      typographyByValue.set(t.$value, entry);
    }
  }

  return { colorsByHex, spacingByPx, typographyByValue };
}


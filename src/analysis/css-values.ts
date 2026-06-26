import { readdir } from "node:fs/promises";
import { join } from "node:path";

/**
 * Shared, token-system-agnostic primitives for reading raw values out of
 * CSS-family stylesheets. Extracted from {@link ./scanner.ts} so both the
 * `migrate` scanner (which matches values against an existing token index)
 * and the `init --from-codebase` extractor (which has no token index yet and
 * just harvests raw values) can reuse the exact same parsing rules.
 *
 * Everything here is pure / stateless: no token knowledge, no I/O beyond the
 * directory walk.
 */

export const STYLE_EXTENSIONS = new Set([
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".styl",
]);

export const IGNORE_DIR_NAMES = new Set([
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".nuxt",
]);

export function isStyleFile(name: string): boolean {
  const lower = name.toLowerCase();
  for (const ext of STYLE_EXTENSIONS) {
    if (lower.endsWith(ext)) return true;
  }
  return false;
}

/**
 * Recursively collect every style file under `dir`, skipping dotfiles/dirs
 * and the well-known build/dependency directories in {@link IGNORE_DIR_NAMES}.
 */
export async function collectFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    if (e.isDirectory() && IGNORE_DIR_NAMES.has(e.name)) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await collectFiles(full)));
    } else if (e.isFile() && isStyleFile(e.name)) {
      out.push(full);
    }
  }
  return out;
}

export function normalizeHex(
  input: string,
): { hex: string; hadAlpha: boolean } | null {
  const s = input.trim();
  if (!s.startsWith("#")) return null;
  const h = s.slice(1);
  if (![3, 4, 6, 8].includes(h.length)) return null;
  const hex = h.toLowerCase();
  if (!/^[0-9a-f]+$/.test(hex)) return null;
  if (hex.length === 3) {
    const [r, g, b] = hex.split("");
    return { hex: `#${r}${r}${g}${g}${b}${b}`, hadAlpha: false };
  }
  if (hex.length === 4) {
    const [r, g, b] = hex.slice(0, 3).split("");
    return { hex: `#${r}${r}${g}${g}${b}${b}`, hadAlpha: true };
  }
  if (hex.length === 8) return { hex: `#${hex.slice(0, 6)}`, hadAlpha: true };
  return { hex: `#${hex}`, hadAlpha: false };
}

export function hexToRgb(
  hex: string,
): { r: number; g: number; b: number } | null {
  const n = normalizeHex(hex);
  if (!n) return null;
  const h = n.hex.slice(1);
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  if (![r, g, b].every((v) => Number.isFinite(v))) return null;
  return { r, g, b };
}

/** Euclidean RGB distance; `null` when either side isn't a parseable hex. */
export function colorDistance(a: string, b: string): number | null {
  const ar = hexToRgb(a);
  const br = hexToRgb(b);
  if (!ar || !br) return null;
  const dr = ar.r - br.r;
  const dg = ar.g - br.g;
  const db = ar.b - br.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/** Convert a `px` / `rem` / `em` dimension to pixels (1rem = 1em = 16px). */
export function dimensionToPx(value: string): number | null {
  const m = value.trim().match(/^(\d+(?:\.\d+)?)(px|rem|em)\b/i);
  if (!m) return null;
  const n = Number.parseFloat(m[1]!);
  if (!Number.isFinite(n)) return null;
  const unit = m[2]!.toLowerCase();
  if (unit === "px") return n;
  return n * 16;
}

export function isQuietoVarDeclaration(line: string): boolean {
  return /--quieto-[a-z0-9-]+\s*:/.test(line);
}

export function stripInlineBlockComments(line: string): string {
  // Best-effort single-line strip; multi-line comment state is out of scope.
  return line.replace(/\/\*.*?\*\//g, "");
}

export function stripQuietoVarCalls(valueSegment: string): string {
  // Remove token var() calls so other hardcoded values (including fallbacks)
  // can still be found.
  return valueSegment.replace(/var\(\s*--quieto-[^)]+\)/g, "");
}

export function findColumnInOriginal(
  originalLine: string,
  raw: string,
  startSearchIdx: number,
): { column: number; nextSearchIdx: number } {
  const idx = originalLine.indexOf(raw, startSearchIdx);
  if (idx === -1) {
    return {
      column: Math.max(1, startSearchIdx + 1),
      nextSearchIdx: startSearchIdx,
    };
  }
  return { column: idx + 1, nextSearchIdx: idx + raw.length };
}

/** Regex sources kept here so scanner + extractor tokenize identically. */
export const HEX_PATTERN = /#[0-9a-fA-F]{3,8}\b/g;
export const DIMENSION_PATTERN = /\b(\d+(?:\.\d+)?)(px|rem|em)\b/g;

/**
 * Split a declaration line into its property name and the (comment- and
 * token-var-stripped) value segment. Returns `null` for lines that aren't a
 * `prop: value` declaration or that are a quieto token declaration we should
 * ignore. The property is lowercased and trimmed; leading SCSS/Less sigils
 * are left intact (callers compare against known property names).
 */
export function splitDeclaration(
  originalLine: string,
): { property: string; valueSegment: string; colonIdx: number } | null {
  if (!originalLine.includes(":")) return null;
  if (isQuietoVarDeclaration(originalLine)) return null;
  const colonIdx = originalLine.indexOf(":");
  if (colonIdx < 0) return null;
  let property = originalLine.slice(0, colonIdx).trim().toLowerCase();
  // Handle `selector { prop: value }` written on one line: drop everything up
  // to and including the last brace so the property is just `prop`.
  const braceIdx = property.lastIndexOf("{");
  if (braceIdx >= 0) property = property.slice(braceIdx + 1).trim();
  const valueSegmentRaw = originalLine.slice(colonIdx + 1);
  const valueSegment = stripQuietoVarCalls(
    stripInlineBlockComments(valueSegmentRaw),
  );
  return { property, valueSegment, colonIdx };
}

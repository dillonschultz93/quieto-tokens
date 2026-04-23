import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { TokenIndex, TokenEntry } from "./token-index.js";

export interface ScanMatch {
  filePath: string;
  line: number;
  column: number;
  hardcodedValue: string;
  suggestedReplacement: string;
  confidence: "exact" | "approximate";
  category: string;
}

export interface ScanResult {
  matches: ScanMatch[];
  filesScanned: number;
  filesWithMatches: number;
  /**
   * Total hardcoded value occurrences encountered (hex colors + dimensions)
   * in scanned value segments, excluding already-tokenized lines.
   */
  hardcodedValuesFound: number;
}

const STYLE_EXTENSIONS = new Set([".css", ".scss", ".sass", ".less", ".styl"]);
const IGNORE_DIR_NAMES = new Set([
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".nuxt",
]);

function isStyleFile(name: string): boolean {
  const lower = name.toLowerCase();
  for (const ext of STYLE_EXTENSIONS) {
    if (lower.endsWith(ext)) return true;
  }
  return false;
}

async function collectFiles(dir: string): Promise<string[]> {
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

function normalizeHex(
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

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const n = normalizeHex(hex);
  if (!n) return null;
  const h = n.hex.slice(1);
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  if (![r, g, b].every((v) => Number.isFinite(v))) return null;
  return { r, g, b };
}

function colorDistance(a: string, b: string): number | null {
  const ar = hexToRgb(a);
  const br = hexToRgb(b);
  if (!ar || !br) return null;
  const dr = ar.r - br.r;
  const dg = ar.g - br.g;
  const db = ar.b - br.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function dimensionToPx(value: string): number | null {
  const m = value.trim().match(/^(\d+(?:\.\d+)?)(px|rem|em)\b/i);
  if (!m) return null;
  const n = Number.parseFloat(m[1]!);
  if (!Number.isFinite(n)) return null;
  const unit = m[2]!.toLowerCase();
  if (unit === "px") return n;
  return n * 16;
}

function findClosestColor(
  hex: string,
  colorsByHex: Map<string, TokenEntry>,
): { entry: TokenEntry; distance: number } | null {
  let best: { entry: TokenEntry; distance: number } | null = null;
  for (const [k, entry] of colorsByHex.entries()) {
    const d = colorDistance(hex, k);
    if (d === null) continue;
    if (best === null || d < best.distance) {
      best = { entry, distance: d };
    }
  }
  return best;
}

function findClosestSpacing(
  px: number,
  spacingByPx: Map<number, TokenEntry>,
): { entry: TokenEntry; diffPx: number } | null {
  let best: { entry: TokenEntry; diffPx: number } | null = null;
  for (const [k, entry] of spacingByPx.entries()) {
    const diff = Math.abs(px - k);
    if (best === null || diff < best.diffPx) {
      best = { entry, diffPx: diff };
    }
  }
  return best;
}

function isQuietoVarDeclaration(line: string): boolean {
  return /--quieto-[a-z0-9-]+\s*:/.test(line);
}

function stripInlineBlockComments(line: string): string {
  // Best-effort single-line strip; multi-line comment state is out of scope.
  return line.replace(/\/\*.*?\*\//g, "");
}

function stripQuietoVarCalls(valueSegment: string): string {
  // Remove token var() calls so other hardcoded values (including fallbacks) can still be found.
  return valueSegment.replace(/var\(\s*--quieto-[^)]+\)/g, "");
}

function findColumnInOriginal(
  originalLine: string,
  raw: string,
  startSearchIdx: number,
): { column: number; nextSearchIdx: number } {
  const idx = originalLine.indexOf(raw, startSearchIdx);
  if (idx === -1) {
    return { column: Math.max(1, startSearchIdx + 1), nextSearchIdx: startSearchIdx };
  }
  return { column: idx + 1, nextSearchIdx: idx + raw.length };
}

function findClosestTypographyByPx(
  px: number,
  typographyByValue: Map<string, TokenEntry>,
): { entry: TokenEntry; diffPx: number } | null {
  let best: { entry: TokenEntry; diffPx: number } | null = null;
  for (const [value, entry] of typographyByValue.entries()) {
    const tokenPx = dimensionToPx(value);
    if (tokenPx === null) continue;
    const diffPx = Math.abs(px - tokenPx);
    if (best === null || diffPx < best.diffPx) {
      best = { entry, diffPx };
    }
  }
  return best;
}

export async function scanDirectory(
  dir: string,
  index: TokenIndex,
): Promise<ScanResult> {
  const files = await collectFiles(dir);
  const matches: ScanMatch[] = [];
  const filesWithMatches = new Set<string>();
  let hardcodedValuesFound = 0;

  for (const filePath of files) {
    const content = await readFile(filePath, "utf-8");
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const originalLine = lines[i] ?? "";
      if (!originalLine.includes(":")) continue;
      if (isQuietoVarDeclaration(originalLine)) continue;

      const colonIdx = originalLine.indexOf(":");
      if (colonIdx < 0) continue;
      const valueSegmentRaw = originalLine.slice(colonIdx + 1);
      const valueSegment = stripQuietoVarCalls(
        stripInlineBlockComments(valueSegmentRaw),
      );
      let searchCursor = colonIdx + 1;

      // Hex colors
      for (const m of valueSegment.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
        const raw = m[0]!;
        hardcodedValuesFound++;
        const norm = normalizeHex(raw);
        if (!norm) continue;
        const entry = index.colorsByHex.get(norm.hex);
        const { column: col, nextSearchIdx } = findColumnInOriginal(
          originalLine,
          raw,
          searchCursor,
        );
        searchCursor = nextSearchIdx;
        if (entry && !norm.hadAlpha) {
          matches.push({
            filePath,
            line: i + 1,
            column: col,
            hardcodedValue: raw,
            suggestedReplacement: entry.cssVar,
            confidence: "exact",
            category: "color",
          });
          filesWithMatches.add(filePath);
          continue;
        }
        const closest = findClosestColor(norm.hex, index.colorsByHex);
        if (closest && closest.distance < 10) {
          const note = norm.hadAlpha ? " (alpha ignored)" : "";
          matches.push({
            filePath,
            line: i + 1,
            column: col,
            hardcodedValue: raw,
            suggestedReplacement: `${closest.entry.cssVar}${note} (distance ${closest.distance.toFixed(2)})`,
            confidence: "approximate",
            category: "color",
          });
          filesWithMatches.add(filePath);
        }
      }

      // Dimensions
      for (const m of valueSegment.matchAll(/\b(\d+(?:\.\d+)?)(px|rem|em)\b/g)) {
        const raw = m[0]!;
        hardcodedValuesFound++;
        const px = dimensionToPx(raw);
        if (px === null) continue;
        const { column: col, nextSearchIdx } = findColumnInOriginal(
          originalLine,
          raw,
          searchCursor,
        );
        searchCursor = nextSearchIdx;

        const spacingEntry = index.spacingByPx.get(px);
        if (spacingEntry) {
          matches.push({
            filePath,
            line: i + 1,
            column: col,
            hardcodedValue: raw,
            suggestedReplacement: spacingEntry.cssVar,
            confidence: "exact",
            category: "spacing",
          });
          filesWithMatches.add(filePath);
          continue;
        }

        // Typography exact/approx (AC #3)
        const typoClosest = findClosestTypographyByPx(px, index.typographyByValue);
        if (typoClosest && typoClosest.diffPx === 0) {
          matches.push({
            filePath,
            line: i + 1,
            column: col,
            hardcodedValue: raw,
            suggestedReplacement: typoClosest.entry.cssVar,
            confidence: "exact",
            category: "typography",
          });
          filesWithMatches.add(filePath);
          continue;
        }

        const spacingClosest = findClosestSpacing(px, index.spacingByPx);
        const best =
          spacingClosest && typoClosest
            ? spacingClosest.diffPx <= typoClosest.diffPx
              ? {
                  entry: spacingClosest.entry,
                  diffPx: spacingClosest.diffPx,
                  category: "spacing" as const,
                }
              : {
                  entry: typoClosest.entry,
                  diffPx: typoClosest.diffPx,
                  category: "typography" as const,
                }
            : spacingClosest
              ? {
                  entry: spacingClosest.entry,
                  diffPx: spacingClosest.diffPx,
                  category: "spacing" as const,
                }
              : typoClosest
                ? {
                    entry: typoClosest.entry,
                    diffPx: typoClosest.diffPx,
                    category: "typography" as const,
                  }
                : null;

        if (best && best.diffPx <= 1) {
          matches.push({
            filePath,
            line: i + 1,
            column: col,
            hardcodedValue: raw,
            suggestedReplacement: `${best.entry.cssVar} (Δ${best.diffPx}px)`,
            confidence: "approximate",
            category: best.category,
          });
          filesWithMatches.add(filePath);
        }
      }
    }
  }

  return {
    matches,
    filesScanned: files.length,
    filesWithMatches: filesWithMatches.size,
    hardcodedValuesFound,
  };
}


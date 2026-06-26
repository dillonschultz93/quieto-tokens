import { readFile } from "node:fs/promises";
import type { TokenIndex, TokenEntry } from "./token-index.js";
import {
  collectFiles,
  colorDistance,
  dimensionToPx,
  DIMENSION_PATTERN,
  findColumnInOriginal,
  HEX_PATTERN,
  normalizeHex,
  splitDeclaration,
} from "./css-values.js";

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
      const decl = splitDeclaration(originalLine);
      if (!decl) continue;
      const { valueSegment, colonIdx } = decl;
      let searchCursor = colonIdx + 1;

      // Hex colors
      for (const m of valueSegment.matchAll(HEX_PATTERN)) {
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
      for (const m of valueSegment.matchAll(DIMENSION_PATTERN)) {
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


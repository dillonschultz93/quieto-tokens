import { readFile } from "node:fs/promises";
import {
  collectFiles,
  DIMENSION_PATTERN,
  dimensionToPx,
  HEX_PATTERN,
  normalizeHex,
  splitDeclaration,
} from "./css-values.js";

/**
 * Raw, un-interpreted histograms of the design-relevant values found across a
 * project's CSS-family stylesheets. This layer is deliberately "dumb": it
 * records what appears and on which CSS property, but makes no decisions about
 * what is a brand color or a spacing base — that interpretation lives in
 * {@link ./infer-seed.ts}. Keeping extraction free of heuristics makes both
 * halves easy to test in isolation.
 */
export interface ValueOccurrence {
  count: number;
  /** Lowercased CSS property names this value appeared on (e.g. `color`). */
  properties: Set<string>;
}

export interface FontFamilyOccurrence {
  count: number;
  /** True if seen inside an `h1`–`h6` rule (heading-stack signal). */
  onHeadingSelector: boolean;
  /** True if the stack looks monospaced. */
  isMono: boolean;
}

export interface RawValueHistograms {
  /** Keyed by normalized `#rrggbb` hex. */
  colors: Map<string, ValueOccurrence>;
  /** Keyed by pixel value (rem/em already converted at 16px). */
  dimensions: Map<number, ValueOccurrence>;
  /** Keyed by the raw font-family stack string. */
  fontFamilies: Map<string, FontFamilyOccurrence>;
  /** Keyed by CSS numeric weight (100–900). */
  fontWeights: Map<number, number>;
  /** True if any dark-theme signal was detected. */
  darkModeSignals: boolean;
  filesScanned: number;
  totalColorUsages: number;
  totalDimensionUsages: number;
}

const DARK_MODE_SIGNAL =
  /prefers-color-scheme:\s*dark|\.dark\b|\[data-theme=['"]?dark['"]?\]/i;

const HEADING_SELECTOR = /\bh[1-6]\b/;

const MONO_HINT =
  /\bmono\b|monospace|courier|consolas|menlo|"?sf mono"?|ui-monospace/i;

const FONT_WEIGHT_KEYWORDS: Record<string, number> = {
  normal: 400,
  bold: 700,
};

function isMonoStack(stack: string): boolean {
  return MONO_HINT.test(stack);
}

/** Best-effort: pull the leading numeric/keyword weight out of a value. */
function parseFontWeight(valueSegment: string): number | null {
  const raw = valueSegment.trim().replace(/!important.*$/i, "").trim();
  const token = raw.split(/[\s;]+/)[0]?.toLowerCase() ?? "";
  if (token in FONT_WEIGHT_KEYWORDS) return FONT_WEIGHT_KEYWORDS[token]!;
  const n = Number.parseInt(token, 10);
  if (Number.isFinite(n) && n >= 100 && n <= 900) return n;
  return null;
}

function cleanFontFamilyStack(valueSegment: string): string {
  return valueSegment
    .replace(/!important.*$/i, "")
    .replace(/;.*$/, "")
    .trim();
}

function bumpOccurrence(
  map: Map<string, ValueOccurrence> | Map<number, ValueOccurrence>,
  key: string | number,
  property: string,
): void {
  // The two map shapes share an identical value type; the cast keeps the
  // call sites tidy without widening the public interface.
  const m = map as Map<string | number, ValueOccurrence>;
  const existing = m.get(key);
  if (existing) {
    existing.count += 1;
    existing.properties.add(property);
  } else {
    m.set(key, { count: 1, properties: new Set([property]) });
  }
}

/**
 * Walk every CSS-family file under `dir` and tally the design values found.
 * Uses the shared tokenizing primitives in {@link ./css-values.ts} so the
 * extraction rules stay identical to the `migrate` scanner.
 */
export async function extractRawValues(
  dir: string,
): Promise<RawValueHistograms> {
  const files = await collectFiles(dir);

  const colors = new Map<string, ValueOccurrence>();
  const dimensions = new Map<number, ValueOccurrence>();
  const fontFamilies = new Map<string, FontFamilyOccurrence>();
  const fontWeights = new Map<number, number>();
  let darkModeSignals = false;
  let totalColorUsages = 0;
  let totalDimensionUsages = 0;

  for (const filePath of files) {
    const content = await readFile(filePath, "utf-8");
    if (!darkModeSignals && DARK_MODE_SIGNAL.test(content)) {
      darkModeSignals = true;
    }

    const lines = content.split(/\r?\n/);
    // Best-effort selector tracking: remember the selector text that opened
    // the current rule so font-family declarations can be attributed to
    // heading selectors. Multi-line selectors collapse onto the `{` line.
    let currentSelector = "";

    for (const originalLine of lines) {
      if (originalLine.includes("{")) {
        currentSelector = originalLine
          .slice(0, originalLine.indexOf("{"))
          .trim()
          .toLowerCase();
      }
      if (originalLine.includes("}")) {
        currentSelector = "";
      }

      const decl = splitDeclaration(originalLine);
      if (!decl) continue;
      const { property, valueSegment } = decl;

      // Colors
      for (const m of valueSegment.matchAll(HEX_PATTERN)) {
        const norm = normalizeHex(m[0]!);
        if (!norm) continue;
        totalColorUsages += 1;
        bumpOccurrence(colors, norm.hex, property);
      }

      // Dimensions
      for (const m of valueSegment.matchAll(DIMENSION_PATTERN)) {
        const px = dimensionToPx(m[0]!);
        if (px === null) continue;
        totalDimensionUsages += 1;
        bumpOccurrence(dimensions, px, property);
      }

      // Font family
      if (property === "font-family") {
        const stack = cleanFontFamilyStack(valueSegment);
        if (stack.length > 0) {
          const existing = fontFamilies.get(stack);
          const onHeading = HEADING_SELECTOR.test(currentSelector);
          if (existing) {
            existing.count += 1;
            existing.onHeadingSelector ||= onHeading;
          } else {
            fontFamilies.set(stack, {
              count: 1,
              onHeadingSelector: onHeading,
              isMono: isMonoStack(stack),
            });
          }
        }
      }

      // Font weight
      if (property === "font-weight") {
        const weight = parseFontWeight(valueSegment);
        if (weight !== null) {
          fontWeights.set(weight, (fontWeights.get(weight) ?? 0) + 1);
        }
      }
    }
  }

  return {
    colors,
    dimensions,
    fontFamilies,
    fontWeights,
    darkModeSignals,
    filesScanned: files.length,
    totalColorUsages,
    totalDimensionUsages,
  };
}

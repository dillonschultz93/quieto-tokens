import { readFile } from "node:fs/promises";
import {
  collectFiles,
  DIMENSION_PATTERN,
  dimensionToPx,
  HEX_PATTERN,
  normalizeHex,
  splitDeclaration,
  stripVarCalls,
  VAR_CALL_PATTERN,
  VAR_REFERENCE_PATTERN,
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

export interface CustomPropertyDefinition {
  /** Comment-stripped value segment as written (may reference other vars). */
  value: string;
  /** True when defined on `:root`, `html`, or `body`. */
  onRootSelector: boolean;
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
  /** Non-quieto custom properties (`--name`) and their definitions. */
  customProperties: Map<string, CustomPropertyDefinition>;
  /** Total non-quieto `var(--x)` references seen on regular declarations. */
  varUsageCount: number;
  /**
   * Background colors declared on `:root`/`html`/`body` (var()s resolved),
   * keyed by normalized hex. Signals whether the app is natively dark.
   */
  rootBackgrounds: Map<string, number>;
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
    .replace(/^[\s,]+|[\s,]+$/g, "")
    .trim();
}

function bumpOccurrence(
  map: Map<string, ValueOccurrence> | Map<number, ValueOccurrence>,
  key: string | number,
  properties: Iterable<string>,
  count = 1,
): void {
  // The two map shapes share an identical value type; the cast keeps the
  // call sites tidy without widening the public interface.
  const m = map as Map<string | number, ValueOccurrence>;
  const existing = m.get(key);
  if (existing) {
    existing.count += count;
    for (const p of properties) existing.properties.add(p);
  } else {
    m.set(key, { count, properties: new Set(properties) });
  }
}

/** True for selectors that style the page root (`:root`, `html`, `body`). */
function isRootSelector(selector: string): boolean {
  return selector
    .split(",")
    .some((s) => [":root", "html", "body"].includes(s.trim()));
}

function cleanCustomPropertyValue(valueSegment: string): string {
  return valueSegment
    .replace(/!important.*$/i, "")
    .replace(/;.*$/, "")
    .trim();
}

/** Per-var-name tally of where `var(--name)` was used. */
interface VarUsage {
  count: number;
  properties: Set<string>;
  onHeadingSelector: boolean;
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
  const customProperties = new Map<string, CustomPropertyDefinition>();
  const varUsages = new Map<string, VarUsage>();
  const rootBackgroundSegments: string[] = [];
  let varUsageCount = 0;
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

      const isCustomProperty = property.startsWith("--");
      if (isCustomProperty) {
        // A definition like `--accent-gold: #c9a857`. Remember it so var()
        // usages can resolve to it; its literal value still gets tallied
        // below (once) so defined-but-unreferenced values aren't lost.
        const value = cleanCustomPropertyValue(valueSegment);
        if (value.length > 0) {
          const onRoot = isRootSelector(currentSelector);
          const existing = customProperties.get(property);
          // Prefer the base-theme (`:root`) definition over theme overrides.
          if (!existing || (!existing.onRootSelector && onRoot)) {
            customProperties.set(property, { value, onRootSelector: onRoot });
          }
        }
      } else {
        // References like `color: var(--accent-gold)` are votes for the
        // referenced token; tally them for the post-walk resolution pass.
        // (References inside definitions are aliases, not usage — skipped.)
        for (const m of valueSegment.matchAll(VAR_REFERENCE_PATTERN)) {
          const name = m[1]!;
          varUsageCount += 1;
          const onHeading =
            property === "font-family" && HEADING_SELECTOR.test(currentSelector);
          const existing = varUsages.get(name);
          if (existing) {
            existing.count += 1;
            existing.properties.add(property);
            existing.onHeadingSelector ||= onHeading;
          } else {
            varUsages.set(name, {
              count: 1,
              properties: new Set([property]),
              onHeadingSelector: onHeading,
            });
          }
        }

        if (
          (property === "background" || property === "background-color") &&
          isRootSelector(currentSelector)
        ) {
          rootBackgroundSegments.push(valueSegment);
        }
      }

      // Literal matching runs on the var()-stripped segment so a reference
      // (or its fallback) is never mistaken for a raw value.
      const literalSegment = stripVarCalls(valueSegment);

      // Colors
      for (const m of literalSegment.matchAll(HEX_PATTERN)) {
        const norm = normalizeHex(m[0]!);
        if (!norm) continue;
        totalColorUsages += 1;
        bumpOccurrence(colors, norm.hex, [property]);
      }

      // Dimensions
      for (const m of literalSegment.matchAll(DIMENSION_PATTERN)) {
        const px = dimensionToPx(m[0]!);
        if (px === null) continue;
        totalDimensionUsages += 1;
        bumpOccurrence(dimensions, px, [property]);
      }

      // Font family
      if (property === "font-family") {
        const stack = cleanFontFamilyStack(literalSegment);
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
        const weight = parseFontWeight(literalSegment);
        if (weight !== null) {
          fontWeights.set(weight, (fontWeights.get(weight) ?? 0) + 1);
        }
      }
    }
  }

  // ── Resolution pass ────────────────────────────────────────────────────
  // Follow definition chains (`--brand: var(--gold)`) up to a small depth
  // and turn each var() usage into count-weighted votes for the resolved
  // value. Unresolvable references are ignored entirely.
  const resolveCustomProperty = (
    name: string,
    seen: Set<string> = new Set(),
  ): string | null => {
    const def = customProperties.get(name);
    if (!def || seen.has(name) || seen.size > 8) return null;
    seen.add(name);
    let failed = false;
    const value = def.value
      .replace(VAR_CALL_PATTERN, (_, ref: string) => {
        const resolved = resolveCustomProperty(ref, seen);
        if (resolved === null) failed = true;
        return resolved ?? "";
      })
      .trim();
    seen.delete(name);
    return failed || value.length === 0 ? null : value;
  };

  for (const [name, usage] of varUsages) {
    const resolved = resolveCustomProperty(name);
    if (resolved === null) continue;

    for (const m of resolved.matchAll(HEX_PATTERN)) {
      const norm = normalizeHex(m[0]!);
      if (!norm) continue;
      totalColorUsages += usage.count;
      bumpOccurrence(colors, norm.hex, usage.properties, usage.count);
    }

    for (const m of resolved.matchAll(DIMENSION_PATTERN)) {
      const px = dimensionToPx(m[0]!);
      if (px === null) continue;
      totalDimensionUsages += usage.count;
      bumpOccurrence(dimensions, px, usage.properties, usage.count);
    }

    if (usage.properties.has("font-family")) {
      const stack = cleanFontFamilyStack(resolved);
      if (stack.length > 0) {
        const existing = fontFamilies.get(stack);
        if (existing) {
          existing.count += usage.count;
          existing.onHeadingSelector ||= usage.onHeadingSelector;
        } else {
          fontFamilies.set(stack, {
            count: usage.count,
            onHeadingSelector: usage.onHeadingSelector,
            isMono: isMonoStack(stack),
          });
        }
      }
    }

    if (usage.properties.has("font-weight")) {
      const weight = parseFontWeight(resolved);
      if (weight !== null) {
        fontWeights.set(weight, (fontWeights.get(weight) ?? 0) + usage.count);
      }
    }
  }

  const rootBackgrounds = new Map<string, number>();
  for (const segment of rootBackgroundSegments) {
    const substituted = segment.replace(
      VAR_CALL_PATTERN,
      (_, ref: string) => resolveCustomProperty(ref) ?? "",
    );
    const first = substituted.match(HEX_PATTERN)?.[0];
    const norm = first ? normalizeHex(first) : null;
    if (norm) {
      rootBackgrounds.set(norm.hex, (rootBackgrounds.get(norm.hex) ?? 0) + 1);
    }
  }

  return {
    colors,
    dimensions,
    fontFamilies,
    fontWeights,
    darkModeSignals,
    customProperties,
    varUsageCount,
    rootBackgrounds,
    filesScanned: files.length,
    totalColorUsages,
    totalDimensionUsages,
  };
}

import { parseColor } from "@quieto/engine";
import { hueNameFromAngle } from "../generators/color.js";
import { normalizeHex } from "../utils/color.js";
import type { QuickStartOptions } from "../types.js";
import type { AdvancedConfig } from "../types/config.js";
import type { RawValueHistograms } from "./extract.js";

/**
 * Turns the raw histograms from {@link ./extract.ts} into the same seed the
 * interactive `init` flow produces: a {@link QuickStartOptions} plus optional
 * {@link AdvancedConfig}. The downstream generation pipeline is reused
 * unchanged, so this module is the entire "reverse" of the questionnaire.
 *
 * Philosophy: **seed-and-generate.** We infer the few high-level inputs that
 * drive Quieto's accessible-ramp pipeline rather than echoing every literal
 * value. The user reviews and adjusts in the existing preview step.
 */

/** Human-readable provenance lines surfaced in the inference summary. */
export interface InferenceRationale {
  lines: string[];
  /** Non-fatal caveats (e.g. brand color had to be guessed). */
  warnings: string[];
}

export interface InferredSeed {
  options: QuickStartOptions;
  advanced: AdvancedConfig;
  rationale: InferenceRationale;
}

/** oklch chroma below this reads as neutral/gray (not a brand candidate). */
const NEUTRAL_CHROMA = 0.04;

/** Fallback brand when no usable color is found (matches quick-start placeholder). */
const DEFAULT_BRAND = "#5B21B6";

const SPACING_PROPERTY =
  /^(padding|margin|gap|row-gap|column-gap|grid-gap|grid-row-gap|grid-column-gap)/;

/** Standard CSS-weight → role-name map for token naming. */
const WEIGHT_ROLES: Record<number, string> = {
  100: "thin",
  200: "extralight",
  300: "light",
  400: "regular",
  500: "medium",
  600: "semibold",
  700: "bold",
  800: "extrabold",
  900: "black",
};

interface ColorFacts {
  hex: string;
  count: number;
  chroma: number;
  hueName: string;
}

function analyzeColors(
  histograms: RawValueHistograms,
): ColorFacts[] {
  const facts: ColorFacts[] = [];
  for (const [hex, occ] of histograms.colors) {
    const parsed = parseColor(hex);
    if (!parsed.ok) continue;
    const { l, c, h } = parsed.value.oklch;
    // Skip near-black / near-white even if technically chromatic.
    if (l <= 0.05 || l >= 0.98) continue;
    facts.push({ hex, count: occ.count, chroma: c, hueName: hueNameFromAngle(h) });
  }
  // Highest usage first; ties broken by chroma (prefer the more vivid).
  facts.sort((a, b) => b.count - a.count || b.chroma - a.chroma);
  return facts;
}

function roleForHue(hueName: string): string {
  if (hueName === "red") return "error";
  if (hueName === "green" || hueName === "lime") return "success";
  if (hueName === "yellow" || hueName === "orange") return "warning";
  return "accent";
}

function inferBrandAndHues(
  histograms: RawValueHistograms,
  rationale: InferenceRationale,
): { brandColor: string; additionalHues: Array<{ name: string; seed: string }> } {
  const facts = analyzeColors(histograms);
  const saturated = facts.filter((f) => f.chroma > NEUTRAL_CHROMA);

  if (saturated.length === 0) {
    if (facts.length > 0) {
      const brand = normalizeHex(facts[0]!.hex);
      rationale.warnings.push(
        `No vivid color found — using the most common color ${brand} as the brand. Adjust by re-running plain \`init\` if that's wrong.`,
      );
      return { brandColor: brand, additionalHues: [] };
    }
    rationale.warnings.push(
      `No colors found in stylesheets — defaulting brand to ${DEFAULT_BRAND}.`,
    );
    return { brandColor: DEFAULT_BRAND, additionalHues: [] };
  }

  const brandFact = saturated[0]!;
  const brandColor = normalizeHex(brandFact.hex);
  rationale.lines.push(
    `Brand color ${brandColor} (${brandFact.hueName}) — ${brandFact.count} use${brandFact.count === 1 ? "" : "s"}.`,
  );

  // Additional hues: most-used saturated colors in a *different* hue family
  // than the brand (and than each other), capped at 3 to keep the palette sane.
  const additionalHues: Array<{ name: string; seed: string }> = [];
  const usedNames = new Set<string>();
  const seenFamilies = new Set<string>([brandFact.hueName]);
  for (const f of saturated.slice(1)) {
    if (additionalHues.length >= 3) break;
    if (seenFamilies.has(f.hueName)) continue;
    seenFamilies.add(f.hueName);
    let name = roleForHue(f.hueName);
    let suffix = 2;
    while (usedNames.has(name)) name = `${roleForHue(f.hueName)}-${suffix++}`;
    usedNames.add(name);
    additionalHues.push({ name, seed: normalizeHex(f.hex) });
  }
  if (additionalHues.length > 0) {
    rationale.lines.push(
      `Additional hues: ${additionalHues.map((h) => `${h.name} (${h.seed})`).join(", ")}.`,
    );
  }

  return { brandColor, additionalHues };
}

function inferSpacingBase(
  histograms: RawValueHistograms,
  rationale: InferenceRationale,
): 4 | 8 {
  let weight8 = 0;
  let weightTotal = 0;
  for (const [px, occ] of histograms.dimensions) {
    if (px <= 0 || !Number.isInteger(px)) continue;
    const isSpacing = [...occ.properties].some((prop) =>
      SPACING_PROPERTY.test(prop),
    );
    if (!isSpacing) continue;
    weightTotal += occ.count;
    if (px % 8 === 0) weight8 += occ.count;
  }
  if (weightTotal === 0) {
    rationale.lines.push("Spacing base 8px (default — no spacing values found).");
    return 8;
  }
  const ratio8 = weight8 / weightTotal;
  const base = ratio8 >= 0.6 ? 8 : 4;
  rationale.lines.push(
    `Spacing base ${base}px — ${Math.round(ratio8 * 100)}% of spacing values are multiples of 8.`,
  );
  return base;
}

function inferTypeScale(
  histograms: RawValueHistograms,
  rationale: InferenceRationale,
): "compact" | "balanced" | "spacious" {
  const sizes = [...histograms.dimensions.entries()]
    .filter(([px, occ]) => px > 0 && [...occ.properties].includes("font-size"))
    .map(([px]) => px)
    .sort((a, b) => a - b);

  if (sizes.length < 2) {
    rationale.lines.push("Type scale: balanced (default — too few font sizes).");
    return "balanced";
  }

  let ratioSum = 0;
  let ratioCount = 0;
  for (let i = 1; i < sizes.length; i++) {
    const prev = sizes[i - 1]!;
    const cur = sizes[i]!;
    if (prev > 0 && cur > prev) {
      ratioSum += cur / prev;
      ratioCount += 1;
    }
  }
  const avg = ratioCount > 0 ? ratioSum / ratioCount : 1.25;
  const scale =
    avg < 1.225 ? "compact" : avg < 1.29 ? "balanced" : "spacious";
  rationale.lines.push(
    `Type scale: ${scale} — average size ratio ${avg.toFixed(3)}.`,
  );
  return scale;
}

function inferTypography(
  histograms: RawValueHistograms,
  rationale: InferenceRationale,
): AdvancedConfig["typography"] | undefined {
  const typography: NonNullable<AdvancedConfig["typography"]> = {};

  // Font families
  const families = [...histograms.fontFamilies.entries()].sort(
    (a, b) => b[1].count - a[1].count,
  );
  if (families.length > 0) {
    const fontFamily: NonNullable<
      NonNullable<AdvancedConfig["typography"]>["fontFamily"]
    > = {};
    const body = families[0]![0];
    fontFamily.body = body;
    const heading = families.find(
      ([stack, occ]) => occ.onHeadingSelector && stack !== body,
    );
    if (heading) fontFamily.heading = heading[0];
    const mono = families.find(([, occ]) => occ.isMono);
    if (mono) fontFamily.mono = mono[0];
    typography.fontFamily = fontFamily;
    rationale.lines.push(
      `Font families: body "${body}"${heading ? `, heading "${heading[0]}"` : ""}${mono ? `, mono "${mono[0]}"` : ""}.`,
    );
  }

  // Base body size override (only when the dominant body size isn't 16px)
  const fontSizes = [...histograms.dimensions.entries()]
    .filter(([px, occ]) => px > 0 && [...occ.properties].includes("font-size"))
    .sort((a, b) => b[1].count - a[1].count);
  if (fontSizes.length > 0) {
    const dominant = Math.round(fontSizes[0]![0]);
    if (dominant !== 16 && dominant >= 10 && dominant <= 24) {
      typography.customSizes = { "font-size-base": dominant };
      rationale.lines.push(`Base font size: ${dominant}px (overrides 16px default).`);
    }
  }

  // Font weights actually used
  if (histograms.fontWeights.size > 0) {
    const customWeights: Record<string, number> = {};
    for (const weight of histograms.fontWeights.keys()) {
      const role = WEIGHT_ROLES[weight];
      if (role) customWeights[`font-weight-${role}`] = weight;
    }
    if (Object.keys(customWeights).length > 0) {
      typography.customWeights = customWeights;
      rationale.lines.push(
        `Font weights: ${[...histograms.fontWeights.keys()].sort((a, b) => a - b).join(", ")}.`,
      );
    }
  }

  return Object.keys(typography).length > 0 ? typography : undefined;
}

/** oklch lightness below this on the page background reads as a dark UI. */
const DARK_BACKGROUND_LIGHTNESS = 0.5;

/**
 * Whether to generate a light + dark pair. Beyond the explicit dark-mode
 * signals (`prefers-color-scheme` etc.), a natively dark app — dark page
 * background, no theme toggle — should also get both themes rather than the
 * default light-only output.
 */
function inferGenerateThemes(
  histograms: RawValueHistograms,
  rationale: InferenceRationale,
): boolean {
  if (histograms.darkModeSignals) {
    rationale.lines.push("Themes: light + dark (dark-mode styles detected).");
    return true;
  }

  // Dominant page background: prefer explicit :root/html/body declarations,
  // fall back to the most-used color seen on background properties.
  let background: string | undefined;
  let bestCount = 0;
  for (const [hex, count] of histograms.rootBackgrounds) {
    if (count > bestCount) {
      background = hex;
      bestCount = count;
    }
  }
  if (!background) {
    for (const [hex, occ] of histograms.colors) {
      const onBackground = [...occ.properties].some(
        (p) => p === "background" || p === "background-color",
      );
      if (onBackground && occ.count > bestCount) {
        background = hex;
        bestCount = occ.count;
      }
    }
  }

  if (background) {
    const parsed = parseColor(background);
    if (parsed.ok && parsed.value.oklch.l < DARK_BACKGROUND_LIGHTNESS) {
      rationale.lines.push(
        `Themes: light + dark (dark background ${normalizeHex(background)} detected).`,
      );
      return true;
    }
  }

  rationale.lines.push("Themes: single (no dark-mode styles detected).");
  return false;
}

/** Thresholds for "this codebase already has a token system" detection. */
const TOKENIZED_MIN_CUSTOM_PROPERTIES = 5;
const TOKENIZED_MIN_VAR_USAGES = 10;

/**
 * Infer a full token-system seed from the histograms. Returns `null` when the
 * stylesheets contain essentially nothing design-relevant, so the caller can
 * fall back to the guided flow with a clear message.
 */
export function inferSeed(
  histograms: RawValueHistograms,
): InferredSeed | null {
  const hasSignal =
    histograms.colors.size > 0 ||
    histograms.dimensions.size > 0 ||
    histograms.fontFamilies.size > 0 ||
    histograms.fontWeights.size > 0;
  if (!hasSignal) return null;

  const rationale: InferenceRationale = { lines: [], warnings: [] };

  if (
    histograms.customProperties.size >= TOKENIZED_MIN_CUSTOM_PROPERTIES &&
    histograms.varUsageCount >= TOKENIZED_MIN_VAR_USAGES
  ) {
    rationale.warnings.push(
      `Existing token system detected (${histograms.customProperties.size} custom properties, ${histograms.varUsageCount} var() references). ` +
        "This builds a fresh Quieto system from those values rather than augmenting them — review the preview carefully before writing files.",
    );
  }

  const { brandColor, additionalHues } = inferBrandAndHues(histograms, rationale);
  const spacingBase = inferSpacingBase(histograms, rationale);
  const typeScale = inferTypeScale(histograms, rationale);
  const generateThemes = inferGenerateThemes(histograms, rationale);

  const advanced: AdvancedConfig = {};
  if (additionalHues.length > 0) advanced.color = { additionalHues };
  const typography = inferTypography(histograms, rationale);
  if (typography) advanced.typography = typography;

  return {
    options: { brandColor, spacingBase, typeScale, generateThemes },
    advanced,
    rationale,
  };
}

import * as p from "@clack/prompts";
import { generateSpacingPrimitives } from "../generators/spacing.js";
import {
  FONT_WEIGHTS,
  generateTypographyPrimitives,
  TYPE_SCALE_BALANCED,
  TYPE_SCALE_COMPACT,
  TYPE_SCALE_SPACIOUS,
  type TypeScaleStep,
} from "../generators/typography.js";
import type { PrimitiveToken } from "../types/tokens.js";
import type {
  AdvancedSpacingConfig,
  AdvancedTypographyConfig,
} from "../types/config.js";

export function runSpacingGeneration(
  base: 4 | 8,
  advanced?: AdvancedSpacingConfig,
): PrimitiveToken[] {
  const tokens = generateSpacingPrimitives(base);
  p.log.step(`Building spacing ramp from ${base}px base: ${tokens.length} steps`);

  if (advanced?.customValues && Object.keys(advanced.customValues).length > 0) {
    const applied: string[] = [];
    for (const token of tokens) {
      // Token path is ["spacing", "<pixels>"]; customValues key is
      // `space-<pixels>` — bridge the two naming schemes here so the
      // AdvancedConfig key stays stable even if generator token naming
      // evolves.
      const key = `space-${token.path[1]}`;
      const override = advanced.customValues[key];
      if (override !== undefined) {
        token.$value = `${override}px`;
        applied.push(`${key}=${override}px`);
      }
    }
    if (applied.length > 0) {
      p.log.info(`✓ Applied spacing overrides: ${applied.join(", ")}`);
    }
  }

  return tokens;
}

function scaleSteps(
  scale: "compact" | "balanced" | "spacious",
): readonly TypeScaleStep[] {
  if (scale === "compact") return TYPE_SCALE_COMPACT;
  if (scale === "balanced") return TYPE_SCALE_BALANCED;
  return TYPE_SCALE_SPACIOUS;
}

export function runTypographyGeneration(
  scale: "compact" | "balanced" | "spacious",
  advanced?: AdvancedTypographyConfig,
): PrimitiveToken[] {
  p.log.step(`Building "${scale}" type scale…`);
  const tokens = generateTypographyPrimitives(scale);

  if (advanced) {
    applyFontSizeOverrides(tokens, advanced.customSizes);
    applyFontWeightOverrides(tokens, advanced.customWeights);
    appendFontFamilyTokens(tokens, advanced.fontFamily);
    appendLineHeightTokens(tokens, advanced.lineHeight, scale);
    appendLetterSpacingTokens(tokens, advanced.letterSpacing);
  }

  const fontSizes = tokens.filter((t) => t.path[1] === "font-size");
  const fontWeights = tokens.filter((t) => t.path[1] === "font-weight");

  p.log.info(`✓ Type scale: ${fontSizes.length} sizes`);
  p.log.info(`✓ ${fontWeights.length} font weights`);
  p.log.info(`${tokens.length} typography primitives generated`);

  return tokens;
}

function applyFontSizeOverrides(
  tokens: PrimitiveToken[],
  overrides: Record<string, number> | undefined,
): void {
  if (!overrides) return;
  for (const token of tokens) {
    if (token.path[1] !== "font-size") continue;
    const label = token.path[2]!;
    const key = `font-size-${label}`;
    const override = overrides[key];
    if (override !== undefined) {
      token.$value = `${override}px`;
    }
  }
}

/**
 * CSS numeric font-weights the pipeline will honour — match the UI
 * validator in `advanced-typography.ts`. Keeping both in sync means an
 * override persisted from a prior session or hand-edited into
 * `quieto.config.json` can't slip through with e.g. `650` and produce a
 * weight CSS won't render correctly.
 */
const ALLOWED_FONT_WEIGHTS = new Set([
  100, 200, 300, 400, 500, 600, 700, 800, 900,
]);

function applyFontWeightOverrides(
  tokens: PrimitiveToken[],
  overrides: Record<string, number> | undefined,
): void {
  if (!overrides) return;
  for (const [key, value] of Object.entries(overrides)) {
    if (!ALLOWED_FONT_WEIGHTS.has(value)) {
      p.log.warn(
        `Skipping font-weight override "${key}=${value}" — only CSS numeric weights (100, 200, …, 900) are supported.`,
      );
      continue;
    }
    // Key shape: `font-weight-<role>`. Anything after the prefix is the role.
    const role = key.replace(/^font-weight-/, "");
    if (!role) continue;
    // Prefer updating an existing primitive (e.g. "semibold") so we don't
    // create duplicates when a user retypes the default role names.
    const existing = tokens.find(
      (t) =>
        t.path[0] === "typography" &&
        t.path[1] === "font-weight" &&
        t.path[2] === role,
    );
    if (existing) {
      existing.$value = String(value);
    } else {
      tokens.push({
        tier: "primitive",
        category: "typography",
        name: `typography.font-weight.${role}`,
        $type: "fontWeight",
        $value: String(value),
        path: ["typography", "font-weight", role],
      });
    }
  }
  void FONT_WEIGHTS;
}

function appendFontFamilyTokens(
  tokens: PrimitiveToken[],
  fontFamily: AdvancedTypographyConfig["fontFamily"],
): void {
  if (!fontFamily) return;
  for (const role of ["heading", "body", "mono"] as const) {
    const stack = fontFamily[role];
    if (!stack) continue;
    tokens.push({
      tier: "primitive",
      category: "typography",
      name: `typography.font-family.${role}`,
      $type: "fontFamily",
      $value: stack,
      path: ["typography", "font-family", role],
    });
  }
}

function appendLineHeightTokens(
  tokens: PrimitiveToken[],
  lineHeight: AdvancedTypographyConfig["lineHeight"],
  scale: "compact" | "balanced" | "spacious",
): void {
  if (!lineHeight) return;
  for (const role of ["heading", "body"] as const) {
    const value = lineHeight[role];
    if (value === undefined) continue;
    tokens.push({
      tier: "primitive",
      category: "typography",
      name: `typography.line-height.${role}`,
      $type: "number",
      $value: String(value),
      path: ["typography", "line-height", role],
    });
  }
  // `scale` is accepted for symmetry / future use (e.g. deriving defaults).
  void scale;
}

function appendLetterSpacingTokens(
  tokens: PrimitiveToken[],
  letterSpacing: AdvancedTypographyConfig["letterSpacing"],
): void {
  if (!letterSpacing) return;
  for (const role of ["heading", "body"] as const) {
    const value = letterSpacing[role];
    if (!value) continue;
    tokens.push({
      tier: "primitive",
      category: "typography",
      name: `typography.letter-spacing.${role}`,
      $type: "dimension",
      $value: value,
      path: ["typography", "letter-spacing", role],
    });
  }
}

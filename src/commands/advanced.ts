import * as p from "@clack/prompts";
import type { QuickStartOptions } from "../types.js";
import type { AdvancedConfig } from "../types/config.js";
import type { PriorContext } from "./modify.js";
import { collectAdvancedColor } from "./advanced-color.js";
import { collectAdvancedSpacing } from "./advanced-spacing.js";
import { collectAdvancedTypography } from "./advanced-typography.js";

/**
 * Dispatcher that walks the user through every category's advanced step and
 * aggregates their answers into a single {@link AdvancedConfig}.
 *
 * Intentionally thin: each category's authoring UI lives in its own module
 * (`advanced-color.ts`, `advanced-spacing.ts`, `advanced-typography.ts`) so
 * steps can be added/removed without touching the dispatcher. Order matches
 * the quick-start mental model (color → spacing → typography) for
 * consistency.
 *
 * Returns `undefined` (not an empty object) when the user opts out of every
 * category — that signals downstream code to treat the run as a pure
 * quick-start for config-writing purposes.
 */
export async function runAdvancedFlow(
  baseline: QuickStartOptions,
  priorContext: PriorContext | null,
): Promise<AdvancedConfig | undefined> {
  p.log.step("Advanced mode — step-by-step customization per category.");

  // --- Color ---
  p.log.step("Category 1/3: Color");
  const color = await collectAdvancedColor(priorContext);
  summarizeColor(color);

  // --- Spacing ---
  p.log.step("Category 2/3: Spacing");
  const spacing = await collectAdvancedSpacing(
    baseline.spacingBase,
    priorContext,
  );
  summarizeSpacing(spacing);

  // --- Typography ---
  p.log.step("Category 3/3: Typography");
  const typography = await collectAdvancedTypography(
    baseline.typeScale,
    priorContext,
  );
  summarizeTypography(typography);

  const advanced: AdvancedConfig = {};
  if (color) advanced.color = color;
  if (spacing) advanced.spacing = spacing;
  if (typography) advanced.typography = typography;

  if (Object.keys(advanced).length === 0) {
    p.log.info(
      "No advanced customizations selected — proceeding with defaults.",
    );
    return undefined;
  }

  return advanced;
}

function summarizeColor(
  color: AdvancedConfig["color"] | undefined,
): void {
  if (!color) {
    p.log.info("  No additional hues — primary + neutral ramps only.");
    return;
  }
  if (color.additionalHues.length === 0) {
    p.log.info("  Cleared all previous additional hues.");
    return;
  }
  const summary = color.additionalHues
    .map((h) => `${h.name} (${h.seed})`)
    .join(", ");
  p.log.info(`  Additional hues: ${summary}`);
}

function summarizeSpacing(
  spacing: AdvancedConfig["spacing"] | undefined,
): void {
  if (!spacing) {
    p.log.info("  No spacing overrides — keeping the preset ramp.");
    return;
  }
  const entries = Object.entries(spacing.customValues);
  if (entries.length === 0) {
    p.log.info("  Cleared all previous spacing overrides.");
    return;
  }
  const summary = entries.map(([k, v]) => `${k}=${v}`).join(", ");
  p.log.info(`  Spacing overrides: ${summary}`);
}

function summarizeTypography(
  typography: AdvancedConfig["typography"] | undefined,
): void {
  if (!typography) {
    p.log.info("  No typography overrides — keeping the preset scale.");
    return;
  }
  const parts: string[] = [];
  if (typography.fontFamily) {
    parts.push(
      `font families (${Object.keys(typography.fontFamily).join(", ")})`,
    );
  }
  if (typography.customSizes) {
    parts.push(
      `${Object.keys(typography.customSizes).length} size override(s)`,
    );
  }
  if (typography.customWeights) {
    parts.push(
      `${Object.keys(typography.customWeights).length} weight override(s)`,
    );
  }
  if (typography.lineHeight) parts.push("line-heights");
  if (typography.letterSpacing) parts.push("letter-spacing");
  p.log.info(
    parts.length > 0 ? `  Typography: ${parts.join(", ")}` : "  No changes.",
  );
}

import * as p from "@clack/prompts";
import { generateSpacingPrimitives } from "../generators/spacing.js";
import { generateTypographyPrimitives } from "../generators/typography.js";
import type { PrimitiveToken } from "../types/tokens.js";

export function runSpacingGeneration(base: 4 | 8): PrimitiveToken[] {
  const tokens = generateSpacingPrimitives(base);
  p.log.step(`Building spacing ramp from ${base}px base: ${tokens.length} steps`);
  return tokens;
}

export function runTypographyGeneration(
  scale: "compact" | "balanced" | "spacious",
): PrimitiveToken[] {
  p.log.step(`Building "${scale}" type scale…`);
  const tokens = generateTypographyPrimitives(scale);
  const fontSizes = tokens.filter((t) => t.path[1] === "font-size");
  const fontWeights = tokens.filter((t) => t.path[1] === "font-weight");

  p.log.info(`✓ Type scale: ${fontSizes.length} sizes`);
  p.log.info(`✓ ${fontWeights.length} font weights`);
  p.log.info(`${tokens.length} typography primitives generated`);

  return tokens;
}

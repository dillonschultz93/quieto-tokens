import * as p from "@clack/prompts";
import {
  generateCustomRamp,
  generateNeutralRamp,
  generatePrimaryRamp,
} from "../generators/color.js";
import { colorRampToTokens } from "../types/tokens.js";
import type { PrimitiveToken } from "../types/tokens.js";
import type { AdvancedColorConfig } from "../types/config.js";

export async function runColorGeneration(
  brandHex: string,
  advanced?: AdvancedColorConfig,
): Promise<PrimitiveToken[]> {
  const allTokens: PrimitiveToken[] = [];

  p.log.step(`Generating primary color ramp from ${brandHex}…`);
  const primary = generatePrimaryRamp(brandHex);
  const primaryTokens = colorRampToTokens(primary);
  allTokens.push(...primaryTokens);
  p.log.info(
    `✓ ${capitalize(primary.hue)} ramp: ${primary.steps.length} steps`,
  );

  p.log.step("Generating neutral color ramp…");
  const neutral = generateNeutralRamp(brandHex);
  const neutralTokens = colorRampToTokens(neutral);
  allTokens.push(...neutralTokens);
  p.log.info(`✓ Neutral ramp: ${neutral.steps.length} steps`);

  if (advanced?.additionalHues.length) {
    // Guard against the user accidentally naming an extra hue after the
    // primary: the primary's name is derived from its hue angle, so
    // collisions are possible. Silently dropping the dupe would be worse
    // than warning and skipping — the user should know.
    const existingHues = new Set<string>();
    for (const token of allTokens) {
      existingHues.add(token.path[1]!);
    }

    for (const { name, seed } of advanced.additionalHues) {
      if (existingHues.has(name)) {
        p.log.warn(
          `Skipping additional hue "${name}" — it conflicts with an existing ramp name. Rename it to include it.`,
        );
        continue;
      }
      p.log.step(`Generating custom "${name}" ramp from ${seed}…`);
      const custom = generateCustomRamp(name, seed);
      const customTokens = colorRampToTokens(custom);
      allTokens.push(...customTokens);
      existingHues.add(name);
      p.log.info(`✓ ${capitalize(name)} ramp: ${custom.steps.length} steps`);
    }
  }

  p.log.info(`${allTokens.length} color primitives generated`);

  return allTokens;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

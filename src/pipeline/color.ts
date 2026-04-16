import * as p from "@clack/prompts";
import {
  generatePrimaryRamp,
  generateNeutralRamp,
} from "../generators/color.js";
import { colorRampToTokens } from "../types/tokens.js";
import type { PrimitiveToken } from "../types/tokens.js";

export async function runColorGeneration(
  brandHex: string,
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
  p.log.info(
    `✓ Neutral ramp: ${neutral.steps.length} steps`,
  );

  p.log.info(`${allTokens.length} color primitives generated`);

  return allTokens;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

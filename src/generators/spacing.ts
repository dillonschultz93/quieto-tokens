import type { PrimitiveToken } from "../types/tokens.js";

export const SPACING_RAMP_4 = [4, 8, 12, 16, 24, 32, 48, 64, 96] as const;
export const SPACING_RAMP_8 = [8, 16, 24, 32, 48, 64, 96, 128, 192] as const;

const RAMPS: Record<4 | 8, readonly number[]> = {
  4: SPACING_RAMP_4,
  8: SPACING_RAMP_8,
};

export function generateSpacingPrimitives(base: 4 | 8): PrimitiveToken[] {
  const ramp = RAMPS[base] as readonly number[] | undefined;
  if (!ramp) {
    throw new Error(`Unsupported spacing base: ${base}`);
  }
  return ramp.map((value) => ({
    tier: "primitive" as const,
    category: "spacing",
    name: `spacing.${value}`,
    $type: "dimension",
    $value: `${value}px`,
    path: ["spacing", String(value)],
  }));
}

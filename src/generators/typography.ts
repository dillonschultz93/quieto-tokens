import type { PrimitiveToken } from "../types/tokens.js";

export interface TypeScaleStep {
  label: string;
  value: number;
}

export const TYPE_SCALE_COMPACT: readonly TypeScaleStep[] = [
  { label: "xs", value: 12 },
  { label: "sm", value: 14 },
  { label: "base", value: 16 },
  { label: "lg", value: 18 },
  { label: "xl", value: 20 },
  { label: "2xl", value: 24 },
];

export const TYPE_SCALE_BALANCED: readonly TypeScaleStep[] = [
  { label: "xs", value: 12 },
  { label: "sm", value: 14 },
  { label: "base", value: 16 },
  { label: "lg", value: 20 },
  { label: "xl", value: 24 },
  { label: "2xl", value: 30 },
  { label: "3xl", value: 36 },
];

export const TYPE_SCALE_SPACIOUS: readonly TypeScaleStep[] = [
  { label: "sm", value: 14 },
  { label: "base", value: 16 },
  { label: "lg", value: 20 },
  { label: "xl", value: 24 },
  { label: "2xl", value: 32 },
  { label: "3xl", value: 40 },
  { label: "4xl", value: 48 },
];

export const FONT_WEIGHTS = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

const SCALES: Record<"compact" | "balanced" | "spacious", readonly TypeScaleStep[]> = {
  compact: TYPE_SCALE_COMPACT,
  balanced: TYPE_SCALE_BALANCED,
  spacious: TYPE_SCALE_SPACIOUS,
};

export function generateTypographyPrimitives(
  scale: "compact" | "balanced" | "spacious",
): PrimitiveToken[] {
  const steps = SCALES[scale] as readonly TypeScaleStep[] | undefined;
  if (!steps) {
    throw new Error(`Unknown type scale: ${scale}`);
  }

  const fontSizeTokens: PrimitiveToken[] = steps.map((step) => ({
    tier: "primitive" as const,
    category: "typography",
    name: `typography.font-size.${step.label}`,
    $type: "fontSize",
    $value: `${step.value}px`,
    path: ["typography", "font-size", step.label],
  }));

  const fontWeightTokens: PrimitiveToken[] = Object.entries(FONT_WEIGHTS).map(
    ([name, weight]) => ({
      tier: "primitive" as const,
      category: "typography",
      name: `typography.font-weight.${name}`,
      $type: "fontWeight",
      $value: String(weight),
      path: ["typography", "font-weight", name],
    }),
  );

  return [...fontSizeTokens, ...fontWeightTokens];
}

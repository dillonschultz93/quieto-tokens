import * as p from "@clack/prompts";
import type {
  PrimitiveToken,
  SemanticToken,
  SemanticMapping,
} from "../types/tokens.js";

export interface ColorMappingRule {
  property: "background" | "content" | "border";
  role: string;
  hue: "primary" | "neutral";
  step: number;
}

export interface TypographyRoleRule {
  role: string;
  fontSizeLabel: string;
  fontWeightName: string;
}

export const DEFAULT_COLOR_RULES: ColorMappingRule[] = [
  // default → neutral
  { property: "background", role: "default", hue: "neutral", step: 50 },
  { property: "content", role: "default", hue: "neutral", step: 900 },
  { property: "border", role: "default", hue: "neutral", step: 200 },
  // primary → primary hue
  { property: "background", role: "primary", hue: "primary", step: 500 },
  { property: "content", role: "primary", hue: "primary", step: 700 },
  { property: "border", role: "primary", hue: "primary", step: 500 },
  // secondary → neutral, offset from default
  { property: "background", role: "secondary", hue: "neutral", step: 100 },
  { property: "content", role: "secondary", hue: "neutral", step: 700 },
  { property: "border", role: "secondary", hue: "neutral", step: 300 },
  // danger → primary dark tones
  { property: "background", role: "danger", hue: "primary", step: 800 },
  { property: "content", role: "danger", hue: "primary", step: 900 },
  { property: "border", role: "danger", hue: "primary", step: 700 },
  // warning → neutral warm tones
  { property: "background", role: "warning", hue: "neutral", step: 200 },
  { property: "content", role: "warning", hue: "neutral", step: 800 },
  { property: "border", role: "warning", hue: "neutral", step: 400 },
  // success → primary lighter tones
  { property: "background", role: "success", hue: "primary", step: 200 },
  { property: "content", role: "success", hue: "primary", step: 800 },
  { property: "border", role: "success", hue: "primary", step: 400 },
  // info → primary light tones
  { property: "background", role: "info", hue: "primary", step: 100 },
  { property: "content", role: "info", hue: "primary", step: 800 },
  { property: "border", role: "info", hue: "primary", step: 300 },
];

export const DEFAULT_SPACING_INDEX_MAP: Record<string, number> = {
  xs: 0,
  sm: 1,
  md: 3,
  lg: 5,
  xl: 6,
  "2xl": 7,
};

export const DEFAULT_TYPOGRAPHY_ROLES: TypographyRoleRule[] = [
  { role: "headline", fontSizeLabel: "2xl", fontWeightName: "bold" },
  { role: "body", fontSizeLabel: "base", fontWeightName: "regular" },
  { role: "label", fontSizeLabel: "sm", fontWeightName: "medium" },
  { role: "meta", fontSizeLabel: "xs", fontWeightName: "regular" },
];

function detectPrimaryHue(colorPrimitives: PrimitiveToken[]): string {
  for (const t of colorPrimitives) {
    const hue = t.path[1];
    if (hue && hue !== "neutral") return hue;
  }
  return "neutral";
}

function resolveMappingRef(
  rule: ColorMappingRule,
  primaryHue: string,
): string {
  const hue = rule.hue === "primary" ? primaryHue : "neutral";
  return `{color.${hue}.${rule.step}}`;
}

export function mapColorSemantics(
  colorPrimitives: PrimitiveToken[],
): SemanticToken[] {
  const primaryHue = detectPrimaryHue(colorPrimitives);

  return DEFAULT_COLOR_RULES.map((rule) => ({
    tier: "semantic" as const,
    category: "color",
    name: `color.${rule.property}.${rule.role}`,
    $type: "color",
    $value: resolveMappingRef(rule, primaryHue),
    path: ["color", rule.property, rule.role],
  }));
}

export function mapSpacingSemantics(
  spacingPrimitives: PrimitiveToken[],
): SemanticToken[] {
  const sorted = [...spacingPrimitives].sort((a, b) => {
    const aVal = parseInt(a.path[1]!, 10);
    const bVal = parseInt(b.path[1]!, 10);
    return aVal - bVal;
  });

  return Object.entries(DEFAULT_SPACING_INDEX_MAP).map(([role, index]) => {
    const prim = sorted[index]!;
    const primValue = prim.path[1]!;
    return {
      tier: "semantic" as const,
      category: "spacing",
      name: `spacing.${role}`,
      $type: "dimension",
      $value: `{spacing.${primValue}}`,
      path: ["spacing", role],
    };
  });
}

export function mapTypographySemantics(
  typoPrimitives: PrimitiveToken[],
): SemanticToken[] {
  const fontSizes = typoPrimitives.filter((t) => t.path[1] === "font-size");
  const availableLabels = new Set(fontSizes.map((t) => t.path[2]));

  const tokens: SemanticToken[] = [];

  for (const role of DEFAULT_TYPOGRAPHY_ROLES) {
    let sizeLabel = role.fontSizeLabel;
    if (!availableLabels.has(sizeLabel)) {
      sizeLabel = fontSizes[fontSizes.length - 1]?.path[2] ?? sizeLabel;
    }

    tokens.push({
      tier: "semantic" as const,
      category: "typography",
      name: `typography.${role.role}.font-size`,
      $type: "dimension",
      $value: `{typography.font-size.${sizeLabel}}`,
      path: ["typography", role.role, "font-size"],
    });

    tokens.push({
      tier: "semantic" as const,
      category: "typography",
      name: `typography.${role.role}.font-weight`,
      $type: "fontWeight",
      $value: `{typography.font-weight.${role.fontWeightName}}`,
      path: ["typography", role.role, "font-weight"],
    });
  }

  return tokens;
}

export function generateSemanticTokens(
  primitives: PrimitiveToken[],
): SemanticToken[] {
  p.log.step("Mapping primitives to semantic tokens…");

  const colorPrims = primitives.filter((t) => t.category === "color");
  const spacingPrims = primitives.filter((t) => t.category === "spacing");
  const typoPrims = primitives.filter((t) => t.category === "typography");

  const colorTokens = mapColorSemantics(colorPrims);
  p.log.info(`✓ ${colorTokens.length} semantic color tokens`);

  const spacingTokens = mapSpacingSemantics(spacingPrims);
  p.log.info(`✓ ${spacingTokens.length} semantic spacing tokens`);

  const typoTokens = mapTypographySemantics(typoPrims);
  p.log.info(`✓ ${typoTokens.length} semantic typography tokens`);

  const all = [...colorTokens, ...spacingTokens, ...typoTokens];
  p.log.info(`${all.length} semantic tokens generated`);

  return all;
}

import type {
  PrimitiveToken,
  SemanticToken,
  ThemeCollection,
} from "../tokens.js";

export function makeColorPrimitive(
  hue: string,
  step: number,
  hex: string,
): PrimitiveToken {
  return {
    tier: "primitive",
    category: "color",
    name: `color.${hue}.${step}`,
    $type: "color",
    $value: hex,
    path: ["color", hue, String(step)],
  };
}

export function makeSpacingPrimitive(value: number): PrimitiveToken {
  return {
    tier: "primitive",
    category: "spacing",
    name: `spacing.${value}`,
    $type: "dimension",
    $value: `${value}px`,
    path: ["spacing", String(value)],
  };
}

export function makeTypoPrimitive(
  sub: string,
  label: string,
  value: string,
  $type: string,
): PrimitiveToken {
  return {
    tier: "primitive",
    category: "typography",
    name: `typography.${sub}.${label}`,
    $type,
    $value: value,
    path: ["typography", sub, label],
  };
}

export function makeColorSemantic(
  property: string,
  role: string,
  ref: string,
): SemanticToken {
  return {
    tier: "semantic",
    category: "color",
    name: `color.${property}.${role}`,
    $type: "color",
    $value: ref,
    path: ["color", property, role],
  };
}

export function makeSpacingSemantic(role: string, ref: string): SemanticToken {
  return {
    tier: "semantic",
    category: "spacing",
    name: `spacing.${role}`,
    $type: "dimension",
    $value: ref,
    path: ["spacing", role],
  };
}

export function samplePrimitives(): PrimitiveToken[] {
  return [
    makeColorPrimitive("blue", 400, "#60A5FA"),
    makeColorPrimitive("blue", 500, "#3B82F6"),
    makeColorPrimitive("neutral", 50, "#F9FAFB"),
    makeColorPrimitive("neutral", 900, "#111827"),
    makeSpacingPrimitive(4),
    makeSpacingPrimitive(16),
    makeTypoPrimitive("font-size", "base", "16px", "dimension"),
    makeTypoPrimitive("font-weight", "regular", "400", "fontWeight"),
  ];
}

export function sampleSemantics(): SemanticToken[] {
  return [
    makeColorSemantic("background", "primary", "{color.blue.500}"),
    makeColorSemantic("content", "default", "{color.neutral.900}"),
    makeSpacingSemantic("md", "{spacing.16}"),
  ];
}

export function sampleCollection(themeNames: string[]): ThemeCollection {
  const semantics = sampleSemantics();
  return {
    primitives: samplePrimitives(),
    themes: themeNames.map((name) => ({ name, semanticTokens: semantics })),
  };
}

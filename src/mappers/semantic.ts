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

/**
 * Map a shadow primitive ramp to the canonical three-role semantic set
 * (`low / medium / high`). Picks the first step for low, the middle step
 * for medium, the last step for high. If the ramp has fewer than three
 * steps the roles collapse onto whichever primitives are available — no
 * crash, documented in the Dev Notes.
 */
export function mapShadowSemantics(
  shadowPrimitives: PrimitiveToken[],
): SemanticToken[] {
  if (shadowPrimitives.length === 0) return [];

  const sorted = [...shadowPrimitives].sort(sortByNumericTail);

  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const mid = sorted[lowerMiddleIndex(sorted.length)] ?? first;

  const makeRef = (t: PrimitiveToken): string =>
    `{shadow.elevation.${t.path[2]}}`;

  const roles: Array<[string, PrimitiveToken]> = [
    ["low", first],
    ["medium", mid],
    ["high", last],
  ];

  return roles.map(([role, prim]) => ({
    tier: "semantic" as const,
    category: "shadow",
    name: `shadow.elevation.${role}`,
    $type: "shadow",
    $value: makeRef(prim),
    path: ["shadow", "elevation", role],
  }));
}

/**
 * Map a border primitive ramp to canonical semantic roles. The ramp is
 * assumed to have two sub-ramps (`width.*` and `radius.*`); the mapper
 * reads each independently. If either sub-ramp is shorter than expected
 * the roles collapse onto available primitives — identical policy to
 * {@link mapShadowSemantics}.
 *
 * Width roles: `default` (thinnest), `emphasis` (second, falls back to first).
 * Radius roles: `sm` (first), `md` (middle), `lg` (second-to-last), `pill` (last).
 */
export function mapBorderSemantics(
  borderPrimitives: PrimitiveToken[],
): SemanticToken[] {
  const widths = borderPrimitives.filter((t) => t.path[1] === "width");
  const radii = borderPrimitives.filter((t) => t.path[1] === "radius");

  const sortedWidths = [...widths].sort(sortByNumericTail);
  const sortedRadii = [...radii].sort(sortByNumericTail);

  const tokens: SemanticToken[] = [];

  if (sortedWidths.length > 0) {
    const thinnest = sortedWidths[0]!;
    const emphasis = sortedWidths[1] ?? thinnest;
    tokens.push(makeBorderRole("width", "default", thinnest));
    tokens.push(makeBorderRole("width", "emphasis", emphasis));
  }

  if (sortedRadii.length > 0) {
    // Short-ramp collapse: when the ramp has fewer primitives than
    // canonical radius roles (sm, md, lg, pill) we collapse roles
    // *toward the smallest available primitive* rather than letting
    // `secondToLast` fall onto `last` and silently alias `lg` to the
    // pill. This keeps `md` and `lg` pointing at a real literal radius
    // instead of a sentinel value like `9999px`.
    const first = sortedRadii[0]!;
    const last = sortedRadii[sortedRadii.length - 1]!;
    switch (sortedRadii.length) {
      case 1: {
        tokens.push(makeBorderRole("radius", "sm", first));
        tokens.push(makeBorderRole("radius", "md", first));
        tokens.push(makeBorderRole("radius", "lg", first));
        tokens.push(makeBorderRole("radius", "pill", first));
        break;
      }
      case 2: {
        // [a, b]: sm=a, md=a, lg=a, pill=b
        tokens.push(makeBorderRole("radius", "sm", first));
        tokens.push(makeBorderRole("radius", "md", first));
        tokens.push(makeBorderRole("radius", "lg", first));
        tokens.push(makeBorderRole("radius", "pill", last));
        break;
      }
      case 3: {
        // [a, b, c]: sm=a, md=b, lg=b, pill=c
        const middle = sortedRadii[1]!;
        tokens.push(makeBorderRole("radius", "sm", first));
        tokens.push(makeBorderRole("radius", "md", middle));
        tokens.push(makeBorderRole("radius", "lg", middle));
        tokens.push(makeBorderRole("radius", "pill", last));
        break;
      }
      default: {
        const mid = sortedRadii[lowerMiddleIndex(sortedRadii.length)]!;
        const secondToLast = sortedRadii[sortedRadii.length - 2]!;
        tokens.push(makeBorderRole("radius", "sm", first));
        tokens.push(makeBorderRole("radius", "md", mid));
        tokens.push(makeBorderRole("radius", "lg", secondToLast));
        tokens.push(makeBorderRole("radius", "pill", last));
        break;
      }
    }
  }

  return tokens;
}

function sortByNumericTail(a: PrimitiveToken, b: PrimitiveToken): number {
  // Tokens whose numeric tail is unparseable sort *after* all well-formed
  // entries so the first / middle / last picks below still land on the
  // literal ramp. Using `Number.MAX_SAFE_INTEGER` as the fallback
  // preserves stable sort order for multiple unparseable entries.
  const av = Number.parseInt(a.path[2] ?? "", 10);
  const bv = Number.parseInt(b.path[2] ?? "", 10);
  const left = Number.isFinite(av) ? av : Number.MAX_SAFE_INTEGER;
  const right = Number.isFinite(bv) ? bv : Number.MAX_SAFE_INTEGER;
  return left - right;
}

/**
 * "Lower middle" index — for length 4 picks index 1, for length 5 picks
 * index 2, etc. Unified across every new-category mapper in Story 2.2
 * so shadow, border, and animation all agree on what "medium" means
 * when the ramp length is even.
 */
function lowerMiddleIndex(length: number): number {
  return Math.max(0, Math.floor((length - 1) / 2));
}

function makeBorderRole(
  sub: "width" | "radius",
  role: string,
  prim: PrimitiveToken,
): SemanticToken {
  return {
    tier: "semantic",
    category: "border",
    name: `border.${sub}.${role}`,
    $type: "dimension",
    $value: `{border.${sub}.${prim.path[2]}}`,
    path: ["border", sub, role],
  };
}

/**
 * Map an animation primitive ramp to canonical semantic roles. Duration
 * roles: `fast` (first), `medium` (middle), `slow` (last). Easing roles:
 * `default / enter / exit` each resolve to the like-named primitive.
 *
 * Same shrink-to-fit policy as the other mappers when the ramp is shorter
 * than expected.
 */
export function mapAnimationSemantics(
  animationPrimitives: PrimitiveToken[],
): SemanticToken[] {
  const durations = animationPrimitives.filter((t) => t.path[1] === "duration");
  const eases = animationPrimitives.filter((t) => t.path[1] === "easing");

  const sortedDurations = [...durations].sort(sortByNumericTail);

  const tokens: SemanticToken[] = [];

  if (sortedDurations.length > 0) {
    const first = sortedDurations[0]!;
    const last = sortedDurations[sortedDurations.length - 1]!;
    const mid =
      sortedDurations[lowerMiddleIndex(sortedDurations.length)] ?? first;
    for (const [role, prim] of [
      ["fast", first],
      ["medium", mid],
      ["slow", last],
    ] as const) {
      tokens.push({
        tier: "semantic",
        category: "animation",
        name: `animation.duration.${role}`,
        $type: "duration",
        $value: `{animation.duration.${prim.path[2]}}`,
        path: ["animation", "duration", role],
      });
    }
  }

  const findEase = (name: string): PrimitiveToken | undefined =>
    eases.find((t) => t.path[2] === name);

  for (const role of ["default", "enter", "exit"] as const) {
    const prim = findEase(role) ?? eases[0];
    if (!prim) continue;
    tokens.push({
      tier: "semantic",
      category: "animation",
      name: `animation.ease.${role}`,
      $type: "cubicBezier",
      $value: `{animation.easing.${prim.path[2]}}`,
      path: ["animation", "ease", role],
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

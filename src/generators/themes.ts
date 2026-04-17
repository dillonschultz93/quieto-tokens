import * as p from "@clack/prompts";
import type {
  PrimitiveToken,
  SemanticToken,
  Theme,
  ThemeCollection,
} from "../types/tokens.js";

// Canonical 10-step ramp (Story 1.10 dropped the 11th `950` step that was
// inherited from the exploratory @quieto/palettes contract). The neutral
// inversion below is a pure symmetric reversal; the primary inversion is a
// hand-tuned map that keeps vibrancy on dark backgrounds.
const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

function buildReversalMap(steps: readonly number[]): Record<number, number> {
  const map: Record<number, number> = {};
  const len = steps.length;
  for (let i = 0; i < len; i++) {
    map[steps[i]!] = steps[len - 1 - i]!;
  }
  return map;
}

export const NEUTRAL_STEP_INVERSION: Record<number, number> =
  buildReversalMap(STEPS);

// PRIMARY inversion: not a pure reversal. Design intent preserved from the
// original 11-step map — light steps push toward mid-range (not pitch-light)
// on dark backgrounds so the hue stays vibrant, and mid/dark steps pull toward
// the 300–400 band for readability against dark surfaces. Asymmetric by
// design (300 and 400 both map to 500; 600 and 700 both map to 300).
export const PRIMARY_STEP_INVERSION: Record<number, number> = {
  50: 900,
  100: 800,
  200: 700,
  300: 500,
  400: 500,
  500: 400,
  600: 300,
  700: 300,
  800: 200,
  900: 100,
};

const DTCG_REF_RE = /^\{color\.(\w+)\.(\d+)\}$/;

function invertColorRef(ref: string): string {
  const match = ref.match(DTCG_REF_RE);
  if (!match) return ref;

  const [, hue, stepStr] = match;
  const step = Number(stepStr);

  const isNeutral = hue === "neutral";
  const map = isNeutral ? NEUTRAL_STEP_INVERSION : PRIMARY_STEP_INVERSION;
  const inverted = map[step];

  if (inverted === undefined) return ref;

  return `{color.${hue}.${inverted}}`;
}

export function generateLightTheme(semanticTokens: SemanticToken[]): Theme {
  return { name: "light", semanticTokens };
}

export function generateDarkTheme(
  semanticTokens: SemanticToken[],
  primitives: PrimitiveToken[],
): Theme {
  void primitives;

  const darkTokens = semanticTokens.map((token) => {
    if (token.category !== "color") return token;

    return {
      ...token,
      $value: invertColorRef(token.$value),
    };
  });

  return { name: "dark", semanticTokens: darkTokens };
}

export function generateThemes(
  semanticTokens: SemanticToken[],
  primitives: PrimitiveToken[],
  enableDarkMode: boolean,
): ThemeCollection {
  if (!enableDarkMode) {
    p.log.step("Using default theme (light)");
    p.log.info(
      `Themes can be enabled later by re-running with light/dark generation`,
    );

    return {
      primitives,
      themes: [{ name: "default", semanticTokens }],
    };
  }

  p.log.step("Generating light theme…");
  const light = generateLightTheme(semanticTokens);
  const lightColorCount = light.semanticTokens.filter(
    (t) => t.category === "color",
  ).length;
  p.log.info(
    `✓ Light theme: ${light.semanticTokens.length} semantic tokens (${lightColorCount} color)`,
  );

  p.log.step("Generating dark theme…");
  const dark = generateDarkTheme(semanticTokens, primitives);
  const darkColorCount = dark.semanticTokens.filter(
    (t) => t.category === "color",
  ).length;
  p.log.info(
    `✓ Dark theme: ${dark.semanticTokens.length} semantic tokens (${darkColorCount} color inverted)`,
  );

  return {
    primitives,
    themes: [light, dark],
  };
}

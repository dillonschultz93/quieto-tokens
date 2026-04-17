import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrimitiveToken, SemanticToken } from "../../types/tokens.js";
import type { Theme, ThemeCollection } from "../../types/tokens.js";
import {
  generateLightTheme,
  generateDarkTheme,
  generateThemes,
  NEUTRAL_STEP_INVERSION,
  PRIMARY_STEP_INVERSION,
} from "../themes.js";

vi.mock("@clack/prompts", () => ({
  log: {
    step: vi.fn(),
    info: vi.fn(),
  },
}));

function makeColorPrimitive(hue: string, step: number): PrimitiveToken {
  return {
    tier: "primitive",
    category: "color",
    name: `color.${hue}.${step}`,
    $type: "color",
    $value: `#000000`,
    path: ["color", hue, String(step)],
  };
}

function makeSpacingPrimitive(value: number): PrimitiveToken {
  return {
    tier: "primitive",
    category: "spacing",
    name: `spacing.${value}`,
    $type: "dimension",
    $value: `${value}px`,
    path: ["spacing", String(value)],
  };
}

function makeTypoPrimitive(
  sub: "font-size" | "font-weight",
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

function makeColorSemantic(
  property: string,
  role: string,
  hue: string,
  step: number,
): SemanticToken {
  return {
    tier: "semantic",
    category: "color",
    name: `color.${property}.${role}`,
    $type: "color",
    $value: `{color.${hue}.${step}}`,
    path: ["color", property, role],
  };
}

function makeSpacingSemantic(role: string, value: number): SemanticToken {
  return {
    tier: "semantic",
    category: "spacing",
    name: `spacing.${role}`,
    $type: "dimension",
    $value: `{spacing.${value}}`,
    path: ["spacing", role],
  };
}

function makeTypoSemantic(
  role: string,
  prop: string,
  ref: string,
  $type: string,
): SemanticToken {
  return {
    tier: "semantic",
    category: "typography",
    name: `typography.${role}.${prop}`,
    $type,
    $value: `{typography.${prop}.${ref}}`,
    path: ["typography", role, prop],
  };
}

const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
const BLUE_PRIMITIVES = STEPS.map((s) => makeColorPrimitive("blue", s));
const NEUTRAL_PRIMITIVES = STEPS.map((s) => makeColorPrimitive("neutral", s));
const ALL_COLOR_PRIMITIVES = [...BLUE_PRIMITIVES, ...NEUTRAL_PRIMITIVES];

const SPACING_PRIMITIVES = [4, 8, 12, 16, 24, 32, 48, 64, 96].map(
  makeSpacingPrimitive,
);

const TYPO_PRIMITIVES: PrimitiveToken[] = [
  makeTypoPrimitive("font-size", "xs", "12px", "dimension"),
  makeTypoPrimitive("font-size", "sm", "14px", "dimension"),
  makeTypoPrimitive("font-size", "base", "16px", "dimension"),
  makeTypoPrimitive("font-weight", "regular", "400", "fontWeight"),
  makeTypoPrimitive("font-weight", "bold", "700", "fontWeight"),
];

const ALL_PRIMITIVES = [
  ...ALL_COLOR_PRIMITIVES,
  ...SPACING_PRIMITIVES,
  ...TYPO_PRIMITIVES,
];

const LIGHT_COLOR_SEMANTICS: SemanticToken[] = [
  makeColorSemantic("background", "default", "neutral", 50),
  makeColorSemantic("content", "default", "neutral", 900),
  makeColorSemantic("border", "default", "neutral", 200),
  makeColorSemantic("background", "primary", "blue", 500),
  makeColorSemantic("content", "primary", "blue", 700),
  makeColorSemantic("border", "primary", "blue", 500),
];

const SPACING_SEMANTICS: SemanticToken[] = [
  makeSpacingSemantic("xs", 4),
  makeSpacingSemantic("md", 16),
];

const TYPO_SEMANTICS: SemanticToken[] = [
  makeTypoSemantic("body", "font-size", "base", "dimension"),
  makeTypoSemantic("body", "font-weight", "regular", "fontWeight"),
];

const ALL_SEMANTICS: SemanticToken[] = [
  ...LIGHT_COLOR_SEMANTICS,
  ...SPACING_SEMANTICS,
  ...TYPO_SEMANTICS,
];

describe("Theme type contract", () => {
  it("Theme has name and semanticTokens fields", () => {
    const theme: Theme = {
      name: "light",
      semanticTokens: [],
    };
    expect(theme.name).toBe("light");
    expect(theme.semanticTokens).toEqual([]);
  });
});

describe("ThemeCollection type contract", () => {
  it("ThemeCollection has primitives and themes fields", () => {
    const collection: ThemeCollection = {
      primitives: [],
      themes: [],
    };
    expect(collection.primitives).toEqual([]);
    expect(collection.themes).toEqual([]);
  });

  it("primitives are shared — not duplicated per theme", () => {
    const prims = ALL_PRIMITIVES;
    const collection: ThemeCollection = {
      primitives: prims,
      themes: [
        { name: "light", semanticTokens: ALL_SEMANTICS },
        { name: "dark", semanticTokens: ALL_SEMANTICS },
      ],
    };
    expect(collection.primitives).toBe(prims);
    expect(collection.themes).toHaveLength(2);
    expect(collection.themes[0]!.name).toBe("light");
    expect(collection.themes[1]!.name).toBe("dark");
  });
});

describe("NEUTRAL_STEP_INVERSION", () => {
  it("is a symmetric reversal of the 10-step ramp", () => {
    const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
    for (const step of steps) {
      const inverted = NEUTRAL_STEP_INVERSION[step]!;
      expect(steps).toContain(inverted);
      expect(NEUTRAL_STEP_INVERSION[inverted]).toBe(step);
    }
  });

  it("maps 50↔900, 100↔800, 200↔700, 300↔600, 400↔500", () => {
    expect(NEUTRAL_STEP_INVERSION[50]).toBe(900);
    expect(NEUTRAL_STEP_INVERSION[900]).toBe(50);
    expect(NEUTRAL_STEP_INVERSION[100]).toBe(800);
    expect(NEUTRAL_STEP_INVERSION[800]).toBe(100);
    expect(NEUTRAL_STEP_INVERSION[200]).toBe(700);
    expect(NEUTRAL_STEP_INVERSION[300]).toBe(600);
    expect(NEUTRAL_STEP_INVERSION[400]).toBe(500);
    expect(NEUTRAL_STEP_INVERSION[500]).toBe(400);
  });

  it("does not define a 950 key (10-step ramp)", () => {
    expect(NEUTRAL_STEP_INVERSION[950]).toBeUndefined();
  });

  it("has exactly 10 keys — catches stray/unexpected additions", () => {
    expect(Object.keys(NEUTRAL_STEP_INVERSION)).toHaveLength(10);
  });
});

describe("PRIMARY_STEP_INVERSION", () => {
  it("maps all 10 valid steps to valid steps", () => {
    const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
    for (const step of steps) {
      expect(steps).toContain(PRIMARY_STEP_INVERSION[step]);
    }
  });

  it("maps 500→400 (lighter for vibrancy on dark backgrounds)", () => {
    expect(PRIMARY_STEP_INVERSION[500]).toBe(400);
  });

  it("maps 700→300 (light for readability on dark)", () => {
    expect(PRIMARY_STEP_INVERSION[700]).toBe(300);
  });

  it("does not define a 950 key", () => {
    expect(PRIMARY_STEP_INVERSION[950]).toBeUndefined();
  });

  it("has exactly 10 keys — catches stray/unexpected additions", () => {
    expect(Object.keys(PRIMARY_STEP_INVERSION)).toHaveLength(10);
  });
});

describe("generateLightTheme", () => {
  it("returns a Theme named 'light'", () => {
    const theme = generateLightTheme(ALL_SEMANTICS);
    expect(theme.name).toBe("light");
  });

  it("wraps the input semantics unchanged", () => {
    const theme = generateLightTheme(ALL_SEMANTICS);
    expect(theme.semanticTokens).toEqual(ALL_SEMANTICS);
  });

  it("preserves the original token count", () => {
    const theme = generateLightTheme(ALL_SEMANTICS);
    expect(theme.semanticTokens).toHaveLength(ALL_SEMANTICS.length);
  });
});

describe("generateDarkTheme", () => {
  let darkTheme: Theme;

  beforeEach(() => {
    vi.clearAllMocks();
    darkTheme = generateDarkTheme(ALL_SEMANTICS, ALL_PRIMITIVES);
  });

  it("returns a Theme named 'dark'", () => {
    expect(darkTheme.name).toBe("dark");
  });

  it("has the same number of semantic tokens as input", () => {
    expect(darkTheme.semanticTokens).toHaveLength(ALL_SEMANTICS.length);
  });

  it("inverts neutral background references (50→900)", () => {
    const bgDefault = darkTheme.semanticTokens.find(
      (t) => t.name === "color.background.default",
    );
    expect(bgDefault!.$value).toBe("{color.neutral.900}");
  });

  it("inverts neutral content references (900→50)", () => {
    const contentDefault = darkTheme.semanticTokens.find(
      (t) => t.name === "color.content.default",
    );
    expect(contentDefault!.$value).toBe("{color.neutral.50}");
  });

  it("inverts neutral border references (200→700)", () => {
    const borderDefault = darkTheme.semanticTokens.find(
      (t) => t.name === "color.border.default",
    );
    expect(borderDefault!.$value).toBe("{color.neutral.700}");
  });

  it("inverts primary background references (500→400)", () => {
    const bgPrimary = darkTheme.semanticTokens.find(
      (t) => t.name === "color.background.primary",
    );
    expect(bgPrimary!.$value).toBe("{color.blue.400}");
  });

  it("inverts primary content references (700→300)", () => {
    const contentPrimary = darkTheme.semanticTokens.find(
      (t) => t.name === "color.content.primary",
    );
    expect(contentPrimary!.$value).toBe("{color.blue.300}");
  });

  it("inverts primary border references (500→400)", () => {
    const borderPrimary = darkTheme.semanticTokens.find(
      (t) => t.name === "color.border.primary",
    );
    expect(borderPrimary!.$value).toBe("{color.blue.400}");
  });

  it("preserves DTCG reference syntax in dark tokens", () => {
    const colorTokens = darkTheme.semanticTokens.filter(
      (t) => t.category === "color",
    );
    for (const t of colorTokens) {
      expect(t.$value).toMatch(/^\{color\.\w+\.\d+\}$/);
    }
  });

  it("does NOT change spacing semantics", () => {
    const spacingTokens = darkTheme.semanticTokens.filter(
      (t) => t.category === "spacing",
    );
    const originalSpacing = ALL_SEMANTICS.filter(
      (t) => t.category === "spacing",
    );
    expect(spacingTokens).toEqual(originalSpacing);
  });

  it("does NOT change typography semantics", () => {
    const typoTokens = darkTheme.semanticTokens.filter(
      (t) => t.category === "typography",
    );
    const originalTypo = ALL_SEMANTICS.filter(
      (t) => t.category === "typography",
    );
    expect(typoTokens).toEqual(originalTypo);
  });

  it("all dark tokens still have tier 'semantic'", () => {
    for (const t of darkTheme.semanticTokens) {
      expect(t.tier).toBe("semantic");
    }
  });
});

describe("generateThemes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("with enableDarkMode=true returns a ThemeCollection with light+dark", () => {
    const collection = generateThemes(ALL_SEMANTICS, ALL_PRIMITIVES, true);
    expect(collection.themes).toHaveLength(2);
    expect(collection.themes[0]!.name).toBe("light");
    expect(collection.themes[1]!.name).toBe("dark");
  });

  it("with enableDarkMode=false returns a single 'default' theme", () => {
    const collection = generateThemes(ALL_SEMANTICS, ALL_PRIMITIVES, false);
    expect(collection.themes).toHaveLength(1);
    expect(collection.themes[0]!.name).toBe("default");
  });

  it("includes primitives in the collection", () => {
    const collection = generateThemes(ALL_SEMANTICS, ALL_PRIMITIVES, true);
    expect(collection.primitives).toBe(ALL_PRIMITIVES);
  });

  it("default theme (no dark mode) uses the original semantic mappings", () => {
    const collection = generateThemes(ALL_SEMANTICS, ALL_PRIMITIVES, false);
    expect(collection.themes[0]!.semanticTokens).toEqual(ALL_SEMANTICS);
  });

  it("light and dark themes reference same primitive palette", () => {
    const collection = generateThemes(ALL_SEMANTICS, ALL_PRIMITIVES, true);
    const lightRefs = collection.themes[0]!.semanticTokens
      .filter((t) => t.category === "color")
      .map((t) => t.$value.match(/\{color\.(\w+)\./)?.[1])
      .filter(Boolean);
    const darkRefs = collection.themes[1]!.semanticTokens
      .filter((t) => t.category === "color")
      .map((t) => t.$value.match(/\{color\.(\w+)\./)?.[1])
      .filter(Boolean);

    const lightHues = new Set(lightRefs);
    const darkHues = new Set(darkRefs);
    expect(lightHues).toEqual(darkHues);
  });

  it("narrates theme generation via Clack when dark mode enabled", async () => {
    const clack = await import("@clack/prompts");
    generateThemes(ALL_SEMANTICS, ALL_PRIMITIVES, true);
    expect(clack.log.step).toHaveBeenCalledWith(
      expect.stringContaining("light theme"),
    );
    expect(clack.log.step).toHaveBeenCalledWith(
      expect.stringContaining("dark theme"),
    );
    expect(clack.log.info).toHaveBeenCalledWith(
      expect.stringContaining("Light theme"),
    );
    expect(clack.log.info).toHaveBeenCalledWith(
      expect.stringContaining("Dark theme"),
    );
  });

  it("narrates single default theme when dark mode disabled", async () => {
    const clack = await import("@clack/prompts");
    generateThemes(ALL_SEMANTICS, ALL_PRIMITIVES, false);
    expect(clack.log.step).toHaveBeenCalledWith(
      expect.stringContaining("default theme"),
    );
    expect(clack.log.info).toHaveBeenCalledWith(
      expect.stringContaining("enabled later"),
    );
  });
});

describe("Style Dictionary compatibility (Task 4)", () => {
  it("theme names are valid CSS identifiers for selectors", () => {
    const collection = generateThemes(ALL_SEMANTICS, ALL_PRIMITIVES, true);
    for (const theme of collection.themes) {
      expect(theme.name).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });

  it("default theme name is also a valid CSS identifier", () => {
    const collection = generateThemes(ALL_SEMANTICS, ALL_PRIMITIVES, false);
    expect(collection.themes[0]!.name).toMatch(/^[a-z][a-z0-9-]*$/);
  });

  it("ThemeCollection separates primitives from theme-scoped semantics", () => {
    const collection = generateThemes(ALL_SEMANTICS, ALL_PRIMITIVES, true);
    expect(collection.primitives.every((t) => t.tier === "primitive")).toBe(
      true,
    );
    for (const theme of collection.themes) {
      expect(
        theme.semanticTokens.every((t) => t.tier === "semantic"),
      ).toBe(true);
    }
  });

  it("each theme's semanticTokens retain path arrays for directory mapping", () => {
    const collection = generateThemes(ALL_SEMANTICS, ALL_PRIMITIVES, true);
    for (const theme of collection.themes) {
      for (const token of theme.semanticTokens) {
        expect(Array.isArray(token.path)).toBe(true);
        expect(token.path.length).toBeGreaterThan(0);
      }
    }
  });

  it("color tokens can be grouped by category for per-file output", () => {
    const collection = generateThemes(ALL_SEMANTICS, ALL_PRIMITIVES, true);
    const light = collection.themes[0]!;
    const categories = new Set(light.semanticTokens.map((t) => t.category));
    expect(categories).toContain("color");
    expect(categories).toContain("spacing");
    expect(categories).toContain("typography");
  });
});

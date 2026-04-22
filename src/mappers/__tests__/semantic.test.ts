import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrimitiveToken } from "../../types/tokens.js";
import type { SemanticToken, SemanticMapping } from "../../types/tokens.js";
import {
  mapAnimationSemantics,
  mapBorderSemantics,
  mapColorSemantics,
  mapShadowSemantics,
  mapSpacingSemantics,
  mapTypographySemantics,
  generateSemanticTokens,
  DEFAULT_COLOR_RULES,
  DEFAULT_SPACING_INDEX_MAP,
  DEFAULT_TYPOGRAPHY_ROLES,
} from "../semantic.js";

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

const BLUE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
const NEUTRAL_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

const BLUE_PRIMITIVES = BLUE_STEPS.map((s) => makeColorPrimitive("blue", s));
const NEUTRAL_PRIMITIVES = NEUTRAL_STEPS.map((s) =>
  makeColorPrimitive("neutral", s),
);
const ALL_COLOR_PRIMITIVES = [...BLUE_PRIMITIVES, ...NEUTRAL_PRIMITIVES];

const SPACING_4_VALUES = [4, 8, 12, 16, 24, 32, 48, 64, 96];
const SPACING_PRIMITIVES = SPACING_4_VALUES.map(makeSpacingPrimitive);

const TYPO_PRIMITIVES: PrimitiveToken[] = [
  makeTypoPrimitive("font-size", "xs", "12px", "dimension"),
  makeTypoPrimitive("font-size", "sm", "14px", "dimension"),
  makeTypoPrimitive("font-size", "base", "16px", "dimension"),
  makeTypoPrimitive("font-size", "lg", "20px", "dimension"),
  makeTypoPrimitive("font-size", "xl", "24px", "dimension"),
  makeTypoPrimitive("font-size", "2xl", "30px", "dimension"),
  makeTypoPrimitive("font-size", "3xl", "36px", "dimension"),
  makeTypoPrimitive("font-weight", "regular", "400", "fontWeight"),
  makeTypoPrimitive("font-weight", "medium", "500", "fontWeight"),
  makeTypoPrimitive("font-weight", "semibold", "600", "fontWeight"),
  makeTypoPrimitive("font-weight", "bold", "700", "fontWeight"),
];

describe("SemanticToken type contract", () => {
  it("mapColorSemantics returns SemanticToken[] with tier semantic", () => {
    const tokens = mapColorSemantics(ALL_COLOR_PRIMITIVES);
    for (const t of tokens) {
      expect(t.tier).toBe("semantic");
    }
  });
});

describe("mapColorSemantics", () => {
  let tokens: SemanticToken[];

  beforeEach(() => {
    vi.clearAllMocks();
    tokens = mapColorSemantics(ALL_COLOR_PRIMITIVES);
  });

  it("generates tokens for 3 properties × 7 roles = 21 tokens", () => {
    expect(tokens).toHaveLength(21);
  });

  it("all tokens have category 'color'", () => {
    for (const t of tokens) {
      expect(t.category).toBe("color");
    }
  });

  it("all tokens have $type 'color'", () => {
    for (const t of tokens) {
      expect(t.$type).toBe("color");
    }
  });

  it("$value uses DTCG reference syntax", () => {
    for (const t of tokens) {
      expect(t.$value).toMatch(/^\{color\.\w+\.\d+\}$/);
    }
  });

  it("generates background, content, border properties", () => {
    const properties = new Set(tokens.map((t) => t.path[1]));
    expect(properties).toEqual(
      new Set(["background", "content", "border"]),
    );
  });

  it("generates all 7 roles per property", () => {
    const bgTokens = tokens.filter((t) => t.path[1] === "background");
    const roles = bgTokens.map((t) => t.path[2]);
    expect(roles).toEqual(
      expect.arrayContaining([
        "default",
        "primary",
        "secondary",
        "danger",
        "warning",
        "success",
        "info",
      ]),
    );
  });

  it("default role references neutral ramp", () => {
    const defaultBg = tokens.find(
      (t) => t.path[1] === "background" && t.path[2] === "default",
    );
    expect(defaultBg!.$value).toMatch(/^\{color\.neutral\.\d+\}$/);
  });

  it("primary role references the primary hue ramp", () => {
    const primaryBg = tokens.find(
      (t) => t.path[1] === "background" && t.path[2] === "primary",
    );
    expect(primaryBg!.$value).toMatch(/^\{color\.blue\.\d+\}$/);
  });

  it("name follows color.<property>.<role> convention", () => {
    const first = tokens.find(
      (t) => t.path[1] === "background" && t.path[2] === "default",
    );
    expect(first!.name).toBe("color.background.default");
  });

  it("path follows ['color', property, role]", () => {
    const first = tokens.find(
      (t) => t.path[1] === "background" && t.path[2] === "default",
    );
    expect(first!.path).toEqual(["color", "background", "default"]);
  });
});

describe("mapSpacingSemantics", () => {
  let tokens: SemanticToken[];

  beforeEach(() => {
    vi.clearAllMocks();
    tokens = mapSpacingSemantics(SPACING_PRIMITIVES);
  });

  it("generates 6 semantic spacing tokens", () => {
    expect(tokens).toHaveLength(6);
  });

  it("all tokens have tier 'semantic' and category 'spacing'", () => {
    for (const t of tokens) {
      expect(t.tier).toBe("semantic");
      expect(t.category).toBe("spacing");
    }
  });

  it("all tokens have $type 'dimension'", () => {
    for (const t of tokens) {
      expect(t.$type).toBe("dimension");
    }
  });

  it("generates xs, sm, md, lg, xl, 2xl roles", () => {
    const roles = tokens.map((t) => t.path[1]);
    expect(roles).toEqual(["xs", "sm", "md", "lg", "xl", "2xl"]);
  });

  it("$value uses DTCG reference syntax", () => {
    for (const t of tokens) {
      expect(t.$value).toMatch(/^\{spacing\.\d+\}$/);
    }
  });

  it("md maps to a middle ramp value (16px for 4px base)", () => {
    const md = tokens.find((t) => t.path[1] === "md");
    expect(md!.$value).toBe("{spacing.16}");
  });

  it("name follows spacing.<role> convention", () => {
    expect(tokens[0]!.name).toBe("spacing.xs");
    expect(tokens[2]!.name).toBe("spacing.md");
  });

  it("path follows ['spacing', role]", () => {
    expect(tokens[0]!.path).toEqual(["spacing", "xs"]);
  });
});

describe("mapTypographySemantics", () => {
  let tokens: SemanticToken[];

  beforeEach(() => {
    vi.clearAllMocks();
    tokens = mapTypographySemantics(TYPO_PRIMITIVES);
  });

  it("generates 8 semantic typography tokens (4 roles × 2 properties)", () => {
    expect(tokens).toHaveLength(8);
  });

  it("all tokens have tier 'semantic' and category 'typography'", () => {
    for (const t of tokens) {
      expect(t.tier).toBe("semantic");
      expect(t.category).toBe("typography");
    }
  });

  it("generates headline, body, label, meta roles", () => {
    const roles = new Set(tokens.map((t) => t.path[1]));
    expect(roles).toEqual(new Set(["headline", "body", "label", "meta"]));
  });

  it("each role has font-size and font-weight properties", () => {
    const headlineTokens = tokens.filter((t) => t.path[1] === "headline");
    const props = headlineTokens.map((t) => t.path[2]);
    expect(props).toEqual(expect.arrayContaining(["font-size", "font-weight"]));
  });

  it("font-size $value uses DTCG reference to typography.font-size.*", () => {
    const fontSizeTokens = tokens.filter((t) => t.path[2] === "font-size");
    for (const t of fontSizeTokens) {
      expect(t.$value).toMatch(/^\{typography\.font-size\.\w+\}$/);
    }
  });

  it("font-weight $value uses DTCG reference to typography.font-weight.*", () => {
    const weightTokens = tokens.filter((t) => t.path[2] === "font-weight");
    for (const t of weightTokens) {
      expect(t.$value).toMatch(/^\{typography\.font-weight\.\w+\}$/);
    }
  });

  it("headline references bold weight", () => {
    const hw = tokens.find(
      (t) => t.path[1] === "headline" && t.path[2] === "font-weight",
    );
    expect(hw!.$value).toBe("{typography.font-weight.bold}");
  });

  it("body references regular weight", () => {
    const bw = tokens.find(
      (t) => t.path[1] === "body" && t.path[2] === "font-weight",
    );
    expect(bw!.$value).toBe("{typography.font-weight.regular}");
  });

  it("body references base font-size", () => {
    const bf = tokens.find(
      (t) => t.path[1] === "body" && t.path[2] === "font-size",
    );
    expect(bf!.$value).toBe("{typography.font-size.base}");
  });

  it("name follows typography.<role>.<property> convention", () => {
    const headline = tokens.find(
      (t) => t.path[1] === "headline" && t.path[2] === "font-size",
    );
    expect(headline!.name).toBe("typography.headline.font-size");
  });

  it("path follows ['typography', role, property]", () => {
    const headline = tokens.find(
      (t) => t.path[1] === "headline" && t.path[2] === "font-size",
    );
    expect(headline!.path).toEqual(["typography", "headline", "font-size"]);
  });
});

describe("generateSemanticTokens", () => {
  const ALL_PRIMITIVES = [
    ...ALL_COLOR_PRIMITIVES,
    ...SPACING_PRIMITIVES,
    ...TYPO_PRIMITIVES,
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns combined semantic tokens from all categories", () => {
    const tokens = generateSemanticTokens(ALL_PRIMITIVES);
    expect(tokens.length).toBe(21 + 6 + 8);
  });

  it("all tokens have tier 'semantic'", () => {
    const tokens = generateSemanticTokens(ALL_PRIMITIVES);
    for (const t of tokens) {
      expect(t.tier).toBe("semantic");
    }
  });

  it("outputs progress narrative via Clack", async () => {
    const clack = await import("@clack/prompts");
    generateSemanticTokens(ALL_PRIMITIVES);

    expect(clack.log.step).toHaveBeenCalledWith(
      expect.stringContaining("semantic"),
    );
    expect(clack.log.info).toHaveBeenCalledWith(
      expect.stringContaining("21 semantic color tokens"),
    );
    expect(clack.log.info).toHaveBeenCalledWith(
      expect.stringContaining("6 semantic spacing tokens"),
    );
    expect(clack.log.info).toHaveBeenCalledWith(
      expect.stringContaining("8 semantic typography tokens"),
    );
    expect(clack.log.info).toHaveBeenCalledWith(
      expect.stringContaining("35 semantic tokens"),
    );
  });
});

describe("DEFAULT_COLOR_RULES", () => {
  it("is a non-empty array of mapping rules", () => {
    expect(Array.isArray(DEFAULT_COLOR_RULES)).toBe(true);
    expect(DEFAULT_COLOR_RULES.length).toBeGreaterThan(0);
  });
});

describe("DEFAULT_SPACING_INDEX_MAP", () => {
  it("maps 6 t-shirt sizes to ramp indices", () => {
    expect(Object.keys(DEFAULT_SPACING_INDEX_MAP)).toEqual([
      "xs",
      "sm",
      "md",
      "lg",
      "xl",
      "2xl",
    ]);
  });
});

describe("DEFAULT_TYPOGRAPHY_ROLES", () => {
  it("is a non-empty array of role definitions", () => {
    expect(Array.isArray(DEFAULT_TYPOGRAPHY_ROLES)).toBe(true);
    expect(DEFAULT_TYPOGRAPHY_ROLES.length).toBe(4);
  });
});

function makeShadowPrimitive(step: number): PrimitiveToken {
  return {
    tier: "primitive",
    category: "shadow",
    name: `shadow.elevation.${step}`,
    $type: "shadow",
    $value: JSON.stringify({
      color: "{color.neutral.900}",
      offsetX: "0px",
      offsetY: `${step}px`,
      blur: `${step * 2}px`,
      spread: "0px",
    }),
    path: ["shadow", "elevation", String(step)],
  };
}

describe("mapShadowSemantics", () => {
  it("maps to low/medium/high using first/middle/last primitives", () => {
    const prims = [1, 2, 3, 4].map(makeShadowPrimitive);
    const result = mapShadowSemantics(prims);
    expect(result).toHaveLength(3);
    const byRole = Object.fromEntries(result.map((t) => [t.path[2], t]));
    expect(byRole.low!.$value).toBe("{shadow.elevation.1}");
    expect(byRole.medium!.$value).toBe("{shadow.elevation.2}");
    expect(byRole.high!.$value).toBe("{shadow.elevation.4}");
    for (const t of result) {
      expect(t.category).toBe("shadow");
      expect(t.tier).toBe("semantic");
      expect(t.$type).toBe("shadow");
    }
  });

  it("returns an empty list when no primitives are provided", () => {
    expect(mapShadowSemantics([])).toEqual([]);
  });

  it("collapses gracefully when fewer steps are available than roles", () => {
    const prims = [makeShadowPrimitive(1)];
    const result = mapShadowSemantics(prims);
    expect(result).toHaveLength(3);
    for (const t of result) {
      expect(t.$value).toBe("{shadow.elevation.1}");
    }
  });
});

function makeBorderPrimitive(
  sub: "width" | "radius",
  value: number,
  raw?: string,
): PrimitiveToken {
  return {
    tier: "primitive",
    category: "border",
    name: `border.${sub}.${value}`,
    $type: "dimension",
    $value: raw ?? `${value}px`,
    path: ["border", sub, String(value)],
  };
}

describe("mapBorderSemantics", () => {
  it("maps widths to default + emphasis (thinnest + next)", () => {
    const prims = [1, 2, 4, 8].map((v) => makeBorderPrimitive("width", v));
    const result = mapBorderSemantics(prims);
    const byName = Object.fromEntries(result.map((t) => [t.name, t]));
    expect(byName["border.width.default"]!.$value).toBe("{border.width.1}");
    expect(byName["border.width.emphasis"]!.$value).toBe("{border.width.2}");
  });

  it("maps radii to sm / md / lg / pill with pill = largest", () => {
    const prims = [2, 4, 8, 16, 999].map((v) =>
      makeBorderPrimitive("radius", v, v === 999 ? "9999px" : `${v}px`),
    );
    const result = mapBorderSemantics(prims);
    const byName = Object.fromEntries(result.map((t) => [t.name, t]));
    expect(byName["border.radius.sm"]!.$value).toBe("{border.radius.2}");
    expect(byName["border.radius.md"]!.$value).toBe("{border.radius.8}");
    expect(byName["border.radius.lg"]!.$value).toBe("{border.radius.16}");
    expect(byName["border.radius.pill"]!.$value).toBe("{border.radius.999}");
  });

  it("collapses roles when the ramp is too short to distinguish them", () => {
    const prims = [makeBorderPrimitive("width", 1)];
    const result = mapBorderSemantics(prims);
    const byName = Object.fromEntries(result.map((t) => [t.name, t]));
    expect(byName["border.width.emphasis"]!.$value).toBe(
      byName["border.width.default"]!.$value,
    );
  });

  it("emits nothing when no border primitives are provided", () => {
    expect(mapBorderSemantics([])).toEqual([]);
  });
});

function makeDuration(ms: number): PrimitiveToken {
  return {
    tier: "primitive",
    category: "animation",
    name: `animation.duration.${ms}`,
    $type: "duration",
    $value: `${ms}ms`,
    path: ["animation", "duration", String(ms)],
  };
}

function makeEase(name: string): PrimitiveToken {
  return {
    tier: "primitive",
    category: "animation",
    name: `animation.easing.${name}`,
    $type: "cubicBezier",
    $value: JSON.stringify([0, 0, 0, 0]),
    path: ["animation", "easing", name],
  };
}

describe("mapAnimationSemantics", () => {
  it("maps fast / medium / slow from first / middle / last duration", () => {
    const prims = [
      makeDuration(100),
      makeDuration(150),
      makeDuration(250),
      makeDuration(400),
      ...["default", "enter", "exit"].map(makeEase),
    ];
    const result = mapAnimationSemantics(prims);
    const byName = Object.fromEntries(result.map((t) => [t.name, t]));
    expect(byName["animation.duration.fast"]!.$value).toBe(
      "{animation.duration.100}",
    );
    // Lower-middle for even-length ramps (decision D4): index 1 of a
    // 4-entry ramp [100, 150, 250, 400] → 150. Unified with shadow +
    // border mappers.
    expect(byName["animation.duration.medium"]!.$value).toBe(
      "{animation.duration.150}",
    );
    expect(byName["animation.duration.slow"]!.$value).toBe(
      "{animation.duration.400}",
    );
  });

  it("maps default / enter / exit to the like-named ease primitives", () => {
    const prims = [
      makeDuration(100),
      ...["default", "enter", "exit"].map(makeEase),
    ];
    const result = mapAnimationSemantics(prims);
    const byName = Object.fromEntries(result.map((t) => [t.name, t]));
    expect(byName["animation.ease.default"]!.$value).toBe(
      "{animation.easing.default}",
    );
    expect(byName["animation.ease.enter"]!.$value).toBe(
      "{animation.easing.enter}",
    );
    expect(byName["animation.ease.exit"]!.$value).toBe(
      "{animation.easing.exit}",
    );
  });

  it("returns an empty list when no primitives are supplied", () => {
    expect(mapAnimationSemantics([])).toEqual([]);
  });
});

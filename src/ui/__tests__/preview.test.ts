import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  PrimitiveToken,
  SemanticToken,
  ThemeCollection,
} from "../../types/tokens.js";

vi.mock("@clack/prompts", () => ({
  log: {
    info: vi.fn(),
    step: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    message: vi.fn(),
  },
  confirm: vi.fn(),
  select: vi.fn(),
  isCancel: vi.fn(() => false),
  cancel: vi.fn(),
}));

function makeColorPrimitive(
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

const BLUE_PRIMITIVES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map(
  (s) => makeColorPrimitive("blue", s, `#${(s * 100).toString(16).padStart(6, "0")}`),
);
const NEUTRAL_PRIMITIVES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map(
  (s) => makeColorPrimitive("neutral", s, `#${(s * 100).toString(16).padStart(6, "0")}`),
);

const SPACING_PRIMITIVES = [4, 8, 12, 16, 24, 32, 48, 64].map(makeSpacingPrimitive);
const TYPO_PRIMITIVES: PrimitiveToken[] = [
  makeTypoPrimitive("font-size", "xs", "12px", "dimension"),
  makeTypoPrimitive("font-size", "sm", "14px", "dimension"),
  makeTypoPrimitive("font-size", "base", "16px", "dimension"),
  makeTypoPrimitive("font-weight", "regular", "400", "fontWeight"),
  makeTypoPrimitive("font-weight", "bold", "700", "fontWeight"),
];

const ALL_PRIMITIVES = [
  ...BLUE_PRIMITIVES,
  ...NEUTRAL_PRIMITIVES,
  ...SPACING_PRIMITIVES,
  ...TYPO_PRIMITIVES,
];

const COLOR_SEMANTICS: SemanticToken[] = [
  makeColorSemantic("background", "default", "neutral", 50),
  makeColorSemantic("content", "default", "neutral", 900),
  makeColorSemantic("border", "default", "neutral", 200),
  makeColorSemantic("background", "primary", "blue", 500),
  makeColorSemantic("content", "primary", "blue", 700),
  makeColorSemantic("border", "primary", "blue", 500),
];

const SPACING_SEMANTICS: SemanticToken[] = [
  makeSpacingSemantic("xs", 4),
  makeSpacingSemantic("sm", 8),
  makeSpacingSemantic("md", 16),
];

const TYPO_SEMANTICS: SemanticToken[] = [
  makeTypoSemantic("body", "font-size", "base", "dimension"),
  makeTypoSemantic("body", "font-weight", "regular", "fontWeight"),
];

const ALL_SEMANTICS = [...COLOR_SEMANTICS, ...SPACING_SEMANTICS, ...TYPO_SEMANTICS];

function makeCollection(themeCount: 1 | 2 = 2): ThemeCollection {
  if (themeCount === 1) {
    return {
      primitives: ALL_PRIMITIVES,
      themes: [{ name: "default", semanticTokens: ALL_SEMANTICS }],
    };
  }
  return {
    primitives: ALL_PRIMITIVES,
    themes: [
      { name: "light", semanticTokens: ALL_SEMANTICS },
      { name: "dark", semanticTokens: ALL_SEMANTICS },
    ],
  };
}

describe("renderPreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls Clack log methods to display token sections", async () => {
    const { renderPreview } = await import("../preview.js");
    const clack = await import("@clack/prompts");

    renderPreview(makeCollection());

    expect(clack.log.step).toHaveBeenCalled();
    expect(clack.log.info).toHaveBeenCalled();
  });

  it("displays section headers for color, spacing, typography primitives", async () => {
    const { renderPreview } = await import("../preview.js");
    const clack = await import("@clack/prompts");

    renderPreview(makeCollection());

    const allCalls = [
      ...(clack.log.step as ReturnType<typeof vi.fn>).mock.calls.map(
        (c: unknown[]) => c[0],
      ),
      ...(clack.log.info as ReturnType<typeof vi.fn>).mock.calls.map(
        (c: unknown[]) => c[0],
      ),
      ...(clack.log.message as ReturnType<typeof vi.fn>).mock.calls.map(
        (c: unknown[]) => c[0],
      ),
    ].join("\n");

    expect(allCalls).toMatch(/color/i);
    expect(allCalls).toMatch(/spacing/i);
    expect(allCalls).toMatch(/typography/i);
  });

  it("groups primitives by category", async () => {
    const { renderPreview } = await import("../preview.js");
    const clack = await import("@clack/prompts");

    renderPreview(makeCollection());

    const allOutput = [
      ...(clack.log.step as ReturnType<typeof vi.fn>).mock.calls.map(
        (c: unknown[]) => c[0],
      ),
      ...(clack.log.info as ReturnType<typeof vi.fn>).mock.calls.map(
        (c: unknown[]) => c[0],
      ),
      ...(clack.log.message as ReturnType<typeof vi.fn>).mock.calls.map(
        (c: unknown[]) => c[0],
      ),
    ].join("\n");

    expect(allOutput).toContain("blue");
    expect(allOutput).toContain("neutral");
  });

  it("shows semantic mappings per theme (light and dark headers)", async () => {
    const { renderPreview } = await import("../preview.js");
    const clack = await import("@clack/prompts");

    renderPreview(makeCollection(2));

    const allOutput = [
      ...(clack.log.step as ReturnType<typeof vi.fn>).mock.calls.map(
        (c: unknown[]) => c[0],
      ),
      ...(clack.log.info as ReturnType<typeof vi.fn>).mock.calls.map(
        (c: unknown[]) => c[0],
      ),
      ...(clack.log.message as ReturnType<typeof vi.fn>).mock.calls.map(
        (c: unknown[]) => c[0],
      ),
    ].join("\n");

    expect(allOutput).toMatch(/light/i);
    expect(allOutput).toMatch(/dark/i);
  });
});

describe("renderTokenCountSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("displays a formatted token count summary", async () => {
    const { renderTokenCountSummary } = await import("../preview.js");
    const clack = await import("@clack/prompts");

    renderTokenCountSummary(makeCollection());

    expect(clack.log.success).toHaveBeenCalled();
    const msg = (clack.log.success as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string;
    expect(msg).toMatch(/\d+ token records/);
    expect(msg).toMatch(/primitive/i);
    expect(msg).toMatch(/semantic/i);
    expect(msg).toMatch(/theme/i);
  });

  it("includes correct primitive count", async () => {
    const { renderTokenCountSummary } = await import("../preview.js");
    const clack = await import("@clack/prompts");

    const collection = makeCollection();
    renderTokenCountSummary(collection);

    const msg = (clack.log.success as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string;
    expect(msg).toContain(String(ALL_PRIMITIVES.length));
  });
});

describe("runOverrideFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty map when user accepts defaults", async () => {
    const clack = await import("@clack/prompts");
    (clack.confirm as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const { runOverrideFlow } = await import("../preview.js");
    const result = await runOverrideFlow(makeCollection());

    expect(result.overrides.size).toBe(0);
  });

  it("returns cancelled=true when user cancels", async () => {
    const clack = await import("@clack/prompts");
    (clack.confirm as ReturnType<typeof vi.fn>).mockResolvedValue(Symbol("cancel"));
    (clack.isCancel as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);

    const { runOverrideFlow } = await import("../preview.js");
    const result = await runOverrideFlow(makeCollection());

    expect(result.cancelled).toBe(true);
  });

  it("allows overriding a semantic token and records it in the map", async () => {
    const clack = await import("@clack/prompts");
    const confirmMock = clack.confirm as ReturnType<typeof vi.fn>;
    const selectMock = clack.select as ReturnType<typeof vi.fn>;
    const isCancelMock = clack.isCancel as unknown as ReturnType<typeof vi.fn>;

    isCancelMock.mockReturnValue(false);
    // First confirm: "no" (wants to override), second confirm: "yes" (accept after override)
    confirmMock.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    // Select category: "color-background", then select new value
    selectMock
      .mockResolvedValueOnce("color-background")
      .mockResolvedValueOnce("color.background.default")
      .mockResolvedValueOnce("{color.blue.500}");

    const { runOverrideFlow } = await import("../preview.js");
    const collection = makeCollection();
    const result = await runOverrideFlow(collection);

    expect(result.overrides.size).toBe(1);
    expect(result.overrides.get("color.background.default")).toBe("{color.blue.500}");
  });
});

describe("previewAndConfirm (full pipeline)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the collection and empty overrides when user accepts", async () => {
    const clack = await import("@clack/prompts");
    (clack.confirm as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (clack.isCancel as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const { previewAndConfirm } = await import("../preview.js");
    const collection = makeCollection();
    const result = await previewAndConfirm(collection);

    expect(result).not.toBeNull();
    expect(result!.collection).toBe(collection);
    expect(result!.overrides.size).toBe(0);
  });

  it("returns null when user cancels", async () => {
    const clack = await import("@clack/prompts");
    (clack.confirm as ReturnType<typeof vi.fn>).mockResolvedValue(Symbol("cancel"));
    (clack.isCancel as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);

    const { previewAndConfirm } = await import("../preview.js");
    const result = await previewAndConfirm(makeCollection());

    expect(result).toBeNull();
  });
});

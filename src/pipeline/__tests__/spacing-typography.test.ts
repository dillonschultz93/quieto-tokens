import { describe, it, expect, vi, beforeEach } from "vitest";
import { runSpacingGeneration } from "../spacing-typography.js";
import { runTypographyGeneration } from "../spacing-typography.js";
import type { PrimitiveToken } from "../../types/tokens.js";

vi.mock("@clack/prompts", () => ({
  log: {
    step: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("runSpacingGeneration", () => {
  let tokens: PrimitiveToken[];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 9 spacing tokens for 4px base", () => {
    tokens = runSpacingGeneration(4);
    expect(tokens).toHaveLength(9);
  });

  it("returns 9 spacing tokens for 8px base", () => {
    tokens = runSpacingGeneration(8);
    expect(tokens).toHaveLength(9);
  });

  it("all tokens have category 'spacing'", () => {
    tokens = runSpacingGeneration(4);
    for (const t of tokens) {
      expect(t.category).toBe("spacing");
    }
  });

  it("outputs progress narrative via Clack", async () => {
    const clack = await import("@clack/prompts");
    runSpacingGeneration(4);

    expect(clack.log.step).toHaveBeenCalledWith(
      expect.stringContaining("4px base: 9 steps"),
    );
  });

  it("applies custom-value overrides to matching spacing tokens", () => {
    tokens = runSpacingGeneration(4, {
      customValues: { "space-4": 20, "space-16": 18 },
    });
    const space4 = tokens.find((t) => t.path[1] === "4");
    const space16 = tokens.find((t) => t.path[1] === "16");
    expect(space4?.$value).toBe("20px");
    expect(space16?.$value).toBe("18px");
  });

  it("ignores custom-value keys for steps not in the current ramp", () => {
    // 4px base does not have a `space-192` step; override must silently drop.
    tokens = runSpacingGeneration(4, {
      customValues: { "space-192": 200 },
    });
    expect(tokens).toHaveLength(9);
    expect(tokens.some((t) => t.$value === "200px")).toBe(false);
  });
});

describe("runTypographyGeneration", () => {
  let tokens: PrimitiveToken[];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns font-size + font-weight tokens for balanced", () => {
    tokens = runTypographyGeneration("balanced");
    expect(tokens).toHaveLength(11);
  });

  it("returns font-size + font-weight tokens for compact", () => {
    tokens = runTypographyGeneration("compact");
    expect(tokens).toHaveLength(10);
  });

  it("returns font-size + font-weight tokens for spacious", () => {
    tokens = runTypographyGeneration("spacious");
    expect(tokens).toHaveLength(11);
  });

  it("all tokens have category 'typography'", () => {
    tokens = runTypographyGeneration("balanced");
    for (const t of tokens) {
      expect(t.category).toBe("typography");
    }
  });

  it("outputs progress narrative for type scale via Clack", async () => {
    const clack = await import("@clack/prompts");
    runTypographyGeneration("balanced");

    expect(clack.log.step).toHaveBeenCalledWith(
      expect.stringContaining("balanced"),
    );
    expect(clack.log.info).toHaveBeenCalledWith(
      expect.stringContaining("7 sizes"),
    );
    expect(clack.log.info).toHaveBeenCalledWith(
      expect.stringContaining("4 font weights"),
    );
  });

  it("reports total non-color primitive count", async () => {
    const clack = await import("@clack/prompts");
    runTypographyGeneration("balanced");

    expect(clack.log.info).toHaveBeenCalledWith(
      expect.stringContaining("11 typography primitives"),
    );
  });

  it("applies font-size overrides to existing tokens", () => {
    tokens = runTypographyGeneration("balanced", {
      customSizes: { "font-size-lg": 22, "font-size-2xl": 34 },
    });
    const lg = tokens.find((t) => t.path.join(".") === "typography.font-size.lg");
    const xxl = tokens.find((t) => t.path.join(".") === "typography.font-size.2xl");
    expect(lg?.$value).toBe("22px");
    expect(xxl?.$value).toBe("34px");
  });

  it("overrides existing font-weight tokens without duplicating them", () => {
    tokens = runTypographyGeneration("balanced", {
      customWeights: { "font-weight-semibold": 500 },
    });
    const semibolds = tokens.filter(
      (t) => t.path.join(".") === "typography.font-weight.semibold",
    );
    expect(semibolds).toHaveLength(1);
    expect(semibolds[0]!.$value).toBe("500");
  });

  it("skips non-CSS font-weight values with a narrated warning", async () => {
    const clack = await import("@clack/prompts");
    tokens = runTypographyGeneration("balanced", {
      customWeights: { "font-weight-semibold": 650, "font-weight-display": 800 },
    });
    const semibold = tokens.find(
      (t) => t.path.join(".") === "typography.font-weight.semibold",
    );
    // 650 is not a valid CSS numeric weight — default (600) must be kept.
    expect(semibold?.$value).toBe("600");
    // 800 IS valid; the new display role should have been appended.
    const display = tokens.find(
      (t) => t.path.join(".") === "typography.font-weight.display",
    );
    expect(display?.$value).toBe("800");
    expect(clack.log.warn).toHaveBeenCalledWith(
      expect.stringContaining("font-weight-semibold=650"),
    );
  });

  it("appends a new font-weight token for a custom role", () => {
    tokens = runTypographyGeneration("balanced", {
      customWeights: { "font-weight-display": 800 },
    });
    const display = tokens.find(
      (t) => t.path.join(".") === "typography.font-weight.display",
    );
    expect(display).toBeDefined();
    expect(display!.$value).toBe("800");
  });

  it("appends font-family tokens when provided", () => {
    tokens = runTypographyGeneration("balanced", {
      fontFamily: {
        heading: "'Inter', sans-serif",
        body: "'Inter', sans-serif",
      },
    });
    const heading = tokens.find(
      (t) => t.path.join(".") === "typography.font-family.heading",
    );
    const body = tokens.find(
      (t) => t.path.join(".") === "typography.font-family.body",
    );
    expect(heading?.$value).toBe("'Inter', sans-serif");
    expect(body?.$value).toBe("'Inter', sans-serif");
  });

  it("appends line-height tokens when provided", () => {
    tokens = runTypographyGeneration("balanced", {
      lineHeight: { heading: 1.2, body: 1.6 },
    });
    const heading = tokens.find(
      (t) => t.path.join(".") === "typography.line-height.heading",
    );
    expect(heading?.$value).toBe("1.2");
    expect(heading?.$type).toBe("number");
  });

  it("appends letter-spacing tokens when provided", () => {
    tokens = runTypographyGeneration("balanced", {
      letterSpacing: { heading: "-0.02em" },
    });
    const heading = tokens.find(
      (t) => t.path.join(".") === "typography.letter-spacing.heading",
    );
    expect(heading?.$value).toBe("-0.02em");
  });
});

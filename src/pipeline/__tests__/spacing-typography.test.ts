import { describe, it, expect, vi, beforeEach } from "vitest";
import { runSpacingGeneration } from "../spacing-typography.js";
import { runTypographyGeneration } from "../spacing-typography.js";
import type { PrimitiveToken } from "../../types/tokens.js";

vi.mock("@clack/prompts", () => ({
  log: {
    step: vi.fn(),
    info: vi.fn(),
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
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { runColorGeneration } from "../color.js";
import type { PrimitiveToken } from "../../types/tokens.js";

vi.mock("@clack/prompts", () => ({
  log: {
    step: vi.fn(),
    info: vi.fn(),
  },
}));

describe("runColorGeneration", () => {
  let tokens: PrimitiveToken[];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 22 primitive tokens for a valid brand color", async () => {
    tokens = await runColorGeneration("#3B82F6");
    expect(tokens).toHaveLength(22);
  });

  it("all tokens have tier 'primitive' and category 'color'", async () => {
    tokens = await runColorGeneration("#3B82F6");
    for (const t of tokens) {
      expect(t.tier).toBe("primitive");
      expect(t.category).toBe("color");
    }
  });

  it("first 11 tokens are the primary ramp (same hue)", async () => {
    tokens = await runColorGeneration("#3B82F6");
    const primaryTokens = tokens.slice(0, 11);
    const primaryHue = primaryTokens[0]!.path[1];
    for (const t of primaryTokens) {
      expect(t.path[1]).toBe(primaryHue);
    }
    expect(primaryHue).not.toBe("neutral");
  });

  it("last 11 tokens are the neutral ramp", async () => {
    tokens = await runColorGeneration("#3B82F6");
    const neutralTokens = tokens.slice(11);
    for (const t of neutralTokens) {
      expect(t.path[1]).toBe("neutral");
    }
  });

  it("outputs progress narrative via Clack", async () => {
    const clack = await import("@clack/prompts");
    await runColorGeneration("#3B82F6");

    expect(clack.log.step).toHaveBeenCalledWith(
      expect.stringContaining("#3B82F6"),
    );
    expect(clack.log.step).toHaveBeenCalledWith(
      expect.stringContaining("neutral"),
    );
    expect(clack.log.info).toHaveBeenCalledWith(
      expect.stringMatching(/ramp: 11 steps/),
    );
    expect(clack.log.info).toHaveBeenCalledWith(
      expect.stringContaining("Neutral ramp"),
    );
    expect(clack.log.info).toHaveBeenCalledWith(
      expect.stringContaining("22 color primitives generated"),
    );
  });

  it("tokens follow color.<hue>.<step> naming", async () => {
    tokens = await runColorGeneration("#5B21B6");
    for (const t of tokens) {
      expect(t.name).toMatch(/^color\.\w+\.\d+$/);
    }
  });
});

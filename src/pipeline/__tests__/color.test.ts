import { describe, it, expect, vi, beforeEach } from "vitest";
import { runColorGeneration } from "../color.js";
import type { PrimitiveToken } from "../../types/tokens.js";

vi.mock("@clack/prompts", () => ({
  log: {
    step: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("runColorGeneration", () => {
  let tokens: PrimitiveToken[];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 20 primitive tokens for a valid brand color", async () => {
    tokens = await runColorGeneration("#3B82F6");
    expect(tokens).toHaveLength(20);
  });

  it("all tokens have tier 'primitive' and category 'color'", async () => {
    tokens = await runColorGeneration("#3B82F6");
    for (const t of tokens) {
      expect(t.tier).toBe("primitive");
      expect(t.category).toBe("color");
    }
  });

  it("first 10 tokens are the primary ramp (same hue)", async () => {
    tokens = await runColorGeneration("#3B82F6");
    const primaryTokens = tokens.slice(0, 10);
    const primaryHue = primaryTokens[0]!.path[1];
    for (const t of primaryTokens) {
      expect(t.path[1]).toBe(primaryHue);
    }
    expect(primaryHue).not.toBe("neutral");
  });

  it("last 10 tokens are the neutral ramp", async () => {
    tokens = await runColorGeneration("#3B82F6");
    const neutralTokens = tokens.slice(10);
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
      expect.stringMatching(/ramp: 10 steps/),
    );
    expect(clack.log.info).toHaveBeenCalledWith(
      expect.stringContaining("Neutral ramp"),
    );
    expect(clack.log.info).toHaveBeenCalledWith(
      expect.stringContaining("20 color primitives generated"),
    );
  });

  it("tokens follow color.<hue>.<step> naming", async () => {
    tokens = await runColorGeneration("#5B21B6");
    for (const t of tokens) {
      expect(t.name).toMatch(/^color\.\w+\.\d+$/);
    }
  });

  it("appends additional hue ramps when advanced config supplies them", async () => {
    tokens = await runColorGeneration("#3B82F6", {
      additionalHues: [
        { name: "accent", seed: "#FF00AA" },
        { name: "error", seed: "#D12020" },
      ],
    });

    // 2 default ramps (10 each) + 2 additional ramps (10 each) = 40
    expect(tokens).toHaveLength(40);
    expect(tokens.some((t) => t.path[1] === "accent")).toBe(true);
    expect(tokens.some((t) => t.path[1] === "error")).toBe(true);
  });

  it("each additional ramp has 10 steps with the expected naming", async () => {
    tokens = await runColorGeneration("#3B82F6", {
      additionalHues: [{ name: "accent", seed: "#FF00AA" }],
    });

    const accentTokens = tokens.filter((t) => t.path[1] === "accent");
    expect(accentTokens).toHaveLength(10);
    for (const t of accentTokens) {
      expect(t.name).toMatch(/^color\.accent\.\d+$/);
    }
  });

  it("warns and skips an additional hue that collides with the primary ramp name", async () => {
    const clack = await import("@clack/prompts");
    // `#3B82F6` resolves to `"blue"` — adding another "blue" must be rejected.
    tokens = await runColorGeneration("#3B82F6", {
      additionalHues: [{ name: "blue", seed: "#1234AB" }],
    });

    expect(clack.log.warn).toHaveBeenCalledWith(
      expect.stringMatching(/conflicts/i),
    );
    // No extra ramp appended.
    expect(tokens).toHaveLength(20);
  });

  it("treats empty additionalHues list as a no-op", async () => {
    tokens = await runColorGeneration("#3B82F6", { additionalHues: [] });
    expect(tokens).toHaveLength(20);
  });
});

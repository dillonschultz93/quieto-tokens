import { describe, it, expect } from "vitest";
import { colorRampToTokens } from "../tokens.js";
import type { PrimitiveToken } from "../tokens.js";
import type { ColorRamp } from "../../generators/color.js";

const MOCK_RAMP: ColorRamp = {
  hue: "blue",
  steps: [
    { name: "color.blue.50", step: 50, hex: "#F0F4FF" },
    { name: "color.blue.100", step: 100, hex: "#D9E2FC" },
    { name: "color.blue.500", step: 500, hex: "#3B82F6" },
    { name: "color.blue.900", step: 900, hex: "#1E2A4A" },
  ],
};

describe("colorRampToTokens", () => {
  let tokens: PrimitiveToken[];

  it("converts every step to a PrimitiveToken", () => {
    tokens = colorRampToTokens(MOCK_RAMP);
    expect(tokens).toHaveLength(4);
  });

  it("sets tier to 'primitive'", () => {
    tokens = colorRampToTokens(MOCK_RAMP);
    for (const t of tokens) {
      expect(t.tier).toBe("primitive");
    }
  });

  it("sets category to 'color'", () => {
    tokens = colorRampToTokens(MOCK_RAMP);
    for (const t of tokens) {
      expect(t.category).toBe("color");
    }
  });

  it("sets $type to 'color'", () => {
    tokens = colorRampToTokens(MOCK_RAMP);
    for (const t of tokens) {
      expect(t.$type).toBe("color");
    }
  });

  it("uses the hex value as $value", () => {
    tokens = colorRampToTokens(MOCK_RAMP);
    expect(tokens[0]!.$value).toBe("#F0F4FF");
    expect(tokens[2]!.$value).toBe("#3B82F6");
  });

  it("builds a path of ['color', hue, step]", () => {
    tokens = colorRampToTokens(MOCK_RAMP);
    expect(tokens[0]!.path).toEqual(["color", "blue", "50"]);
    expect(tokens[3]!.path).toEqual(["color", "blue", "900"]);
  });

  it("preserves the dot-notation name from the ramp", () => {
    tokens = colorRampToTokens(MOCK_RAMP);
    expect(tokens[0]!.name).toBe("color.blue.50");
    expect(tokens[1]!.name).toBe("color.blue.100");
  });
});

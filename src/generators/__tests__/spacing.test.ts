import { describe, it, expect } from "vitest";
import {
  generateSpacingPrimitives,
  SPACING_RAMP_4,
  SPACING_RAMP_8,
} from "../spacing.js";
import type { PrimitiveToken } from "../../types/tokens.js";

describe("SPACING_RAMP_4", () => {
  it("contains 9 steps for the 4px base", () => {
    expect(SPACING_RAMP_4).toEqual([4, 8, 12, 16, 24, 32, 48, 64, 96]);
  });
});

describe("SPACING_RAMP_8", () => {
  it("contains 9 steps for the 8px base", () => {
    expect(SPACING_RAMP_8).toEqual([8, 16, 24, 32, 48, 64, 96, 128, 192]);
  });
});

describe("generateSpacingPrimitives", () => {
  describe("with 4px base", () => {
    let tokens: PrimitiveToken[];

    it("returns 9 tokens", () => {
      tokens = generateSpacingPrimitives(4);
      expect(tokens).toHaveLength(9);
    });

    it("all tokens have tier 'primitive' and category 'spacing'", () => {
      tokens = generateSpacingPrimitives(4);
      for (const t of tokens) {
        expect(t.tier).toBe("primitive");
        expect(t.category).toBe("spacing");
      }
    });

    it("all tokens have $type 'dimension'", () => {
      tokens = generateSpacingPrimitives(4);
      for (const t of tokens) {
        expect(t.$type).toBe("dimension");
      }
    });

    it("$value is the pixel string (e.g. '4px')", () => {
      tokens = generateSpacingPrimitives(4);
      expect(tokens[0]!.$value).toBe("4px");
      expect(tokens[3]!.$value).toBe("16px");
      expect(tokens[8]!.$value).toBe("96px");
    });

    it("path follows ['spacing', value] convention", () => {
      tokens = generateSpacingPrimitives(4);
      expect(tokens[0]!.path).toEqual(["spacing", "4"]);
      expect(tokens[3]!.path).toEqual(["spacing", "16"]);
    });

    it("name follows spacing.<value> convention", () => {
      tokens = generateSpacingPrimitives(4);
      expect(tokens[0]!.name).toBe("spacing.4");
      expect(tokens[3]!.name).toBe("spacing.16");
      expect(tokens[8]!.name).toBe("spacing.96");
    });
  });

  describe("with 8px base", () => {
    let tokens: PrimitiveToken[];

    it("returns 9 tokens from the 8px ramp", () => {
      tokens = generateSpacingPrimitives(8);
      expect(tokens).toHaveLength(9);
    });

    it("first token is 8px", () => {
      tokens = generateSpacingPrimitives(8);
      expect(tokens[0]!.$value).toBe("8px");
      expect(tokens[0]!.name).toBe("spacing.8");
    });

    it("last token is 192px", () => {
      tokens = generateSpacingPrimitives(8);
      expect(tokens[8]!.$value).toBe("192px");
      expect(tokens[8]!.name).toBe("spacing.192");
    });
  });
});

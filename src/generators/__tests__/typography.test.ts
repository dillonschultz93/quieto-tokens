import { describe, it, expect } from "vitest";
import {
  generateTypographyPrimitives,
  TYPE_SCALE_COMPACT,
  TYPE_SCALE_BALANCED,
  TYPE_SCALE_SPACIOUS,
  FONT_WEIGHTS,
} from "../typography.js";
import type { PrimitiveToken } from "../../types/tokens.js";

describe("TYPE_SCALE_COMPACT", () => {
  it("has 6 size steps", () => {
    expect(TYPE_SCALE_COMPACT).toHaveLength(6);
  });

  it("contains the expected values", () => {
    expect(TYPE_SCALE_COMPACT.map((s) => s.value)).toEqual([
      12, 14, 16, 18, 20, 24,
    ]);
  });
});

describe("TYPE_SCALE_BALANCED", () => {
  it("has 7 size steps", () => {
    expect(TYPE_SCALE_BALANCED).toHaveLength(7);
  });

  it("contains the expected values", () => {
    expect(TYPE_SCALE_BALANCED.map((s) => s.value)).toEqual([
      12, 14, 16, 20, 24, 30, 36,
    ]);
  });
});

describe("TYPE_SCALE_SPACIOUS", () => {
  it("has 7 size steps", () => {
    expect(TYPE_SCALE_SPACIOUS).toHaveLength(7);
  });

  it("contains the expected values", () => {
    expect(TYPE_SCALE_SPACIOUS.map((s) => s.value)).toEqual([
      14, 16, 20, 24, 32, 40, 48,
    ]);
  });
});

describe("FONT_WEIGHTS", () => {
  it("defines regular, medium, semibold, bold", () => {
    expect(FONT_WEIGHTS).toEqual({
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    });
  });
});

describe("generateTypographyPrimitives", () => {
  describe("compact scale", () => {
    let tokens: PrimitiveToken[];

    it("returns font-size + font-weight tokens", () => {
      tokens = generateTypographyPrimitives("compact");
      const fontSizes = tokens.filter((t) => t.path[1] === "font-size");
      const fontWeights = tokens.filter((t) => t.path[1] === "font-weight");
      expect(fontSizes).toHaveLength(6);
      expect(fontWeights).toHaveLength(4);
      expect(tokens).toHaveLength(10);
    });
  });

  describe("balanced scale", () => {
    let tokens: PrimitiveToken[];

    it("returns font-size + font-weight tokens", () => {
      tokens = generateTypographyPrimitives("balanced");
      const fontSizes = tokens.filter((t) => t.path[1] === "font-size");
      expect(fontSizes).toHaveLength(7);
      expect(tokens).toHaveLength(11);
    });
  });

  describe("spacious scale", () => {
    let tokens: PrimitiveToken[];

    it("returns font-size + font-weight tokens", () => {
      tokens = generateTypographyPrimitives("spacious");
      const fontSizes = tokens.filter((t) => t.path[1] === "font-size");
      expect(fontSizes).toHaveLength(7);
      expect(tokens).toHaveLength(11);
    });
  });

  describe("token structure", () => {
    let tokens: PrimitiveToken[];

    it("all tokens have tier 'primitive' and category 'typography'", () => {
      tokens = generateTypographyPrimitives("balanced");
      for (const t of tokens) {
        expect(t.tier).toBe("primitive");
        expect(t.category).toBe("typography");
      }
    });

    it("font-size tokens have $type 'dimension'", () => {
      tokens = generateTypographyPrimitives("balanced");
      const fontSizes = tokens.filter((t) => t.path[1] === "font-size");
      for (const t of fontSizes) {
        expect(t.$type).toBe("dimension");
      }
    });

    it("font-weight tokens have $type 'fontWeight'", () => {
      tokens = generateTypographyPrimitives("balanced");
      const fontWeights = tokens.filter((t) => t.path[1] === "font-weight");
      for (const t of fontWeights) {
        expect(t.$type).toBe("fontWeight");
      }
    });

    it("font-size $value is a pixel string", () => {
      tokens = generateTypographyPrimitives("balanced");
      const fontSizes = tokens.filter((t) => t.path[1] === "font-size");
      expect(fontSizes[0]!.$value).toBe("12px");
      expect(fontSizes[2]!.$value).toBe("16px");
    });

    it("font-weight $value is a numeric string", () => {
      tokens = generateTypographyPrimitives("balanced");
      const fontWeights = tokens.filter((t) => t.path[1] === "font-weight");
      const regular = fontWeights.find((t) => t.path[2] === "regular");
      expect(regular!.$value).toBe("400");
    });

    it("font-size path follows ['typography', 'font-size', label]", () => {
      tokens = generateTypographyPrimitives("balanced");
      const fontSizes = tokens.filter((t) => t.path[1] === "font-size");
      expect(fontSizes[0]!.path).toEqual(["typography", "font-size", "xs"]);
    });

    it("font-weight path follows ['typography', 'font-weight', name]", () => {
      tokens = generateTypographyPrimitives("balanced");
      const fontWeights = tokens.filter((t) => t.path[1] === "font-weight");
      expect(fontWeights[0]!.path).toEqual([
        "typography",
        "font-weight",
        "regular",
      ]);
    });

    it("font-size name follows typography.font-size.<label>", () => {
      tokens = generateTypographyPrimitives("balanced");
      const fontSizes = tokens.filter((t) => t.path[1] === "font-size");
      expect(fontSizes[0]!.name).toBe("typography.font-size.xs");
    });

    it("font-weight name follows typography.font-weight.<name>", () => {
      tokens = generateTypographyPrimitives("balanced");
      const fontWeights = tokens.filter((t) => t.path[1] === "font-weight");
      expect(fontWeights[0]!.name).toBe("typography.font-weight.regular");
      expect(fontWeights[3]!.name).toBe("typography.font-weight.bold");
    });
  });
});

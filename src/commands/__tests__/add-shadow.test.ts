import { describe, it, expect } from "vitest";
import {
  validateCustomColorRef,
  validateShadowLevels,
} from "../add-shadow.js";

describe("validateShadowLevels", () => {
  it("rejects empty / whitespace input", () => {
    expect(validateShadowLevels("")).toMatch(/number of elevation/i);
    expect(validateShadowLevels("   ")).toMatch(/number of elevation/i);
    expect(validateShadowLevels(undefined)).toMatch(/number of elevation/i);
  });

  it("rejects non-integer strings", () => {
    expect(validateShadowLevels("3.5")).toMatch(/whole number/i);
    expect(validateShadowLevels("abc")).toMatch(/whole number/i);
    expect(validateShadowLevels("-2")).toMatch(/whole number/i);
  });

  it("rejects values below the minimum", () => {
    expect(validateShadowLevels("0")).toMatch(/between 2 and 6/i);
    expect(validateShadowLevels("1")).toMatch(/between 2 and 6/i);
  });

  it("rejects values above the maximum", () => {
    expect(validateShadowLevels("7")).toMatch(/between 2 and 6/i);
    expect(validateShadowLevels("100")).toMatch(/between 2 and 6/i);
  });

  it("accepts the full permitted range", () => {
    for (const n of [2, 3, 4, 5, 6]) {
      expect(validateShadowLevels(String(n))).toBeUndefined();
    }
  });
});

describe("validateCustomColorRef", () => {
  it("rejects empty or malformed refs", () => {
    expect(validateCustomColorRef("")).toMatch(/DTCG color/i);
    expect(validateCustomColorRef(undefined)).toMatch(/DTCG color/i);
    expect(validateCustomColorRef("#112233")).toMatch(/color\.<hue>/);
    expect(validateCustomColorRef("{spacing.md}")).toMatch(/color\.<hue>/);
    expect(validateCustomColorRef("{color.neutral}")).toMatch(/color\.<hue>/);
  });

  it("accepts well-formed DTCG color refs", () => {
    expect(validateCustomColorRef("{color.neutral.900}")).toBeUndefined();
    expect(validateCustomColorRef("{color.brand.50}")).toBeUndefined();
    expect(validateCustomColorRef("{color.my-hue.500}")).toBeUndefined();
  });
});

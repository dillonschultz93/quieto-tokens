import { describe, it, expect } from "vitest";
import {
  parseSizeOverrideLine,
  parseWeightOverrideLine,
  validateFontFamily,
  validateLetterSpacing,
  validateLineHeight,
} from "../advanced-typography.js";

const BALANCED_LABELS = ["xs", "sm", "base", "lg", "xl", "2xl", "3xl"];

describe("parseSizeOverrideLine", () => {
  it("parses `font-size-lg=18`", () => {
    expect(parseSizeOverrideLine("font-size-lg=18", BALANCED_LABELS)).toEqual({
      ok: true,
      key: "font-size-lg",
      value: 18,
    });
  });

  it("accepts colon separator and px suffix", () => {
    expect(
      parseSizeOverrideLine("font-size-base : 17px", BALANCED_LABELS),
    ).toEqual({ ok: true, key: "font-size-base", value: 17 });
  });

  it("rejects unknown labels", () => {
    const result = parseSizeOverrideLine("font-size-giant=50", BALANCED_LABELS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Unknown size/);
  });

  it("rejects zero or negative values", () => {
    expect(parseSizeOverrideLine("font-size-lg=0", BALANCED_LABELS).ok).toBe(false);
    expect(parseSizeOverrideLine("font-size-lg=-4", BALANCED_LABELS).ok).toBe(false);
  });

  it("rejects malformed lines", () => {
    expect(parseSizeOverrideLine("font-size-lg", BALANCED_LABELS).ok).toBe(false);
    expect(parseSizeOverrideLine("lg=18", BALANCED_LABELS).ok).toBe(false);
  });
});

describe("parseWeightOverrideLine", () => {
  it("parses `font-weight-heading=700`", () => {
    expect(parseWeightOverrideLine("font-weight-heading=700")).toEqual({
      ok: true,
      key: "font-weight-heading",
      value: 700,
    });
  });

  it("accepts roles with hyphens/digits", () => {
    expect(parseWeightOverrideLine("font-weight-ui-label=500")).toEqual({
      ok: true,
      key: "font-weight-ui-label",
      value: 500,
    });
  });

  it("rejects non-standard numeric weights", () => {
    expect(parseWeightOverrideLine("font-weight-heading=650").ok).toBe(false);
    expect(parseWeightOverrideLine("font-weight-heading=99").ok).toBe(false);
    expect(parseWeightOverrideLine("font-weight-heading=1000").ok).toBe(false);
  });

  it("rejects malformed lines", () => {
    expect(parseWeightOverrideLine("heading=700").ok).toBe(false);
    expect(parseWeightOverrideLine("font-weight-=700").ok).toBe(false);
  });
});

describe("validateFontFamily", () => {
  it("accepts empty strings (interpreted as 'keep default')", () => {
    expect(validateFontFamily("")).toBeUndefined();
    expect(validateFontFamily("   ")).toBeUndefined();
    expect(validateFontFamily(undefined)).toBeUndefined();
  });

  it("accepts reasonable stacks", () => {
    expect(validateFontFamily("'Inter', system-ui, sans-serif")).toBeUndefined();
  });

  it("rejects stacks over 200 characters", () => {
    expect(validateFontFamily("a".repeat(201))).toMatch(/too long/);
  });
});

describe("validateLineHeight", () => {
  it("accepts null (empty input)", () => {
    expect(validateLineHeight(null)).toBeUndefined();
  });

  it("accepts 0 < value <= 3", () => {
    expect(validateLineHeight(1.2)).toBeUndefined();
    expect(validateLineHeight(1.5)).toBeUndefined();
    expect(validateLineHeight(3)).toBeUndefined();
  });

  it("rejects zero, negative, and > 3", () => {
    expect(validateLineHeight(0)).toMatch(/between 0 and 3/);
    expect(validateLineHeight(-1)).toMatch(/between 0 and 3/);
    expect(validateLineHeight(3.01)).toMatch(/between 0 and 3/);
  });
});

describe("validateLetterSpacing", () => {
  it("accepts em, rem, px lengths", () => {
    expect(validateLetterSpacing("-0.02em")).toBeUndefined();
    expect(validateLetterSpacing("0.5px")).toBeUndefined();
    expect(validateLetterSpacing("0.025rem")).toBeUndefined();
  });

  it("accepts empty strings", () => {
    expect(validateLetterSpacing("")).toBeUndefined();
    expect(validateLetterSpacing("   ")).toBeUndefined();
    expect(validateLetterSpacing(undefined)).toBeUndefined();
  });

  it("rejects unit-less numbers and unknown units", () => {
    expect(validateLetterSpacing("-0.02")).toMatch(/CSS length/);
    expect(validateLetterSpacing("1pt")).toMatch(/CSS length/);
  });
});

import { describe, it, expect } from "vitest";
import {
  relativeLuminance,
  contrastRatio,
  meetsWcagAA,
  formatContrastResult,
} from "../contrast.js";

describe("relativeLuminance", () => {
  it("returns 0 for black (#000000)", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 4);
  });

  it("returns 1 for white (#FFFFFF)", () => {
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 4);
  });

  it("returns ~0.2126 for pure red (#FF0000)", () => {
    expect(relativeLuminance("#FF0000")).toBeCloseTo(0.2126, 3);
  });

  it("returns ~0.7152 for pure green (#00FF00)", () => {
    expect(relativeLuminance("#00FF00")).toBeCloseTo(0.7152, 3);
  });

  it("returns ~0.0722 for pure blue (#0000FF)", () => {
    expect(relativeLuminance("#0000FF")).toBeCloseTo(0.0722, 3);
  });
});

describe("contrastRatio", () => {
  it("returns 21:1 for black on white", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
  });

  it("returns 1:1 for same color", () => {
    expect(contrastRatio("#3B82F6", "#3B82F6")).toBeCloseTo(1, 1);
  });

  it("is commutative — order of arguments does not matter", () => {
    const ab = contrastRatio("#3B82F6", "#FFFFFF");
    const ba = contrastRatio("#FFFFFF", "#3B82F6");
    expect(ab).toBeCloseTo(ba, 4);
  });

  it("returns a value >= 1 for any pair", () => {
    expect(contrastRatio("#123456", "#ABCDEF")).toBeGreaterThanOrEqual(1);
  });
});

describe("meetsWcagAA", () => {
  it("returns true for black on white (21:1)", () => {
    expect(meetsWcagAA("#000000", "#FFFFFF")).toBe(true);
  });

  it("returns false for low-contrast pair", () => {
    expect(meetsWcagAA("#777777", "#888888")).toBe(false);
  });

  it("uses 4.5:1 threshold by default", () => {
    expect(meetsWcagAA("#000000", "#FFFFFF")).toBe(true);
  });
});

describe("formatContrastResult", () => {
  it("formats a passing contrast ratio with checkmark", () => {
    const result = formatContrastResult("#000000", "#FFFFFF");
    expect(result).toContain("21");
    expect(result).toContain("✓");
    expect(result).toContain("AA");
  });

  it("formats a failing contrast ratio with X mark", () => {
    const result = formatContrastResult("#777777", "#888888");
    expect(result).toContain("✗");
    expect(result).toContain("AA");
  });

  it("includes the ratio value in X.X:1 format", () => {
    const result = formatContrastResult("#000000", "#FFFFFF");
    expect(result).toMatch(/\d+(\.\d+)?:1/);
  });
});

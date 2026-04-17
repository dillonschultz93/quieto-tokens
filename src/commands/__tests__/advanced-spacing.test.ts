import { describe, it, expect } from "vitest";
import { parseSpacingOverrideLine } from "../advanced-spacing.js";

const RAMP_4_KEYS = [
  "space-4",
  "space-8",
  "space-12",
  "space-16",
  "space-24",
  "space-32",
  "space-48",
  "space-64",
  "space-96",
];

describe("parseSpacingOverrideLine", () => {
  it("parses `space-4=20` into { key, value }", () => {
    expect(parseSpacingOverrideLine("space-4=20", RAMP_4_KEYS)).toEqual({
      ok: true,
      key: "space-4",
      value: 20,
    });
  });

  it("accepts colon separator and a `px` suffix", () => {
    expect(parseSpacingOverrideLine("space-8 : 18px", RAMP_4_KEYS)).toEqual({
      ok: true,
      key: "space-8",
      value: 18,
    });
  });

  it("accepts decimal values", () => {
    expect(parseSpacingOverrideLine("space-4=18.5", RAMP_4_KEYS)).toEqual({
      ok: true,
      key: "space-4",
      value: 18.5,
    });
  });

  it("rejects unknown keys with a helpful list", () => {
    const result = parseSpacingOverrideLine("space-999=12", RAMP_4_KEYS);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Unknown token/);
      expect(result.error).toContain("space-4");
    }
  });

  it("rejects non-numeric values", () => {
    const result = parseSpacingOverrideLine("space-4=potato", RAMP_4_KEYS);
    expect(result.ok).toBe(false);
  });

  it("rejects zero and negative values", () => {
    expect(parseSpacingOverrideLine("space-4=0", RAMP_4_KEYS).ok).toBe(false);
    expect(parseSpacingOverrideLine("space-4=-8", RAMP_4_KEYS).ok).toBe(false);
  });

  it("rejects empty lines", () => {
    expect(parseSpacingOverrideLine("", RAMP_4_KEYS).ok).toBe(false);
    expect(parseSpacingOverrideLine("   ", RAMP_4_KEYS).ok).toBe(false);
  });

  it("rejects lines without a separator", () => {
    expect(parseSpacingOverrideLine("space-4 20", RAMP_4_KEYS).ok).toBe(false);
  });
});

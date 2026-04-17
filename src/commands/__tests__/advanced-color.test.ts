import { describe, it, expect } from "vitest";
import { validateHueName } from "../advanced-color.js";

describe("validateHueName", () => {
  it("rejects empty or whitespace-only values", () => {
    expect(validateHueName("")).toMatch(/enter a name/i);
    expect(validateHueName("   ")).toMatch(/enter a name/i);
    expect(validateHueName(undefined)).toMatch(/enter a name/i);
  });

  it("rejects names over 32 characters", () => {
    expect(validateHueName("a".repeat(33))).toMatch(/32 characters/i);
  });

  it("rejects names with invalid characters", () => {
    expect(validateHueName("my color")).toMatch(/letters, numbers/i);
    expect(validateHueName("color!")).toMatch(/letters, numbers/i);
    expect(validateHueName("1color")).toMatch(/letters, numbers/i);
  });

  it("accepts letters, digits, and hyphens (starting with a letter)", () => {
    expect(validateHueName("accent")).toBeUndefined();
    expect(validateHueName("accent-2")).toBeUndefined();
    expect(validateHueName("brand-success-v2")).toBeUndefined();
  });

  it("rejects duplicates when an existing list is provided", () => {
    expect(validateHueName("accent", ["accent", "error"])).toMatch(/already/i);
  });

  it("accepts non-duplicates even when list is populated", () => {
    expect(validateHueName("success", ["accent", "error"])).toBeUndefined();
  });
});

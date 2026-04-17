import { describe, it, expect } from "vitest";
import { validateBorderList } from "../add-border.js";

describe("validateBorderList", () => {
  it("rejects empty / whitespace input", () => {
    expect(validateBorderList("", "widths")).toMatch(/at least one width/i);
    expect(validateBorderList("   ", "radii")).toMatch(/at least one radius/i);
    expect(validateBorderList(undefined, "widths")).toMatch(
      /at least one width/i,
    );
  });

  it("rejects values that aren't comma-separated positive integers", () => {
    expect(validateBorderList("1, 2, abc", "widths")).toMatch(/positive integers/i);
    expect(validateBorderList("1;2;3", "widths")).toMatch(/positive integers/i);
    expect(validateBorderList("1.5,2", "widths")).toMatch(/positive integers/i);
  });

  it("rejects zero / negative entries", () => {
    expect(validateBorderList("0,1,2", "widths")).toMatch(/positive integers/i);
  });

  it("rejects lists longer than 9 entries", () => {
    expect(
      validateBorderList("1,2,3,4,5,6,7,8,9,10", "radii"),
    ).toMatch(/9 entries/);
  });

  it("accepts well-formed lists of various shapes", () => {
    expect(validateBorderList("1,2,4,8", "widths")).toBeUndefined();
    expect(validateBorderList("1, 2, 4, 8", "widths")).toBeUndefined();
    expect(validateBorderList("2", "widths")).toBeUndefined();
    expect(validateBorderList("2,4,8,16,999", "radii")).toBeUndefined();
  });
});

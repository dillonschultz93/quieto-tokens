import { describe, it, expect } from "vitest";
import { validateDurationList } from "../add-animation.js";

describe("validateDurationList", () => {
  it("rejects empty input", () => {
    expect(validateDurationList("")).toMatch(/at least one duration/i);
    expect(validateDurationList("   ")).toMatch(/at least one duration/i);
    expect(validateDurationList(undefined)).toMatch(/at least one duration/i);
  });

  it("rejects non-integer or non-positive entries", () => {
    expect(validateDurationList("100, 200ms")).toMatch(/positive integers/i);
    expect(validateDurationList("100,abc")).toMatch(/positive integers/i);
    expect(validateDurationList("0,100")).toMatch(/positive integers/i);
    expect(validateDurationList("100.5,200")).toMatch(/positive integers/i);
  });

  it("rejects lists over 9 entries", () => {
    expect(
      validateDurationList("1,2,3,4,5,6,7,8,9,10"),
    ).toMatch(/9 entries/);
  });

  it("accepts reasonable lists", () => {
    expect(validateDurationList("100")).toBeUndefined();
    expect(validateDurationList("100,150,250,400")).toBeUndefined();
    expect(validateDurationList("100, 150 , 250")).toBeUndefined();
  });
});

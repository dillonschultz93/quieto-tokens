import { describe, it, expect } from "vitest";
import {
  ADDABLE_CATEGORIES,
  CANONICAL_CATEGORY_ORDER,
  isAddableCategory,
  sortCategoriesCanonical,
} from "../categories.js";

describe("CANONICAL_CATEGORY_ORDER", () => {
  it("lists the six known categories in diff-stable order", () => {
    expect(CANONICAL_CATEGORY_ORDER).toEqual([
      "color",
      "spacing",
      "typography",
      "shadow",
      "border",
      "animation",
    ]);
  });

  it("is frozen so importers cannot mutate it", () => {
    expect(Object.isFrozen(CANONICAL_CATEGORY_ORDER)).toBe(true);
  });
});

describe("sortCategoriesCanonical", () => {
  it("returns the canonical order when given the full set", () => {
    expect(
      sortCategoriesCanonical([
        "animation",
        "spacing",
        "color",
        "border",
        "typography",
        "shadow",
      ]),
    ).toEqual([
      "color",
      "spacing",
      "typography",
      "shadow",
      "border",
      "animation",
    ]);
  });

  it("places unknown categories at the end, alphabetically", () => {
    expect(
      sortCategoriesCanonical(["zeta", "color", "alpha", "shadow"]),
    ).toEqual(["color", "shadow", "alpha", "zeta"]);
  });

  it("leaves an empty list unchanged", () => {
    expect(sortCategoriesCanonical([])).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const input = ["shadow", "color"];
    sortCategoriesCanonical(input);
    expect(input).toEqual(["shadow", "color"]);
  });

  it("is stable: duplicates keep their relative positions", () => {
    expect(
      sortCategoriesCanonical(["color", "color", "shadow"]),
    ).toEqual(["color", "color", "shadow"]);
  });
});

describe("ADDABLE_CATEGORIES + isAddableCategory", () => {
  it("exposes exactly shadow/border/animation", () => {
    expect([...ADDABLE_CATEGORIES]).toEqual([
      "shadow",
      "border",
      "animation",
    ]);
  });

  it("accepts the three known values", () => {
    expect(isAddableCategory("shadow")).toBe(true);
    expect(isAddableCategory("border")).toBe(true);
    expect(isAddableCategory("animation")).toBe(true);
  });

  it("rejects core categories and garbage", () => {
    expect(isAddableCategory("color")).toBe(false);
    expect(isAddableCategory("spacing")).toBe(false);
    expect(isAddableCategory("typography")).toBe(false);
    expect(isAddableCategory("")).toBe(false);
    expect(isAddableCategory(42)).toBe(false);
    expect(isAddableCategory(undefined)).toBe(false);
    expect(isAddableCategory(null)).toBe(false);
  });
});

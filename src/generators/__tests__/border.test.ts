import { describe, it, expect } from "vitest";
import { generateBorderPrimitives } from "../border.js";

describe("generateBorderPrimitives", () => {
  it("emits width + radius primitives in one flat array", () => {
    const tokens = generateBorderPrimitives({
      widths: [1, 2, 4, 8],
      radii: [2, 4, 8, 16, 999],
      pill: true,
    });

    const widths = tokens.filter((t) => t.path[1] === "width");
    const radii = tokens.filter((t) => t.path[1] === "radius");
    expect(widths).toHaveLength(4);
    expect(radii).toHaveLength(5);
    for (const t of tokens) {
      expect(t.category).toBe("border");
      expect(t.tier).toBe("primitive");
      expect(t.$type).toBe("dimension");
    }
  });

  it("uses 9999px for the largest radius entry when pill: true", () => {
    const tokens = generateBorderPrimitives({
      widths: [1],
      radii: [2, 4, 8, 999],
      pill: true,
    });
    const pill = tokens.find((t) => t.name === "border.radius.999");
    expect(pill?.$value).toBe("9999px");
    const small = tokens.find((t) => t.name === "border.radius.2");
    expect(small?.$value).toBe("2px");
  });

  it("does NOT substitute 9999px when pill: false (literal values only)", () => {
    const tokens = generateBorderPrimitives({
      widths: [1],
      radii: [2, 4, 8, 999],
      pill: false,
    });
    const last = tokens.find((t) => t.name === "border.radius.999");
    expect(last?.$value).toBe("999px");
  });

  it("does NOT emit a pill marker when pill: true but radii is empty", () => {
    const tokens = generateBorderPrimitives({
      widths: [1],
      radii: [],
      pill: true,
    });
    expect(tokens.filter((t) => t.path[1] === "radius")).toHaveLength(0);
  });

  it("sorts and dedupes widths / radii defensively", () => {
    const tokens = generateBorderPrimitives({
      widths: [4, 1, 2, 1, 4],
      radii: [16, 2, 2, 4, 999],
      pill: false,
    });
    const widths = tokens
      .filter((t) => t.path[1] === "width")
      .map((t) => t.path[2]);
    expect(widths).toEqual(["1", "2", "4"]);
  });

  it("drops non-integer / non-positive / non-finite values silently", () => {
    const tokens = generateBorderPrimitives({
      widths: [1, 0, -1, 1.5, Number.NaN, 2],
      radii: [4, 999],
      pill: false,
    });
    expect(tokens.filter((t) => t.path[1] === "width")).toHaveLength(2);
  });

  it("serialises as `$value: \"<n>px\"` for dimensions", () => {
    const tokens = generateBorderPrimitives({
      widths: [2],
      radii: [4, 16],
      pill: false,
    });
    const w = tokens.find((t) => t.name === "border.width.2");
    expect(w?.$value).toBe("2px");
  });
});

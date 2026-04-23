import { describe, it, expect } from "vitest";
import { validateNaming } from "../naming.js";
import type { LoadedTokenSystem } from "../token-loader.js";

function makeSystem(
  overrides: Partial<LoadedTokenSystem> = {},
): LoadedTokenSystem {
  return {
    primitives: [],
    themes: [],
    components: [],
    config: {} as LoadedTokenSystem["config"],
    ...overrides,
  };
}

describe("validateNaming", () => {
  it("returns empty for valid kebab-case names", () => {
    const result = validateNaming(
      makeSystem({
        primitives: [
          {
            tier: "primitive",
            category: "color",
            name: "color.blue.500",
            $type: "color",
            $value: "#3B82F6",
            path: ["color", "blue", "500"],
          },
        ],
        themes: [
          {
            name: "default",
            semantics: [
              {
                tier: "semantic",
                category: "color",
                name: "color.background.primary",
                $type: "color",
                $value: "{color.blue.500}",
                path: ["color", "background", "primary"],
              },
            ],
          },
        ],
      }),
    );
    expect(result).toEqual([]);
  });

  it("flags uppercase segments", () => {
    const result = validateNaming(
      makeSystem({
        primitives: [
          {
            tier: "primitive",
            category: "color",
            name: "color.Blue.500",
            $type: "color",
            $value: "#3B82F6",
            path: ["color", "Blue", "500"],
          },
        ],
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.tier).toBe("primitive");
    expect(result[0]!.reason).toContain("Blue");
  });

  it("flags segments with underscores", () => {
    const result = validateNaming(
      makeSystem({
        themes: [
          {
            name: "default",
            semantics: [
              {
                tier: "semantic",
                category: "color",
                name: "color.bg_primary",
                $type: "color",
                $value: "#FFF",
                path: ["color", "bg_primary"],
              },
            ],
          },
        ],
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.reason).toContain("bg_primary");
  });

  it("flags component tokens with invalid names", () => {
    const result = validateNaming(
      makeSystem({
        components: [
          {
            tier: "component",
            category: "color",
            componentName: "button",
            name: "Button.bgColor",
            $type: "color",
            $value: "{color.blue.500}",
            path: ["Button", "bgColor"],
          },
        ],
      }),
    );
    expect(result.length).toBeGreaterThanOrEqual(1);
    const reasons = result.map((v) => v.reason).join(" ");
    expect(reasons).toContain("Button");
  });

  it("flags segment starting with hyphen", () => {
    const result = validateNaming(
      makeSystem({
        primitives: [
          {
            tier: "primitive",
            category: "color",
            name: "color.-blue.500",
            $type: "color",
            $value: "#3B82F6",
            path: ["color", "-blue", "500"],
          },
        ],
      }),
    );
    expect(result).toHaveLength(1);
  });

  it("allows numeric segments", () => {
    const result = validateNaming(
      makeSystem({
        primitives: [
          {
            tier: "primitive",
            category: "spacing",
            name: "spacing.4",
            $type: "dimension",
            $value: "4px",
            path: ["spacing", "4"],
          },
        ],
      }),
    );
    expect(result).toEqual([]);
  });
});

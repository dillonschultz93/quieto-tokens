import { describe, it, expect } from "vitest";
import { analyzeContrast } from "../contrast.js";
import type { LoadedTokenSystem } from "../token-loader.js";
import {
  makeColorPrimitive,
  makeColorSemantic,
} from "../../types/__fixtures__/tokens.js";

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

describe("analyzeContrast", () => {
  it("returns empty when no semantic colors exist", () => {
    const result = analyzeContrast(
      makeSystem({
        primitives: [makeColorPrimitive("blue", 500, "#3B82F6")],
        themes: [{ name: "default", semantics: [] }],
      }),
    );
    expect(result).toEqual([]);
  });

  it("pairs background and content tokens with matching role", () => {
    const result = analyzeContrast(
      makeSystem({
        primitives: [
          makeColorPrimitive("neutral", 50, "#F9FAFB"),
          makeColorPrimitive("neutral", 900, "#111827"),
        ],
        themes: [
          {
            name: "light",
            semantics: [
              makeColorSemantic("background", "primary", "{color.neutral.50}"),
              makeColorSemantic("content", "primary", "{color.neutral.900}"),
            ],
          },
        ],
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.backgroundPath).toEqual([
      "color",
      "background",
      "primary",
    ]);
    expect(result[0]!.contentPath).toEqual(["color", "content", "primary"]);
    expect(result[0]!.theme).toBe("light");
    expect(result[0]!.passAA).toBe(true);
    expect(result[0]!.ratio).toBeGreaterThan(4.5);
  });

  it("detects failing contrast pairs", () => {
    const result = analyzeContrast(
      makeSystem({
        primitives: [
          makeColorPrimitive("neutral", 100, "#F3F4F6"),
          makeColorPrimitive("neutral", 300, "#D1D5DB"),
        ],
        themes: [
          {
            name: "light",
            semantics: [
              makeColorSemantic(
                "background",
                "primary",
                "{color.neutral.100}",
              ),
              makeColorSemantic("content", "primary", "{color.neutral.300}"),
            ],
          },
        ],
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.passAA).toBe(false);
    expect(result[0]!.ratio).toBeLessThan(4.5);
  });

  it("does not pair tokens with different roles", () => {
    const result = analyzeContrast(
      makeSystem({
        primitives: [
          makeColorPrimitive("neutral", 50, "#F9FAFB"),
          makeColorPrimitive("neutral", 900, "#111827"),
        ],
        themes: [
          {
            name: "light",
            semantics: [
              makeColorSemantic("background", "primary", "{color.neutral.50}"),
              makeColorSemantic(
                "content",
                "secondary",
                "{color.neutral.900}",
              ),
            ],
          },
        ],
      }),
    );
    expect(result).toEqual([]);
  });

  it("pairs text tokens as content", () => {
    const result = analyzeContrast(
      makeSystem({
        primitives: [
          makeColorPrimitive("neutral", 50, "#F9FAFB"),
          makeColorPrimitive("neutral", 900, "#111827"),
        ],
        themes: [
          {
            name: "default",
            semantics: [
              makeColorSemantic("background", "primary", "{color.neutral.50}"),
              {
                tier: "semantic",
                category: "color",
                name: "color.text.primary",
                $type: "color",
                $value: "{color.neutral.900}",
                path: ["color", "text", "primary"],
              },
            ],
          },
        ],
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.contentPath).toEqual(["color", "text", "primary"]);
  });

  it("analyzes each theme independently", () => {
    const result = analyzeContrast(
      makeSystem({
        primitives: [
          makeColorPrimitive("neutral", 50, "#F9FAFB"),
          makeColorPrimitive("neutral", 900, "#111827"),
        ],
        themes: [
          {
            name: "light",
            semantics: [
              makeColorSemantic("background", "primary", "{color.neutral.50}"),
              makeColorSemantic("content", "primary", "{color.neutral.900}"),
            ],
          },
          {
            name: "dark",
            semantics: [
              makeColorSemantic("background", "primary", "{color.neutral.900}"),
              makeColorSemantic("content", "primary", "{color.neutral.50}"),
            ],
          },
        ],
      }),
    );
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.theme).sort()).toEqual(["dark", "light"]);
  });
});

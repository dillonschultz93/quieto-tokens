import { describe, it, expect } from "vitest";
import { detectBrokenReferences } from "../references.js";
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

describe("detectBrokenReferences", () => {
  it("returns empty when all references resolve", () => {
    const result = detectBrokenReferences(
      makeSystem({
        primitives: [makeColorPrimitive("blue", 500, "#3B82F6")],
        themes: [
          {
            name: "default",
            semantics: [
              makeColorSemantic("background", "primary", "{color.blue.500}"),
            ],
          },
        ],
      }),
    );
    expect(result).toEqual([]);
  });

  it("detects semantic tokens referencing non-existent primitives", () => {
    const result = detectBrokenReferences(
      makeSystem({
        primitives: [makeColorPrimitive("blue", 500, "#3B82F6")],
        themes: [
          {
            name: "light",
            semantics: [
              makeColorSemantic("background", "primary", "{color.red.500}"),
            ],
          },
        ],
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      tokenPath: ["color", "background", "primary"],
      tier: "semantic",
      referenceValue: "{color.red.500}",
      theme: "light",
    });
  });

  it("detects broken references in component tokens", () => {
    const result = detectBrokenReferences(
      makeSystem({
        primitives: [],
        themes: [],
        components: [
          {
            tier: "component",
            category: "color",
            componentName: "button",
            name: "button.bg",
            $type: "color",
            $value: "{color.missing.100}",
            path: ["button", "bg"],
          },
        ],
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.tier).toBe("component");
    expect(result[0]!.referenceValue).toBe("{color.missing.100}");
    expect(result[0]!.theme).toBeUndefined();
  });

  it("allows semantic-to-semantic references", () => {
    const result = detectBrokenReferences(
      makeSystem({
        primitives: [makeColorPrimitive("blue", 500, "#3B82F6")],
        themes: [
          {
            name: "default",
            semantics: [
              makeColorSemantic("background", "primary", "{color.blue.500}"),
              makeColorSemantic(
                "background",
                "secondary",
                "{color.background.primary}",
              ),
            ],
          },
        ],
      }),
    );
    expect(result).toEqual([]);
  });

  it("reports broken refs per theme", () => {
    const result = detectBrokenReferences(
      makeSystem({
        primitives: [],
        themes: [
          {
            name: "light",
            semantics: [
              makeColorSemantic("background", "primary", "{color.nope.1}"),
            ],
          },
          {
            name: "dark",
            semantics: [
              makeColorSemantic("background", "primary", "{color.nope.2}"),
            ],
          },
        ],
      }),
    );
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.theme).sort()).toEqual(["dark", "light"]);
  });

  it("ignores literal values (non-references)", () => {
    const result = detectBrokenReferences(
      makeSystem({
        primitives: [],
        themes: [
          {
            name: "default",
            semantics: [
              {
                tier: "semantic",
                category: "color",
                name: "color.background.primary",
                $type: "color",
                $value: "#FF0000",
                path: ["color", "background", "primary"],
              },
            ],
          },
        ],
      }),
    );
    expect(result).toEqual([]);
  });
});

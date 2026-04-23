import { describe, it, expect } from "vitest";
import { detectOrphans } from "../orphans.js";
import type { LoadedTokenSystem } from "../token-loader.js";
import {
  makeColorPrimitive,
  makeSpacingPrimitive,
  makeColorSemantic,
  makeSpacingSemantic,
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

describe("detectOrphans", () => {
  it("returns empty when all primitives are referenced", () => {
    const result = detectOrphans(
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

  it("detects primitives with no references", () => {
    const result = detectOrphans(
      makeSystem({
        primitives: [
          makeColorPrimitive("blue", 500, "#3B82F6"),
          makeColorPrimitive("red", 500, "#EF4444"),
        ],
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
    expect(result).toHaveLength(1);
    expect(result[0]!.path).toEqual(["color", "red", "500"]);
    expect(result[0]!.category).toBe("color");
  });

  it("counts component references towards non-orphan status", () => {
    const result = detectOrphans(
      makeSystem({
        primitives: [makeSpacingPrimitive(4)],
        themes: [],
        components: [
          {
            tier: "component",
            category: "spacing",
            componentName: "button",
            name: "button.padding",
            $type: "dimension",
            $value: "{spacing.4}",
            path: ["button", "padding"],
          },
        ],
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.path).toEqual(["spacing", "4"]);
  });

  it("returns all primitives when no semantics or components exist", () => {
    const prims = [
      makeColorPrimitive("blue", 500, "#3B82F6"),
      makeSpacingPrimitive(4),
    ];
    const result = detectOrphans(makeSystem({ primitives: prims }));
    expect(result).toHaveLength(2);
  });

  it("handles multiple themes referencing the same primitive", () => {
    const result = detectOrphans(
      makeSystem({
        primitives: [
          makeColorPrimitive("blue", 500, "#3B82F6"),
          makeColorPrimitive("neutral", 50, "#F9FAFB"),
        ],
        themes: [
          {
            name: "light",
            semantics: [
              makeColorSemantic("background", "primary", "{color.blue.500}"),
            ],
          },
          {
            name: "dark",
            semantics: [
              makeColorSemantic("background", "primary", "{color.neutral.50}"),
            ],
          },
        ],
      }),
    );
    expect(result).toEqual([]);
  });
});

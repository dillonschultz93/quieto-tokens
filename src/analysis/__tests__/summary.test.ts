import { describe, it, expect } from "vitest";
import { computeSummary } from "../summary.js";
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

describe("computeSummary", () => {
  it("counts primitives by category", () => {
    const result = computeSummary(
      makeSystem({
        primitives: [
          makeColorPrimitive("blue", 500, "#3B82F6"),
          makeColorPrimitive("red", 500, "#EF4444"),
          makeSpacingPrimitive(4),
        ],
      }),
    );
    expect(result.totalByTier.primitive).toBe(3);
    expect(result.byCategory["color"]!.primitive).toBe(2);
    expect(result.byCategory["spacing"]!.primitive).toBe(1);
  });

  it("deduplicates semantics across themes", () => {
    const semantics = [
      makeColorSemantic("background", "primary", "{color.blue.500}"),
    ];
    const result = computeSummary(
      makeSystem({
        themes: [
          { name: "light", semantics },
          { name: "dark", semantics },
        ],
      }),
    );
    expect(result.totalByTier.semantic).toBe(1);
    expect(result.byCategory["color"]!.semantic).toBe(1);
  });

  it("counts components", () => {
    const result = computeSummary(
      makeSystem({
        components: [
          {
            tier: "component",
            category: "color",
            componentName: "button",
            name: "button.bg",
            $type: "color",
            $value: "{color.blue.500}",
            path: ["button", "bg"],
          },
        ],
      }),
    );
    expect(result.totalByTier.component).toBe(1);
    expect(result.byCategory["color"]!.component).toBe(1);
  });

  it("reports theme names and count", () => {
    const result = computeSummary(
      makeSystem({
        themes: [
          { name: "light", semantics: [] },
          { name: "dark", semantics: [] },
        ],
      }),
    );
    expect(result.themeCount).toBe(2);
    expect(result.themeNames).toEqual(["light", "dark"]);
  });

  it("handles empty system", () => {
    const result = computeSummary(makeSystem());
    expect(result.totalByTier).toEqual({
      primitive: 0,
      semantic: 0,
      component: 0,
    });
    expect(result.themeCount).toBe(0);
  });
});

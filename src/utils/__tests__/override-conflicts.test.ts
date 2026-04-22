import { describe, it, expect } from "vitest";
import type { ThemeCollection } from "../../types/tokens.js";
import { makeColorPrimitive } from "../../types/__fixtures__/tokens.js";
import { detectOverrideConflicts } from "../override-conflicts.js";

function makeCollection(): ThemeCollection {
  return {
    primitives: [makeColorPrimitive("blue", 500, "#3B82F6")],
    themes: [
      {
        name: "default",
        semanticTokens: [
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
  };
}

describe("detectOverrideConflicts", () => {
  it("returns empty when all primitive refs resolve", () => {
    const c = makeCollection();
    const conflicts = detectOverrideConflicts(
      { "color.background.primary": "{color.blue.500}" },
      c,
    );
    expect(conflicts).toEqual([]);
  });

  it("flags a missing primitive ref", () => {
    const c = makeCollection();
    const conflicts = detectOverrideConflicts(
      { "color.background.accent": "{color.teal.500}" },
      c,
    );
    expect(conflicts).toEqual([
      {
        semanticName: "color.background.accent",
        reference: "color.teal.500",
      },
    ]);
  });

  it("ignores non-brace values", () => {
    const c = makeCollection();
    const conflicts = detectOverrideConflicts(
      { "color.background.primary": "#ff00ff" },
      c,
    );
    expect(conflicts).toEqual([]);
  });
});

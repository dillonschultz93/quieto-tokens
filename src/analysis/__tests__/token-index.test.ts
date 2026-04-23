import { describe, it, expect } from "vitest";
import type { LoadedTokenSystem } from "../token-loader.js";
import { buildTokenIndex } from "../token-index.js";

describe("buildTokenIndex", () => {
  it("indexes primitive hex colors and spacing px values with correct CSS var suggestions", () => {
    const system: LoadedTokenSystem = {
      config: {
        version: "0.1.0",
        generated: new Date().toISOString(),
        inputs: {
          brandColor: "#3B82F6",
          spacingBase: 4,
          typeScale: "balanced",
          darkMode: false,
        },
        overrides: {},
        output: { tokensDir: "tokens", buildDir: "build", prefix: "quieto" },
        outputs: ["css"],
        categories: ["color", "spacing", "typography"],
      },
      primitives: [
        {
          tier: "primitive",
          category: "color",
          name: "color.blue.500",
          $type: "color",
          $value: "#3B82F6",
          path: ["color", "blue", "500"],
        },
        {
          tier: "primitive",
          category: "spacing",
          name: "spacing.4",
          $type: "dimension",
          $value: "4px",
          path: ["spacing", "4"],
        },
        {
          tier: "primitive",
          category: "typography",
          name: "typography.fontSize.base",
          $type: "fontSize",
          $value: "16px",
          path: ["typography", "fontSize", "base"],
        },
      ],
      themes: [],
      components: [],
    };

    const idx = buildTokenIndex(system);
    expect(idx.colorsByHex.get("#3b82f6")?.cssVar).toBe(
      "var(--quieto-color-blue-500)",
    );
    expect(idx.spacingByPx.get(4)?.cssVar).toBe("var(--quieto-spacing-4)");
    expect(idx.typographyByValue.get("16px")?.cssVar).toBe(
      "var(--quieto-typography-fontSize-base)",
    );
  });
});


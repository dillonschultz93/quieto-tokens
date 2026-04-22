import { describe, it, expect } from "vitest";
import type { ThemeCollection } from "../../types/tokens.js";
import type { QuietoConfig } from "../../types/config.js";
import {
  buildInitSummary,
  buildUpdateSummary,
  buildAddSummary,
  buildComponentSummary,
  detectConfigDelta,
} from "../changelog-summary.js";
import type { TokenDiff, TokenChange } from "../../ui/diff.js";

function makeThemeCollection(
  primitives: { category: string; name: string }[],
  perTheme: { name: string; n: { category: string; name: string; $value: string }[] }[],
): ThemeCollection {
  return {
    primitives: primitives.map((p) => ({
      tier: "primitive" as const,
      category: p.category,
      name: p.name,
      $type: p.category === "color" ? "color" : "dimension",
      $value: "#000000",
      path: [p.category, p.name],
    })),
    themes: perTheme.map((t) => ({
      name: t.name,
      semanticTokens: t.n.map((s) => ({
        tier: "semantic" as const,
        category: s.category,
        name: s.name,
        $type: s.category === "color" ? "color" : "shadow",
        $value: s.$value,
        path: [s.category, s.name],
      })),
    })),
  };
}

function minimalQuietoConfig(overrides: Partial<QuietoConfig["inputs"]> = {}): QuietoConfig {
  return {
    version: "0.1.0",
    generated: "2026-01-01T00:00:00.000Z",
    inputs: {
      brandColor: "#3B82F6",
      spacingBase: 8,
      typeScale: "balanced",
      darkMode: true,
      ...overrides,
    },
    overrides: {},
    output: { tokensDir: "tokens", buildDir: "build", prefix: "quieto" },
    categories: ["color", "spacing", "typography"],
  };
}

describe("changelog-summary", () => {
  describe("buildInitSummary", () => {
    it("initial context lists counts and themes", () => {
      const c = makeThemeCollection(
        [
          { category: "color", name: "a" },
          { category: "color", name: "b" },
        ],
        [
          { name: "default", n: [] },
          { name: "dark", n: [] },
        ],
      );
      c.themes[0]!.semanticTokens = [
        {
          tier: "semantic" as const,
          category: "color",
          name: "s1",
          $type: "color" as const,
          $value: "{a}",
          path: ["color", "s1"],
        },
      ];
      c.themes[1]!.semanticTokens = [
        {
          tier: "semantic" as const,
          category: "color",
          name: "s2",
          $type: "color" as const,
          $value: "{a}",
          path: ["color", "s2"],
        },
      ];
      const s = buildInitSummary(c, "initial");
      expect(s).toContain("Initial token system generated.");
      expect(s).toContain("2 primitive");
      expect(s).toContain("2 semantic");
      expect(s).toContain("2 theme");
    });

    it("modify context uses the regen one-liner from the story", () => {
      const c = makeThemeCollection([{ category: "color", name: "a" }], [
        { name: "default", n: [] },
      ]);
      c.themes[0]!.semanticTokens = [];
      c.primitives = [
        {
          tier: "primitive" as const,
          category: "color",
          name: "a",
          $type: "color" as const,
          $value: "#000",
          path: ["color", "a"],
        },
      ];
      const s = buildInitSummary(c, "modify");
      expect(s).toContain("init modify-flow");
    });
  });

  describe("detectConfigDelta", () => {
    it("detects brand color, spacing, type scale, and theme changes", () => {
      const prior = minimalQuietoConfig();
      const d1 = detectConfigDelta(prior, { brandColor: "#2563EB" });
      expect(d1.changes[0]).toMatch(/Brand color changed from/);

      const d2 = detectConfigDelta(prior, { spacingBase: 4 });
      expect(d2.changes[0]).toMatch(/Spacing base/);

      const d3 = detectConfigDelta(prior, { typeScale: "spacious" });
      expect(d3.changes[0]).toMatch(/Type scale/);

      const d4 = detectConfigDelta(prior, { generateThemes: false });
      expect(d4.changes[0]).toMatch(/Theme generation/);
    });
  });

  describe("buildUpdateSummary", () => {
    it("merges config delta lines, tier counts, and a cascade line", () => {
      const prim: TokenChange[] = [
        {
          kind: "modified",
          path: ["color", "blue", "500"],
          name: "color.blue.500",
          category: "color",
          $type: "color",
          oldValue: "#2563EB",
          newValue: "#1D4ED8",
        },
      ];
      const diff: TokenDiff = {
        primitiveChanges: prim,
        semanticChanges: new Map([
          [
            "default",
            [
              {
                kind: "modified",
                path: [],
                name: "color.text.primary",
                category: "color",
                $type: "color",
                oldValue: "{color.blue.500}",
                newValue: "{color.blue.500}",
              },
            ],
          ],
        ]),
        isEmpty: false,
      };
      const current = makeThemeCollection(
        [{ category: "color", name: "color.blue.500" }],
        [
          {
            name: "default",
            n: [
              {
                category: "color",
                name: "color.text.primary",
                $value: "{color.blue.500}",
              },
            ],
          },
        ],
      );
      current.primitives[0]!.$value = "#1D4ED8";
      current.primitives[0]!.path = ["color", "blue", "500"];
      const prior = minimalQuietoConfig({ brandColor: "#2563EB" });
      const delta = detectConfigDelta(
        { ...prior, inputs: { ...prior.inputs, brandColor: "#2563EB" } },
        { brandColor: "#1D4ED8" },
      );
      const s = buildUpdateSummary(diff, current, delta);
      expect(s).toMatch(/Primitive/i);
      expect(s).toMatch(/Semantics/);
    });
  });

  describe("buildAddSummary", () => {
    it("reports counts for a single new category", () => {
      const c = makeThemeCollection(
        [
          { category: "color", name: "x" },
          { category: "shadow", name: "s1" },
        ],
        [
          {
            name: "default",
            n: [
              { category: "shadow", name: "elev", $value: "1px" },
            ],
          },
        ],
      );
      const s = buildAddSummary("shadow", c);
      expect(s).toContain("Added shadow category");
      expect(s).toMatch(/1 primitive/);
    });
  });

  describe("buildComponentSummary", () => {
    it("new vs re-author", () => {
      expect(buildComponentSummary("button", 4, false)).toMatch(
        /Added component tokens for button/,
      );
      expect(buildComponentSummary("button", 4, true)).toMatch(
        /Re-authored component tokens for button/,
      );
    });
  });
});

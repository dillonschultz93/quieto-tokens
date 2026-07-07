import { describe, it, expect } from "vitest";
import { inferSeed } from "../infer-seed.js";
import type {
  RawValueHistograms,
  ValueOccurrence,
  FontFamilyOccurrence,
} from "../extract.js";

function color(count: number, ...properties: string[]): ValueOccurrence {
  return { count, properties: new Set(properties) };
}

function makeHistograms(
  partial: Partial<RawValueHistograms>,
): RawValueHistograms {
  return {
    colors: new Map(),
    dimensions: new Map(),
    fontFamilies: new Map(),
    fontWeights: new Map(),
    darkModeSignals: false,
    customProperties: new Map(),
    varUsageCount: 0,
    rootBackgrounds: new Map(),
    filesScanned: 1,
    totalColorUsages: 0,
    totalDimensionUsages: 0,
    ...partial,
  };
}

describe("inferSeed", () => {
  it("returns null when there is no design-relevant signal", () => {
    expect(inferSeed(makeHistograms({}))).toBeNull();
  });

  it("picks the most-used saturated color as brand, ignoring a more frequent neutral", () => {
    const result = inferSeed(
      makeHistograms({
        colors: new Map([
          ["#808080", color(50, "color")], // frequent neutral
          ["#3b82f6", color(20, "background")], // saturated blue
        ]),
      }),
    );
    expect(result?.options.brandColor).toBe("#3B82F6");
  });

  it("names additional hues by semantic role and skips the brand's own family", () => {
    const result = inferSeed(
      makeHistograms({
        colors: new Map([
          ["#3b82f6", color(30, "background")], // blue → brand
          ["#2563eb", color(10, "background")], // also blue → skipped (same family)
          ["#ef4444", color(8, "color")], // red → error
          ["#22c55e", color(5, "color")], // green → success
        ]),
      }),
    );
    const hues = result?.advanced.color?.additionalHues ?? [];
    const names = hues.map((h) => h.name);
    expect(names).toContain("error");
    expect(names).toContain("success");
    // No second blue ramp.
    expect(hues.length).toBe(2);
  });

  it("falls back to the most common color with a warning when nothing is saturated", () => {
    const result = inferSeed(
      makeHistograms({
        colors: new Map([["#808080", color(10, "color")]]),
      }),
    );
    expect(result?.options.brandColor).toBe("#808080");
    expect(result?.rationale.warnings.length).toBeGreaterThan(0);
  });

  it("infers spacing base 8 when values are predominantly multiples of 8", () => {
    const result = inferSeed(
      makeHistograms({
        dimensions: new Map([
          [8, color(5, "padding")],
          [16, color(5, "margin")],
          [24, color(3, "gap")],
        ]),
      }),
    );
    expect(result?.options.spacingBase).toBe(8);
  });

  it("infers spacing base 4 when values are not multiples of 8", () => {
    const result = inferSeed(
      makeHistograms({
        dimensions: new Map([
          [4, color(5, "padding")],
          [12, color(5, "margin")],
          [20, color(3, "padding")],
        ]),
      }),
    );
    expect(result?.options.spacingBase).toBe(4);
  });

  it.each([
    [[16, 19, 23], "compact"],
    [[16, 20, 25, 31], "balanced"],
    [[16, 22, 30], "spacious"],
  ] as const)("classifies type scale %j as %s", (sizes, expected) => {
    const dims = new Map<number, ValueOccurrence>();
    for (const s of sizes) dims.set(s, color(1, "font-size"));
    const result = inferSeed(makeHistograms({ dimensions: dims }));
    expect(result?.options.typeScale).toBe(expected);
  });

  it("enables themes when the root background is dark, without explicit dark-mode styles", () => {
    const result = inferSeed(
      makeHistograms({
        colors: new Map([["#c9a857", color(5, "color")]]),
        rootBackgrounds: new Map([["#0a0a1a", 1]]),
      }),
    );
    expect(result?.options.generateThemes).toBe(true);
    expect(
      result?.rationale.lines.some((l) => l.includes("dark background")),
    ).toBe(true);
  });

  it("falls back to the dominant background-property color for dark detection", () => {
    const result = inferSeed(
      makeHistograms({
        colors: new Map([
          ["#111827", color(12, "background")],
          ["#c9a857", color(5, "color")],
        ]),
      }),
    );
    expect(result?.options.generateThemes).toBe(true);
  });

  it("keeps a single theme when the background is light", () => {
    const result = inferSeed(
      makeHistograms({
        colors: new Map([["#3b82f6", color(5, "color")]]),
        rootBackgrounds: new Map([["#ffffff", 1]]),
      }),
    );
    expect(result?.options.generateThemes).toBe(false);
  });

  it("warns when the codebase already looks tokenized", () => {
    const customProperties = new Map(
      Array.from({ length: 6 }, (_, i) => [
        `--token-${i}`,
        { value: "#3b82f6", onRootSelector: true },
      ]),
    );
    const result = inferSeed(
      makeHistograms({
        colors: new Map([["#3b82f6", color(5, "color")]]),
        customProperties,
        varUsageCount: 12,
      }),
    );
    expect(
      result?.rationale.warnings.some((w) =>
        w.includes("Existing token system detected"),
      ),
    ).toBe(true);
  });

  it("does not warn about a token system below the detection thresholds", () => {
    const result = inferSeed(
      makeHistograms({
        colors: new Map([["#3b82f6", color(5, "color")]]),
        customProperties: new Map([
          ["--brand", { value: "#3b82f6", onRootSelector: true }],
        ]),
        varUsageCount: 3,
      }),
    );
    expect(result?.rationale.warnings).toEqual([]);
  });

  it("enables themes only when dark-mode signals are present", () => {
    const base = { colors: new Map([["#3b82f6", color(5, "color")]]) };
    expect(
      inferSeed(makeHistograms({ ...base, darkModeSignals: true }))?.options
        .generateThemes,
    ).toBe(true);
    expect(
      inferSeed(makeHistograms({ ...base, darkModeSignals: false }))?.options
        .generateThemes,
    ).toBe(false);
  });

  it("maps font families to body/heading/mono and weights to roles", () => {
    const fontFamilies = new Map<string, FontFamilyOccurrence>([
      ["Inter, sans-serif", { count: 10, onHeadingSelector: false, isMono: false }],
      ["Georgia, serif", { count: 3, onHeadingSelector: true, isMono: false }],
      ["'SF Mono', monospace", { count: 2, onHeadingSelector: false, isMono: true }],
    ]);
    const result = inferSeed(
      makeHistograms({
        colors: new Map([["#3b82f6", color(5, "color")]]),
        fontFamilies,
        fontWeights: new Map([
          [400, 5],
          [700, 2],
        ]),
      }),
    );
    const typo = result?.advanced.typography;
    expect(typo?.fontFamily?.body).toBe("Inter, sans-serif");
    expect(typo?.fontFamily?.heading).toBe("Georgia, serif");
    expect(typo?.fontFamily?.mono).toBe("'SF Mono', monospace");
    expect(typo?.customWeights).toMatchObject({
      "font-weight-regular": 400,
      "font-weight-bold": 700,
    });
  });
});

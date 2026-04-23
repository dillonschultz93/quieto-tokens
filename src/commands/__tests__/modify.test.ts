import { describe, it, expect } from "vitest";
import {
  buildPriorContext,
  deriveBaselineFromConfig,
} from "../modify.js";
import type { QuietoConfig } from "../../types/config.js";

function makeConfig(overrides: Partial<QuietoConfig> = {}): QuietoConfig {
  return {
    version: "0.1.0",
    generated: "2026-04-16T12:00:00.000Z",
    inputs: {
      brandColor: "#5B21B6",
      spacingBase: 8,
      typeScale: "balanced",
      darkMode: true,
    },
    overrides: {},
    output: { tokensDir: "tokens", buildDir: "build", prefix: "quieto" },
    outputs: ["css"],
    categories: ["color", "spacing", "typography"],
    ...overrides,
  };
}

describe("deriveBaselineFromConfig", () => {
  it("projects inputs.* into QuickStartOptions verbatim", () => {
    expect(deriveBaselineFromConfig(makeConfig())).toEqual({
      brandColor: "#5B21B6",
      spacingBase: 8,
      typeScale: "balanced",
      generateThemes: true,
    });
  });

  it("renames darkMode back to generateThemes", () => {
    const config = makeConfig({
      inputs: {
        brandColor: "#112233",
        spacingBase: 4,
        typeScale: "compact",
        darkMode: false,
      },
    });
    expect(deriveBaselineFromConfig(config).generateThemes).toBe(false);
  });

  it("round-trips spacingBase=4 and typeScale=spacious", () => {
    const config = makeConfig({
      inputs: {
        brandColor: "#ABCDEF",
        spacingBase: 4,
        typeScale: "spacious",
        darkMode: true,
      },
    });
    const baseline = deriveBaselineFromConfig(config);
    expect(baseline.spacingBase).toBe(4);
    expect(baseline.typeScale).toBe("spacious");
  });
});

describe("buildPriorContext", () => {
  it("wraps the config into a PriorContext unchanged", () => {
    const config = makeConfig();
    expect(buildPriorContext(config)).toEqual({ config });
  });
});

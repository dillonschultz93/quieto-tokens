import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

vi.mock("@clack/prompts", () => ({
  log: {
    step: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  },
}));

import { runColorGeneration } from "../../pipeline/color.js";
import {
  runSpacingGeneration,
  runTypographyGeneration,
} from "../../pipeline/spacing-typography.js";
import { generateSemanticTokens } from "../../mappers/semantic.js";
import { generateThemes } from "../../generators/themes.js";
import { writeTokensToJson } from "../../output/json-writer.js";
import {
  buildConfig,
  writeConfig,
} from "../../output/config-writer.js";
import { loadConfig } from "../../utils/config.js";
import type { AdvancedConfig } from "../../types/config.js";

/**
 * Full-stack "advanced mode" smoke test: run the advanced color/spacing/
 * typography pipelines, persist JSON + config, and assert the artifacts
 * on disk reflect every advanced input the user provided.
 *
 * This is the closest we can practically get to an E2E test without
 * actually driving Clack prompts — the UI layer above these functions is
 * validated separately in the per-category unit tests.
 */
describe("advanced mode — end-to-end pipeline", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-advanced-e2e-"));
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
    vi.clearAllMocks();
  });

  const ADVANCED: AdvancedConfig = {
    color: {
      additionalHues: [
        { name: "accent", seed: "#FF00AA" },
        { name: "error", seed: "#D12020" },
      ],
    },
    spacing: {
      customValues: { "space-4": 20 },
    },
    typography: {
      fontFamily: { heading: "'Inter', sans-serif" },
      customSizes: { "font-size-lg": 22 },
      lineHeight: { heading: 1.2 },
    },
  };

  it("generates primitives that include every advanced addition", async () => {
    const color = await runColorGeneration("#3B82F6", ADVANCED.color);
    const spacing = runSpacingGeneration(8, ADVANCED.spacing);
    const typography = runTypographyGeneration("balanced", ADVANCED.typography);

    // Color: 22 defaults + 22 extras (2 hues × 11 steps).
    expect(color.length).toBe(44);
    expect(color.some((t) => t.path[1] === "accent")).toBe(true);
    expect(color.some((t) => t.path[1] === "error")).toBe(true);

    // Spacing: the override key `space-4` references a step that exists
    // only in the 4px ramp; at an 8px base that key is out-of-range and
    // must silently drop — no crash, token count unchanged, AND none of
    // the emitted tokens should have picked up the 20px value.
    expect(spacing).toHaveLength(9);
    expect(spacing.some((t) => t.$value === "20px")).toBe(false);
    // The 8px ramp's first step is still the untouched 8px default.
    const firstStep = spacing.find((t) => t.path[1] === "8");
    expect(firstStep?.$value).toBe("8px");

    // Typography: lg override applied, heading font-family + line-height
    // added as new tokens.
    const lg = typography.find(
      (t) => t.path.join(".") === "typography.font-size.lg",
    );
    const heading = typography.find(
      (t) => t.path.join(".") === "typography.font-family.heading",
    );
    const lineHeight = typography.find(
      (t) => t.path.join(".") === "typography.line-height.heading",
    );
    expect(lg?.$value).toBe("22px");
    expect(heading?.$value).toBe("'Inter', sans-serif");
    expect(lineHeight?.$value).toBe("1.2");
  });

  it("persists advanced inputs into quieto.config.json", async () => {
    const config = buildConfig({
      options: {
        brandColor: "#3B82F6",
        spacingBase: 8,
        typeScale: "balanced",
        generateThemes: true,
      },
      overrides: new Map(),
      version: "0.1.0",
      generated: "2026-04-16T12:00:00.000Z",
      advanced: ADVANCED,
    });
    const filePath = await writeConfig(config, tempDir);

    const raw = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.advanced).toEqual(ADVANCED);
    expect(parsed.categories).toEqual(["color", "spacing", "typography"]);
  });

  it("round-trips through loadConfig for modify-flow pre-fill", async () => {
    const config = buildConfig({
      options: {
        brandColor: "#3B82F6",
        spacingBase: 8,
        typeScale: "balanced",
        generateThemes: true,
      },
      overrides: new Map(),
      version: "0.1.0",
      advanced: ADVANCED,
    });
    await writeConfig(config, tempDir);

    const result = loadConfig(tempDir);
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.config.advanced).toEqual(ADVANCED);
      expect(result.config.categories).toEqual([
        "color",
        "spacing",
        "typography",
      ]);
    }
  });

  it("stamps $metadata on every token JSON including additional hues", async () => {
    const color = await runColorGeneration("#3B82F6", ADVANCED.color);
    const spacing = runSpacingGeneration(8, ADVANCED.spacing);
    const typography = runTypographyGeneration(
      "balanced",
      ADVANCED.typography,
    );

    const primitives = [...color, ...spacing, ...typography];
    const semanticTokens = generateSemanticTokens(primitives);
    const themes = generateThemes(semanticTokens, primitives, true);

    const files = await writeTokensToJson(themes, tempDir, {
      generatedAt: "2026-04-16T12:00:00.000Z",
    });

    for (const file of files) {
      const parsed = JSON.parse(readFileSync(file, "utf-8"));
      expect(parsed.$metadata).toEqual({
        generatedBy: "quieto-tokens",
        doNotEdit: true,
        generatedAt: "2026-04-16T12:00:00.000Z",
        notice: expect.stringContaining("tool-generated"),
      });
    }
  });
});

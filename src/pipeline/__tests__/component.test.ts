import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  existsSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { QuietoConfig, ComponentTokenConfig } from "../../types/config.js";

vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn(),
  isCancel: vi.fn(() => false),
  log: {
    step: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  },
  text: vi.fn(),
  select: vi.fn(),
  confirm: vi.fn(),
  multiselect: vi.fn(),
  note: vi.fn(),
}));

vi.mock("../../commands/component-flow.js", () => ({
  collectComponentInputs: vi.fn(),
}));

import * as p from "@clack/prompts";
import { collectComponentInputs } from "../../commands/component-flow.js";
import { runComponent } from "../component.js";
import { writeTokensToJson } from "../../output/json-writer.js";
import { runColorGeneration } from "../color.js";
import {
  runSpacingGeneration,
  runTypographyGeneration,
} from "../spacing-typography.js";
import { generateSemanticTokens } from "../../mappers/semantic.js";
import { generateThemes } from "../../generators/themes.js";

function baseConfig(
  overrides: Partial<QuietoConfig> = {},
): QuietoConfig {
  return {
    version: "0.1.0",
    generated: "2026-04-21T00:00:00.000Z",
    inputs: {
      brandColor: "#3B82F6",
      spacingBase: 8,
      typeScale: "balanced",
      darkMode: false,
    },
    overrides: {},
    output: { tokensDir: "tokens", buildDir: "build", prefix: "quieto" },
    categories: ["color", "spacing", "typography"],
    ...overrides,
  };
}

async function seedInitState(cwd: string, config: QuietoConfig): Promise<void> {
  const corePrimitives = [
    ...(await runColorGeneration(config.inputs.brandColor, config.advanced?.color)),
    ...runSpacingGeneration(config.inputs.spacingBase, config.advanced?.spacing),
    ...runTypographyGeneration(
      config.inputs.typeScale,
      config.advanced?.typography,
    ),
  ];
  const semantics = generateSemanticTokens(corePrimitives);
  const collection = generateThemes(semantics, corePrimitives, config.inputs.darkMode);
  await writeTokensToJson(collection, cwd, {
    generatedAt: "2026-04-21T00:00:00.000Z",
  });
}

const BUTTON_CONFIG: ComponentTokenConfig = {
  variants: ["primary"],
  cells: [
    {
      variant: "primary",
      property: "color-background",
      states: [
        { state: "default", value: "{color.background.primary}" },
        { state: "hover", value: "{color.background.secondary}" },
      ],
    },
    {
      variant: "primary",
      property: "color-content",
      states: [
        { state: "default", value: "{color.content.default}" },
      ],
    },
  ],
};

describe("runComponent — pipeline E2E", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-comp-e2e-"));
    vi.clearAllMocks();
    vi.mocked(p.isCancel).mockReturnValue(false);
    vi.mocked(collectComponentInputs).mockResolvedValue(BUTTON_CONFIG);
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("writes tokens/component/button.json to disk with correct DTCG structure", async () => {
    const config = baseConfig();
    await seedInitState(tempDir, config);

    const outcome = await runComponent(config, "button", tempDir);

    expect(outcome.status).toBe("ok");

    const filePath = join(tempDir, "tokens", "component", "button.json");
    expect(existsSync(filePath)).toBe(true);

    const parsed = JSON.parse(readFileSync(filePath, "utf-8"));
    expect(parsed.$metadata).toBeDefined();
    expect(parsed.$metadata.doNotEdit).toBe(true);
    expect(parsed.button.primary.color.background.default.$value).toBe("{color.background.primary}");
    expect(parsed.button.primary.color.background.hover.$value).toBe("{color.background.secondary}");
    expect(parsed.button.primary.color.content.default.$value).toBe("{color.content.default}");
  });

  it("rebuilds CSS that includes component token variables", async () => {
    const config = baseConfig();
    await seedInitState(tempDir, config);

    const outcome = await runComponent(config, "button", tempDir);
    expect(outcome.status).toBe("ok");

    const cssPath = join(tempDir, "build", "tokens.css");
    expect(existsSync(cssPath)).toBe(true);

    const css = readFileSync(cssPath, "utf-8");
    expect(css).toContain("--quieto-component-button-primary-color-background");
    expect(css).toContain("--quieto-component-button-primary-color-background-hover");
    expect(css).toContain("--quieto-component-button-primary-color-content");
  });

  it("returns the correct token count and file paths", async () => {
    const config = baseConfig();
    await seedInitState(tempDir, config);

    const outcome = await runComponent(config, "button", tempDir);
    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") return;

    expect(outcome.result.tokenCount).toBe(3);
    expect(outcome.result.jsonFiles).toHaveLength(1);
    expect(outcome.result.jsonFiles[0]).toContain("button.json");
    expect(outcome.result.cssFiles.length).toBeGreaterThan(0);
  });

  it("returns componentConfig for config persistence round-trip", async () => {
    const config = baseConfig();
    await seedInitState(tempDir, config);

    const outcome = await runComponent(config, "button", tempDir);
    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") return;

    expect(outcome.result.componentConfig).toEqual(BUTTON_CONFIG);
  });

  it("returns cancelled status when collector yields zero component tokens", async () => {
    const config = baseConfig();
    await seedInitState(tempDir, config);

    // Config with no cells means generateComponentTokens will return []
    vi.mocked(collectComponentInputs).mockResolvedValue({
      variants: ["primary"],
      cells: [],
    });

    const outcome = await runComponent(config, "button", tempDir);
    expect(outcome.status).toBe("cancelled");
  });

  it("returns cancelled status when collector throws cancelled", async () => {
    const config = baseConfig();
    await seedInitState(tempDir, config);

    vi.mocked(collectComponentInputs).mockRejectedValue(
      new Error("cancelled"),
    );

    const outcome = await runComponent(config, "button", tempDir);
    expect(outcome.status).toBe("cancelled");
  });

  it("returns error status on unexpected failure", async () => {
    const config = baseConfig();
    await seedInitState(tempDir, config);

    vi.mocked(collectComponentInputs).mockRejectedValue(
      new Error("unexpected boom"),
    );

    const outcome = await runComponent(config, "button", tempDir);
    expect(outcome.status).toBe("error");
    if (outcome.status !== "error") return;
    expect(outcome.message).toBe("unexpected boom");
  });
});

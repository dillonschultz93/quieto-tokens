import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadPriorCollection, themeNamesFromConfig } from "../diff-loader.js";
import type { QuietoConfig } from "../../types/config.js";
import { writeTokensToJson } from "../../output/json-writer.js";
import { runColorGeneration } from "../color.js";
import {
  runSpacingGeneration,
  runTypographyGeneration,
} from "../spacing-typography.js";
import { generateSemanticTokens } from "../../mappers/semantic.js";
import { generateThemes } from "../../generators/themes.js";

function makeConfig(over: Partial<QuietoConfig> = {}): QuietoConfig {
  return {
    version: "0.1.0",
    generated: "2026-01-01T00:00:00.000Z",
    inputs: {
      brandColor: "#5B21B6",
      spacingBase: 8,
      typeScale: "balanced",
      darkMode: false,
    },
    overrides: {},
    output: { tokensDir: "tokens", buildDir: "build", prefix: "quieto" },
    outputs: ["css"],
    categories: ["color", "spacing", "typography"],
    ...over,
  };
}

describe("themeNamesFromConfig", () => {
  it("returns default for single theme", () => {
    const c = makeConfig();
    expect(themeNamesFromConfig(c)).toEqual(["default"]);
  });
  it("returns light+dark for darkMode", () => {
    const c = makeConfig({
      inputs: { ...makeConfig().inputs, darkMode: true },
    });
    expect(themeNamesFromConfig(c)).toEqual(["light", "dark"]);
  });
});

describe("loadPriorCollection", () => {
  let d: string;
  let o: string;
  beforeEach(() => {
    o = process.cwd();
    d = mkdtempSync(join(tmpdir(), "diff-ld-"));
    process.chdir(d);
  });
  afterEach(() => {
    process.chdir(o);
    if (existsSync(d)) {
      rmSync(d, { recursive: true, force: true });
    }
  });

  it("returns empty when tokens dir is missing", async () => {
    const c = makeConfig();
    const col = await loadPriorCollection(c, d);
    expect(col.primitives).toHaveLength(0);
    expect(col.themes).toHaveLength(0);
  });

  it("round-trips a written token tree", async () => {
    const c = makeConfig();
    const colorPrims = await runColorGeneration(
      c.inputs.brandColor,
      c.advanced?.color,
    );
    const space = runSpacingGeneration(
      c.inputs.spacingBase,
      c.advanced?.spacing,
    );
    const typo = runTypographyGeneration(
      c.inputs.typeScale,
      c.advanced?.typography,
    );
    const p = [...colorPrims, ...space, ...typo];
    const s = generateSemanticTokens(p);
    const coll = generateThemes(s, p, c.inputs.darkMode);
    await writeTokensToJson(coll, d);
    const loaded = await loadPriorCollection(c, d, { warn: () => {} });
    expect(loaded.primitives.length).toBe(p.length);
    const defaultTheme = loaded.themes.find((t) => t.name === "default");
    expect(
      (defaultTheme?.semanticTokens.length ?? 0) > 0,
    ).toBe(true);
  });

});

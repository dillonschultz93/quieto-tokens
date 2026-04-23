import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writeTokensToJson } from "../../output/json-writer.js";
import { sampleCollection } from "../../types/__fixtures__/tokens.js";
import type { QuietoConfig } from "../../types/config.js";
import { runUpdate } from "../update.js";
import type { UpdateResult } from "../../commands/update-flow.js";

describe("runUpdate", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "quieto-update-pipe-"));
  });

  afterEach(() => {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("regenerates spacing while loading color from disk when only spacing is modified", async () => {
    const collection = sampleCollection(["default"]);
    await writeTokensToJson(collection, tmpDir);

    const config: QuietoConfig = {
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
    };
    writeFileSync(
      join(tmpDir, "quieto.config.json"),
      JSON.stringify(config, null, 2),
      "utf-8",
    );

    const updateResult: UpdateResult = {
      modifiedCategories: ["spacing"],
      nextOptions: {
        brandColor: config.inputs.brandColor,
        spacingBase: 4,
        typeScale: config.inputs.typeScale,
        generateThemes: false,
      },
      nextAdvanced: undefined,
      nextCategoryConfigs: {},
    };

    const out = await runUpdate(config, updateResult, tmpDir);
    expect(out).not.toBeNull();
    const colorCount = out!.collection.primitives.filter(
      (t) => t.category === "color",
    ).length;
    const spacingCount = out!.collection.primitives.filter(
      (t) => t.category === "spacing",
    ).length;
    expect(colorCount).toBeGreaterThan(0);
    expect(spacingCount).toBeGreaterThan(0);
    expect(out!.modifiedCategories).toEqual(["spacing"]);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { ThemeCollection } from "../../types/tokens.js";

const sharedCol: ThemeCollection = {
  primitives: [
    {
      tier: "primitive",
      category: "color",
      name: "color.brand.500",
      $type: "color",
      $value: "#5B21B6",
      path: ["color", "brand", "500"],
    },
  ],
  themes: [{ name: "default", semanticTokens: [] }],
};

const runUpdate = vi.hoisted(() => vi.fn());
const loadPriorCollection = vi.hoisted(() => vi.fn());

vi.mock("../../pipeline/update.js", () => ({
  runUpdate: (config: unknown, u: unknown, _cwd: string) => {
    void config;
    void u;
    return runUpdate();
  },
}));

vi.mock("../../pipeline/diff-loader.js", () => ({
  loadPriorCollection: (c: unknown, cwd: string, l?: { warn: (m: string) => void }) =>
    loadPriorCollection(c, cwd, l),
  themeNamesFromConfig: (c: { inputs: { darkMode: boolean } }) =>
    c.inputs.darkMode ? ["light", "dark"] : ["default"],
}));

vi.mock("../update-flow.js", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../update-flow.js")>();
  return {
    ...mod,
    collectUpdateInputs: vi.fn().mockResolvedValue({
      modifiedCategories: ["color"],
      nextOptions: {
        brandColor: "#5B21B6",
        spacingBase: 8,
        typeScale: "balanced",
      },
      nextAdvanced: undefined,
      nextCategoryConfigs: {},
    }),
  };
});

import * as p from "@clack/prompts";
import { updateCommand } from "../update.js";

vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn(),
  note: vi.fn(),
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
}));

import * as configWriter from "../../output/config-writer.js";
vi.mock("../../output/config-writer.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../output/config-writer.js")>();
  return {
    ...actual,
    readToolVersion: vi.fn().mockResolvedValue("0.1.0"),
    writeConfig: vi.fn().mockResolvedValue("/fake/quieto.config.json"),
  };
});
vi.mock("../../output/pruner.js", () => ({
  prune: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../pipeline/output.js", () => ({
  runOutputGeneration: vi.fn().mockResolvedValue({ jsonFiles: [], cssFiles: [] }),
}));

describe("update no-changes (empty diff) early exit", () => {
  let tmp: string;
  let orig: string;
  beforeEach(() => {
    orig = process.cwd();
    vi.clearAllMocks();
    runUpdate.mockReset();
    loadPriorCollection.mockReset();
  });
  afterEach(() => {
    process.chdir(orig);
    if (tmp && existsSync(tmp)) {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("exits with info and does not write when prior matches pipeline output", async () => {
    const col = structuredClone(sharedCol);
    runUpdate.mockResolvedValue({
      collection: structuredClone(col),
      modifiedCategories: ["color"],
    });
    loadPriorCollection.mockResolvedValue(structuredClone(col));

    tmp = mkdtempSync(join(tmpdir(), "up-empty-"));
    process.chdir(tmp);
    writeFileSync(
      join(tmp, "quieto.config.json"),
      JSON.stringify(
        {
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
          categories: ["color", "spacing", "typography"],
        },
        null,
        2,
      ),
    );

    process.exitCode = undefined;
    await updateCommand();
    expect(vi.mocked(p.log.info)).toHaveBeenCalledWith(
      "No changes to apply — your token system is up to date.",
    );
    expect(vi.mocked(configWriter.writeConfig)).not.toHaveBeenCalled();
  });
});

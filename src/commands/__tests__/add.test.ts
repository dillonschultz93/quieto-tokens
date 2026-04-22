import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Behavioural coverage for `addCommand` — Story 2.4 Task 3 (AC #5, #6,
 * #12). We mock the command's collaborators (`configExists`, `loadConfig`,
 * `runAdd`, `writeConfig`, `readToolVersion`) so each branch of
 * `addCommand`'s control flow can be driven from the test without
 * touching the real filesystem or the full add pipeline.
 *
 * The pipeline E2E is already covered by `src/pipeline/__tests__/add.test.ts`.
 */

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

vi.mock("../../utils/config.js", () => ({
  configExists: vi.fn(),
  loadConfig: vi.fn(),
}));

vi.mock("../../output/config-writer.js", () => ({
  readToolVersion: vi.fn().mockResolvedValue("0.1.0"),
  buildConfig: vi.fn((args: { categories: string[] }) => ({
    version: "0.1.0",
    generated: "2026-04-17T12:00:00.000Z",
    inputs: {
      brandColor: "#3B82F6",
      spacingBase: 8,
      typeScale: "balanced",
      darkMode: true,
    },
    overrides: {},
    output: { tokensDir: "tokens", buildDir: "build", prefix: "quieto" },
    categories: args.categories,
  })),
  writeConfig: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../pipeline/add.js", () => ({
  runAdd: vi.fn(),
  rollbackNewFiles: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../output/changelog-writer.js", () => ({
  appendChangelog: vi.fn().mockResolvedValue({ path: "/tmp/TOKENS_CHANGELOG.md" }),
}));

import * as p from "@clack/prompts";
import { addCommand } from "../add.js";
import { configExists, loadConfig } from "../../utils/config.js";
import { writeConfig } from "../../output/config-writer.js";
import { appendChangelog } from "../../output/changelog-writer.js";
import { runAdd, rollbackNewFiles } from "../../pipeline/add.js";
import type { QuietoConfig } from "../../types/config.js";

function validConfig(overrides: Partial<QuietoConfig> = {}): QuietoConfig {
  return {
    version: "0.1.0",
    generated: "2026-04-17T12:00:00.000Z",
    inputs: {
      brandColor: "#3B82F6",
      spacingBase: 8,
      typeScale: "balanced",
      darkMode: true,
    },
    overrides: {},
    output: { tokensDir: "tokens", buildDir: "build", prefix: "quieto" },
    categories: ["color", "spacing", "typography"],
    ...overrides,
  };
}

describe("addCommand", () => {
  const originalExitCode = process.exitCode;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(p.isCancel).mockReturnValue(false);
    // `process.exitCode` is a globally mutable property on Node — reset
    // it before each test so a prior non-zero exit doesn't leak into
    // the next assertion. We restore the original in `afterEach` so
    // the whole suite stays isolated.
    process.exitCode = undefined;
  });

  afterEach(() => {
    process.exitCode = originalExitCode;
  });

  describe("missing-config branch (AC #12)", () => {
    it("exits non-zero with an error pointing at `init` when no quieto.config.json exists", async () => {
      vi.mocked(configExists).mockReturnValue(false);

      await addCommand({ category: "shadow" });

      expect(process.exitCode).toBe(1);
      expect(vi.mocked(p.log.error)).toHaveBeenCalledWith(
        expect.stringContaining("No quieto.config.json found"),
      );
      expect(vi.mocked(p.outro)).toHaveBeenCalledWith(
        expect.stringContaining("quieto-tokens init"),
      );
      expect(runAdd).not.toHaveBeenCalled();
      expect(writeConfig).not.toHaveBeenCalled();
    });
  });

  describe("corrupt-config recovery branch (AC #5)", () => {
    it("aborts with exit 1, no files written, and a descriptive error when the user picks `abort`", async () => {
      vi.mocked(configExists).mockReturnValue(true);
      vi.mocked(loadConfig).mockReturnValue({
        status: "corrupt",
        error: new Error("Unexpected token } in JSON at position 42"),
      });
      vi.mocked(p.select).mockResolvedValueOnce("abort");

      await addCommand({ category: "shadow" });

      expect(process.exitCode).toBe(1);
      // The "abort" branch surfaces the parse-failure summary via p.log.error.
      expect(vi.mocked(p.log.error)).toHaveBeenCalledWith(
        expect.stringMatching(
          /Couldn't read quieto\.config\.json.*Unexpected token/,
        ),
      );
      // Critically, the pipeline never runs and no config rewrite happens.
      expect(runAdd).not.toHaveBeenCalled();
      expect(writeConfig).not.toHaveBeenCalled();
      // The "Show details" branch was NOT taken — p.note should not have
      // been called to print parser details. (p.note may still be called
      // elsewhere, but the parser-details note shouldn't fire.)
      const noteCalls = vi.mocked(p.note).mock.calls;
      const parserNoteCall = noteCalls.find(([, title]) => title === "Parser error");
      expect(parserNoteCall).toBeUndefined();
    });

    it("also aborts cleanly on invalid config when the user picks `abort`", async () => {
      vi.mocked(configExists).mockReturnValue(true);
      vi.mocked(loadConfig).mockReturnValue({
        status: "invalid",
        errors: ["inputs.brandColor: expected hex string"],
      });
      vi.mocked(p.select).mockResolvedValueOnce("abort");

      await addCommand({ category: "shadow" });

      expect(process.exitCode).toBe(1);
      expect(vi.mocked(p.log.error)).toHaveBeenCalledWith(
        expect.stringContaining("missing required fields"),
      );
      expect(runAdd).not.toHaveBeenCalled();
      expect(writeConfig).not.toHaveBeenCalled();
    });
  });

  describe("re-author confirm branch (AC #6)", () => {
    const shadowConfigWithPriorShadow = validConfig({
      categories: ["color", "spacing", "typography", "shadow"],
      categoryConfigs: {
        shadow: {
          levels: 4,
          profile: "soft",
          colorRef: "{color.neutral.900}",
        },
      },
    });

    it("runs the pipeline when the user accepts the re-author confirm", async () => {
      vi.mocked(configExists).mockReturnValue(true);
      vi.mocked(loadConfig).mockReturnValue({
        status: "ok",
        config: shadowConfigWithPriorShadow,
      });
      vi.mocked(p.confirm).mockResolvedValueOnce(true);
      vi.mocked(runAdd).mockResolvedValueOnce({
        status: "ok",
        result: {
          categories: ["color", "spacing", "typography", "shadow"],
          categoryConfigs: {
            shadow: {
              levels: 3,
              profile: "hard",
              colorRef: "{color.neutral.900}",
            },
          },
          output: { jsonFiles: [], cssFiles: [] },
          collection: { primitives: [], themes: [] },
          newFiles: [],
        },
      });

      await addCommand({ category: "shadow" });

      expect(p.confirm).toHaveBeenCalledTimes(1);
      expect(p.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("shadow is already configured"),
          initialValue: false,
        }),
      );
      expect(runAdd).toHaveBeenCalledTimes(1);
      expect(writeConfig).toHaveBeenCalledTimes(1);
      expect(vi.mocked(appendChangelog)).toHaveBeenCalled();
      expect(process.exitCode).toBeUndefined();
    });

    it("bails out cleanly (no pipeline, no writes, exit 0) when the user declines the re-author confirm", async () => {
      vi.mocked(configExists).mockReturnValue(true);
      vi.mocked(loadConfig).mockReturnValue({
        status: "ok",
        config: shadowConfigWithPriorShadow,
      });
      vi.mocked(p.confirm).mockResolvedValueOnce(false);

      await addCommand({ category: "shadow" });

      expect(p.confirm).toHaveBeenCalledTimes(1);
      expect(runAdd).not.toHaveBeenCalled();
      expect(writeConfig).not.toHaveBeenCalled();
      expect(rollbackNewFiles).not.toHaveBeenCalled();
      // Decline is NOT an error — exit code stays zero.
      expect(process.exitCode).toBeUndefined();
      expect(vi.mocked(p.outro)).toHaveBeenCalledWith(
        expect.stringContaining("Nothing changed"),
      );
    });

    it("does NOT prompt for re-author when the category isn't already configured", async () => {
      vi.mocked(configExists).mockReturnValue(true);
      vi.mocked(loadConfig).mockReturnValue({
        status: "ok",
        config: validConfig({
          categories: ["color", "spacing", "typography"],
        }),
      });
      vi.mocked(runAdd).mockResolvedValueOnce({
        status: "ok",
        result: {
          categories: ["color", "spacing", "typography", "shadow"],
          categoryConfigs: {
            shadow: {
              levels: 3,
              profile: "hard",
              colorRef: "{color.neutral.900}",
            },
          },
          output: { jsonFiles: [], cssFiles: [] },
          collection: { primitives: [], themes: [] },
          newFiles: [],
        },
      });

      await addCommand({ category: "shadow" });

      expect(p.confirm).not.toHaveBeenCalled();
      expect(runAdd).toHaveBeenCalledTimes(1);
    });
  });

  describe("dry run (Story 3.3)", () => {
    it("does not call writeConfig and passes dryRun into runAdd", async () => {
      vi.mocked(configExists).mockReturnValue(true);
      vi.mocked(loadConfig).mockReturnValue({
        status: "ok",
        config: validConfig(),
      });
      vi.mocked(runAdd).mockResolvedValueOnce({
        status: "ok",
        result: {
          categories: ["color", "spacing", "typography", "shadow"],
          categoryConfigs: {
            shadow: {
              levels: 3,
              profile: "hard",
              colorRef: "{color.neutral.900}",
            },
          },
          output: { jsonFiles: [], cssFiles: [] },
          collection: { primitives: [], themes: [] },
          newFiles: [],
        },
      });

      await addCommand({ category: "shadow", dryRun: true });

      expect(vi.mocked(runAdd)).toHaveBeenCalledWith(
        "shadow",
        expect.anything(),
        expect.any(String),
        { dryRun: true },
      );
      expect(writeConfig).not.toHaveBeenCalled();
      expect(vi.mocked(appendChangelog)).not.toHaveBeenCalled();
      expect(vi.mocked(p.outro)).toHaveBeenCalledWith(
        "Dry run complete — no files were written.",
      );
    });
  });
});

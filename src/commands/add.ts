import { relative } from "node:path";
import * as p from "@clack/prompts";
import { configExists, loadConfig } from "../utils/config.js";
import {
  readToolVersion,
  buildConfig,
  writeConfig,
} from "../output/config-writer.js";
import { appendChangelog } from "../output/changelog-writer.js";
import { buildAddSummary } from "../output/changelog-summary.js";
import type { AddableCategory } from "../utils/categories.js";
import type { QuietoConfig } from "../types/config.js";
import { runAdd, rollbackNewFiles } from "../pipeline/add.js";
import type { QuickStartOptions } from "../types.js";

export interface AddCommandOptions {
  category?: AddableCategory;
  /**
   * When true, run prompts and generation but skip all writes (Story 3.3).
   */
  dryRun?: boolean;
}

const ADD_CATEGORY_LABEL: Record<AddableCategory, string> = {
  shadow: "Shadow (elevation ramp)",
  border: "Border (widths + radii)",
  animation: "Animation (durations + easing)",
};

export async function addCommand(
  options: AddCommandOptions = {},
): Promise<void> {
  const { dryRun = false } = options;
  p.intro("◆  quieto-tokens — Add a new token category.");

  try {
    let category = options.category;

    if (category === undefined) {
      const selected = await p.select({
        message: "Which category would you like to add?",
        options: [
          {
            value: "shadow" as const,
            label: ADD_CATEGORY_LABEL.shadow,
          },
          {
            value: "border" as const,
            label: ADD_CATEGORY_LABEL.border,
          },
          {
            value: "animation" as const,
            label: ADD_CATEGORY_LABEL.animation,
          },
          { value: "__cancel__" as const, label: "Cancel" },
        ],
      });
      if (p.isCancel(selected) || selected === "__cancel__") {
        p.cancel(dryRun ? "Dry run cancelled." : "Operation cancelled.");
        return;
      }
      category = selected as AddableCategory;
    }

    const cwd = process.cwd();

    if (!configExists(cwd)) {
      p.log.error(
        "No quieto.config.json found — `add` needs an existing token system to extend.",
      );
      p.outro(
        "Run `quieto-tokens init` first to create a token system, then add categories.",
      );
      process.exitCode = 1;
      return;
    }

    const toolVersion = await readToolVersion().catch(() => undefined);
    const loaded = loadConfig(cwd, {
      toolVersion,
      logger: { warn: (message) => p.log.warn(message) },
    });

    if (loaded.status === "missing") {
      p.log.error(
        "quieto.config.json disappeared between detection and load — refusing to continue so we don't overwrite anything.",
      );
      p.outro("Re-run `quieto-tokens add` once the filesystem has settled.");
      process.exitCode = 1;
      return;
    }

    if (loaded.status === "corrupt" || loaded.status === "invalid") {
      const label =
        loaded.status === "corrupt"
          ? `Couldn't read quieto.config.json: ${loaded.error.message}`
          : `quieto.config.json is missing required fields: ${loaded.errors.join(", ")}.`;
      p.log.error(label);

      const recovery = await p.select({
        message: "How would you like to proceed?",
        options: [
          {
            value: "abort" as const,
            label: "Abort",
            hint: "Exit without touching anything so you can fix the file manually",
          },
          {
            value: "details" as const,
            label: "Show details",
            hint: "Print the validator / parser output",
          },
        ],
      });
      // Ctrl-C at the recovery prompt is also an abort — treat it as
      // cancel so the user gets consistent messaging and the next
      // recovery prompt (if any) doesn't silently swallow the intent.
      if (p.isCancel(recovery)) {
        p.cancel(dryRun ? "Dry run cancelled." : "Operation cancelled.");
        process.exitCode = 1;
        return;
      }
      if (loaded.status === "invalid" && recovery === "details") {
        p.note(loaded.errors.join("\n"), "Validation errors");
      } else if (loaded.status === "corrupt" && recovery === "details") {
        p.note(loaded.error.message, "Parser error");
      }
      p.outro(
        "Fix quieto.config.json and re-run `quieto-tokens add <category>`.",
      );
      process.exitCode = 1;
      return;
    }

    const config = loaded.config;

    if (config.categories.includes(category)) {
      const confirmed = await p.confirm({
        message: `${category} is already configured. Re-author it? This overwrites tokens/primitive/${category}.json and tokens/semantic/*/${category}.json.`,
        initialValue: false,
      });
      if (p.isCancel(confirmed) || confirmed === false) {
        p.outro("Nothing changed.");
        return;
      }
    }

    const outcome = await runAdd(category, config, cwd, { dryRun });
    if (outcome.status === "cancelled") {
      // Graceful cancel inside the pipeline (a prompt, not a
      // programming error) — the pipeline already printed `Operation
      // cancelled.` via `p.cancel`. Exit 0 so CI doesn't misread it.
      return;
    }
    if (outcome.status === "error") {
      process.exitCode = 1;
      return;
    }
    const result = outcome.result;

    if (dryRun) {
      p.outro("Dry run complete — no files were written.");
      return;
    }

    // --- Persist config ---
    let newVersion: string;
    try {
      newVersion = await readToolVersion();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      p.log.error(`Failed to resolve tool version: ${message}`);
      await rollbackNewFiles(result.newFiles, cwd);
      p.outro(
        `${category} tokens rolled back — re-run quieto-tokens add ${category} to retry.`,
      );
      process.exitCode = 1;
      return;
    }

    const nextConfig = buildNextConfig({
      prev: config,
      newVersion,
      newCategories: result.categories,
      newCategoryConfigs: result.categoryConfigs,
    });

    try {
      await writeConfig(nextConfig, cwd);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      p.log.error(`Failed to write quieto.config.json: ${message}`);
      // Rollback: the tokens landed on disk but the config never
      // did — left alone, the next run would treat those files as
      // orphans or, worse, re-prompt for a category the user has
      // already authored. Roll back the new category's files so disk
      // state matches the (unchanged) config again.
      await rollbackNewFiles(result.newFiles, cwd);
      p.outro(
        `${category} tokens rolled back — re-run quieto-tokens add ${category} to retry.`,
      );
      process.exitCode = 1;
      return;
    }

    const changelogRes = await appendChangelog(
      {
        timestamp: new Date().toISOString(),
        toolVersion: newVersion,
        command: `add ${category}`,
        categoriesAffected: [category],
        summary: buildAddSummary(category, result.collection, result.output),
      },
      cwd,
    );
    if ("error" in changelogRes) {
      p.log.warn(
        `Could not update TOKENS_CHANGELOG.md: ${changelogRes.error}`,
      );
    }

    const allFiles = [...result.output.jsonFiles, ...result.output.cssFiles];
    const fileListLines = allFiles
      .map((file) => `  ${formatPath(file, cwd)}`)
      .join("\n");

    p.log.success(
      `Added ${category} tokens!\n\nFiles written:\n${fileListLines}`,
    );
    p.log.info(
      `${result.categories.length} categor${result.categories.length === 1 ? "y" : "ies"} configured: ${result.categories.join(", ")}`,
    );

    p.outro(`Added ${category} — config updated.`);
  } catch (error) {
    if (error instanceof Error && error.message === "cancelled") {
      return;
    }
    p.cancel("Something went wrong.");
    throw error;
  }
}

interface BuildNextConfigInput {
  prev: QuietoConfig;
  newVersion: string;
  newCategories: string[];
  newCategoryConfigs: QuietoConfig["categoryConfigs"];
}

function buildNextConfig(input: BuildNextConfigInput): QuietoConfig {
  const options: QuickStartOptions = {
    brandColor: input.prev.inputs.brandColor,
    spacingBase: input.prev.inputs.spacingBase,
    typeScale: input.prev.inputs.typeScale,
    generateThemes: input.prev.inputs.darkMode,
  };
  const overrides = new Map(Object.entries(input.prev.overrides ?? {}));
  const next = buildConfig({
    options,
    overrides,
    version: input.newVersion,
    advanced: input.prev.advanced,
    categories: input.newCategories,
    categoryConfigs: input.newCategoryConfigs,
    outputs: input.prev.outputs,
    androidFormat: input.prev.androidFormat,
  });
  next.output = { ...input.prev.output };
  if (input.prev.$schema) {
    next.$schema = input.prev.$schema;
  }
  return next;
}

function formatPath(absolutePath: string, cwd: string): string {
  const rel = relative(cwd, absolutePath);
  if (rel.length === 0) return absolutePath;
  return rel;
}

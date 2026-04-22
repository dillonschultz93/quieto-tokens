import { relative } from "node:path";
import * as p from "@clack/prompts";
import { configExists, loadConfig } from "../utils/config.js";
import { readToolVersion, buildConfig, writeConfig } from "../output/config-writer.js";
import { prune } from "../output/pruner.js";
import { sortCategoriesCanonical } from "../utils/categories.js";
import { previewAndConfirm } from "../ui/preview.js";
import { runOutputGeneration } from "../pipeline/output.js";
import { loadPriorCollection } from "../pipeline/diff-loader.js";
import { applyPriorOverrides } from "../utils/overrides.js";
import {
  detectOverrideConflicts,
  resolveOverrideConflicts,
} from "../utils/override-conflicts.js";
import { collectUpdateInputs, type UpdateResult } from "./update-flow.js";
import { runUpdate } from "../pipeline/update.js";
import type { QuietoConfig } from "../types/config.js";
import type { ThemeCollection } from "../types/tokens.js";
import {
  computeTokenDiff,
  renderCascadeSummary,
  renderTokenDiff,
} from "../ui/diff.js";

export interface UpdateCommandOptions {
  /**
   * When true, the diff and preview run but no files are written (Story 3.3).
   */
  dryRun?: boolean;
}

export async function updateCommand(
  options: UpdateCommandOptions = {},
): Promise<void> {
  const { dryRun = false } = options;
  p.intro(
    "◆  quieto-tokens — Update specific categories (with a change diff before you write).",
  );

  try {
    const cwd = process.cwd();

    if (!configExists(cwd)) {
      p.log.error(
        "No token system found — run 'quieto-tokens init' first.",
      );
      p.outro("Create a token system with `quieto-tokens init`, then re-run update.");
      process.exitCode = 1;
      return;
    }

    const toolVersion = await readToolVersion().catch(() => undefined);
    const loaded = loadConfig(cwd, {
      toolVersion,
      logger: { warn: (m) => p.log.warn(m) },
    });

    if (loaded.status === "missing") {
      p.log.error(
        "quieto.config.json disappeared between detection and load — refusing to continue so we don't overwrite anything.",
      );
      p.outro("Re-run `quieto-tokens update` once the filesystem has settled.");
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
      if (p.isCancel(recovery) || recovery === "abort") {
        p.outro(
          "Fix quieto.config.json (or delete it and re-run `quieto-tokens init`) to continue.",
        );
        process.exitCode = 1;
        return;
      }
      if (loaded.status === "invalid" && recovery === "details") {
        p.note(loaded.errors.join("\n"), "Validation errors");
      } else if (loaded.status === "corrupt" && recovery === "details") {
        p.note(loaded.error.message, "Parser error");
      }
      p.outro("Fix the config file and re-run `quieto-tokens update`.");
      process.exitCode = 1;
      return;
    }

    const config = loaded.config;

    const themeLabel = config.inputs.darkMode
      ? "light + dark"
      : "single theme";
    const componentCount = config.components
      ? Object.keys(config.components).length
      : 0;
    p.log.step(
      [
        "Current token system:",
        `  Brand color:   ${config.inputs.brandColor}`,
        `  Spacing base:  ${config.inputs.spacingBase}px`,
        `  Type scale:    ${config.inputs.typeScale}`,
        `  Themes:        ${themeLabel}`,
        `  Categories:    ${config.categories.join(", ")}`,
        `  Components:    ${componentCount}`,
      ].join("\n"),
    );

    let lastUpdateResult = await collectUpdateInputs(config);

    if (lastUpdateResult.modifiedCategories.length === 0) {
      p.log.info("No changes to apply.");
      p.outro("Nothing was modified.");
      return;
    }

    for (;;) {
      const updateResult = lastUpdateResult;
      const pipeline = await runUpdate(config, updateResult, cwd, {
        warn: (m) => p.log.warn(m),
      });
      if (!pipeline) {
        process.exitCode = 1;
        return;
      }

      const priorOverrides = config.overrides ?? {};
      const conflicts = detectOverrideConflicts(
        priorOverrides,
        pipeline.collection,
      );
      const cleanedOverrides: Record<string, string> =
        conflicts.length > 0
          ? await resolveOverrideConflicts(
              conflicts,
              priorOverrides,
              pipeline.collection,
            )
          : { ...priorOverrides };

      if (Object.keys(cleanedOverrides).length > 0) {
        applyPriorOverrides(pipeline.collection, cleanedOverrides);
      }

      const priorCollection = await loadPriorCollection(
        config,
        cwd,
        { warn: () => {} },
      );
      const diff = computeTokenDiff(
        priorCollection,
        pipeline.collection,
      );
      if (diff.isEmpty) {
        p.log.info(
          "No changes to apply — your token system is up to date.",
        );
        p.outro("No files were written.");
        return;
      }

      const modifiedScope = new Set<string>(updateResult.modifiedCategories);
      renderTokenDiff(
        diff,
        pipeline.collection.primitives,
        { modifiedCategories: modifiedScope },
      );
      renderCascadeSummary(diff, pipeline.collection);
      if (
        pipeline.collection.components &&
        pipeline.collection.components.length > 0
      ) {
        p.log.info(
          "Component tokens are unchanged — they reference semantic tokens and will inherit your changes via the CSS cascade.",
        );
      }

      for (;;) {
        const action = await p.select({
          message: "What would you like to do?",
          options: dryRun
            ? [
                {
                  value: "end" as const,
                  label: "End dry run",
                  hint: "Exit — no files will be written",
                },
                {
                  value: "preview" as const,
                  label: "Review full token preview",
                  hint: "See all tokens (not just changes) with the override editor",
                },
                {
                  value: "back" as const,
                  label: "Go back and modify further",
                  hint: "Return to category picker",
                },
                {
                  value: "cancel" as const,
                  label: "Cancel",
                  hint: "Exit without writing",
                },
              ]
            : [
                {
                  value: "accept" as const,
                  label: "Accept changes and write",
                  hint: "Write modified token files and rebuild CSS",
                },
                {
                  value: "preview" as const,
                  label: "Review full token preview",
                  hint: "See all tokens (not just changes) with the override editor",
                },
                {
                  value: "back" as const,
                  label: "Go back and modify further",
                  hint: "Return to category picker",
                },
                {
                  value: "cancel" as const,
                  label: "Cancel",
                  hint: "Exit without writing",
                },
              ],
        });
        if (p.isCancel(action) || action === "cancel") {
          p.cancel(dryRun ? "Dry run cancelled." : "No changes written.");
          return;
        }
        if (action === "end" && dryRun) {
          p.log.info("Dry run — skipping file writes.");
          p.outro("Dry run complete — no files were written.");
          return;
        }
        if (action === "back") {
          lastUpdateResult = await collectUpdateInputs(config);
          if (lastUpdateResult.modifiedCategories.length === 0) {
            p.log.info("No changes to apply.");
            p.outro("Nothing was modified.");
            return;
          }
          break;
        }
        if (action === "preview") {
          const toPreview = structuredClone(pipeline.collection);
          const previewResult = await previewAndConfirm(toPreview, {
            initialOverrides: new Map(Object.entries(cleanedOverrides)),
            dryRun,
          });
          if (!previewResult) {
            continue;
          }
          if (dryRun) {
            p.log.info("Dry run — skipping file writes.");
            continue;
          }
          const scopedCategories = [
            ...new Set([
              ...pipeline.modifiedCategories,
              ...getChangedOverrideCategories(
                cleanedOverrides,
                previewResult.overrides,
              ),
            ]),
          ];
          await finalizeWrite(
            config,
            cwd,
            updateResult,
            previewResult.collection,
            previewResult.overrides,
            scopedCategories,
            config.components,
          );
          return;
        }
        if (action === "accept") {
          const finalOverrides = new Map<string, string>(
            Object.entries(cleanedOverrides) as [string, string][],
          );
          const scopedCategories = [
            ...new Set([
              ...pipeline.modifiedCategories,
              ...getChangedOverrideCategories(
                cleanedOverrides,
                finalOverrides,
              ),
            ]),
          ];
          await finalizeWrite(
            config,
            cwd,
            updateResult,
            pipeline.collection,
            finalOverrides,
            scopedCategories,
            config.components,
          );
          return;
        }
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message === "cancelled") {
      return;
    }
    p.cancel("Something went wrong.");
    throw error;
  }
}

function normalizeOverrides(
  overrides: unknown,
): Map<string, unknown> {
  if (overrides instanceof Map) {
    return new Map(overrides.entries());
  }

  if (overrides && typeof overrides === "object") {
    return new Map(Object.entries(overrides as Record<string, unknown>));
  }

  return new Map();
}

function extractCategoryFromOverrideKey(key: string): string | null {
  const trimmedKey = key.trim();

  if (trimmedKey.length === 0) {
    return null;
  }

  const separatorMatch = /[./]/.exec(trimmedKey);
  if (!separatorMatch || separatorMatch.index === 0) {
    return trimmedKey;
  }

  return trimmedKey.slice(0, separatorMatch.index);
}

function getChangedOverrideCategories(
  previousOverrides: unknown,
  nextOverrides: unknown,
): string[] {
  const previous = normalizeOverrides(previousOverrides);
  const next = normalizeOverrides(nextOverrides);
  const changedCategories = new Set<string>();
  const keys = new Set([...previous.keys(), ...next.keys()]);

  for (const key of keys) {
    if (previous.get(key) === next.get(key)) {
      continue;
    }

    const category = extractCategoryFromOverrideKey(key);
    if (category) {
      changedCategories.add(category);
    }
  }

  return [...changedCategories];
}

function formatPath(absolutePath: string, cwd: string): string {
  const rel = relative(cwd, absolutePath);
  return rel.length > 0 && !rel.startsWith("..") ? rel : absolutePath;
}

async function finalizeWrite(
  config: QuietoConfig,
  cwd: string,
  updateResult: UpdateResult,
  collection: ThemeCollection,
  overrides: Map<string, string>,
  scopedCategories: string[],
  components: QuietoConfig["components"],
): Promise<void> {
  const outputResult = await runOutputGeneration(collection, cwd, {
    scope: { categories: scopedCategories },
    skipComponents: true,
  });
  if (!outputResult) {
    process.exitCode = 1;
    return;
  }
  const version = await readToolVersion();
  const mergedCategoryConfigs: Record<string, unknown> = {
    ...(config.categoryConfigs ?? {}),
    ...updateResult.nextCategoryConfigs,
  };
  const categoryConfigs =
    Object.keys(mergedCategoryConfigs).length > 0
      ? (mergedCategoryConfigs as typeof config.categoryConfigs)
      : undefined;
  const built = buildConfig({
    options: updateResult.nextOptions,
    overrides,
    version,
    advanced: updateResult.nextAdvanced,
    categories: sortCategoriesCanonical(config.categories),
    categoryConfigs,
    components: config.components,
  });
  built.output = { ...config.output };
  if (config.$schema) {
    built.$schema = config.$schema;
  }
  p.log.step("Saving config…");
  let configPath: string;
  try {
    configPath = await writeConfig(built, cwd);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    p.log.error(`Failed to write quieto.config.json: ${message}`);
    p.outro(
      "Tokens were written, but config save failed — fix permissions and re-run.",
    );
    process.exitCode = 1;
    return;
  }
  const themeNames = collection.themes.map((t) => t.name);
  const knownComponents = components
    ? Object.keys(components)
    : undefined;
  await prune(
    cwd,
    sortCategoriesCanonical(built.categories),
    themeNames,
    knownComponents,
  );
  const allFiles = [
    ...outputResult.jsonFiles,
    ...outputResult.cssFiles,
    configPath,
  ];
  const fileListLines = allFiles
    .map((file) => `  ${formatPath(file, cwd)}`)
    .join("\n");
  p.log.success(`Update complete!\n\nFiles written:\n${fileListLines}`);
  p.log.info(
    [
      "What's next:",
      "  • Import your built CSS as before",
      '  • Run "quieto-tokens update" again to tweak another category',
      '  • Run "quieto-tokens init" for a full regeneration pass',
    ].join("\n"),
  );
  p.outro("Config saved — your selective updates are on disk.");
}

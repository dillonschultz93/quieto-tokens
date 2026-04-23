import * as p from "@clack/prompts";
import { configExists, loadConfig } from "../utils/config.js";
import { readToolVersion } from "../output/config-writer.js";
import { appendChangelog } from "../output/changelog-writer.js";
import {
  buildInitSummary,
  type InitChangelogContext,
} from "../output/changelog-summary.js";
import { sortCategoriesCanonical } from "../utils/categories.js";
import { quickStartFlow } from "./quick-start.js";
import {
  buildPriorContext,
  deriveBaselineFromConfig,
  type PriorContext,
} from "./modify.js";
import { runAdvancedFlow } from "./advanced.js";
import type { QuickStartOptions } from "../types.js";
import {
  type OutputPlatform,
  DEFAULT_OUTPUTS,
  type AdvancedConfig,
} from "../types/config.js";
import { runColorGeneration } from "../pipeline/color.js";
import {
  runSpacingGeneration,
  runTypographyGeneration,
} from "../pipeline/spacing-typography.js";
import { generateSemanticTokens } from "../mappers/semantic.js";
import { generateThemes } from "../generators/themes.js";
import { previewAndConfirm } from "../ui/preview.js";
import { runOutputGeneration } from "../pipeline/output.js";
import { runConfigGeneration } from "../pipeline/config.js";
import { applyPriorOverrides } from "../utils/overrides.js";

export interface InitCommandOptions {
  /**
   * When true, enter advanced mode after the baseline is established.
   * Advanced mode walks the user through per-category step-by-step authoring
   * (additional color ramps, custom spacing values, typography overrides).
   *
   * Forced `true` implicitly when `modify` is chosen from the existing-config
   * prompt — modify-flow IS advanced-flow with the prior config pre-loaded.
   */
  advanced?: boolean;
  /**
   * When true, run the full init pipeline (including preview) but skip
   * writing JSON, CSS, and config (Story 3.3).
   */
  dryRun?: boolean;
}

export async function initCommand(
  initOptions: InitCommandOptions = {},
): Promise<void> {
  let { advanced = false, dryRun = false } = initOptions;
  p.intro("◆  quieto-tokens — Design tokens, made yours.");

  if (dryRun) {
    p.log.info("🔍 Dry run mode — no files will be written.");
  }

  if (advanced) {
    p.log.info(
      "Advanced mode: you'll be walked through each category step by step.",
    );
  }

  try {
    const hasConfig = configExists();

    // When modify is selected, we derive the baseline from the loaded config
    // instead of re-prompting. `priorContext` carries the full config to the
    // advanced flow so each step can offer "keep current" defaults.
    let baseline: QuickStartOptions | null = null;
    let priorContext: PriorContext | null = null;

    if (hasConfig) {
      const action = await p.select({
        message:
          "An existing token system was found. What would you like to do?",
        options: [
          {
            value: "modify" as const,
            label: "Modify existing system",
            hint: "Update specific categories while preserving your overrides",
          },
          {
            value: "fresh" as const,
            label: "Start fresh",
            hint: "Replace the current token system with a new one",
          },
        ],
      });

      if (p.isCancel(action)) {
        p.cancel(dryRun ? "Dry run cancelled." : "Operation cancelled.");
        return;
      }

      if (action === "modify") {
        // Load the existing config through the Clack-backed logger so any
        // "newer-tool" advisory surfaces as a proper step in the UI instead
        // of a bare console.warn.
        const toolVersion = await readToolVersion().catch(() => undefined);
        const loaded = loadConfig(process.cwd(), {
          toolVersion,
          logger: {
            warn: (message) => p.log.warn(message),
          },
        });

        if (loaded.status === "missing") {
          // Raced: file existed at the configExists check but not at load.
          // Rather than silently reverting to a fresh-start flow (which
          // could surprise a user whose config was mid-rotation), surface
          // the discrepancy and bail out so they can investigate.
          p.log.error(
            "quieto.config.json disappeared between detection and load — refusing to continue so we don't overwrite anything by accident.",
          );
          p.outro(
            "Re-run `quieto-tokens init` once the filesystem has settled.",
          );
          process.exitCode = 1;
          return;
        } else if (loaded.status === "corrupt" || loaded.status === "invalid") {
          // AC-9: on corrupt/invalid, offer Abort vs Start-fresh instead of
          // unilaterally exiting. Start-fresh drops the bad file onto the
          // caller's head only after an explicit confirm.
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
                value: "fresh" as const,
                label: "Start fresh",
                hint: "Replace the broken config with a new token system (overwrites on save)",
              },
            ],
          });

          if (p.isCancel(recovery)) {
            if (dryRun) {
              p.cancel("Dry run cancelled.");
            } else {
              p.outro(
                "Fix the file (or delete it and re-run `quieto-tokens init`) to continue.",
              );
            }
            process.exitCode = 1;
            return;
          }
          if (recovery === "abort") {
            p.outro(
              "Fix the file (or delete it and re-run `quieto-tokens init`) to continue.",
            );
            process.exitCode = 1;
            return;
          }
          // Fall through into the fresh-start path with no baseline /
          // priorContext — same as if no config ever existed.
        } else {
          baseline = deriveBaselineFromConfig(loaded.config);
          priorContext = buildPriorContext(loaded.config);
          // Modify-flow IS advanced-flow — force it even when `--advanced`
          // was not explicitly passed.
          advanced = true;
          p.log.step(
            [
              "Loaded existing preferences:",
              `  Brand color:   ${baseline.brandColor}`,
              `  Spacing base:  ${baseline.spacingBase}px`,
              `  Type scale:    ${baseline.typeScale}`,
              `  Themes:        ${baseline.generateThemes ? "light + dark" : "single theme"}`,
            ].join("\n"),
          );
        }
      }
    } else if (!advanced) {
      // AC-18: first run on a clean project — ask up front whether the
      // user wants a quick start or the advanced walkthrough. No config
      // file exists and no `--advanced` flag was passed, so we have room
      // to offer the choice without stepping on a CI/script caller.
      const mode = await p.select({
        message: "How would you like to build your token system?",
        options: [
          {
            value: "quick" as const,
            label: "Quick start",
            hint: "3–4 questions, opinionated defaults — the fastest path",
          },
          {
            value: "advanced" as const,
            label: "Advanced",
            hint: "Customize color ramps, spacing steps, and typography per category",
          },
        ],
      });
      if (p.isCancel(mode)) {
        p.cancel(dryRun ? "Dry run cancelled." : "Operation cancelled.");
        return;
      }
      if (mode === "advanced") {
        advanced = true;
        p.log.info(
          "Advanced mode: you'll be walked through each category step by step.",
        );
      }
    }

    const options: QuickStartOptions = baseline ?? (await quickStartFlow());

    // AC-22 hygiene: if the user chose a new spacing base, any
    // `customValues` keyed to the old ramp are stale (the keys reference
    // nonexistent steps at the new base). Drop them from the prior
    // context BEFORE advanced-spacing collects fresh input, and tell the
    // user what happened so the loss of overrides isn't silent.
    let adjustedPriorContext: PriorContext | null = priorContext;
    if (
      priorContext &&
      baseline &&
      baseline.spacingBase !== options.spacingBase
    ) {
      const customValues =
        priorContext.config.advanced?.spacing?.customValues ?? {};
      if (Object.keys(customValues).length > 0) {
        p.log.info(
          `Spacing base changed ${baseline.spacingBase}px → ${options.spacingBase}px; clearing ${Object.keys(customValues).length} stale spacing override(s).`,
        );
        const cleaned: typeof priorContext.config = {
          ...priorContext.config,
          advanced: priorContext.config.advanced
            ? {
                ...priorContext.config.advanced,
                spacing: { customValues: {} },
              }
            : undefined,
        };
        adjustedPriorContext = { config: cleaned };
      }
    }

    const advancedConfig: AdvancedConfig | undefined = advanced
      ? await runAdvancedFlow(options, adjustedPriorContext)
      : undefined;

    const themeLabel = options.generateThemes ? "light + dark" : "single theme";
    p.log.step(
      [
        "Your preferences:",
        `  Brand color:   ${options.brandColor}`,
        `  Spacing base:  ${options.spacingBase}px`,
        `  Type scale:    ${options.typeScale}`,
        `  Themes:        ${themeLabel}`,
      ].join("\n"),
    );

    const colorTokens = await runColorGeneration(
      options.brandColor,
      advancedConfig?.color,
    );

    const spacingTokens = runSpacingGeneration(
      options.spacingBase,
      advancedConfig?.spacing,
    );
    const typographyTokens = runTypographyGeneration(
      options.typeScale,
      advancedConfig?.typography,
    );

    const allPrimitives = [
      ...colorTokens,
      ...spacingTokens,
      ...typographyTokens,
    ];

    p.log.info(
      `${allPrimitives.length} total primitives generated (${colorTokens.length} color, ${spacingTokens.length} spacing, ${typographyTokens.length} typography)`,
    );

    const semanticTokens = generateSemanticTokens(allPrimitives);

    const themeCollection = generateThemes(
      semanticTokens,
      allPrimitives,
      options.generateThemes,
    );

    // AC-5 / modify-flow: when the user is editing a prior config, pre-
    // apply their previously-saved semantic overrides to the collection so
    // the preview reflects what they last chose instead of re-presenting
    // the fresh mapper output and silently forgetting their tweaks.
    const priorOverrides = priorContext?.config.overrides ?? {};
    if (Object.keys(priorOverrides).length > 0) {
      applyPriorOverrides(themeCollection, priorOverrides);
    }

    let outputPlatforms: OutputPlatform[] = [...DEFAULT_OUTPUTS];
    if (priorContext) {
      outputPlatforms = priorContext.config.outputs ?? [...DEFAULT_OUTPUTS];
    } else {
      const platformPick = await p.multiselect({
        message: "Which output platforms should be enabled?",
        options: [
          {
            value: "css" as const,
            label: "CSS custom properties",
            hint: "Required — always generated as build/*.css",
          },
          {
            value: "figma" as const,
            label: "Figma JSON (Variables / Tokens Studio)",
            hint: "Optional — build/tokens.figma.json for manual import",
          },
        ],
        initialValues: ["css" as const],
        required: true,
      });
      if (p.isCancel(platformPick)) {
        p.cancel(dryRun ? "Dry run cancelled." : "Operation cancelled.");
        return;
      }
      const picked = new Set(platformPick as OutputPlatform[]);
      picked.add("css");
      outputPlatforms = picked.has("figma")
        ? ["css", "figma"]
        : ["css"];
    }

    const previewResult = await previewAndConfirm(themeCollection, {
      initialOverrides: new Map(Object.entries(priorOverrides)),
      dryRun,
    });

    if (!previewResult) {
      return;
    }

    if (dryRun) {
      p.log.info("Dry run — skipping file writes.");
      p.outro("Dry run complete — no files were written.");
      return;
    }

    const outputResult = await runOutputGeneration(previewResult.collection, process.cwd(), {
      outputs: outputPlatforms,
    });

    if (!outputResult) {
      process.exitCode = 1;
      return;
    }

    const configOk = await runConfigGeneration({
      options,
      overrides: previewResult.overrides,
      output: outputResult,
      advanced: advancedConfig,
      themeNames: previewResult.collection.themes.map((t) => t.name),
      outputs: outputPlatforms,
    });

    if (!configOk) {
      process.exitCode = 1;
      return;
    }

    const initChangelogContext: InitChangelogContext = priorContext
      ? "modify"
      : hasConfig
        ? "regenerate"
        : "initial";
    const toolVersion = await readToolVersion();
    const catForLog = new Set(
      previewResult.collection.primitives.map((t) => t.category),
    );
    const changelogRes = await appendChangelog(
      {
        timestamp: new Date().toISOString(),
        toolVersion,
        command: "init",
        categoriesAffected: sortCategoriesCanonical([...catForLog]),
        summary: buildInitSummary(
          previewResult.collection,
          initChangelogContext,
          outputResult,
        ),
      },
      process.cwd(),
    );
    if ("error" in changelogRes) {
      p.log.warn(
        `Could not update TOKENS_CHANGELOG.md: ${changelogRes.error}`,
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message === "cancelled") {
      return;
    }
    p.cancel("Something went wrong.");
    throw error;
  }
}


import { relative } from "node:path";
import * as p from "@clack/prompts";
import type { QuickStartOptions } from "../types.js";
import type { AdvancedConfig } from "../types/config.js";
import {
  buildConfig,
  readToolVersion,
  writeConfig,
} from "../output/config-writer.js";
import { prune } from "../output/pruner.js";
import { sortCategoriesCanonical } from "../utils/categories.js";
import type { OutputPlatform } from "../types/config.js";
import type { OutputResult } from "./output.js";

export interface ConfigGenerationInput {
  options: QuickStartOptions;
  overrides: Map<string, string>;
  output: OutputResult;
  cwd?: string;
  /**
   * Advanced-mode authoring details collected by `runAdvancedFlow`.
   * `undefined` for quick-start runs — the config will omit the `advanced`
   * block entirely.
   */
  advanced?: AdvancedConfig;
  /**
   * Active categories list written into `config.categories`. Defaults to
   * the three core categories when omitted.
   */
  categories?: string[];
  /**
   * Names of the themes the pipeline wrote into `tokens/semantic/<name>/`.
   * When provided, the post-write prune step uses this list to detect
   * *orphan* theme directories (e.g. a `dark/` folder left over after the
   * user toggled `darkMode: false`) and delete them wholesale.
   *
   * When omitted, the prune step only deletes *category* orphans inside
   * every semantic subdirectory it finds — safer default for callers that
   * can't cheaply enumerate the active themes.
   */
  themeNames?: readonly string[];
  /** Build targets (CSS + optional Figma). When omitted, uses CSS only. */
  outputs?: readonly OutputPlatform[];
  /** When `outputs` includes `android`, persisted to config. */
  androidFormat?: "xml" | "compose";
}

/**
 * Format an absolute path relative to `cwd` for narrative output. Mirrors
 * the helper in `pipeline/output.ts`; duplicated rather than exported to
 * keep the two pipeline steps decoupled.
 */
function formatPath(absolutePath: string, cwd: string): string {
  const rel = relative(cwd, absolutePath);
  return rel.length > 0 && !rel.startsWith("..") ? rel : absolutePath;
}

/**
 * Write `quieto.config.json` and render the final success summary + outro.
 * Returns `true` when the full close-out succeeded, `false` when the config
 * write failed (caller is expected to set a non-zero exit code).
 */
export async function runConfigGeneration(
  input: ConfigGenerationInput,
): Promise<boolean> {
  const cwd = input.cwd ?? process.cwd();

  p.log.step("Saving config…");

  let version: string;
  try {
    version = await readToolVersion();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    p.log.error(`Failed to resolve tool version: ${message}`);
    p.outro(
      "Token system generated, but config not saved — re-run quieto-tokens init to retry.",
    );
    return false;
  }

  const config = buildConfig({
    options: input.options,
    overrides: input.overrides,
    version,
    advanced: input.advanced,
    categories: input.categories,
    outputs: input.outputs,
    androidFormat: input.androidFormat,
  });

  let configPath: string;
  try {
    configPath = await writeConfig(config, cwd);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    p.log.error(`Failed to write quieto.config.json: ${message}`);
    p.log.info(
      "Check that the project root is writable and try again. Your tokens and CSS were still generated.",
    );
    p.outro(
      "Token system generated, but config not saved — re-run quieto-tokens init to retry.",
    );
    return false;
  }

  // Prune orphan category JSON (and orphan theme directories) left over
  // from prior runs that used different categories/theme settings.
  // Mirrors the behaviour of `runAdd` so `init` on a brownfield project
  // can't silently leave stale tokens on disk. Pruner is best-effort —
  // failures are surfaced to the user but don't fail the close-out.
  //
  // `themeNames` is required to run this safely: without it, the pruner
  // would treat every theme directory as an orphan and nuke it. Callers
  // that can't provide the active theme list skip pruning entirely.
  if (input.themeNames !== undefined) {
    await prune(
      cwd,
      sortCategoriesCanonical(config.categories),
      input.themeNames,
    );
  }

  const allFiles = [
    ...input.output.jsonFiles,
    ...input.output.cssFiles,
    ...(input.output.figmaFiles ?? []),
    configPath,
  ];

  const fileListLines = allFiles
    .map((file) => `  ${formatPath(file, cwd)}`)
    .join("\n");

  p.log.success(
    `Token system generated successfully!\n\nFiles created:\n${fileListLines}`,
  );

  p.log.info(
    [
      "What's next:",
      "  • Import build/light.css into your project for CSS variables",
      "  • Use --quieto-* custom properties in your styles",
      "  • Review TOKENS_CHANGELOG.md for a running history of what this tool last wrote to disk",
      '  • Run "quieto-tokens update" to modify specific categories without regenerating everything',
      '  • Re-run "quieto-tokens init" to modify your system (full regeneration)',
      '  • Run "quieto-tokens init --advanced" for per-category customization',
      '  • Run "quieto-tokens add shadow" to add shadow elevation tokens',
      '  • Run "quieto-tokens add border" to add border widths + radii',
      '  • Run "quieto-tokens add animation" to add durations + easing',
      '  • Run "quieto-tokens component button" (or any component name) to author component tokens',
      '  • Run "quieto-tokens inspect" to analyze your token system\'s health (orphans, broken refs, contrast)',
      '  • Run "quieto-tokens migrate --scan ./src" to find hardcoded values you can replace with token references',
    ].join("\n"),
  );

  p.outro("Config saved — you can re-run to modify your system anytime.");

  return true;
}

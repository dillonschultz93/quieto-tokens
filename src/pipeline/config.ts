import { relative } from "node:path";
import * as p from "@clack/prompts";
import type { QuickStartOptions } from "../types.js";
import {
  buildConfig,
  readToolVersion,
  writeConfig,
} from "../output/config-writer.js";
import type { OutputResult } from "./output.js";

export interface ConfigGenerationInput {
  options: QuickStartOptions;
  overrides: Map<string, string>;
  output: OutputResult;
  cwd?: string;
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

  const allFiles = [
    ...input.output.jsonFiles,
    ...input.output.cssFiles,
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
      '  • Re-run "quieto-tokens init" to modify your system',
      '  • Run "quieto-tokens add shadow" to add new categories (coming soon)',
    ].join("\n"),
  );

  p.outro("Config saved — you can re-run to modify your system anytime.");

  return true;
}

import { readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { QuickStartOptions } from "../types.js";
import type {
  AdvancedConfig,
  CategoryConfigs,
  ComponentTokenConfig,
  QuietoConfig,
} from "../types/config.js";
import {
  DEFAULT_CATEGORIES,
  DEFAULT_OUTPUTS,
  DEFAULT_OUTPUT_CONFIG,
  type OutputPlatform,
} from "../types/config.js";
import { getConfigPath } from "../utils/config.js";

/**
 * Read the tool's version from the installed package.json. Mirrors the
 * resolution logic in `src/cli.ts` so the config records the same version
 * reported by `quieto-tokens --version`.
 */
export async function readToolVersion(): Promise<string> {
  const here = dirname(fileURLToPath(import.meta.url));
  // From dist/, package.json lives one level up. From src/output/ during
  // tests, it lives two levels up. Try both so the helper is usable in both
  // contexts without caller plumbing.
  const candidates = [
    resolve(here, "..", "package.json"),
    resolve(here, "..", "..", "package.json"),
  ];
  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      const contents = await readFile(candidate, "utf-8");
      const pkg = JSON.parse(contents) as { version?: unknown };
      if (typeof pkg.version === "string" && pkg.version.length > 0) {
        return pkg.version;
      }
      lastError = new Error(
        `package.json at ${candidate} has no valid "version" string`,
      );
    } catch (error) {
      lastError = error;
    }
  }
  const detail =
    lastError instanceof Error ? lastError.message : String(lastError ?? "");
  throw new Error(
    `Unable to read tool version from package.json${detail ? ` (${detail})` : ""}`,
  );
}

export interface BuildConfigInput {
  options: QuickStartOptions;
  overrides: Map<string, string>;
  version: string;
  /** Override for deterministic tests; defaults to `new Date().toISOString()`. */
  generated?: string;
  /**
   * Advanced-mode authoring details. Omit or pass `undefined` for quick-start
   * configs — the resulting `QuietoConfig.advanced` will be absent rather
   * than an empty object.
   */
  advanced?: AdvancedConfig;
  /**
   * Active token categories. Defaults to {@link DEFAULT_CATEGORIES}
   * (`["color", "spacing", "typography"]`). Epic 2.2's `add` subcommand
   * passes an extended list.
   */
  categories?: string[];
  /**
   * Per-category authoring inputs captured by `quieto-tokens add`. Omit or
   * pass `undefined` for quick-start / legacy writes — the resulting
   * `QuietoConfig.categoryConfigs` is absent rather than an empty object so
   * `loadConfig`'s absence-vs-empty-map signal (AC #24) stays intact.
   */
  categoryConfigs?: CategoryConfigs;
  components?: Record<string, ComponentTokenConfig>;
  /**
   * Build targets. Defaults to CSS-only when omitted.
   * `buildConfig` always includes `"css"`.
   */
  outputs?: readonly OutputPlatform[];
}

/**
 * Assemble a {@link QuietoConfig} from the accumulated pipeline data. Pure
 * function — safe to unit-test without touching the filesystem.
 */
export function buildConfig(input: BuildConfigInput): QuietoConfig {
  const fromInput = input.outputs
    ? [...new Set<OutputPlatform>(["css" as const, ...input.outputs])]
    : [...DEFAULT_OUTPUTS];
  const config: QuietoConfig = {
    version: input.version,
    generated: input.generated ?? new Date().toISOString(),
    inputs: {
      brandColor: input.options.brandColor,
      spacingBase: input.options.spacingBase,
      typeScale: input.options.typeScale,
      darkMode: input.options.generateThemes,
    },
    overrides: Object.fromEntries(input.overrides),
    output: { ...DEFAULT_OUTPUT_CONFIG },
    outputs: fromInput.filter(
      (p): p is OutputPlatform => p === "css" || p === "figma",
    ),
    categories: input.categories ? [...input.categories] : [...DEFAULT_CATEGORIES],
  };
  if (input.advanced !== undefined) {
    config.advanced = input.advanced;
  }
  if (input.categoryConfigs !== undefined) {
    config.categoryConfigs = input.categoryConfigs;
  }
  if (input.components !== undefined) {
    config.components = input.components;
  }
  return config;
}

/**
 * Serialize {@link QuietoConfig} to `quieto.config.json` in the given
 * directory (defaults to the user's CWD). Returns the absolute path written.
 *
 * The file is written with 2-space indentation and a trailing newline to
 * match the convention used by the JSON token writer.
 *
 * Write is atomic: content lands in a sibling `.tmp` file first and is then
 * `rename(2)`'d over the final path. A crash or SIGINT mid-write leaves the
 * previously-valid config (if any) untouched.
 */
export async function writeConfig(
  config: QuietoConfig,
  cwd: string = process.cwd(),
): Promise<string> {
  const filePath = getConfigPath(cwd);
  const tmpPath = `${filePath}.${process.pid}.tmp`;
  const json = JSON.stringify(config, null, 2) + "\n";
  await writeFile(tmpPath, json, "utf-8");
  await rename(tmpPath, filePath);
  return filePath;
}

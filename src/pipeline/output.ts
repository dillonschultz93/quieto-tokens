import { readFile, unlink } from "node:fs/promises";
import { relative } from "node:path";
import * as p from "@clack/prompts";
import type { ThemeCollection } from "../types/tokens.js";
import { writeTokensToJson } from "../output/json-writer.js";
import type { WriteScope } from "../output/json-writer.js";
import { buildCss } from "../output/style-dictionary.js";

export interface OutputResult {
  jsonFiles: string[];
  cssFiles: string[];
}

export interface RunOutputOptions {
  /**
   * Restrict which categories' JSON files are (re)written on disk. See
   * {@link WriteScope}. Defaults to `"all"` — the historical Epic 1
   * behaviour used by the `init` pipeline.
   *
   * `add` passes `{ categories: [category] }` so only the newly-authored
   * category's primitive + per-theme semantic JSON are touched (Story 2.4
   * / Story 2.2 AC #16). CSS is then rebuilt by sourcing the full
   * on-disk JSON tree, so the union of existing + newly-written
   * categories always makes it into the `build/*.css` output.
   */
  scope?: WriteScope;
  /**
   * Passed through to {@link writeTokensToJson}. Story 3.1 `update` sets
   * this so tier-3 component JSON mtimes stay stable.
   */
  skipComponents?: boolean;
}

/**
 * Format an absolute path relative to `process.cwd()` for narrative output.
 * Falls back to the absolute path when the target is outside cwd.
 */
function formatPath(absolutePath: string): string {
  const rel = relative(process.cwd(), absolutePath);
  return rel.length > 0 && !rel.startsWith("..") ? rel : absolutePath;
}

/**
 * Count CSS custom-property declarations (`--name: value;`) in a file. Block
 * comments are stripped first so header comments like
 * `/** Do not edit directly ... *\/` don't inflate the count.
 */
async function countCssVariables(filePath: string): Promise<number> {
  try {
    const content = await readFile(filePath, "utf-8");
    const withoutComments = content.replace(/\/\*[\s\S]*?\*\//g, "");
    const matches = withoutComments.match(/--[\w-]+\s*:/g);
    return matches ? matches.length : 0;
  } catch {
    return 0;
  }
}

export async function runOutputGeneration(
  collection: ThemeCollection,
  outputDir: string = process.cwd(),
  options: RunOutputOptions = {},
): Promise<OutputResult | null> {
  p.log.step("Writing DTCG JSON source files…");

  let jsonFiles: string[];
  try {
    jsonFiles = await writeTokensToJson(collection, outputDir, {
      scope: options.scope,
      skipComponents: options.skipComponents,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    p.log.error(`Failed to write token JSON files: ${message}`);
    p.log.info(
      "Check that the directory is writable and the path is valid, then run again.",
    );
    return null;
  }

  for (const file of jsonFiles) {
    p.log.info(`✓ Wrote ${formatPath(file)}`);
  }

  p.log.step("Building CSS custom properties…");

  let cssFiles: string[];
  try {
    cssFiles = await buildCss(collection, outputDir);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    p.log.error(`Failed to build CSS: ${message}`);
    p.log.info(
      "Check that the build/ directory is writable and that token JSON files are valid.",
    );
    // Story 2.4 review (D2 extension): JSON already landed on disk — roll it
    // back so a failed CSS build does not leave a half-written token tree
    // (especially for scoped `add` writes where the user expects atomicity).
    for (const path of jsonFiles) {
      try {
        await unlink(path);
      } catch {
        // best-effort — same spirit as `rollbackNewFiles` in pipeline/add.ts
      }
    }
    return null;
  }

  for (const file of cssFiles) {
    const count = await countCssVariables(file);
    p.log.info(
      `✓ Generated ${formatPath(file)} (${count} variables)`,
    );
  }

  p.log.success(
    `Output complete — ${jsonFiles.length} JSON source files, ${cssFiles.length} CSS file${cssFiles.length === 1 ? "" : "s"}.`,
  );

  return { jsonFiles, cssFiles };
}

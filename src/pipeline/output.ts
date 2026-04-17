import { readFile } from "node:fs/promises";
import { relative } from "node:path";
import * as p from "@clack/prompts";
import type { ThemeCollection } from "../types/tokens.js";
import { writeTokensToJson } from "../output/json-writer.js";
import { buildCss } from "../output/style-dictionary.js";

export interface OutputResult {
  jsonFiles: string[];
  cssFiles: string[];
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
): Promise<OutputResult | null> {
  p.log.step("Writing DTCG JSON source files…");

  let jsonFiles: string[];
  try {
    jsonFiles = await writeTokensToJson(collection, outputDir);
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

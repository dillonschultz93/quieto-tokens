import { readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export const TOKENS_CHANGELOG_FILENAME = "TOKENS_CHANGELOG.md";

const CHANGELOG_TITLE = "# Design System Changelog\n";

export interface ChangelogEntry {
  timestamp: string;
  toolVersion: string;
  command: string;
  categoriesAffected: string[];
  summary: string;
}

/**
 * Renders a single changelog entry. Ends with a horizontal rule for visual
 * separation when multiple entries are stacked in one file.
 */
export function formatChangelogEntry(entry: ChangelogEntry): string {
  const cat =
    entry.categoriesAffected.length > 0
      ? entry.categoriesAffected.join(", ")
      : "none";
  return [
    `## [${entry.timestamp}]`,
    "",
    `**Tool version:** ${entry.toolVersion}`,
    `**Command:** ${entry.command}`,
    `**Categories affected:** ${cat}`,
    "",
    "### Summary",
    "",
    entry.summary.trimEnd(),
    "",
    "---",
    "",
  ].join("\n");
}

function stripTitleBody(content: string): string {
  const t = content.trimStart();
  if (t.length === 0) return "";
  if (t.startsWith("# Design System Changelog")) {
    return t.slice("# Design System Changelog".length).replace(/^\s+/, "");
  }
  return t;
}

/**
 * Appends a changelog entry at the project root (newest first, directly
 * after the file title). Writes atomically (tmp + rename) like
 * {@link writeConfig}. On read/write failure, returns a structured result
 * so the caller can warn without aborting a successful token write.
 */
export async function appendChangelog(
  entry: ChangelogEntry,
  cwd?: string,
): Promise<{ path: string } | { error: string }> {
  const projectRoot = cwd ?? process.cwd();
  const targetPath = resolve(projectRoot, TOKENS_CHANGELOG_FILENAME);
  const tmpPath = resolve(
    projectRoot,
    `${TOKENS_CHANGELOG_FILENAME}.${process.pid}.tmp`,
  );

  let existing: string;
  try {
    existing = await readFile(targetPath, "utf-8");
  } catch {
    existing = "";
  }

  const newBlock = formatChangelogEntry(entry);
  let next: string;
  if (existing.trim().length === 0) {
    next = `${CHANGELOG_TITLE}\n${newBlock}`;
  } else {
    const rest = stripTitleBody(existing);
    if (rest.length === 0) {
      next = `${CHANGELOG_TITLE}\n${newBlock}`;
    } else {
      next = `${CHANGELOG_TITLE}\n${newBlock}${rest}`;
    }
  }

  try {
    await writeFile(tmpPath, next, "utf-8");
    await rename(tmpPath, targetPath);
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : String(e),
    };
  }
  return { path: targetPath };
}

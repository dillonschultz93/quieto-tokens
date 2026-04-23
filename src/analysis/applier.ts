import { readFile, writeFile, rename, access } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { ScanMatch } from "./scanner.js";

export interface ApplyResult {
  replacementsMade: number;
  filesModified: number;
  approximateSkipped: number;
  backupsWritten: number;
}

function tmpPathFor(targetPath: string): string {
  const base = targetPath.split(/[/\\]/).pop() ?? "file";
  const nonce = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return join(dirname(targetPath), `.${base}.${nonce}.tmp`);
}

function applyMatchToLine(
  line: string,
  match: ScanMatch,
): { next: string; applied: boolean } {
  const startIdx = Math.max(0, match.column - 1);
  const needle = match.hardcodedValue;
  if (line.slice(startIdx, startIdx + needle.length) === needle) {
    const next =
      line.slice(0, startIdx) +
      match.suggestedReplacement +
      line.slice(startIdx + needle.length);
    return { next, applied: true };
  }
  const idx = line.indexOf(needle, startIdx);
  if (idx === -1) return { next: line, applied: false };
  const next =
    line.slice(0, idx) +
    match.suggestedReplacement +
    line.slice(idx + needle.length);
  return { next, applied: true };
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function backupPathFor(targetPath: string): string {
  // Keep simple + predictable so users can clean up easily.
  return `${targetPath}.quieto-bak`;
}

export async function applyReplacements(
  matches: ScanMatch[],
  cwd: string,
): Promise<ApplyResult> {
  const exact = matches.filter((m) => m.confidence === "exact");
  const approximateSkipped = matches.filter((m) => m.confidence !== "exact").length;

  const byFile = new Map<string, ScanMatch[]>();
  for (const m of exact) {
    const filePath = resolve(cwd, m.filePath);
    const arr = byFile.get(filePath) ?? [];
    arr.push({ ...m, filePath });
    byFile.set(filePath, arr);
  }

  let replacementsMade = 0;
  let filesModified = 0;
  let backupsWritten = 0;

  for (const [filePath, fileMatches] of byFile.entries()) {
    const original = await readFile(filePath, "utf-8");
    const lines = original.split(/\r?\n/);

    const sorted = [...fileMatches].sort((a, b) => {
      if (a.line !== b.line) return b.line - a.line;
      return b.column - a.column;
    });

    let touched = false;
    for (const m of sorted) {
      const lineIdx = m.line - 1;
      if (lineIdx < 0 || lineIdx >= lines.length) continue;
      const before = lines[lineIdx] ?? "";
      const { next, applied } = applyMatchToLine(before, m);
      if (!applied) continue;
      lines[lineIdx] = next;
      touched = true;
      replacementsMade++;
    }

    if (!touched) continue;

    const backupPath = backupPathFor(filePath);
    if (!(await exists(backupPath))) {
      await writeFile(backupPath, original, "utf-8");
      backupsWritten++;
    }

    const nextContent = lines.join("\n");
    const tmp = tmpPathFor(filePath);
    await writeFile(tmp, nextContent, "utf-8");
    await rename(tmp, filePath);
    filesModified++;
  }

  return { replacementsMade, filesModified, approximateSkipped, backupsWritten };
}


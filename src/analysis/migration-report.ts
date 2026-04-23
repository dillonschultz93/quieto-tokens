import * as p from "@clack/prompts";
import type { ScanResult, ScanMatch } from "./scanner.js";
import type { ApplyResult } from "./applier.js";

function groupByConfidence(matches: ScanMatch[]): {
  exact: ScanMatch[];
  approximate: ScanMatch[];
} {
  const exact: ScanMatch[] = [];
  const approximate: ScanMatch[] = [];
  for (const m of matches) {
    if (m.confidence === "exact") exact.push(m);
    else approximate.push(m);
  }
  return { exact, approximate };
}

function adoptionCoveragePercent(matches: ScanMatch[]): number {
  // Deprecated: keep for call sites that don't pass `hardcodedValuesFound`.
  if (matches.length === 0) return 0;
  return 100;
}

export function renderMigrationTerminalReport(
  result: ScanResult,
  applyResult?: ApplyResult,
): void {
  const { exact, approximate } = groupByConfidence(result.matches);
  const coverage =
    result.hardcodedValuesFound > 0
      ? Math.round((result.matches.length / result.hardcodedValuesFound) * 100)
      : adoptionCoveragePercent(result.matches);
  p.log.info(
    [
      `Files scanned: ${result.filesScanned}`,
      `Matches found: ${result.matches.length}`,
      `Exact: ${exact.length}`,
      `Approximate: ${approximate.length}`,
      `Estimated adoption coverage: ${coverage}%`,
    ].join("\n"),
  );

  if (applyResult) {
    p.log.info(
      [
        `Replacements made: ${applyResult.replacementsMade}`,
        `Files modified: ${applyResult.filesModified}`,
        `Backups written: ${applyResult.backupsWritten}`,
        `Approximate matches skipped: ${applyResult.approximateSkipped}`,
      ].join("\n"),
    );
  }

  const renderList = (title: string, items: ScanMatch[]) => {
    if (items.length === 0) return;
    p.log.step(title);
    for (const m of items) {
      p.log.info(
        `${m.filePath}:${m.line}:${m.column}  ${m.hardcodedValue} → ${m.suggestedReplacement}`,
      );
    }
  };

  renderList("Exact matches", exact);
  renderList("Approximate matches", approximate);
}

function escapeMd(s: string): string {
  return s.replace(/\|/g, "\\|");
}

export function renderMigrationMarkdownReport(
  result: ScanResult,
  applyResult?: ApplyResult,
): string {
  const { exact, approximate } = groupByConfidence(result.matches);
  const coverage =
    result.hardcodedValuesFound > 0
      ? Math.round((result.matches.length / result.hardcodedValuesFound) * 100)
      : adoptionCoveragePercent(result.matches);

  const lines: string[] = [];
  lines.push("# Token Migration Report", "");
  lines.push("## Summary", "");
  lines.push(`- Files scanned: ${result.filesScanned}`);
  lines.push(`- Files with matches: ${result.filesWithMatches}`);
  lines.push(`- Matches found: ${result.matches.length}`);
  lines.push(`- Exact matches: ${exact.length}`);
  lines.push(`- Approximate matches: ${approximate.length}`);
  lines.push(`- Estimated adoption coverage: ${coverage}%`);
  if (applyResult) {
    lines.push("");
    lines.push("### Apply results", "");
    lines.push(`- Replacements made: ${applyResult.replacementsMade}`);
    lines.push(`- Files modified: ${applyResult.filesModified}`);
    lines.push(`- Backups written: ${applyResult.backupsWritten}`);
    lines.push(`- Approximate matches skipped: ${applyResult.approximateSkipped}`);
  }

  const table = (title: string, items: ScanMatch[]) => {
    lines.push("", `## ${title}`, "");
    if (items.length === 0) {
      lines.push("_No matches._");
      return;
    }
    lines.push(
      "| File | Line | Column | Hardcoded value | Suggested replacement | Category | Confidence |",
    );
    lines.push("|---|---:|---:|---|---|---|---|");
    for (const m of items) {
      lines.push(
        `| ${escapeMd(m.filePath)} | ${m.line} | ${m.column} | ${escapeMd(
          m.hardcodedValue,
        )} | ${escapeMd(m.suggestedReplacement)} | ${escapeMd(
          m.category,
        )} | ${m.confidence} |`,
      );
    }
  };

  table("Exact matches", exact);
  table("Approximate matches", approximate);

  lines.push("");
  return lines.join("\n");
}


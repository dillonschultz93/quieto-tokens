import { describe, it, expect } from "vitest";
import { renderMigrationMarkdownReport } from "../migration-report.js";
import type { ScanResult } from "../scanner.js";

describe("renderMigrationMarkdownReport", () => {
  it("renders a readable markdown report with tables", () => {
    const result: ScanResult = {
      filesScanned: 2,
      filesWithMatches: 1,
      hardcodedValuesFound: 1,
      matches: [
        {
          filePath: "src/a.css",
          line: 1,
          column: 10,
          hardcodedValue: "#3B82F6",
          suggestedReplacement: "var(--quieto-color-blue-500)",
          confidence: "exact",
          category: "color",
        },
      ],
    };
    const md = renderMigrationMarkdownReport(result);
    expect(md).toContain("# Token Migration Report");
    expect(md).toContain("## Summary");
    expect(md).toContain("| File | Line | Column |");
    expect(md).toContain("src/a.css");
  });

  it("includes backups written when apply result is provided", () => {
    const result: ScanResult = {
      filesScanned: 1,
      filesWithMatches: 1,
      hardcodedValuesFound: 1,
      matches: [
        {
          filePath: "src/a.css",
          line: 1,
          column: 10,
          hardcodedValue: "#3B82F6",
          suggestedReplacement: "var(--quieto-color-blue-500)",
          confidence: "exact",
          category: "color",
        },
      ],
    };

    const md = renderMigrationMarkdownReport(result, {
      replacementsMade: 1,
      filesModified: 1,
      backupsWritten: 1,
      approximateSkipped: 0,
    });
    expect(md).toContain("Backups written: 1");
  });
});


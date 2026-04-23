import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { applyReplacements } from "../applier.js";
import type { ScanMatch } from "../scanner.js";

describe("applyReplacements", () => {
  let dir: string;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("applies only exact matches and preserves surrounding content", async () => {
    dir = mkdtempSync(join(tmpdir(), "quieto-apply-"));
    const src = join(dir, "src");
    mkdirSync(src, { recursive: true });
    const filePath = join(src, "a.css");

    writeFileSync(
      filePath,
      ["a { color: #3B82F6; padding: 16px; }", "b { color: #3A82F6; }", ""].join(
        "\n",
      ),
    );

    const matches: ScanMatch[] = [
      {
        filePath,
        line: 1,
        column: 12,
        hardcodedValue: "#3B82F6",
        suggestedReplacement: "var(--quieto-color-blue-500)",
        confidence: "exact",
        category: "color",
      },
      {
        filePath,
        line: 1,
        column: 30,
        hardcodedValue: "16px",
        suggestedReplacement: "var(--quieto-spacing-16)",
        confidence: "exact",
        category: "spacing",
      },
      {
        filePath,
        line: 2,
        column: 12,
        hardcodedValue: "#3A82F6",
        suggestedReplacement: "var(--quieto-color-blue-500) (distance 1.00)",
        confidence: "approximate",
        category: "color",
      },
    ];

    const result = await applyReplacements(matches, dir);
    expect(result.replacementsMade).toBe(2);
    expect(result.filesModified).toBe(1);
    expect(result.approximateSkipped).toBe(1);
    expect(result.backupsWritten).toBe(1);

    const updated = readFileSync(filePath, "utf-8");
    expect(updated).toContain("color: var(--quieto-color-blue-500)");
    expect(updated).toContain("padding: var(--quieto-spacing-16)");
    expect(updated).toContain("color: #3A82F6");
  });
});


import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  TOKENS_CHANGELOG_FILENAME,
  formatChangelogEntry,
  appendChangelog,
} from "../changelog-writer.js";

describe("changelog-writer", () => {
  let dir: string;
  const baseEntry = {
    toolVersion: "0.1.0",
    command: "init",
    categoriesAffected: ["color", "typography"],
    summary: "Test summary line.",
  };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "chlog-"));
  });

  afterEach(() => {
    if (dir) {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        /* best-effort */
      }
    }
  });

  it("formatChangelogEntry produces expected structure", () => {
    const md = formatChangelogEntry({
      ...baseEntry,
      timestamp: "2026-04-22T15:30:00.000Z",
    });
    expect(md).toContain("## [2026-04-22T15:30:00.000Z]");
    expect(md).toContain("**Tool version:** 0.1.0");
    expect(md).toContain("**Command:** init");
    expect(md).toContain("**Categories affected:** color, typography");
    expect(md).toContain("### Summary");
    expect(md).toContain("Test summary line.");
    expect(md).toContain("---");
  });

  it("appendChangelog creates a new file with title + entry", async () => {
    const r = await appendChangelog(
      { ...baseEntry, timestamp: "2026-04-22T16:00:00.000Z" },
      dir,
    );
    expect("path" in r).toBe(true);
    if ("path" in r) {
      const text = readFileSync(r.path, "utf-8");
      expect(text.startsWith("# Design System Changelog\n")).toBe(true);
      expect(text).toContain("## [2026-04-22T16:00:00.000Z]");
    }
  });

  it("appendChangelog prepends so the newest entry is first after the title", async () => {
    const a = await appendChangelog(
      { ...baseEntry, timestamp: "2026-04-22T17:00:00.000Z" },
      dir,
    );
    if ("error" in a) throw a.error;
    const b = await appendChangelog(
      { ...baseEntry, command: "update", timestamp: "2026-04-22T18:00:00.000Z" },
      dir,
    );
    if ("error" in b) throw b.error;
    const text = readFileSync(join(dir, TOKENS_CHANGELOG_FILENAME), "utf-8");
    const firstH2 = text.indexOf("## [");
    const secondH2 = text.indexOf("## [", firstH2 + 1);
    expect(text.slice(firstH2, firstH2 + 30)).toContain("18:00:00");
    expect(text.slice(secondH2, secondH2 + 30)).toContain("17:00:00");
  });

  it("reapplies the title when the file is empty", async () => {
    writeFileSync(join(dir, TOKENS_CHANGELOG_FILENAME), "", "utf-8");
    const r = await appendChangelog(
      { ...baseEntry, timestamp: "2026-04-22T20:00:00.000Z" },
      dir,
    );
    if ("error" in r) throw r.error;
    const text = readFileSync(join(dir, TOKENS_CHANGELOG_FILENAME), "utf-8");
    expect(text.startsWith("# Design System Changelog\n")).toBe(true);
    expect(text).toContain("20:00:00");
  });

  it("returns a structured error when the project root is not writable", async () => {
    // Skip on Windows where POSIX permission modes don't apply.
    if (process.platform === "win32") {
      return;
    }
    // Skip when running as root — chmod cannot revoke write access for root.
    if (typeof process.getuid === "function" && process.getuid() === 0) {
      return;
    }

    const r0 = await appendChangelog(
      { ...baseEntry, timestamp: "2026-04-22T10:00:00.000Z" },
      dir,
    );
    if ("error" in r0) {
      throw new Error(r0.error);
    }
    chmodSync(dir, 0o555);
    try {
      const r = await appendChangelog(
        { ...baseEntry, timestamp: "2026-04-22T11:00:00.000Z" },
        dir,
      );
      expect("error" in r).toBe(true);
    } finally {
      chmodSync(dir, 0o755);
    }
  });
});

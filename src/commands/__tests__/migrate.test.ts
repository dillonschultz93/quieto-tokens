import { describe, it, expect, vi, afterEach } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  rmSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  confirm: vi.fn(),
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    step: vi.fn(),
  },
}));

// Ensure git check is deterministic in tests.
vi.mock("node:child_process", () => ({
  execSync: vi.fn(() => ""),
}));

import { migrateCommand } from "../migrate.js";

function scaffoldTokenSystem(dir: string): void {
  writeFileSync(
    join(dir, "quieto.config.json"),
    JSON.stringify({
      version: "0.1.0",
      generated: new Date().toISOString(),
      inputs: {
        brandColor: "#3B82F6",
        spacingBase: 4,
        typeScale: "balanced",
        darkMode: false,
      },
      overrides: {},
      output: { tokensDir: "tokens", buildDir: "build", prefix: "quieto" },
      outputs: ["css"],
      categories: ["color", "spacing"],
    }),
  );

  const primDir = join(dir, "tokens", "primitive");
  mkdirSync(primDir, { recursive: true });
  writeFileSync(
    join(primDir, "color.json"),
    JSON.stringify({
      color: {
        blue: { 500: { $type: "color", $value: "#3B82F6" } },
      },
    }),
  );
  writeFileSync(
    join(primDir, "spacing.json"),
    JSON.stringify({
      spacing: {
        16: { $type: "dimension", $value: "16px" },
      },
    }),
  );
}

describe("migrateCommand", () => {
  let tempDir: string;
  const origCwd = process.cwd();

  afterEach(() => {
    process.chdir(origCwd);
    if (tempDir && existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
    process.exitCode = undefined;
  });

  it("sets exitCode when no token system exists", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-mig-"));
    process.chdir(tempDir);
    const target = join(tempDir, "src");
    mkdirSync(target, { recursive: true });
    await migrateCommand({ mode: "scan", target });
    expect(process.exitCode).toBe(1);
  });

  it("errors when target directory does not exist", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-mig-"));
    scaffoldTokenSystem(tempDir);
    process.chdir(tempDir);
    await migrateCommand({ mode: "scan", target: "./nonexistent" });
    expect(process.exitCode).toBe(1);
  });

  it("writes a markdown report when --output is given", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-mig-"));
    scaffoldTokenSystem(tempDir);
    const target = join(tempDir, "src");
    mkdirSync(target, { recursive: true });
    writeFileSync(join(target, "a.css"), "a { color: #3B82F6; padding: 16px; }\n");
    process.chdir(tempDir);

    const outPath = join(tempDir, "migration-report.md");
    await migrateCommand({ mode: "scan", target, output: outPath });
    expect(existsSync(outPath)).toBe(true);
    const content = readFileSync(outPath, "utf-8");
    expect(content).toContain("# Token Migration Report");
  });
});


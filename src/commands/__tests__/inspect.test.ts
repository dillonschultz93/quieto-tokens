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
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    step: vi.fn(),
  },
}));

import { inspectCommand } from "../inspect.js";

function scaffoldProject(dir: string): void {
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
  const semDir = join(dir, "tokens", "semantic", "default");
  mkdirSync(primDir, { recursive: true });
  mkdirSync(semDir, { recursive: true });

  writeFileSync(
    join(primDir, "color.json"),
    JSON.stringify({
      color: {
        blue: { 500: { $type: "color", $value: "#3B82F6" } },
        neutral: {
          50: { $type: "color", $value: "#F9FAFB" },
          900: { $type: "color", $value: "#111827" },
        },
      },
    }),
  );

  writeFileSync(
    join(primDir, "spacing.json"),
    JSON.stringify({
      spacing: {
        4: { $type: "dimension", $value: "4px" },
      },
    }),
  );

  writeFileSync(
    join(semDir, "color.json"),
    JSON.stringify({
      color: {
        background: {
          primary: { $type: "color", $value: "{color.neutral.50}" },
        },
        content: {
          primary: { $type: "color", $value: "{color.neutral.900}" },
        },
      },
    }),
  );
}

describe("inspectCommand", () => {
  let tempDir: string;
  const origCwd = process.cwd();

  afterEach(() => {
    process.chdir(origCwd);
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
    process.exitCode = undefined;
  });

  it("sets exitCode when no token system exists", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-insp-"));
    process.chdir(tempDir);
    await inspectCommand();
    expect(process.exitCode).toBe(1);
  });

  it("runs without errors on a valid project", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-insp-"));
    scaffoldProject(tempDir);
    process.chdir(tempDir);
    await inspectCommand();
    expect(process.exitCode).toBeUndefined();
  });

  it("writes markdown report when --output is given", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-insp-"));
    scaffoldProject(tempDir);
    process.chdir(tempDir);
    const outPath = join(tempDir, "report.md");
    await inspectCommand({ output: outPath });
    expect(existsSync(outPath)).toBe(true);
    const content = readFileSync(outPath, "utf-8");
    expect(content).toContain("# Token System Inspection Report");
  });
});

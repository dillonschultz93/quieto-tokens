import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn(),
  note: vi.fn(),
  isCancel: vi.fn(() => false),
  log: {
    step: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  },
  text: vi.fn(),
  select: vi.fn(),
  confirm: vi.fn(),
}));

vi.mock("../../output/config-writer.js", () => ({
  readToolVersion: vi.fn().mockResolvedValue("0.1.0"),
  buildConfig: vi.fn(() => ({})),
  writeConfig: vi.fn().mockResolvedValue("/fake/quieto.config.json"),
}));

import * as p from "@clack/prompts";
import { updateCommand } from "../update.js";

describe("updateCommand", () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    vi.clearAllMocks();
    tmpDir = mkdtempSync(join(tmpdir(), "update-cmd-"));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
    process.exitCode = undefined;
  });

  afterEach(() => {
    process.chdir(originalCwd);
    process.exitCode = undefined;
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("sets exit code 1 when no quieto.config.json exists", async () => {
    await updateCommand();
    expect(process.exitCode).toBe(1);
    expect(vi.mocked(p.log.error)).toHaveBeenCalledWith(
      "No token system found — run 'quieto-tokens init' first.",
    );
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
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
  multiselect: vi.fn(),
}));

vi.mock("../../pipeline/component.js", () => ({
  runComponent: vi.fn(),
}));

vi.mock("../../output/config-writer.js", () => ({
  readToolVersion: vi.fn().mockResolvedValue("0.1.0"),
  writeConfig: vi.fn().mockResolvedValue("/fake/quieto.config.json"),
}));

import * as p from "@clack/prompts";
import { componentCommand } from "../component.js";
import { runComponent } from "../../pipeline/component.js";
import { writeConfig } from "../../output/config-writer.js";

describe("componentCommand", () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    vi.clearAllMocks();
    tmpDir = mkdtempSync(join(tmpdir(), "component-cmd-"));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    process.exitCode = undefined;
  });

  function writeMinimalConfig() {
    writeFileSync(
      join(tmpDir, "quieto.config.json"),
      JSON.stringify({
        version: "0.1.0",
        generated: "2026-01-01T00:00:00.000Z",
        inputs: {
          brandColor: "#5B21B6",
          spacingBase: 8,
          typeScale: "balanced",
          darkMode: false,
        },
        overrides: {},
        output: { tokensDir: "tokens", buildDir: "build", prefix: "quieto" },
        categories: ["color", "spacing", "typography"],
      }),
    );
  }

  it("exits 1 when no config exists", async () => {
    await componentCommand({ name: "button" });
    expect(process.exitCode).toBe(1);
    expect(vi.mocked(p.log.error)).toHaveBeenCalledWith(
      expect.stringContaining("No quieto.config.json"),
    );
  });

  it("exits 1 when config is corrupt", async () => {
    writeFileSync(join(tmpDir, "quieto.config.json"), "not json");
    vi.mocked(p.select).mockResolvedValueOnce("abort");
    await componentCommand({ name: "button" });
    expect(process.exitCode).toBe(1);
  });

  it("exits 1 when config is invalid and user aborts", async () => {
    writeFileSync(
      join(tmpDir, "quieto.config.json"),
      JSON.stringify({ version: 42 }),
    );
    vi.mocked(p.select).mockResolvedValueOnce("abort");
    await componentCommand({ name: "button" });
    expect(process.exitCode).toBe(1);
  });

  it("prompts for re-author confirmation when component file exists", async () => {
    writeMinimalConfig();
    mkdirSync(join(tmpDir, "tokens", "component"), { recursive: true });
    writeFileSync(join(tmpDir, "tokens", "component", "button.json"), "{}");

    vi.mocked(p.confirm).mockResolvedValueOnce(false);

    await componentCommand({ name: "button" });
    expect(vi.mocked(p.confirm)).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("Re-author"),
      }),
    );
    expect(vi.mocked(p.outro)).toHaveBeenCalledWith("Nothing changed.");
    expect(runComponent).not.toHaveBeenCalled();
  });

  it("dispatches to runComponent on the happy path", async () => {
    writeMinimalConfig();

    vi.mocked(runComponent).mockResolvedValueOnce({
      status: "ok",
      result: {
        componentConfig: { variants: ["primary"], cells: [] },
        tokenCount: 5,
        jsonFiles: [join(tmpDir, "tokens/component/button.json")],
        cssFiles: [join(tmpDir, "build/tokens.css")],
      },
    });

    await componentCommand({ name: "button" });
    expect(runComponent).toHaveBeenCalledTimes(1);
    expect(vi.mocked(p.log.success)).toHaveBeenCalledWith(
      expect.stringContaining("5 component tokens"),
    );
    expect(vi.mocked(p.outro)).toHaveBeenCalledWith(
      "Component saved — you can re-run to modify this component anytime.",
    );
    expect(writeConfig).toHaveBeenCalled();
  });

  it("handles cancelled pipeline gracefully", async () => {
    writeMinimalConfig();
    vi.mocked(runComponent).mockResolvedValueOnce({ status: "cancelled" });

    await componentCommand({ name: "button" });
    expect(vi.mocked(p.outro)).toHaveBeenCalledWith("Nothing changed.");
    expect(process.exitCode).toBeUndefined();
  });

  it("handles pipeline error with exit code 1", async () => {
    writeMinimalConfig();
    vi.mocked(runComponent).mockResolvedValueOnce({
      status: "error",
      message: "Something went wrong",
    });

    await componentCommand({ name: "button" });
    expect(process.exitCode).toBe(1);
    expect(vi.mocked(p.log.error)).toHaveBeenCalledWith("Something went wrong");
  });
});

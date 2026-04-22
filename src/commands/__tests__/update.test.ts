import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, writeFileSync } from "node:fs";
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
import * as configWriter from "../../output/config-writer.js";
import { updateCommand } from "../update.js";

describe("updateCommand", () => {
  let tmpDir: string;
  let originalCwd: string;

  const writeQuietoConfig = (config: unknown) => {
    writeFileSync(
      join(tmpDir, "quieto.config.json"),
      JSON.stringify(config, null, 2),
      "utf8",
    );
  };

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

  it("persists an updated config when an existing config is edited and saved", async () => {
    writeQuietoConfig({
      version: "0.1.0",
      tokens: {
        color: {
          brand: {
            $value: "#ffffff",
          },
        },
      },
    });

    let selectCallCount = 0;
    vi.mocked(p.select).mockImplementation(async (args?: any) => {
      selectCallCount += 1;
      const options = Array.isArray(args?.options) ? args.options : [];

      const findOption = (pattern: RegExp) =>
        options.find((option: any) => {
          const label = String(option?.label ?? "");
          const value = String(option?.value ?? "");
          return pattern.test(label) || pattern.test(value);
        });

      if (selectCallCount === 1) {
        return (
          findOption(/^(?!.*(save|write|finish|done|exit|quit)).*$/i)?.value ??
          options[0]?.value
        );
      }

      return (
        findOption(/save|write|finish|done|exit|quit/i)?.value ??
        options[0]?.value
      );
    });
    vi.mocked(p.text).mockResolvedValue("updated-value");
    vi.mocked(p.confirm).mockResolvedValue(true);

    await updateCommand();

    expect(process.exitCode).toBeUndefined();
    expect(vi.mocked(configWriter.buildConfig)).toHaveBeenCalled();
    expect(vi.mocked(configWriter.writeConfig)).toHaveBeenCalled();
  });

  it("cancels without writing when the prompt flow is aborted", async () => {
    writeQuietoConfig({
      version: "0.1.0",
      tokens: {
        color: {
          brand: {
            $value: "#ffffff",
          },
        },
      },
    });

    const cancelValue = Symbol("cancel");
    vi.mocked(p.select).mockResolvedValue(cancelValue as never);
    vi.mocked(p.isCancel).mockImplementation((value) => value === cancelValue);

    await updateCommand();

    expect(vi.mocked(configWriter.writeConfig)).not.toHaveBeenCalled();
    expect(vi.mocked(p.cancel)).toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, existsSync, rmSync, readFileSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { QuickStartOptions } from "../../types.js";
import type { QuietoConfig } from "../../types/config.js";

vi.mock("@clack/prompts", () => ({
  log: {
    info: vi.fn(),
    step: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    message: vi.fn(),
  },
  outro: vi.fn(),
}));

function makeOptions(): QuickStartOptions {
  return {
    brandColor: "#5B21B6",
    spacingBase: 8,
    typeScale: "balanced",
    generateThemes: true,
  };
}

describe("runConfigGeneration", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-cfgpipe-"));
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("writes quieto.config.json at the provided cwd", async () => {
    const { runConfigGeneration } = await import("../config.js");

    const ok = await runConfigGeneration({
      options: makeOptions(),
      overrides: new Map([
        ["color.background.primary", "{color.blue.400}"],
      ]),
      output: {
        jsonFiles: [join(tempDir, "tokens", "primitive", "color.json")],
        cssFiles: [join(tempDir, "build", "tokens.css")],
      },
      cwd: tempDir,
    });

    expect(ok).toBe(true);

    const configPath = join(tempDir, "quieto.config.json");
    expect(existsSync(configPath)).toBe(true);

    const parsed = JSON.parse(readFileSync(configPath, "utf-8")) as QuietoConfig;
    expect(parsed.inputs.brandColor).toBe("#5B21B6");
    expect(parsed.overrides).toEqual({
      "color.background.primary": "{color.blue.400}",
    });
    expect(parsed.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("renders the files-created summary via log.success, including the config file", async () => {
    const clack = await import("@clack/prompts");
    const { runConfigGeneration } = await import("../config.js");

    await runConfigGeneration({
      options: makeOptions(),
      overrides: new Map(),
      output: {
        jsonFiles: [
          join(tempDir, "tokens", "primitive", "color.json"),
          join(tempDir, "tokens", "semantic", "light", "color.json"),
        ],
        cssFiles: [
          join(tempDir, "build", "primitives.css"),
          join(tempDir, "build", "light.css"),
        ],
      },
      cwd: tempDir,
    });

    const successCalls = (clack.log.success as ReturnType<typeof vi.fn>).mock
      .calls.map((c: unknown[]) => c[0])
      .join("\n");
    expect(successCalls).toMatch(/Token system generated successfully/);
    expect(successCalls).toMatch(/Files created:/);
    expect(successCalls).toMatch(/tokens[/\\]primitive[/\\]color\.json/);
    expect(successCalls).toMatch(/build[/\\]primitives\.css/);
    expect(successCalls).toMatch(/quieto\.config\.json/);
  });

  it('emits the exact "Config saved" outro required by AC #6', async () => {
    const clack = await import("@clack/prompts");
    const { runConfigGeneration } = await import("../config.js");

    await runConfigGeneration({
      options: makeOptions(),
      overrides: new Map(),
      output: { jsonFiles: [], cssFiles: [] },
      cwd: tempDir,
    });

    expect(clack.outro).toHaveBeenCalledWith(
      "Config saved — you can re-run to modify your system anytime.",
    );
  });

  it("displays the What's next guide via log.info", async () => {
    const clack = await import("@clack/prompts");
    const { runConfigGeneration } = await import("../config.js");

    await runConfigGeneration({
      options: makeOptions(),
      overrides: new Map(),
      output: { jsonFiles: [], cssFiles: [] },
      cwd: tempDir,
    });

    const infoCalls = (clack.log.info as ReturnType<typeof vi.fn>).mock.calls
      .map((c: unknown[]) => c[0])
      .join("\n");
    expect(infoCalls).toMatch(/What's next:/);
    expect(infoCalls).toMatch(/TOKENS_CHANGELOG\.md/);
    expect(infoCalls).toMatch(/Import build\/light\.css/);
    expect(infoCalls).toMatch(/--quieto-\* custom properties/);
    expect(infoCalls).toMatch(/Re-run "quieto-tokens init"/);
    expect(infoCalls).toMatch(/init --advanced/);
  });

  it("returns false and emits an error when the config write fails", async () => {
    // Skip on Windows or when running as root, where chmod can't revoke write.
    if (
      process.platform === "win32" ||
      (typeof process.getuid === "function" && process.getuid() === 0)
    ) {
      return;
    }

    const clack = await import("@clack/prompts");
    const { runConfigGeneration } = await import("../config.js");

    chmodSync(tempDir, 0o500);
    try {
      const ok = await runConfigGeneration({
        options: makeOptions(),
        overrides: new Map(),
        output: { jsonFiles: [], cssFiles: [] },
        cwd: tempDir,
      });

      expect(ok).toBe(false);
      expect(clack.log.error).toHaveBeenCalledWith(
        expect.stringMatching(/Failed to write quieto\.config\.json/),
      );
    } finally {
      chmodSync(tempDir, 0o700);
    }
  });
});

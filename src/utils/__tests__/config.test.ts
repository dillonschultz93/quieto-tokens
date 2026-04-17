import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mkdtempSync,
  rmSync,
  existsSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  CONFIG_FILENAME,
  configExists,
  getConfigPath,
  loadConfig,
} from "../config.js";
import type { QuietoConfig } from "../../types/config.js";

function sampleConfig(
  overrides: Partial<QuietoConfig> = {},
): QuietoConfig {
  return {
    version: "0.1.0",
    generated: "2026-04-16T12:00:00.000Z",
    inputs: {
      brandColor: "#5B21B6",
      spacingBase: 8,
      typeScale: "balanced",
      darkMode: true,
    },
    overrides: {},
    output: {
      tokensDir: "tokens",
      buildDir: "build",
      prefix: "quieto",
    },
    ...overrides,
  };
}

describe("CONFIG_FILENAME + path helpers", () => {
  it("uses the canonical quieto.config.json filename", () => {
    expect(CONFIG_FILENAME).toBe("quieto.config.json");
  });

  it("getConfigPath resolves the filename under the given cwd", () => {
    expect(getConfigPath("/tmp/project")).toBe(
      join("/tmp/project", "quieto.config.json"),
    );
  });
});

describe("configExists + loadConfig", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-loadcfg-"));
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it("configExists is false when the config file is missing", () => {
    expect(configExists(tempDir)).toBe(false);
  });

  it("configExists is true once the config file is written", () => {
    writeFileSync(
      join(tempDir, "quieto.config.json"),
      JSON.stringify(sampleConfig()),
      "utf-8",
    );
    expect(configExists(tempDir)).toBe(true);
  });

  it("loadConfig returns null when no config file exists", () => {
    expect(loadConfig(tempDir)).toBeNull();
  });

  it("loadConfig returns null when the file is not valid JSON", () => {
    writeFileSync(
      join(tempDir, "quieto.config.json"),
      "{ not valid json",
      "utf-8",
    );
    expect(loadConfig(tempDir)).toBeNull();
  });

  it("loadConfig returns null when the required `version` field is missing", () => {
    const bad = { ...sampleConfig() } as Partial<QuietoConfig>;
    delete bad.version;
    writeFileSync(
      join(tempDir, "quieto.config.json"),
      JSON.stringify(bad),
      "utf-8",
    );
    expect(loadConfig(tempDir)).toBeNull();
  });

  it("loadConfig returns the parsed config for a valid file", () => {
    writeFileSync(
      join(tempDir, "quieto.config.json"),
      JSON.stringify(sampleConfig()),
      "utf-8",
    );
    const loaded = loadConfig(tempDir);
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe("0.1.0");
    expect(loaded!.inputs.brandColor).toBe("#5B21B6");
    expect(loaded!.output.prefix).toBe("quieto");
  });

  it("loadConfig warns when config version is newer than tool version", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    writeFileSync(
      join(tempDir, "quieto.config.json"),
      JSON.stringify(sampleConfig({ version: "2.0.0" })),
      "utf-8",
    );

    const loaded = loadConfig(tempDir, { toolVersion: "0.1.0" });
    expect(loaded).not.toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toMatch(/newer version/i);
  });

  it("loadConfig does NOT warn when config version equals tool version", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    writeFileSync(
      join(tempDir, "quieto.config.json"),
      JSON.stringify(sampleConfig({ version: "0.1.0" })),
      "utf-8",
    );

    loadConfig(tempDir, { toolVersion: "0.1.0" });
    expect(warn).not.toHaveBeenCalled();
  });

  it("loadConfig does NOT warn when config version is older than tool version", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    writeFileSync(
      join(tempDir, "quieto.config.json"),
      JSON.stringify(sampleConfig({ version: "0.0.1" })),
      "utf-8",
    );

    loadConfig(tempDir, { toolVersion: "1.0.0" });
    expect(warn).not.toHaveBeenCalled();
  });

  it("loadConfig skips the version check when no toolVersion is supplied", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    writeFileSync(
      join(tempDir, "quieto.config.json"),
      JSON.stringify(sampleConfig({ version: "999.0.0" })),
      "utf-8",
    );

    loadConfig(tempDir);
    expect(warn).not.toHaveBeenCalled();
  });
});

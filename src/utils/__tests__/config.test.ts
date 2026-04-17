import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mkdtempSync,
  rmSync,
  existsSync,
  writeFileSync,
  chmodSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

vi.mock("@clack/prompts", () => ({
  log: {
    step: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  CONFIG_FILENAME,
  configExists,
  getConfigPath,
  loadConfig,
  validateConfigShape,
} from "../config.js";
import type { ConfigLogger } from "../config.js";
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
    categories: ["color", "spacing", "typography"],
    ...overrides,
  };
}

function makeLogger(): ConfigLogger & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    warn: (message) => {
      calls.push(message);
    },
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

describe("validateConfigShape", () => {
  it("returns no errors for a well-formed config", () => {
    expect(validateConfigShape(sampleConfig())).toEqual([]);
  });

  it("rejects non-object roots with a `<root>` error", () => {
    expect(validateConfigShape(null)).toEqual(["<root>: expected object"]);
    expect(validateConfigShape("string")).toEqual(["<root>: expected object"]);
    expect(validateConfigShape(42)).toEqual(["<root>: expected object"]);
  });

  it("flags a missing version field", () => {
    const bad = { ...sampleConfig() } as Partial<QuietoConfig>;
    delete bad.version;
    expect(validateConfigShape(bad)).toContain("version");
  });

  it("flags a missing inputs block entirely", () => {
    const bad = { ...sampleConfig() } as Partial<QuietoConfig>;
    delete bad.inputs;
    expect(validateConfigShape(bad)).toContain("inputs");
  });

  it("flags an invalid spacingBase value", () => {
    const bad = sampleConfig();
    (bad.inputs as unknown as { spacingBase: number }).spacingBase = 12;
    expect(validateConfigShape(bad)).toContain("inputs.spacingBase");
  });

  it("flags an invalid typeScale value", () => {
    const bad = sampleConfig();
    (bad.inputs as unknown as { typeScale: string }).typeScale = "enormous";
    expect(validateConfigShape(bad)).toContain("inputs.typeScale");
  });

  it("flags a non-boolean darkMode", () => {
    const bad = sampleConfig();
    (bad.inputs as unknown as { darkMode: string }).darkMode = "yes";
    expect(validateConfigShape(bad)).toContain("inputs.darkMode");
  });

  it("flags array overrides (arrays are objects in JS but not a record)", () => {
    const bad = { ...sampleConfig(), overrides: [] as unknown };
    expect(validateConfigShape(bad)).toContain("overrides");
  });

  it("flags missing output sub-fields individually", () => {
    const bad = sampleConfig();
    (bad.output as unknown as { prefix?: string }).prefix = undefined;
    expect(validateConfigShape(bad)).toContain("output.prefix");
  });

  it("accepts configs without optional categories/advanced (Epic 1 fallback)", () => {
    const legacy = { ...sampleConfig() } as Partial<QuietoConfig>;
    delete legacy.categories;
    delete legacy.advanced;
    expect(validateConfigShape(legacy)).toEqual([]);
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

  it("returns { status: 'missing' } when no config file exists", () => {
    expect(loadConfig(tempDir)).toEqual({ status: "missing" });
  });

  it("returns { status: 'corrupt' } with the parser error when JSON is malformed", () => {
    writeFileSync(
      join(tempDir, "quieto.config.json"),
      "{ not valid json",
      "utf-8",
    );
    const result = loadConfig(tempDir);
    expect(result.status).toBe("corrupt");
    if (result.status === "corrupt") {
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message.length).toBeGreaterThan(0);
    }
  });

  it("strips a leading UTF-8 BOM before parsing", () => {
    writeFileSync(
      join(tempDir, "quieto.config.json"),
      "\uFEFF" + JSON.stringify(sampleConfig()),
      "utf-8",
    );
    const result = loadConfig(tempDir);
    expect(result.status).toBe("ok");
  });

  it("returns { status: 'invalid' } with the list of broken paths", () => {
    const bad = { ...sampleConfig() } as Partial<QuietoConfig>;
    delete bad.version;
    delete bad.inputs;
    writeFileSync(
      join(tempDir, "quieto.config.json"),
      JSON.stringify(bad),
      "utf-8",
    );
    const result = loadConfig(tempDir);
    expect(result.status).toBe("invalid");
    if (result.status === "invalid") {
      expect(result.errors).toEqual(
        expect.arrayContaining(["version", "inputs"]),
      );
    }
  });

  it("returns { status: 'ok' } with the parsed config for a valid file", () => {
    writeFileSync(
      join(tempDir, "quieto.config.json"),
      JSON.stringify(sampleConfig()),
      "utf-8",
    );
    const result = loadConfig(tempDir);
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.config.version).toBe("0.1.0");
      expect(result.config.inputs.brandColor).toBe("#5B21B6");
      expect(result.config.output.prefix).toBe("quieto");
    }
  });

  it("defaults missing `categories` to the three core categories (Epic 1 fallback)", () => {
    const legacy = { ...sampleConfig() } as Partial<QuietoConfig>;
    delete legacy.categories;
    writeFileSync(
      join(tempDir, "quieto.config.json"),
      JSON.stringify(legacy),
      "utf-8",
    );
    const result = loadConfig(tempDir);
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.config.categories).toEqual([
        "color",
        "spacing",
        "typography",
      ]);
    }
  });

  it("leaves advanced undefined when absent on disk", () => {
    writeFileSync(
      join(tempDir, "quieto.config.json"),
      JSON.stringify(sampleConfig()),
      "utf-8",
    );
    const result = loadConfig(tempDir);
    if (result.status === "ok") {
      expect(result.config.advanced).toBeUndefined();
    }
  });

  it("preserves advanced when present on disk", () => {
    const cfg = {
      ...sampleConfig(),
      advanced: {
        color: { additionalHues: [{ name: "accent", seed: "#FF00AA" }] },
      },
    };
    writeFileSync(
      join(tempDir, "quieto.config.json"),
      JSON.stringify(cfg),
      "utf-8",
    );
    const result = loadConfig(tempDir);
    if (result.status === "ok") {
      expect(result.config.advanced).toEqual({
        color: { additionalHues: [{ name: "accent", seed: "#FF00AA" }] },
      });
    }
  });

  it("warns via the injected logger when config version is newer than tool version", () => {
    const logger = makeLogger();
    writeFileSync(
      join(tempDir, "quieto.config.json"),
      JSON.stringify(sampleConfig({ version: "2.0.0" })),
      "utf-8",
    );

    const result = loadConfig(tempDir, { toolVersion: "0.1.0", logger });
    expect(result.status).toBe("ok");
    expect(logger.calls).toHaveLength(1);
    expect(logger.calls[0]).toMatch(/newer version/i);
  });

  it("falls back to Clack's p.log.warn when no logger is supplied", async () => {
    const clack = await import("@clack/prompts");
    vi.mocked(clack.log.warn).mockClear();
    writeFileSync(
      join(tempDir, "quieto.config.json"),
      JSON.stringify(sampleConfig({ version: "2.0.0" })),
      "utf-8",
    );

    loadConfig(tempDir, { toolVersion: "0.1.0" });
    expect(clack.log.warn).toHaveBeenCalledTimes(1);
    expect(clack.log.warn).toHaveBeenCalledWith(
      expect.stringMatching(/newer version/i),
    );
  });

  it("swallows logger errors so the discriminated-union contract is preserved", () => {
    writeFileSync(
      join(tempDir, "quieto.config.json"),
      JSON.stringify(sampleConfig({ version: "2.0.0" })),
      "utf-8",
    );
    const throwing: ConfigLogger = {
      warn: () => {
        throw new Error("logger exploded");
      },
    };
    const result = loadConfig(tempDir, {
      toolVersion: "0.1.0",
      logger: throwing,
    });
    expect(result.status).toBe("ok");
  });

  it("does NOT warn when config version equals tool version", () => {
    const logger = makeLogger();
    writeFileSync(
      join(tempDir, "quieto.config.json"),
      JSON.stringify(sampleConfig({ version: "0.1.0" })),
      "utf-8",
    );

    loadConfig(tempDir, { toolVersion: "0.1.0", logger });
    expect(logger.calls).toHaveLength(0);
  });

  it("does NOT warn when config version is older than tool version", () => {
    const logger = makeLogger();
    writeFileSync(
      join(tempDir, "quieto.config.json"),
      JSON.stringify(sampleConfig({ version: "0.0.1" })),
      "utf-8",
    );

    loadConfig(tempDir, { toolVersion: "1.0.0", logger });
    expect(logger.calls).toHaveLength(0);
  });

  it("skips the version check when no toolVersion is supplied", () => {
    const logger = makeLogger();
    writeFileSync(
      join(tempDir, "quieto.config.json"),
      JSON.stringify(sampleConfig({ version: "999.0.0" })),
      "utf-8",
    );

    loadConfig(tempDir, { logger });
    expect(logger.calls).toHaveLength(0);
  });

  it("classifies non-ENOENT read errors as corrupt (e.g. EACCES)", () => {
    // Skip on Windows / root where POSIX permissions don't bite.
    if (process.platform === "win32") return;
    if (typeof process.getuid === "function" && process.getuid() === 0) return;

    writeFileSync(
      join(tempDir, "quieto.config.json"),
      JSON.stringify(sampleConfig()),
      "utf-8",
    );
    chmodSync(join(tempDir, "quieto.config.json"), 0o000);

    try {
      const result = loadConfig(tempDir);
      expect(result.status).toBe("corrupt");
    } finally {
      chmodSync(join(tempDir, "quieto.config.json"), 0o600);
    }
  });

  it("configExists returns true for unreadable-but-present files (EACCES)", () => {
    if (process.platform === "win32") return;
    if (typeof process.getuid === "function" && process.getuid() === 0) return;

    writeFileSync(
      join(tempDir, "quieto.config.json"),
      JSON.stringify(sampleConfig()),
      "utf-8",
    );
    chmodSync(join(tempDir, "quieto.config.json"), 0o000);

    try {
      // The file exists — configExists must not lie by returning false
      // just because the read errored. loadConfig surfaces the real error.
      expect(configExists(tempDir)).toBe(true);
    } finally {
      chmodSync(join(tempDir, "quieto.config.json"), 0o600);
    }
  });

  it("does not pollute the returned config prototype with attacker keys", () => {
    const malicious = JSON.stringify({
      ...sampleConfig(),
      __proto__: { polluted: "yes" },
      constructor: { prototype: { polluted: "yes" } },
    });
    writeFileSync(join(tempDir, "quieto.config.json"), malicious, "utf-8");

    const result = loadConfig(tempDir);
    expect(result.status).toBe("ok");
    // Both the returned config and a fresh object must be untouched — the
    // explicit-field copy in loadConfig refuses to spread attacker keys.
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    if (result.status === "ok") {
      expect(
        (result.config as unknown as Record<string, unknown>).polluted,
      ).toBeUndefined();
    }
  });

  it("flags advanced.spacing.customValues with non-positive / non-finite values", () => {
    writeFileSync(
      join(tempDir, "quieto.config.json"),
      JSON.stringify({
        ...sampleConfig(),
        advanced: {
          spacing: {
            customValues: {
              "space-4": 20,
              "space-8": -1,
              "space-12": 0,
            },
          },
        },
      }),
      "utf-8",
    );

    const result = loadConfig(tempDir);
    expect(result.status).toBe("invalid");
    if (result.status === "invalid") {
      expect(result.errors).toEqual(
        expect.arrayContaining([
          "advanced.spacing.customValues.space-8",
          "advanced.spacing.customValues.space-12",
        ]),
      );
    }
  });

  it("flags non-string elements in categories", () => {
    writeFileSync(
      join(tempDir, "quieto.config.json"),
      JSON.stringify({
        ...sampleConfig(),
        categories: ["color", 42, "typography"],
      }),
      "utf-8",
    );

    const result = loadConfig(tempDir);
    expect(result.status).toBe("invalid");
    if (result.status === "invalid") {
      expect(result.errors).toContain("categories[1]");
    }
  });
});

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

/**
 * `categoryConfigs` validator + round-trip coverage — Story 2.4 Task 5 /
 * AC #8. Covers every category block (shadow / border / animation),
 * every out-of-range error path, and the prototype-pollution guard so
 * hand-edited / malicious configs can't sneak attacker keys past the
 * validator into runtime code paths.
 */
describe("categoryConfigs validator + round-trip", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-catconf-test-"));
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("buildConfig → writeConfig → loadConfig round-trip (AC #23, #24)", () => {
    it("round-trips a config with every categoryConfigs block intact", async () => {
      const { buildConfig, writeConfig } = await import("../../output/config-writer.js");
      const input = {
        options: {
          brandColor: "#3B82F6",
          spacingBase: 8 as const,
          typeScale: "balanced" as const,
          generateThemes: true,
        },
        overrides: new Map<string, string>(),
        version: "0.1.0",
        generated: "2026-04-17T12:00:00.000Z",
        categories: ["color", "spacing", "typography", "shadow", "border", "animation"],
        categoryConfigs: {
          shadow: {
            levels: 4,
            profile: "soft" as const,
            colorRef: "{color.neutral.900}",
          },
          border: {
            widths: [1, 2, 4, 8],
            radii: [2, 4, 8, 16],
            pill: true,
          },
          animation: {
            durations: [100, 200, 300],
            easing: "standard" as const,
          },
        },
      };
      const built = buildConfig(input);
      await writeConfig(built, tempDir);

      const result = loadConfig(tempDir);
      expect(result.status).toBe("ok");
      if (result.status !== "ok") return;

      // Each block must survive untouched — values, keys, nested arrays.
      expect(result.config.categoryConfigs).toEqual(input.categoryConfigs);
      // Categories list survives with every entry in order.
      expect(result.config.categories).toEqual(input.categories);
    });

    it("round-trips a config with only the shadow block set", async () => {
      const { buildConfig, writeConfig } = await import("../../output/config-writer.js");
      const built = buildConfig({
        options: {
          brandColor: "#3B82F6",
          spacingBase: 8,
          typeScale: "balanced",
          generateThemes: true,
        },
        overrides: new Map(),
        version: "0.1.0",
        generated: "2026-04-17T12:00:00.000Z",
        categories: ["color", "spacing", "typography", "shadow"],
        categoryConfigs: {
          shadow: {
            levels: 3,
            profile: "hard",
            colorRef: "{color.gray.800}",
          },
        },
      });
      await writeConfig(built, tempDir);

      const result = loadConfig(tempDir);
      expect(result.status).toBe("ok");
      if (result.status !== "ok") return;
      expect(result.config.categoryConfigs?.shadow).toEqual({
        levels: 3,
        profile: "hard",
        colorRef: "{color.gray.800}",
      });
      expect(result.config.categoryConfigs?.border).toBeUndefined();
      expect(result.config.categoryConfigs?.animation).toBeUndefined();
    });

    it("preserves the absence of categoryConfigs when the build omits it", async () => {
      const { buildConfig, writeConfig } = await import("../../output/config-writer.js");
      const built = buildConfig({
        options: {
          brandColor: "#3B82F6",
          spacingBase: 8,
          typeScale: "balanced",
          generateThemes: true,
        },
        overrides: new Map(),
        version: "0.1.0",
        generated: "2026-04-17T12:00:00.000Z",
      });
      // Quick-start build: no categoryConfigs at all. The absence-vs-empty
      // signal must survive through write + reload so Story 2.1's "config
      // predates add" detection stays intact.
      expect(built.categoryConfigs).toBeUndefined();
      await writeConfig(built, tempDir);

      const result = loadConfig(tempDir);
      expect(result.status).toBe("ok");
      if (result.status !== "ok") return;
      expect(result.config.categoryConfigs).toBeUndefined();
    });
  });

  describe("shadow.levels out-of-range rejection", () => {
    it("rejects levels below SHADOW_MIN_LEVELS (1) with the exact error-path", () => {
      writeFileSync(
        join(tempDir, "quieto.config.json"),
        JSON.stringify({
          ...sampleConfig(),
          categoryConfigs: {
            shadow: {
              levels: 1,
              profile: "soft",
              colorRef: "{color.neutral.900}",
            },
          },
        }),
        "utf-8",
      );

      const result = loadConfig(tempDir);
      expect(result.status).toBe("invalid");
      if (result.status !== "invalid") return;
      expect(result.errors).toContain("categoryConfigs.shadow.levels");
    });

    it("rejects levels above SHADOW_MAX_LEVELS (7) with the exact error-path", () => {
      writeFileSync(
        join(tempDir, "quieto.config.json"),
        JSON.stringify({
          ...sampleConfig(),
          categoryConfigs: {
            shadow: {
              levels: 7,
              profile: "soft",
              colorRef: "{color.neutral.900}",
            },
          },
        }),
        "utf-8",
      );

      const result = loadConfig(tempDir);
      expect(result.status).toBe("invalid");
      if (result.status !== "invalid") return;
      expect(result.errors).toContain("categoryConfigs.shadow.levels");
    });

    it("rejects non-integer levels (e.g. 3.5)", () => {
      writeFileSync(
        join(tempDir, "quieto.config.json"),
        JSON.stringify({
          ...sampleConfig(),
          categoryConfigs: {
            shadow: {
              levels: 3.5,
              profile: "soft",
              colorRef: "{color.neutral.900}",
            },
          },
        }),
        "utf-8",
      );

      const result = loadConfig(tempDir);
      expect(result.status).toBe("invalid");
      if (result.status !== "invalid") return;
      expect(result.errors).toContain("categoryConfigs.shadow.levels");
    });

    it("rejects malformed colorRef that doesn't match the DTCG ref shape", () => {
      writeFileSync(
        join(tempDir, "quieto.config.json"),
        JSON.stringify({
          ...sampleConfig(),
          categoryConfigs: {
            shadow: {
              levels: 3,
              profile: "soft",
              colorRef: "not-a-ref",
            },
          },
        }),
        "utf-8",
      );

      const result = loadConfig(tempDir);
      expect(result.status).toBe("invalid");
      if (result.status !== "invalid") return;
      expect(result.errors).toContain("categoryConfigs.shadow.colorRef");
    });

    it("rejects invalid profile values", () => {
      writeFileSync(
        join(tempDir, "quieto.config.json"),
        JSON.stringify({
          ...sampleConfig(),
          categoryConfigs: {
            shadow: {
              levels: 3,
              profile: "fluffy",
              colorRef: "{color.neutral.900}",
            },
          },
        }),
        "utf-8",
      );

      const result = loadConfig(tempDir);
      expect(result.status).toBe("invalid");
      if (result.status !== "invalid") return;
      expect(result.errors).toContain("categoryConfigs.shadow.profile");
    });
  });

  describe("prototype-pollution guard", () => {
    it("rejects `__proto__` nested under categoryConfigs.shadow (AC #8 path)", () => {
      writeFileSync(
        join(tempDir, "quieto.config.json"),
        `{
          "version": "0.1.0",
          "generated": "2026-04-16T12:00:00.000Z",
          "inputs": {
            "brandColor": "#3B82F6",
            "spacingBase": 8,
            "typeScale": "balanced",
            "darkMode": true
          },
          "overrides": {},
          "output": { "tokensDir": "tokens", "buildDir": "build", "prefix": "quieto" },
          "categories": ["color", "spacing", "typography"],
          "categoryConfigs": {
            "shadow": {
              "__proto__": { "polluted": "yes" },
              "levels": 3,
              "profile": "soft",
              "colorRef": "{color.neutral.900}"
            }
          }
        }`,
        "utf-8",
      );

      const result = loadConfig(tempDir);
      expect(result.status).toBe("invalid");
      if (result.status !== "invalid") return;
      expect(
        result.errors.some((e) =>
          e.startsWith("categoryConfigs.shadow.__proto__"),
        ),
      ).toBe(true);
    });

    it("rejects an unknown `__proto__` key under categoryConfigs", () => {
      // Hand-crafted JSON because `JSON.stringify({__proto__: ...})` drops
      // `__proto__` silently — we need the key to actually land in the
      // serialized text so `JSON.parse` will expose it as an own property.
      writeFileSync(
        join(tempDir, "quieto.config.json"),
        `{
          "version": "0.1.0",
          "generated": "2026-04-16T12:00:00.000Z",
          "inputs": {
            "brandColor": "#3B82F6",
            "spacingBase": 8,
            "typeScale": "balanced",
            "darkMode": true
          },
          "overrides": {},
          "output": { "tokensDir": "tokens", "buildDir": "build", "prefix": "quieto" },
          "categories": ["color", "spacing", "typography"],
          "categoryConfigs": {
            "__proto__": { "polluted": "yes" }
          }
        }`,
        "utf-8",
      );

      const result = loadConfig(tempDir);
      expect(result.status).toBe("invalid");
      if (result.status !== "invalid") return;
      // Either "unknown key" rejection (most likely) or a specific
      // prototype-pollution error — assert on the path prefix so the
      // exact error message can evolve without breaking the test.
      expect(
        result.errors.some((e) => e.startsWith("categoryConfigs.__proto__")),
      ).toBe(true);
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    it("rejects an unknown top-level category like `categoryConfigs.shadow2`", () => {
      writeFileSync(
        join(tempDir, "quieto.config.json"),
        JSON.stringify({
          ...sampleConfig(),
          categoryConfigs: {
            shadow2: {
              levels: 3,
            },
          },
        }),
        "utf-8",
      );

      const result = loadConfig(tempDir);
      expect(result.status).toBe("invalid");
      if (result.status !== "invalid") return;
      expect(result.errors).toContain("categoryConfigs.shadow2: unknown key");
    });

    it("keeps the loaded config's prototype clean after a valid load (no inherited keys)", async () => {
      const { buildConfig, writeConfig } = await import("../../output/config-writer.js");
      const built = buildConfig({
        options: {
          brandColor: "#3B82F6",
          spacingBase: 8,
          typeScale: "balanced",
          generateThemes: true,
        },
        overrides: new Map(),
        version: "0.1.0",
        generated: "2026-04-17T12:00:00.000Z",
        categoryConfigs: {
          shadow: {
            levels: 3,
            profile: "soft",
            colorRef: "{color.neutral.900}",
          },
        },
      });
      await writeConfig(built, tempDir);

      const result = loadConfig(tempDir);
      expect(result.status).toBe("ok");
      if (result.status !== "ok") return;
      // The returned categoryConfigs must not leak anything from the
      // underlying JSON's prototype — Object.getPrototypeOf should be
      // the plain-object prototype, nothing more.
      const block = result.config.categoryConfigs?.shadow as
        | Record<string, unknown>
        | undefined;
      expect(block).toBeDefined();
      if (!block) return;
      expect(Object.getPrototypeOf(block)).toBe(Object.prototype);
      expect(
        (block as unknown as Record<string, unknown>).polluted,
      ).toBeUndefined();
    });
  });
});

describe("validateConfigShape — components block", () => {
  function makeValidConfig(components: unknown): Record<string, unknown> {
    return {
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
      components,
    };
  }

  it("accepts a config without components (undefined)", () => {
    const errors = validateConfigShape(makeValidConfig(undefined));
    // Remove the `components` key entirely
    const obj = { ...makeValidConfig(undefined) };
    delete obj.components;
    expect(validateConfigShape(obj)).toEqual([]);
  });

  it("accepts a valid components block", () => {
    const errors = validateConfigShape(
      makeValidConfig({
        button: {
          variants: ["primary"],
          cells: [
            {
              variant: "primary",
              property: "color-background",
              states: [
                { state: "default", value: "{color.background.primary}" },
              ],
            },
          ],
        },
      }),
    );
    expect(errors).toEqual([]);
  });

  it("rejects a non-object components", () => {
    const errors = validateConfigShape(makeValidConfig("not-object"));
    expect(errors).toContain("components");
  });

  it("rejects missing variants", () => {
    const errors = validateConfigShape(
      makeValidConfig({
        button: { cells: [] },
      }),
    );
    expect(errors).toContainEqual(
      expect.stringContaining("components.button.variants"),
    );
  });

  it("rejects empty variants array", () => {
    const errors = validateConfigShape(
      makeValidConfig({
        button: { variants: [], cells: [] },
      }),
    );
    expect(errors).toContainEqual(
      expect.stringContaining("components.button.variants"),
    );
  });

  it("rejects unknown property in a cell", () => {
    const errors = validateConfigShape(
      makeValidConfig({
        button: {
          variants: ["primary"],
          cells: [
            {
              variant: "primary",
              property: "not-a-property",
              states: [
                { state: "default", value: "{color.background.primary}" },
              ],
            },
          ],
        },
      }),
    );
    expect(errors).toContainEqual(
      expect.stringContaining("components.button.cells[0].property"),
    );
  });

  it("rejects cell states without a default state", () => {
    const errors = validateConfigShape(
      makeValidConfig({
        button: {
          variants: ["primary"],
          cells: [
            {
              variant: "primary",
              property: "color-background",
              states: [
                { state: "hover", value: "{color.background.primary}" },
              ],
            },
          ],
        },
      }),
    );
    expect(errors).toContainEqual(
      expect.stringContaining("must include a default state"),
    );
  });

  it("rejects duplicate states", () => {
    const errors = validateConfigShape(
      makeValidConfig({
        button: {
          variants: ["primary"],
          cells: [
            {
              variant: "primary",
              property: "color-background",
              states: [
                { state: "default", value: "{color.background.primary}" },
                { state: "default", value: "{color.background.primary}" },
              ],
            },
          ],
        },
      }),
    );
    expect(errors).toContainEqual(
      expect.stringContaining("duplicate state"),
    );
  });

  it("rejects paddingShape on a non-padding cell", () => {
    const errors = validateConfigShape(
      makeValidConfig({
        button: {
          variants: ["primary"],
          cells: [
            {
              variant: "primary",
              property: "color-background",
              paddingShape: "single",
              states: [
                { state: "default", value: "{color.background.primary}" },
              ],
            },
          ],
        },
      }),
    );
    expect(errors).toContainEqual(
      expect.stringContaining("only valid for spacing-padding"),
    );
  });

  it("rejects invalid DTCG ref string in value", () => {
    const errors = validateConfigShape(
      makeValidConfig({
        button: {
          variants: ["primary"],
          cells: [
            {
              variant: "primary",
              property: "color-background",
              states: [
                { state: "default", value: "not-a-ref" },
              ],
            },
          ],
        },
      }),
    );
    expect(errors).toContainEqual(
      expect.stringContaining("components.button.cells[0].states[0].value"),
    );
  });

  it("rejects a cell whose variant is not in the variants list", () => {
    const errors = validateConfigShape(
      makeValidConfig({
        button: {
          variants: ["primary"],
          cells: [
            {
              variant: "nonexistent",
              property: "color-background",
              states: [
                { state: "default", value: "{color.background.primary}" },
              ],
            },
          ],
        },
      }),
    );
    expect(errors).toContainEqual(
      expect.stringContaining("components.button.cells[0].variant"),
    );
  });

  it("rejects a reserved component name as a key", () => {
    const errors = validateConfigShape(
      makeValidConfig({
        component: {
          variants: ["primary"],
          cells: [],
        },
      }),
    );
    expect(errors).toContainEqual(
      expect.stringContaining("components.component"),
    );
  });

  it("accepts four-sides padding with object value", () => {
    const errors = validateConfigShape(
      makeValidConfig({
        button: {
          variants: ["primary"],
          cells: [
            {
              variant: "primary",
              property: "spacing-padding",
              paddingShape: "four-sides",
              states: [
                {
                  state: "default",
                  value: {
                    top: "{spacing.md}",
                    right: "{spacing.sm}",
                    bottom: "{spacing.md}",
                    left: "{spacing.sm}",
                  },
                },
              ],
            },
          ],
        },
      }),
    );
    expect(errors).toEqual([]);
  });

  it("round-trips components through buildConfig → writeConfig → loadConfig", async () => {
    const { buildConfig, writeConfig } = await import(
      "../../output/config-writer.js"
    );

    const components = {
      button: {
        variants: ["primary"],
        cells: [
          {
            variant: "primary",
            property: "color-background" as const,
            states: [
              {
                state: "default" as const,
                value: "{color.background.primary}",
              },
            ],
          },
        ],
      },
    };

    const built = buildConfig({
      options: {
        brandColor: "#5B21B6",
        spacingBase: 8,
        typeScale: "balanced",
        generateThemes: false,
      },
      overrides: new Map(),
      version: "0.1.0",
      components,
    });

    expect(built.components).toEqual(components);

    const dir = mkdtempSync(join(tmpdir(), "quieto-comp-rt-"));
    try {
      await writeConfig(built, dir);
      const result = loadConfig(dir);
      expect(result.status).toBe("ok");
      if (result.status !== "ok") return;
      expect(result.config.components).toEqual(components);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects a variant string with leading/trailing whitespace", () => {
    const errors = validateConfigShape(
      makeValidConfig({
        button: {
          variants: [" primary "],
          cells: [
            {
              variant: " primary ",
              property: "color-background",
              states: [
                { state: "default", value: "{color.background.primary}" },
              ],
            },
          ],
        },
      }),
    );
    expect(errors).toContainEqual(
      expect.stringContaining("components.button.variants[0]"),
    );
  });

  it("does not pollute Object.prototype via __proto__ in components", () => {
    const components = Object.create(null);
    Object.defineProperty(components, "__proto__", {
      value: { variants: ["primary"], cells: [] },
      enumerable: true,
    });
    const errors = validateConfigShape(makeValidConfig(components));
    expect(errors.some((e) => e.includes("components.__proto__"))).toBe(true);
  });
});

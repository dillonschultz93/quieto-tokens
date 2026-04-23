import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  existsSync,
  writeFileSync,
  chmodSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  buildConfig,
  readToolVersion,
  writeConfig,
} from "../config-writer.js";
import type { QuickStartOptions } from "../../types.js";
import type { QuietoConfig } from "../../types/config.js";

function makeOptions(overrides: Partial<QuickStartOptions> = {}): QuickStartOptions {
  return {
    brandColor: "#5B21B6",
    spacingBase: 8,
    typeScale: "balanced",
    generateThemes: true,
    ...overrides,
  };
}

describe("buildConfig", () => {
  it("maps quick-start inputs into the `inputs` block verbatim", () => {
    const config = buildConfig({
      options: makeOptions(),
      overrides: new Map(),
      version: "0.1.0",
      generated: "2026-04-16T12:00:00.000Z",
    });

    expect(config.inputs).toEqual({
      brandColor: "#5B21B6",
      spacingBase: 8,
      typeScale: "balanced",
      darkMode: true,
    });
  });

  it("renames `generateThemes` to `darkMode` in the config schema", () => {
    const config = buildConfig({
      options: makeOptions({ generateThemes: false }),
      overrides: new Map(),
      version: "0.1.0",
      generated: "2026-04-16T12:00:00.000Z",
    });

    expect(config.inputs.darkMode).toBe(false);
  });

  it("serializes the overrides map as a plain object", () => {
    const overrides = new Map<string, string>([
      ["color.background.primary", "{color.blue.400}"],
      ["color.content.default", "{color.neutral.800}"],
    ]);

    const config = buildConfig({
      options: makeOptions(),
      overrides,
      version: "0.1.0",
      generated: "2026-04-16T12:00:00.000Z",
    });

    expect(config.overrides).toEqual({
      "color.background.primary": "{color.blue.400}",
      "color.content.default": "{color.neutral.800}",
    });
  });

  it("emits an empty overrides object when no overrides were made", () => {
    const config = buildConfig({
      options: makeOptions(),
      overrides: new Map(),
      version: "0.1.0",
      generated: "2026-04-16T12:00:00.000Z",
    });

    expect(config.overrides).toEqual({});
  });

  it("fills output paths with the default tokens/build/quieto values", () => {
    const config = buildConfig({
      options: makeOptions(),
      overrides: new Map(),
      version: "0.1.0",
      generated: "2026-04-16T12:00:00.000Z",
    });

    expect(config.output).toEqual({
      tokensDir: "tokens",
      buildDir: "build",
      prefix: "quieto",
    });
  });

  it("records the supplied tool version", () => {
    const config = buildConfig({
      options: makeOptions(),
      overrides: new Map(),
      version: "1.2.3",
      generated: "2026-04-16T12:00:00.000Z",
    });

    expect(config.version).toBe("1.2.3");
  });

  it("uses `new Date().toISOString()` when no generated timestamp is supplied", () => {
    const before = Date.now();
    const config = buildConfig({
      options: makeOptions(),
      overrides: new Map(),
      version: "0.1.0",
    });
    const after = Date.now();

    const when = Date.parse(config.generated);
    expect(Number.isFinite(when)).toBe(true);
    expect(when).toBeGreaterThanOrEqual(before);
    expect(when).toBeLessThanOrEqual(after);
  });

  it("defaults `categories` to the three core categories when none is supplied", () => {
    const config = buildConfig({
      options: makeOptions(),
      overrides: new Map(),
      version: "0.1.0",
      generated: "2026-04-16T12:00:00.000Z",
    });

    expect(config.categories).toEqual(["color", "spacing", "typography"]);
  });

  it("preserves a caller-supplied categories list (and copies it defensively)", () => {
    const categories = ["color", "spacing", "typography", "shadow"];
    const config = buildConfig({
      options: makeOptions(),
      overrides: new Map(),
      version: "0.1.0",
      generated: "2026-04-16T12:00:00.000Z",
      categories,
    });

    expect(config.categories).toEqual(categories);
    // Mutating the input must not mutate the stored config — defensive copy.
    categories.push("border");
    expect(config.categories).toEqual(["color", "spacing", "typography", "shadow"]);
  });

  it("omits `advanced` when no advanced block is supplied", () => {
    const config = buildConfig({
      options: makeOptions(),
      overrides: new Map(),
      version: "0.1.0",
      generated: "2026-04-16T12:00:00.000Z",
    });

    expect("advanced" in config).toBe(false);
  });

  it("includes the supplied advanced block verbatim", () => {
    const config = buildConfig({
      options: makeOptions(),
      overrides: new Map(),
      version: "0.1.0",
      generated: "2026-04-16T12:00:00.000Z",
      advanced: {
        color: {
          additionalHues: [
            { name: "accent", seed: "#FF00AA" },
            { name: "error", seed: "#D12020" },
          ],
        },
        spacing: { customValues: { "space-4": 18 } },
      },
    });

    expect(config.advanced).toEqual({
      color: {
        additionalHues: [
          { name: "accent", seed: "#FF00AA" },
          { name: "error", seed: "#D12020" },
        ],
      },
      spacing: { customValues: { "space-4": 18 } },
    });
  });
});

describe("writeConfig", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-config-"));
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  function sampleConfig(): QuietoConfig {
    return buildConfig({
      options: makeOptions(),
      overrides: new Map([["color.background.primary", "{color.blue.400}"]]),
      version: "0.1.0",
      generated: "2026-04-16T12:00:00.000Z",
    });
  }

  it("writes quieto.config.json to the given cwd and returns its path", async () => {
    const filePath = await writeConfig(sampleConfig(), tempDir);

    expect(filePath).toBe(join(tempDir, "quieto.config.json"));
    expect(existsSync(filePath)).toBe(true);
  });

  it("serializes as pretty-printed JSON with a trailing newline", async () => {
    await writeConfig(sampleConfig(), tempDir);
    const raw = readFileSync(join(tempDir, "quieto.config.json"), "utf-8");

    expect(raw.endsWith("\n")).toBe(true);
    expect(raw).toContain("  \"version\": \"0.1.0\"");
    expect(raw).toContain("  \"inputs\":");
  });

  it("round-trips through JSON.parse with all fields preserved", async () => {
    await writeConfig(sampleConfig(), tempDir);
    const raw = readFileSync(join(tempDir, "quieto.config.json"), "utf-8");
    const parsed = JSON.parse(raw) as QuietoConfig;

    expect(parsed.version).toBe("0.1.0");
    expect(parsed.generated).toBe("2026-04-16T12:00:00.000Z");
    expect(parsed.inputs.brandColor).toBe("#5B21B6");
    expect(parsed.inputs.spacingBase).toBe(8);
    expect(parsed.inputs.typeScale).toBe("balanced");
    expect(parsed.inputs.darkMode).toBe(true);
    expect(parsed.overrides).toEqual({
      "color.background.primary": "{color.blue.400}",
    });
    expect(parsed.output).toEqual({
      tokensDir: "tokens",
      buildDir: "build",
      prefix: "quieto",
    });
    expect(parsed.outputs).toEqual(["css"]);
  });

  it("overwrites an existing config file in place", async () => {
    writeFileSync(join(tempDir, "quieto.config.json"), "{}\n", "utf-8");
    await writeConfig(sampleConfig(), tempDir);

    const parsed = JSON.parse(
      readFileSync(join(tempDir, "quieto.config.json"), "utf-8"),
    ) as QuietoConfig;
    expect(parsed.version).toBe("0.1.0");
  });

  it("propagates filesystem errors when the target directory is not writable", async () => {
    // Skip on CI / Windows where permission modes don't behave like POSIX.
    if (process.platform === "win32") {
      return;
    }
    // Only skip when running as root — chmod cannot revoke write for root.
    if (typeof process.getuid === "function" && process.getuid() === 0) {
      return;
    }

    chmodSync(tempDir, 0o500);
    try {
      await expect(writeConfig(sampleConfig(), tempDir)).rejects.toThrow();
    } finally {
      chmodSync(tempDir, 0o700);
    }
  });
});

describe("readToolVersion", () => {
  it("resolves a non-empty semver-like string from package.json", async () => {
    const version = await readToolVersion();
    expect(typeof version).toBe("string");
    expect(version.length).toBeGreaterThan(0);
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });
});

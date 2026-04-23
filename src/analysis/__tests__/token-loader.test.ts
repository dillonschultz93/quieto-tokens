import { describe, it, expect, afterEach } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadTokenSystem } from "../token-loader.js";

function writeConfig(dir: string): void {
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
}

function writeTokenFiles(dir: string): void {
  const primColor = join(dir, "tokens", "primitive");
  const semDefault = join(dir, "tokens", "semantic", "default");
  mkdirSync(primColor, { recursive: true });
  mkdirSync(semDefault, { recursive: true });

  writeFileSync(
    join(primColor, "color.json"),
    JSON.stringify({
      color: {
        blue: {
          500: { $type: "color", $value: "#3B82F6" },
        },
      },
    }),
  );
  writeFileSync(
    join(primColor, "spacing.json"),
    JSON.stringify({
      spacing: {
        4: { $type: "dimension", $value: "4px" },
      },
    }),
  );
  writeFileSync(
    join(semDefault, "color.json"),
    JSON.stringify({
      color: {
        background: {
          primary: { $type: "color", $value: "{color.blue.500}" },
        },
      },
    }),
  );
}

describe("loadTokenSystem", () => {
  let tempDir: string;
  afterEach(() => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("returns null when no config exists", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-tl-"));
    const result = await loadTokenSystem(tempDir);
    expect(result).toBeNull();
  });

  it("loads primitives, semantics, and themes", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-tl-"));
    writeConfig(tempDir);
    writeTokenFiles(tempDir);

    const result = await loadTokenSystem(tempDir);
    expect(result).not.toBeNull();
    expect(result!.primitives.length).toBeGreaterThan(0);
    expect(result!.themes.length).toBe(1);
    expect(result!.themes[0]!.name).toBe("default");
    expect(result!.themes[0]!.semantics.length).toBeGreaterThan(0);
  });

  it("detects multiple themes from directory structure", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-tl-"));
    writeConfig(tempDir);
    const primColor = join(tempDir, "tokens", "primitive");
    mkdirSync(primColor, { recursive: true });
    writeFileSync(
      join(primColor, "color.json"),
      JSON.stringify({
        color: { blue: { 500: { $type: "color", $value: "#3B82F6" } } },
      }),
    );
    for (const theme of ["light", "dark"]) {
      const themeDir = join(tempDir, "tokens", "semantic", theme);
      mkdirSync(themeDir, { recursive: true });
      writeFileSync(
        join(themeDir, "color.json"),
        JSON.stringify({
          color: {
            background: {
              primary: { $type: "color", $value: "{color.blue.500}" },
            },
          },
        }),
      );
    }

    const result = await loadTokenSystem(tempDir);
    expect(result).not.toBeNull();
    expect(result!.themes.length).toBe(2);
    expect(result!.themes.map((t) => t.name).sort()).toEqual(["dark", "light"]);
  });

  it("treats component-only systems as present (not null)", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-tl-"));
    writeConfig(tempDir);
    const compDir = join(tempDir, "tokens", "component");
    mkdirSync(compDir, { recursive: true });
    writeFileSync(
      join(compDir, "button.json"),
      JSON.stringify({
        button: {
          padding: { $type: "dimension", $value: "{spacing.4}" },
        },
      }),
    );

    const result = await loadTokenSystem(tempDir);
    expect(result).not.toBeNull();
    expect(result!.components.length).toBeGreaterThan(0);
  });
});

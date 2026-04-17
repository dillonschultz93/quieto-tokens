import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writeTokensToJson } from "../json-writer.js";
import { buildCss } from "../style-dictionary.js";
import { sampleCollection } from "../../types/__fixtures__/tokens.js";

describe("buildCss (Style Dictionary v5)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-sd-test-"));
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("outputs a single build/tokens.css when only one theme exists (default)", async () => {
    const collection = sampleCollection(["default"]);
    await writeTokensToJson(collection, tempDir);

    const files = await buildCss(collection, tempDir);

    const tokensCssPath = join(tempDir, "build", "tokens.css");
    expect(existsSync(tokensCssPath)).toBe(true);
    expect(files).toContain(tokensCssPath);

    const css = readFileSync(tokensCssPath, "utf-8");
    expect(css).toContain(":root {");
  });

  it("applies the --quieto- prefix to CSS variables", async () => {
    const collection = sampleCollection(["default"]);
    await writeTokensToJson(collection, tempDir);
    await buildCss(collection, tempDir);

    const css = readFileSync(join(tempDir, "build", "tokens.css"), "utf-8");
    expect(css).toMatch(/--quieto-color-blue-500:\s*#3B82F6/i);
  });

  it("emits semantic variables as --quieto-semantic-* via the custom name transform", async () => {
    const collection = sampleCollection(["default"]);
    await writeTokensToJson(collection, tempDir);
    await buildCss(collection, tempDir);

    const css = readFileSync(join(tempDir, "build", "tokens.css"), "utf-8");
    expect(css).toMatch(
      /--quieto-semantic-color-background-primary:\s*var\(--quieto-color-blue-500\)/i,
    );
  });

  it("outputs primitives.css + light.css + dark.css for multi-theme", async () => {
    const collection = sampleCollection(["light", "dark"]);
    await writeTokensToJson(collection, tempDir);

    const files = await buildCss(collection, tempDir);

    expect(existsSync(join(tempDir, "build", "primitives.css"))).toBe(true);
    expect(existsSync(join(tempDir, "build", "light.css"))).toBe(true);
    expect(existsSync(join(tempDir, "build", "dark.css"))).toBe(true);

    expect(files).toContain(join(tempDir, "build", "primitives.css"));
    expect(files).toContain(join(tempDir, "build", "light.css"));
    expect(files).toContain(join(tempDir, "build", "dark.css"));
  });

  it("scopes dark theme under [data-theme=\"dark\"] selector", async () => {
    const collection = sampleCollection(["light", "dark"]);
    await writeTokensToJson(collection, tempDir);
    await buildCss(collection, tempDir);

    const darkCss = readFileSync(join(tempDir, "build", "dark.css"), "utf-8");
    expect(darkCss).toContain('[data-theme="dark"]');
  });

  it("scopes light theme under :root", async () => {
    const collection = sampleCollection(["light", "dark"]);
    await writeTokensToJson(collection, tempDir);
    await buildCss(collection, tempDir);

    const lightCss = readFileSync(join(tempDir, "build", "light.css"), "utf-8");
    expect(lightCss).toContain(":root {");
  });

  it("uses var() references for semantic tokens via outputReferences", async () => {
    const collection = sampleCollection(["light", "dark"]);
    await writeTokensToJson(collection, tempDir);
    await buildCss(collection, tempDir);

    const lightCss = readFileSync(join(tempDir, "build", "light.css"), "utf-8");
    expect(lightCss).toMatch(
      /--quieto-semantic-color-background-primary:\s*var\(--quieto-color-blue-500\)/i,
    );
  });

  it("primitives.css only contains primitive variables (no semantic prefix)", async () => {
    const collection = sampleCollection(["light", "dark"]);
    await writeTokensToJson(collection, tempDir);
    await buildCss(collection, tempDir);

    const primCss = readFileSync(
      join(tempDir, "build", "primitives.css"),
      "utf-8",
    );
    expect(primCss).toMatch(/--quieto-color-blue-500/);
    expect(primCss).not.toMatch(/--quieto-semantic-/);
  });

  it("theme CSS files only contain semantic variables", async () => {
    const collection = sampleCollection(["light", "dark"]);
    await writeTokensToJson(collection, tempDir);
    await buildCss(collection, tempDir);

    const lightCss = readFileSync(join(tempDir, "build", "light.css"), "utf-8");
    expect(lightCss).toMatch(/--quieto-semantic-/);
    expect(lightCss).not.toMatch(/--quieto-color-blue-500:\s*#/);
  });
});

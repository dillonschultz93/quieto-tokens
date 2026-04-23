import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { LoadedTokenSystem } from "../token-loader.js";
import { buildTokenIndex } from "../token-index.js";
import { scanDirectory } from "../scanner.js";

describe("scanDirectory", () => {
  let dir: string;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("finds exact and approximate matches, and skips already-tokenized lines", async () => {
    dir = mkdtempSync(join(tmpdir(), "quieto-scan-"));
    const src = join(dir, "src");
    mkdirSync(src, { recursive: true });

    writeFileSync(
      join(src, "a.css"),
      [
        ".a {",
        "  color: #3B82F6;",
        "  margin: 16px;",
        "  background: var(--quieto-color-blue-500);",
        "}",
        "",
      ].join("\n"),
    );

    writeFileSync(
      join(src, "b.scss"),
      [
        ".b {",
        "  border-color: #3A82F6;", // approx to #3b82f6
        "  padding: 15px;", // approx to 16px
        "}",
        "",
      ].join("\n"),
    );

    const system: LoadedTokenSystem = {
      config: {
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
      },
      primitives: [
        {
          tier: "primitive",
          category: "color",
          name: "color.blue.500",
          $type: "color",
          $value: "#3B82F6",
          path: ["color", "blue", "500"],
        },
        {
          tier: "primitive",
          category: "spacing",
          name: "spacing.16",
          $type: "dimension",
          $value: "16px",
          path: ["spacing", "16"],
        },
      ],
      themes: [],
      components: [],
    };

    const idx = buildTokenIndex(system);
    const result = await scanDirectory(src, idx);

    const exact = result.matches.filter((m) => m.confidence === "exact");
    const approx = result.matches.filter((m) => m.confidence === "approximate");

    expect(result.filesScanned).toBe(2);
    expect(result.hardcodedValuesFound).toBe(4);
    expect(exact.map((m) => m.hardcodedValue)).toEqual(
      expect.arrayContaining(["#3B82F6", "16px"]),
    );
    expect(approx.map((m) => m.hardcodedValue)).toEqual(
      expect.arrayContaining(["#3A82F6", "15px"]),
    );

    // Tokenized var() calls should not produce matches
    expect(
      result.matches.some((m) => m.hardcodedValue.includes("quieto")),
    ).toBe(false);
  });

  it("matches typography dimensions (AC #3)", async () => {
    dir = mkdtempSync(join(tmpdir(), "quieto-scan-typo-"));
    const src = join(dir, "src");
    mkdirSync(src, { recursive: true });

    writeFileSync(join(src, "a.css"), ".a { font-size: 16px; }\n");

    const system: LoadedTokenSystem = {
      config: {
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
        categories: ["typography"],
      },
      primitives: [
        {
          tier: "primitive",
          category: "typography",
          name: "typography.fontSize.base",
          $type: "fontSize",
          $value: "16px",
          path: ["typography", "fontSize", "base"],
        },
      ],
      themes: [],
      components: [],
    };

    const idx = buildTokenIndex(system);
    const result = await scanDirectory(src, idx);
    expect(result.matches.length).toBe(1);
    expect(result.matches[0]?.category).toBe("typography");
    expect(result.matches[0]?.confidence).toBe("exact");
  });
});


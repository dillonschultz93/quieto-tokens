import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writeTokensToJson } from "../json-writer.js";
import { buildIos } from "../style-dictionary.js";
import type {
  PrimitiveToken,
  SemanticToken,
  ThemeCollection,
} from "../../types/tokens.js";
import {
  makeColorPrimitive,
  makeSpacingPrimitive,
  makeTypoPrimitive,
  makeColorSemantic,
  sampleCollection,
} from "../../types/__fixtures__/tokens.js";

function makeFullCollection(themeNames: string[]): ThemeCollection {
  const primitives: PrimitiveToken[] = [
    makeColorPrimitive("blue", 500, "#3B82F6"),
    makeColorPrimitive("neutral", 900, "#111827"),
    makeSpacingPrimitive(4),
    makeSpacingPrimitive(16),
    makeTypoPrimitive("font-size", "lg", "18px", "fontSize"),
    makeTypoPrimitive("font-weight", "bold", "700", "fontWeight"),
    makeTypoPrimitive("font-family", "body", "Inter", "fontFamily"),
  ];
  const semantics: SemanticToken[] = [
    makeColorSemantic("background", "primary", "{color.blue.500}"),
  ];
  return {
    primitives,
    themes: themeNames.map((name) => ({ name, semanticTokens: semantics })),
  };
}

describe("buildIos — name/ios transform", () => {
  let tempDir: string;
  afterEach(() => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("produces camelCase identifiers for color tokens", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-ios-name-"));
    const c = makeFullCollection(["default"]);
    await writeTokensToJson(c, tempDir);
    await buildIos(c, tempDir);

    const color = readFileSync(join(tempDir, "build", "ios", "Color.swift"), "utf-8");
    expect(color).toContain("colorBlue500");
    expect(color).toContain("colorNeutral900");
  });

  it("adds semantic prefix to semantic token identifiers", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-ios-sem-"));
    const c = makeFullCollection(["default"]);
    await writeTokensToJson(c, tempDir);
    await buildIos(c, tempDir);

    const color = readFileSync(join(tempDir, "build", "ios", "Color.swift"), "utf-8");
    expect(color).toContain("semanticColorBackgroundPrimary");
  });

  it("produces camelCase for spacing tokens", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-ios-sp-"));
    const c = makeFullCollection(["default"]);
    await writeTokensToJson(c, tempDir);
    await buildIos(c, tempDir);

    const spacing = readFileSync(join(tempDir, "build", "ios", "Spacing.swift"), "utf-8");
    expect(spacing).toContain("spacing4");
    expect(spacing).toContain("spacing16");
  });
});

describe("buildIos — ios/color-swift format", () => {
  let tempDir: string;
  afterEach(() => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("produces UIColor static constants", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-ios-uic-"));
    const c = makeFullCollection(["default"]);
    await writeTokensToJson(c, tempDir);
    await buildIos(c, tempDir);

    const color = readFileSync(join(tempDir, "build", "ios", "Color.swift"), "utf-8");
    expect(color).toMatch(/static let colorBlue500\s*=\s*UIColor\(/);
    expect(color).toContain("import UIKit");
  });

  it("produces SwiftUI Color companion extensions", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-ios-swc-"));
    const c = makeFullCollection(["default"]);
    await writeTokensToJson(c, tempDir);
    await buildIos(c, tempDir);

    const color = readFileSync(join(tempDir, "build", "ios", "Color.swift"), "utf-8");
    expect(color).toContain("import SwiftUI");
    expect(color).toContain("extension Color");
    expect(color).toMatch(/Color\(uiColor:\s*\.colorBlue500\)/);
  });

  it("resolves semantic color references to concrete UIColor values", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-ios-ref-"));
    const c = makeFullCollection(["default"]);
    await writeTokensToJson(c, tempDir);
    await buildIos(c, tempDir);

    const color = readFileSync(join(tempDir, "build", "ios", "Color.swift"), "utf-8");
    expect(color).toMatch(
      /static let semanticColorBackgroundPrimary\s*=\s*UIColor\(red:/,
    );
  });
});

describe("buildIos — ios/spacing-swift format", () => {
  let tempDir: string;
  afterEach(() => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("produces CGFloat constants from pixel values", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-ios-cgf-"));
    const c = makeFullCollection(["default"]);
    await writeTokensToJson(c, tempDir);
    await buildIos(c, tempDir);

    const spacing = readFileSync(join(tempDir, "build", "ios", "Spacing.swift"), "utf-8");
    expect(spacing).toContain("import CoreGraphics");
    expect(spacing).toMatch(/static let spacing4:\s*CGFloat\s*=\s*4/);
    expect(spacing).toMatch(/static let spacing16:\s*CGFloat\s*=\s*16/);
  });
});

describe("buildIos — ios/typography-swift format", () => {
  let tempDir: string;
  afterEach(() => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("produces font size as CGFloat", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-ios-typo-"));
    const c = makeFullCollection(["default"]);
    await writeTokensToJson(c, tempDir);
    await buildIos(c, tempDir);

    const typo = readFileSync(join(tempDir, "build", "ios", "Typography.swift"), "utf-8");
    expect(typo).toMatch(/static let typographyFontSizeLg:\s*CGFloat\s*=\s*18/);
  });

  it("produces font weight as CGFloat", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-ios-fw-"));
    const c = makeFullCollection(["default"]);
    await writeTokensToJson(c, tempDir);
    await buildIos(c, tempDir);

    const typo = readFileSync(join(tempDir, "build", "ios", "Typography.swift"), "utf-8");
    expect(typo).toMatch(/static let typographyFontWeightBold:\s*CGFloat\s*=\s*700/);
  });

  it("produces font family as String constant", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-ios-ff-"));
    const c = makeFullCollection(["default"]);
    await writeTokensToJson(c, tempDir);
    await buildIos(c, tempDir);

    const typo = readFileSync(join(tempDir, "build", "ios", "Typography.swift"), "utf-8");
    expect(typo).toMatch(/static let typographyFontFamilyBody:\s*String\s*=\s*"Inter"/);
  });
});

describe("buildIos — multi-theme support", () => {
  let tempDir: string;
  afterEach(() => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("generates Theme.Light and Theme.Dark namespaces for colors", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-ios-mt-"));
    const c = makeFullCollection(["light", "dark"]);
    await writeTokensToJson(c, tempDir);
    await buildIos(c, tempDir);

    const color = readFileSync(join(tempDir, "build", "ios", "Color.swift"), "utf-8");
    expect(color).toContain("public enum Theme {");
    expect(color).toContain("public enum Light {");
    expect(color).toContain("public enum Dark {");
  });

  it("multi-theme colors include per-theme SwiftUI Color extensions", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-ios-mtc-"));
    const c = makeFullCollection(["light", "dark"]);
    await writeTokensToJson(c, tempDir);
    await buildIos(c, tempDir);

    const color = readFileSync(join(tempDir, "build", "ios", "Color.swift"), "utf-8");
    expect(color).toContain("Color(uiColor: Theme.Light.");
    expect(color).toContain("Color(uiColor: Theme.Dark.");
  });

  it("generates Theme namespaces for spacing in multi-theme", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-ios-mts-"));
    const c = makeFullCollection(["light", "dark"]);
    await writeTokensToJson(c, tempDir);
    await buildIos(c, tempDir);

    const spacing = readFileSync(join(tempDir, "build", "ios", "Spacing.swift"), "utf-8");
    expect(spacing).toContain("public enum Theme {");
    expect(spacing).toContain("public enum Light {");
  });
});

describe("buildIos — file organization", () => {
  let tempDir: string;
  afterEach(() => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("writes files to build/ios/ directory", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-ios-dir-"));
    const c = makeFullCollection(["default"]);
    await writeTokensToJson(c, tempDir);
    const files = await buildIos(c, tempDir);

    expect(files).toContain(join(tempDir, "build", "ios", "Color.swift"));
    expect(files).toContain(join(tempDir, "build", "ios", "Spacing.swift"));
    expect(files).toContain(join(tempDir, "build", "ios", "Typography.swift"));
  });

  it("creates all three category files", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-ios-all-"));
    const c = makeFullCollection(["default"]);
    await writeTokensToJson(c, tempDir);
    await buildIos(c, tempDir);

    expect(existsSync(join(tempDir, "build", "ios", "Color.swift"))).toBe(true);
    expect(existsSync(join(tempDir, "build", "ios", "Spacing.swift"))).toBe(true);
    expect(existsSync(join(tempDir, "build", "ios", "Typography.swift"))).toBe(true);
  });

  it("single-theme produces flat extensions (no Theme enum)", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-ios-flat-"));
    const c = makeFullCollection(["default"]);
    await writeTokensToJson(c, tempDir);
    await buildIos(c, tempDir);

    const color = readFileSync(join(tempDir, "build", "ios", "Color.swift"), "utf-8");
    expect(color).toContain("extension UIColor");
    expect(color).not.toContain("enum Theme");
  });
});

describe("buildIos — pipeline integration", () => {
  let tempDir: string;
  afterEach(() => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("returns array of written file paths", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-ios-ret-"));
    const c = sampleCollection(["default"]);
    await writeTokensToJson(c, tempDir);
    const files = await buildIos(c, tempDir);

    expect(Array.isArray(files)).toBe(true);
    expect(files.length).toBe(3);
    for (const f of files) {
      expect(f).toMatch(/\.swift$/);
    }
  });
});

import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writeTokensToJson } from "../json-writer.js";
import { buildAndroid } from "../style-dictionary.js";
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

describe("buildAndroid — name transforms and formats", () => {
  let tempDir: string;
  afterEach(() => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("xml: resource names are quieto_snake_case", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-and-xm-"));
    const c = makeFullCollection(["default"]);
    await writeTokensToJson(c, tempDir);
    await buildAndroid(c, tempDir, "xml");
    const colors = readFileSync(
      join(tempDir, "build", "android", "values", "colors.xml"),
      "utf-8",
    );
    expect(colors).toContain("quieto_color_blue_500");
    expect(colors).toMatch(
      /<color name="quieto_color_blue_500">#[0-9A-Fa-f]+<\/color>/,
    );
  });

  it("xml: dimens use dp and quieto_ names", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-and-dm-"));
    const c = makeFullCollection(["default"]);
    await writeTokensToJson(c, tempDir);
    await buildAndroid(c, tempDir, "xml");
    const dim = readFileSync(
      join(tempDir, "build", "android", "values", "dimens.xml"),
      "utf-8",
    );
    expect(dim).toContain("quieto_spacing_4");
    expect(dim).toMatch(
      /<dimen name="quieto_spacing_4">[0-9.]+dp<\/dimen>/,
    );
  });

  it("compose: color identifiers are PascalCase", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-and-cmp-"));
    const c = makeFullCollection(["default"]);
    await writeTokensToJson(c, tempDir);
    await buildAndroid(c, tempDir, "compose");
    const color = readFileSync(
      join(tempDir, "build", "android", "Color.kt"),
      "utf-8",
    );
    expect(color).toMatch(/val Blue500 = Color\(0xFF/);
  });

  it("compose: spacing is Dp with SpaceN names", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-and-cmsp-"));
    const c = makeFullCollection(["default"]);
    await writeTokensToJson(c, tempDir);
    await buildAndroid(c, tempDir, "compose");
    const sp = readFileSync(
      join(tempDir, "build", "android", "Spacing.kt"),
      "utf-8",
    );
    expect(sp).toMatch(/val Space4 = [0-9.]+.dp/);
  });

  it("multi-theme xml writes values/ and values-night/", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-and-mt-"));
    const c = makeFullCollection(["light", "dark"]);
    await writeTokensToJson(c, tempDir);
    await buildAndroid(c, tempDir, "xml");
    expect(
      existsSync(
        join(tempDir, "build", "android", "values", "colors.xml"),
      ),
    ).toBe(true);
    expect(
      existsSync(
        join(tempDir, "build", "android", "values-night", "colors.xml"),
      ),
    ).toBe(true);
  });

  it("multi-theme compose nests Theme* and schemes", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-and-mtc-"));
    const c = makeFullCollection(["light", "dark"]);
    await writeTokensToJson(c, tempDir);
    await buildAndroid(c, tempDir, "compose");
    const color = readFileSync(
      join(tempDir, "build", "android", "Color.kt"),
      "utf-8",
    );
    expect(color).toContain("object ThemeColors");
    expect(color).toContain("object Light");
    expect(color).toContain("object Dark");
    expect(color).toContain("quietoLightColorScheme");
    expect(color).toContain("quietoDarkColorScheme");
  });

  it("xml: typography dimens omit fontWeight and number tokens", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-and-typdm-"));
    const c = makeFullCollection(["default"]);
    await writeTokensToJson(c, tempDir);
    await buildAndroid(c, tempDir, "xml");
    const typo = readFileSync(
      join(tempDir, "build", "android", "values", "typography_dimens.xml"),
      "utf-8",
    );
    // fontWeight token ("700") must not appear as a <dimen>
    expect(typo).not.toContain("font_weight");
    // fontFamily token must not appear as a <dimen>
    expect(typo).not.toContain("font_family");
    // font-size (fontSize type) token should appear as sp
    expect(typo).toContain("sp");
  });

  it("xml: typography dimens do not pass em values through", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-and-typem-"));
    const primitives: PrimitiveToken[] = [
      makeTypoPrimitive("letter-spacing", "tight", "-0.02em", "dimension"),
    ];
    const c: ThemeCollection = {
      primitives,
      themes: [{ name: "default", semanticTokens: [] }],
    };
    await writeTokensToJson(c, tempDir);
    await buildAndroid(c, tempDir, "xml");
    const typo = readFileSync(
      join(tempDir, "build", "android", "values", "typography_dimens.xml"),
      "utf-8",
    );
    // em units are not valid Android dimen units; token should be skipped
    expect(typo).not.toContain("em");
    expect(typo).not.toContain("letter_spacing");
  });

  it("xml: typography strings escape backslash before apostrophe", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-and-typstr-"));
    const primitives: PrimitiveToken[] = [
      makeTypoPrimitive("font-family", "quote", "It's\\Cool", "fontFamily"),
    ];
    const c: ThemeCollection = {
      primitives,
      themes: [{ name: "default", semanticTokens: [] }],
    };
    await writeTokensToJson(c, tempDir);
    await buildAndroid(c, tempDir, "xml");
    const strings = readFileSync(
      join(tempDir, "build", "android", "values", "typography_strings.xml"),
      "utf-8",
    );
    // The fontFamily/css transform pre-escapes apostrophes for CSS, producing "It\'s\Cool".
    // With the new (correct) order — backslashes doubled first, then apostrophes escaped —
    // the file ends up with 3 backslashes before the apostrophe: It\\\'s\\Cool.
    // The old (wrong) order would have doubled the backslash added for the apostrophe,
    // yielding 4 backslashes: It\\\\'s\\Cool.
    expect(strings).toContain(String.raw`It\\\'s\\Cool`);
    expect(strings).not.toContain(String.raw`It\\\\'s\\Cool`);
  });

  it("compose: fontWeight tokens emit FontWeight(n), not TextStyle", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-and-cmpfw-"));
    const c = makeFullCollection(["default"]);
    await writeTokensToJson(c, tempDir);
    await buildAndroid(c, tempDir, "compose");
    const typo = readFileSync(
      join(tempDir, "build", "android", "Typography.kt"),
      "utf-8",
    );
    expect(typo).toMatch(/val \w+ = FontWeight\(\d+\)/);
    expect(typo).not.toMatch(/FontWeight\(\d+\).*TextStyle/s);
  });

  it("compose: fontFamily tokens emit a string literal, not FontFamily(...) or TextStyle", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-and-cmpff-"));
    const c = makeFullCollection(["default"]);
    await writeTokensToJson(c, tempDir);
    await buildAndroid(c, tempDir, "compose");
    const typo = readFileSync(
      join(tempDir, "build", "android", "Typography.kt"),
      "utf-8",
    );
    // font-family tokens should be plain string vals, not FontFamily("...") constructors
    expect(typo).toMatch(/val \w+ = "Inter"/);
    expect(typo).not.toMatch(/FontFamily\("Inter"\)/);
  });

  it("compose: Typography.kt never uses invalid FontFamily(string) constructor", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-and-cmpts-"));
    // Use the full collection which includes fontFamily primitives
    const c = makeFullCollection(["default"]);
    await writeTokensToJson(c, tempDir);
    await buildAndroid(c, tempDir, "compose");
    const typo = readFileSync(
      join(tempDir, "build", "android", "Typography.kt"),
      "utf-8",
    );
    // FontFamily("string") is not a valid Compose constructor; must never appear
    expect(typo).not.toMatch(/FontFamily\("[^"]+"\)/);
  });
});

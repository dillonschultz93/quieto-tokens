import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { extractRawValues } from "../extract.js";

describe("extractRawValues", () => {
  let dir: string;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("tallies colors and dimensions with their CSS properties", async () => {
    dir = mkdtempSync(join(tmpdir(), "quieto-extract-"));
    const src = join(dir, "src");
    mkdirSync(src, { recursive: true });

    writeFileSync(
      join(src, "a.css"),
      [
        ".btn {",
        "  color: #3B82F6;",
        "  background: #3b82f6;", // same hex, different case → same key
        "  padding: 8px;",
        "  margin: 16px;",
        "  font-size: 14px;",
        "  background: var(--quieto-color-blue-500);", // ignored
        "}",
        ".link { color: #3B82F6; }",
        "",
      ].join("\n"),
    );

    const h = await extractRawValues(dir);

    expect(h.filesScanned).toBe(1);
    // #3b82f6 appears 3 times (.btn color + background, .link color); the
    // var(--quieto-…) line is ignored.
    const blue = h.colors.get("#3b82f6");
    expect(blue?.count).toBe(3);
    expect([...(blue?.properties ?? [])].sort()).toEqual([
      "background",
      "color",
    ]);

    expect(h.dimensions.get(8)?.properties.has("margin")).toBe(false);
    expect(h.dimensions.get(8)?.properties.has("padding")).toBe(true);
    expect(h.dimensions.get(16)?.properties.has("margin")).toBe(true);
    expect(h.dimensions.get(14)?.properties.has("font-size")).toBe(true);
  });

  it("converts rem/em to px at 16px", async () => {
    dir = mkdtempSync(join(tmpdir(), "quieto-extract-"));
    writeFileSync(
      join(dir, "a.css"),
      [".x { padding: 1rem; gap: 0.5em; }"].join("\n"),
    );
    const h = await extractRawValues(dir);
    expect(h.dimensions.has(16)).toBe(true);
    expect(h.dimensions.has(8)).toBe(true);
  });

  it("detects font families (body/heading/mono) and weights", async () => {
    dir = mkdtempSync(join(tmpdir(), "quieto-extract-"));
    writeFileSync(
      join(dir, "a.css"),
      [
        "body {",
        "  font-family: Inter, sans-serif;",
        "  font-weight: 400;",
        "}",
        "h1 {",
        "  font-family: Georgia, serif;",
        "  font-weight: 700;",
        "}",
        "code {",
        "  font-family: 'SF Mono', monospace;",
        "}",
        "",
      ].join("\n"),
    );
    const h = await extractRawValues(dir);

    expect(h.fontFamilies.get("Inter, sans-serif")?.count).toBe(1);
    expect(h.fontFamilies.get("Georgia, serif")?.onHeadingSelector).toBe(true);
    expect(h.fontFamilies.get("'SF Mono', monospace")?.isMono).toBe(true);
    expect(h.fontWeights.get(400)).toBe(1);
    expect(h.fontWeights.get(700)).toBe(1);
  });

  it("detects dark-mode signals", async () => {
    dir = mkdtempSync(join(tmpdir(), "quieto-extract-"));
    writeFileSync(
      join(dir, "a.css"),
      ["@media (prefers-color-scheme: dark) { body { color: #fff; } }"].join(
        "\n",
      ),
    );
    const h = await extractRawValues(dir);
    expect(h.darkModeSignals).toBe(true);
  });

  it("counts var() usages as votes for the referenced custom property's value", async () => {
    dir = mkdtempSync(join(tmpdir(), "quieto-extract-"));
    writeFileSync(
      join(dir, "tokens.css"),
      [
        ":root {",
        "  --accent-gold: #c9a857;",
        "  --danger: #ef4444;",
        "  --space-2: 8px;",
        "}",
        ".a { color: var(--accent-gold); }",
        ".b { border-color: var(--accent-gold); }",
        ".c { background: var(--accent-gold); }",
        ".d { color: var(--danger); }",
        ".e { padding: var(--space-2); }",
        "",
      ].join("\n"),
    );
    const h = await extractRawValues(dir);

    // 1 definition vote + 3 usage votes vs. 1 definition + 1 usage.
    expect(h.colors.get("#c9a857")?.count).toBe(4);
    expect(h.colors.get("#ef4444")?.count).toBe(2);
    expect(h.colors.get("#c9a857")?.properties.has("color")).toBe(true);
    expect(h.dimensions.get(8)?.properties.has("padding")).toBe(true);

    expect(h.customProperties.get("--accent-gold")?.value).toBe("#c9a857");
    expect(h.customProperties.get("--accent-gold")?.onRootSelector).toBe(true);
    expect(h.varUsageCount).toBe(5);
  });

  it("resolves chained definitions and ignores unresolvable references", async () => {
    dir = mkdtempSync(join(tmpdir(), "quieto-extract-"));
    writeFileSync(
      join(dir, "a.css"),
      [
        ":root {",
        "  --gold: #c9a857;",
        "  --brand: var(--gold);",
        "}",
        ".a { color: var(--brand); }",
        ".b { color: var(--undefined-token); }",
        "",
      ].join("\n"),
    );
    const h = await extractRawValues(dir);
    // Definition (1) + chained usage (1); the unresolvable ref adds nothing.
    expect(h.colors.get("#c9a857")?.count).toBe(2);
    expect(h.colors.size).toBe(1);
  });

  it("never treats a var() reference as a font-family name", async () => {
    dir = mkdtempSync(join(tmpdir(), "quieto-extract-"));
    writeFileSync(
      join(dir, "a.css"),
      [
        ":root {",
        "  --font-heading: 'Playfair Display', serif;",
        "}",
        "h1 {",
        "  font-family: var(--font-heading);",
        "}",
        ".missing {",
        "  font-family: var(--font-nowhere);",
        "}",
        "",
      ].join("\n"),
    );
    const h = await extractRawValues(dir);

    const names = [...h.fontFamilies.keys()];
    expect(names.some((n) => n.includes("var("))).toBe(false);
    const heading = h.fontFamilies.get("'Playfair Display', serif");
    expect(heading?.count).toBe(1);
    expect(heading?.onHeadingSelector).toBe(true);
  });

  it("captures root background colors, resolving var() references", async () => {
    dir = mkdtempSync(join(tmpdir(), "quieto-extract-"));
    writeFileSync(
      join(dir, "a.css"),
      [
        ":root {",
        "  --bg-primary: #0a0a1a;",
        "}",
        "body {",
        "  background: var(--bg-primary);",
        "}",
        ".card { background: #1f2937; }", // not a root selector → excluded
        "",
      ].join("\n"),
    );
    const h = await extractRawValues(dir);
    expect(h.rootBackgrounds.get("#0a0a1a")).toBe(1);
    expect(h.rootBackgrounds.has("#1f2937")).toBe(false);
  });

  it("returns empty histograms for a directory with no stylesheets", async () => {
    dir = mkdtempSync(join(tmpdir(), "quieto-extract-"));
    writeFileSync(join(dir, "readme.md"), "# nothing here");
    const h = await extractRawValues(dir);
    expect(h.filesScanned).toBe(0);
    expect(h.colors.size).toBe(0);
    expect(h.dimensions.size).toBe(0);
  });
});

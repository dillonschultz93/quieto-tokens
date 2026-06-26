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

  it("returns empty histograms for a directory with no stylesheets", async () => {
    dir = mkdtempSync(join(tmpdir(), "quieto-extract-"));
    writeFileSync(join(dir, "readme.md"), "# nothing here");
    const h = await extractRawValues(dir);
    expect(h.filesScanned).toBe(0);
    expect(h.colors.size).toBe(0);
    expect(h.dimensions.size).toBe(0);
  });
});

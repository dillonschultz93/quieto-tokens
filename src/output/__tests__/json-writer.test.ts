import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type {
  PrimitiveToken,
  ThemeCollection,
} from "../../types/tokens.js";
import {
  tokensToDtcgTree,
  writeTokensToJson,
} from "../json-writer.js";
import {
  makeColorPrimitive,
  makeColorSemantic,
  sampleCollection,
} from "../../types/__fixtures__/tokens.js";

describe("tokensToDtcgTree", () => {
  it("builds a nested DTCG tree for primitives with $type and $value", () => {
    const tree = tokensToDtcgTree([
      makeColorPrimitive("blue", 500, "#3B82F6"),
    ]);
    expect(tree).toEqual({
      color: {
        blue: {
          "500": {
            $type: "color",
            $value: "#3B82F6",
          },
        },
      },
    });
  });

  it("preserves DTCG reference syntax in values", () => {
    const tree = tokensToDtcgTree([
      makeColorSemantic("background", "primary", "{color.blue.500}"),
    ]);
    expect(tree).toEqual({
      color: {
        background: {
          primary: {
            $type: "color",
            $value: "{color.blue.500}",
          },
        },
      },
    });
  });

  it("emits $description when a token has one", () => {
    const token: PrimitiveToken = {
      ...makeColorPrimitive("blue", 500, "#3B82F6"),
      description: "Primary brand accent.",
    };
    const tree = tokensToDtcgTree([token]);
    expect(tree).toEqual({
      color: {
        blue: {
          "500": {
            $type: "color",
            $value: "#3B82F6",
            $description: "Primary brand accent.",
          },
        },
      },
    });
  });

  it("omits $description when the token has none or an empty string", () => {
    const tree = tokensToDtcgTree([
      { ...makeColorPrimitive("blue", 500, "#3B82F6"), description: "" },
    ]);
    expect(tree).toEqual({
      color: { blue: { "500": { $type: "color", $value: "#3B82F6" } } },
    });
  });

  it("throws on duplicate token paths rather than silently overwriting", () => {
    expect(() =>
      tokensToDtcgTree([
        makeColorPrimitive("blue", 500, "#3B82F6"),
        makeColorPrimitive("blue", 500, "#2563EB"),
      ]),
    ).toThrow(/Duplicate token path/);
  });

  it("throws when a path segment would replace an existing leaf with a group", () => {
    expect(() =>
      tokensToDtcgTree([
        {
          tier: "primitive",
          category: "color",
          name: "color.blue",
          $type: "color",
          $value: "#3B82F6",
          path: ["color", "blue"],
        },
        makeColorPrimitive("blue", 500, "#2563EB"),
      ]),
    ).toThrow(/Token path collision/);
  });
});

describe("writeTokensToJson", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-test-"));
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("writes primitive color/spacing/typography JSON files to tokens/primitive/", async () => {
    const collection = sampleCollection(["light", "dark"]);
    const files = await writeTokensToJson(collection, tempDir);

    const colorPath = join(tempDir, "tokens", "primitive", "color.json");
    const spacingPath = join(tempDir, "tokens", "primitive", "spacing.json");
    const typoPath = join(tempDir, "tokens", "primitive", "typography.json");

    expect(existsSync(colorPath)).toBe(true);
    expect(existsSync(spacingPath)).toBe(true);
    expect(existsSync(typoPath)).toBe(true);
    expect(files).toContain(colorPath);
    expect(files).toContain(spacingPath);
    expect(files).toContain(typoPath);
  });

  it("writes semantic tokens per theme into tokens/semantic/<theme>/", async () => {
    const collection = sampleCollection(["light", "dark"]);
    await writeTokensToJson(collection, tempDir);

    expect(
      existsSync(join(tempDir, "tokens", "semantic", "light", "color.json")),
    ).toBe(true);
    expect(
      existsSync(join(tempDir, "tokens", "semantic", "dark", "color.json")),
    ).toBe(true);
    expect(
      existsSync(join(tempDir, "tokens", "semantic", "light", "spacing.json")),
    ).toBe(true);
  });

  it("primitive JSON uses $type and $value per DTCG spec", async () => {
    const collection = sampleCollection(["light"]);
    await writeTokensToJson(collection, tempDir);

    const content = JSON.parse(
      readFileSync(
        join(tempDir, "tokens", "primitive", "color.json"),
        "utf-8",
      ),
    );

    expect(content.color.blue["500"]).toEqual({
      $type: "color",
      $value: "#3B82F6",
    });
  });

  it("semantic JSON is flat (no synthetic `semantic` wrapper) and uses DTCG refs", async () => {
    const collection = sampleCollection(["light"]);
    await writeTokensToJson(collection, tempDir);

    const content = JSON.parse(
      readFileSync(
        join(tempDir, "tokens", "semantic", "light", "color.json"),
        "utf-8",
      ),
    );

    expect(content.semantic).toBeUndefined();
    expect(content.color.background.primary.$value).toBe("{color.blue.500}");
    expect(content.color.background.primary.$type).toBe("color");
  });

  it("creates output directory structure when it does not exist", async () => {
    const deepDir = join(tempDir, "nested", "project");
    const collection = sampleCollection(["default"]);
    await writeTokensToJson(collection, deepDir);

    expect(
      existsSync(join(deepDir, "tokens", "primitive", "color.json")),
    ).toBe(true);
  });

  it("returns the list of written file paths", async () => {
    const collection = sampleCollection(["light", "dark"]);
    const files = await writeTokensToJson(collection, tempDir);

    // 3 primitive categories + 2 semantic categories (color, spacing) × 2 themes = 7 files
    expect(files.length).toBe(7);
    for (const file of files) {
      expect(existsSync(file)).toBe(true);
    }
  });

  it("omits a category file when no tokens exist for it", async () => {
    const collection: ThemeCollection = {
      primitives: [makeColorPrimitive("blue", 500, "#3B82F6")],
      themes: [
        {
          name: "light",
          semanticTokens: [
            makeColorSemantic("background", "primary", "{color.blue.500}"),
          ],
        },
      ],
    };

    await writeTokensToJson(collection, tempDir);
    expect(
      existsSync(join(tempDir, "tokens", "primitive", "color.json")),
    ).toBe(true);
    expect(
      existsSync(join(tempDir, "tokens", "primitive", "spacing.json")),
    ).toBe(false);
    expect(
      existsSync(join(tempDir, "tokens", "primitive", "typography.json")),
    ).toBe(false);
  });

  it("throws on duplicate theme names instead of silently overwriting", async () => {
    const collection: ThemeCollection = {
      primitives: [makeColorPrimitive("blue", 500, "#3B82F6")],
      themes: [
        {
          name: "light",
          semanticTokens: [
            makeColorSemantic("background", "primary", "{color.blue.500}"),
          ],
        },
        {
          name: "light",
          semanticTokens: [
            makeColorSemantic("background", "primary", "{color.blue.500}"),
          ],
        },
      ],
    };

    await expect(writeTokensToJson(collection, tempDir)).rejects.toThrow(
      /Duplicate theme names/,
    );
  });

  it("emits $description in the written JSON when the token carries one", async () => {
    const collection: ThemeCollection = {
      primitives: [
        {
          ...makeColorPrimitive("blue", 500, "#3B82F6"),
          description: "Primary brand accent.",
        },
      ],
      themes: [{ name: "default", semanticTokens: [] }],
    };

    await writeTokensToJson(collection, tempDir);

    const content = JSON.parse(
      readFileSync(
        join(tempDir, "tokens", "primitive", "color.json"),
        "utf-8",
      ),
    );
    expect(content.color.blue["500"].$description).toBe(
      "Primary brand accent.",
    );
  });
});

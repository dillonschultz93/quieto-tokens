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

  it("allows a DTCG node to be both a token and a group (mixed leaf+group)", () => {
    const tree = tokensToDtcgTree([
      {
        tier: "primitive",
        category: "color",
        name: "color.blue",
        $type: "color",
        $value: "#3B82F6",
        path: ["color", "blue"],
      },
      makeColorPrimitive("blue", 500, "#2563EB"),
    ]);
    expect(tree.color).toBeDefined();
    const blue = tree.color as Record<string, unknown>;
    expect((blue.blue as Record<string, unknown>).$value).toBe("#3B82F6");
    expect((blue.blue as Record<string, unknown>).$type).toBe("color");
    expect(((blue.blue as Record<string, unknown>)["500"] as Record<string, unknown>).$value).toBe("#2563EB");
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

  it("injects a $metadata banner into every primitive and semantic JSON file", async () => {
    const collection = sampleCollection(["light", "dark"]);
    const files = await writeTokensToJson(collection, tempDir, {
      generatedAt: "2026-04-16T12:00:00.000Z",
    });

    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const parsed = JSON.parse(readFileSync(file, "utf-8"));
      expect(parsed.$metadata).toEqual({
        generatedBy: "quieto-tokens",
        doNotEdit: true,
        generatedAt: "2026-04-16T12:00:00.000Z",
        notice: expect.stringContaining("tool-generated"),
      });
    }
  });

  it("stamps the same generatedAt across all files in a single run", async () => {
    const collection = sampleCollection(["light"]);
    const files = await writeTokensToJson(collection, tempDir);

    const timestamps = files.map(
      (f) => (JSON.parse(readFileSync(f, "utf-8")) as { $metadata: { generatedAt: string } })
        .$metadata.generatedAt,
    );
    expect(new Set(timestamps).size).toBe(1);
  });

  it("places $metadata at the top of the file for human readability", async () => {
    const collection = sampleCollection(["light"]);
    await writeTokensToJson(collection, tempDir);

    const raw = readFileSync(
      join(tempDir, "tokens", "primitive", "color.json"),
      "utf-8",
    );
    // First non-whitespace key after `{` must be `$metadata`.
    expect(raw).toMatch(/^{\s*"\$metadata":/);
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

/**
 * Dynamic-category coverage — Story 2.4 Task 6 / AC #9.
 *
 * After Story 2.2's Task 3.5 refactor, `writeTokensToJson` no longer
 * hardcodes the three core primitive/semantic category names (color,
 * spacing, typography). It walks `collection.primitives` and each
 * theme's `semanticTokens` and emits a file per distinct `category`.
 * These tests drive `shadow` through that dynamic path and assert
 * byte-equivalence with the hardcoded-category shape — a regression
 * guard against any future change that re-introduces a closed-list
 * dispatch.
 */
describe("writeTokensToJson — dynamic category coverage (AC #9)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-dyn-cat-"));
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("emits tokens/primitive/shadow.json for a dynamically-added shadow category", async () => {
    const shadowPrimitive: PrimitiveToken = {
      tier: "primitive",
      category: "shadow",
      name: "shadow.elevation.1",
      $type: "shadow",
      $value: JSON.stringify({
        color: "{color.neutral.900}",
        offsetX: "0px",
        offsetY: "1px",
        blur: "0px",
        spread: "0px",
      }),
      path: ["shadow", "elevation", "1"],
    };
    const collection: ThemeCollection = {
      primitives: [makeColorPrimitive("blue", 500, "#3B82F6"), shadowPrimitive],
      themes: [
        {
          name: "light",
          semanticTokens: [
            makeColorSemantic("background", "primary", "{color.blue.500}"),
            {
              tier: "semantic",
              category: "shadow",
              name: "shadow.low",
              $type: "shadow",
              $value: "{shadow.elevation.1}",
              path: ["shadow", "low"],
            },
          ],
        },
      ],
    };

    const files = await writeTokensToJson(collection, tempDir);

    const shadowPrimPath = join(tempDir, "tokens", "primitive", "shadow.json");
    const shadowSemPath = join(
      tempDir,
      "tokens",
      "semantic",
      "light",
      "shadow.json",
    );
    expect(files).toContain(shadowPrimPath);
    expect(files).toContain(shadowSemPath);
    expect(existsSync(shadowPrimPath)).toBe(true);
    expect(existsSync(shadowSemPath)).toBe(true);
  });

  it("emits composite `$value` as a native JSON object (not a stringified blob) for shadow tokens", async () => {
    // Regression guard for the fix landed alongside this story's shadow
    // E2E: before the fix, composite `$value`s were written as quoted
    // strings (`"{\"color\":\"{color.neutral.900}\", …}"`), and Style
    // Dictionary v5's DTCG reader couldn't resolve the embedded color
    // ref from inside the string. The fix decodes composite values at
    // the writer boundary so disk JSON is DTCG-spec-compliant.
    const shadowPrimitive: PrimitiveToken = {
      tier: "primitive",
      category: "shadow",
      name: "shadow.elevation.1",
      $type: "shadow",
      $value: JSON.stringify({
        color: "{color.neutral.900}",
        offsetX: "0px",
        offsetY: "1px",
        blur: "0px",
        spread: "0px",
      }),
      path: ["shadow", "elevation", "1"],
    };
    const collection: ThemeCollection = {
      primitives: [shadowPrimitive],
      themes: [{ name: "default", semanticTokens: [] }],
    };

    await writeTokensToJson(collection, tempDir);

    const parsed = JSON.parse(
      readFileSync(
        join(tempDir, "tokens", "primitive", "shadow.json"),
        "utf-8",
      ),
    );
    const leaf = parsed.shadow.elevation["1"];
    expect(leaf.$type).toBe("shadow");
    expect(typeof leaf.$value).toBe("object");
    expect(leaf.$value).toEqual({
      color: "{color.neutral.900}",
      offsetX: "0px",
      offsetY: "1px",
      blur: "0px",
      spread: "0px",
    });
  });

  it("leaves DTCG scalar values untouched — refs stay strings, hex stays string", async () => {
    // Composite decode runs only for `$type` in { shadow, cubicBezier }.
    // Color / dimension scalars stay strings even when the literal looks
    // like JSON (e.g. a bracketed string).
    const collection: ThemeCollection = {
      primitives: [makeColorPrimitive("blue", 500, "#3B82F6")],
      themes: [
        {
          name: "default",
          semanticTokens: [
            makeColorSemantic("background", "primary", "{color.blue.500}"),
          ],
        },
      ],
    };
    await writeTokensToJson(collection, tempDir);

    const prim = JSON.parse(
      readFileSync(
        join(tempDir, "tokens", "primitive", "color.json"),
        "utf-8",
      ),
    );
    const sem = JSON.parse(
      readFileSync(
        join(tempDir, "tokens", "semantic", "default", "color.json"),
        "utf-8",
      ),
    );
    expect(prim.color.blue["500"].$value).toBe("#3B82F6");
    expect(sem.color.background.primary.$value).toBe("{color.blue.500}");
  });

  it("does not JSON-decode a color primitive whose $value looks like a JSON array", async () => {
    const collection: ThemeCollection = {
      primitives: [
        {
          tier: "primitive",
          category: "color",
          name: "color.note.example",
          $type: "color",
          $value: "[1,2,3]",
          path: ["color", "note", "example"],
        },
      ],
      themes: [{ name: "default", semanticTokens: [] }],
    };
    await writeTokensToJson(collection, tempDir);
    const prim = JSON.parse(
      readFileSync(
        join(tempDir, "tokens", "primitive", "color.json"),
        "utf-8",
      ),
    );
    expect(prim.color.note.example.$value).toBe("[1,2,3]");
  });

  it("rejects shadow $value JSON that embeds a __proto__ key", async () => {
    const shadowPrimitive: PrimitiveToken = {
      tier: "primitive",
      category: "shadow",
      name: "shadow.elevation.1",
      $type: "shadow",
      $value: '{"__proto__":{"polluted":true},"offsetX":"0px"}',
      path: ["shadow", "elevation", "1"],
    };
    const collection: ThemeCollection = {
      primitives: [shadowPrimitive],
      themes: [{ name: "default", semanticTokens: [] }],
    };
    await expect(writeTokensToJson(collection, tempDir)).rejects.toThrow(
      /forbidden key __proto__ or constructor/,
    );
  });

  it("decodes leading-whitespace stringified shadow composites", async () => {
    const shadowPrimitive: PrimitiveToken = {
      tier: "primitive",
      category: "shadow",
      name: "shadow.elevation.1",
      $type: "shadow",
      $value: `  ${JSON.stringify({
        color: "{color.neutral.900}",
        offsetX: "0px",
        offsetY: "1px",
        blur: "0px",
        spread: "0px",
      })}`,
      path: ["shadow", "elevation", "1"],
    };
    const collection: ThemeCollection = {
      primitives: [shadowPrimitive],
      themes: [{ name: "default", semanticTokens: [] }],
    };
    await writeTokensToJson(collection, tempDir);
    const parsed = JSON.parse(
      readFileSync(
        join(tempDir, "tokens", "primitive", "shadow.json"),
        "utf-8",
      ),
    );
    expect(typeof parsed.shadow.elevation["1"].$value).toBe("object");
  });

  it("matches byte-for-byte between hardcoded and dynamic-category paths for the same token shape", async () => {
    // Build two equivalent collections — one where the category name
    // is a core category (`color`) and one where it's a dynamic name
    // (`shadow`) but every other field of the token matches. After
    // stripping the filename-dependent `$metadata.generatedAt`, the
    // emitted JSON bodies must be identical in structure.
    const coreOnly: ThemeCollection = {
      primitives: [makeColorPrimitive("blue", 500, "#3B82F6")],
      themes: [{ name: "default", semanticTokens: [] }],
    };
    const dynOnly: ThemeCollection = {
      primitives: [
        {
          tier: "primitive",
          category: "shadow",
          name: "shadow.blue.500",
          $type: "color",
          $value: "#3B82F6",
          path: ["shadow", "blue", "500"],
        },
      ],
      themes: [{ name: "default", semanticTokens: [] }],
    };

    await writeTokensToJson(coreOnly, tempDir, {
      generatedAt: "fixed-ts",
    });
    const coreJson = JSON.parse(
      readFileSync(
        join(tempDir, "tokens", "primitive", "color.json"),
        "utf-8",
      ),
    );

    // Second write: new tmp dir so the first file doesn't collide.
    const dynDir = mkdtempSync(join(tmpdir(), "quieto-dyn-cat-b-"));
    try {
      await writeTokensToJson(dynOnly, dynDir, { generatedAt: "fixed-ts" });
      const dynJson = JSON.parse(
        readFileSync(
          join(dynDir, "tokens", "primitive", "shadow.json"),
          "utf-8",
        ),
      );
      // Both files must share: $metadata shape, leaf shape, exact values.
      expect(coreJson.$metadata).toEqual(dynJson.$metadata);
      expect(coreJson.color.blue["500"]).toEqual(dynJson.shadow.blue["500"]);
    } finally {
      rmSync(dynDir, { recursive: true, force: true });
    }
  });
});

/**
 * WriteScope filtering — Story 2.4 Task 1.2 / AC #1. Direct coverage of
 * the new `options.scope` parameter so the filter behaviour has a
 * focused unit regression guard in addition to the pipeline E2E.
 */
describe("writeTokensToJson — WriteScope filtering", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-scope-"));
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("writes every category when scope is omitted (default `all` behaviour)", async () => {
    const collection = sampleCollection(["light"]);
    const files = await writeTokensToJson(collection, tempDir);
    // color + spacing + typography primitives + color + spacing semantics
    expect(files.length).toBeGreaterThanOrEqual(3);
  });

  it("writes every category when scope is explicit `all`", async () => {
    const collection = sampleCollection(["light"]);
    const files = await writeTokensToJson(collection, tempDir, {
      scope: "all",
    });
    expect(files.length).toBeGreaterThanOrEqual(3);
  });

  it("writes only the listed categories when scope is `{ categories: [...] }`", async () => {
    const collection = sampleCollection(["light", "dark"]);
    const files = await writeTokensToJson(collection, tempDir, {
      scope: { categories: ["color"] },
    });

    for (const file of files) {
      expect(file).toMatch(/color\.json$/);
    }
    expect(
      existsSync(join(tempDir, "tokens", "primitive", "color.json")),
    ).toBe(true);
    expect(
      existsSync(join(tempDir, "tokens", "primitive", "spacing.json")),
    ).toBe(false);
    expect(
      existsSync(join(tempDir, "tokens", "primitive", "typography.json")),
    ).toBe(false);
    expect(
      existsSync(join(tempDir, "tokens", "semantic", "light", "color.json")),
    ).toBe(true);
    expect(
      existsSync(join(tempDir, "tokens", "semantic", "dark", "color.json")),
    ).toBe(true);
    expect(
      existsSync(join(tempDir, "tokens", "semantic", "light", "spacing.json")),
    ).toBe(false);
  });

  it("throws when scope lists a category absent from the collection", async () => {
    const collection = sampleCollection(["light"]);
    await expect(
      writeTokensToJson(collection, tempDir, {
        scope: { categories: ["shadow"] },
      }),
    ).rejects.toThrow(/scope category "shadow" produced no JSON files/);
    expect(
      existsSync(join(tempDir, "tokens", "primitive", "shadow.json")),
    ).toBe(false);
    expect(
      existsSync(join(tempDir, "tokens", "primitive", "color.json")),
    ).toBe(false);
  });

  it("throws when scope.categories is empty", async () => {
    const collection = sampleCollection(["light"]);
    await expect(
      writeTokensToJson(collection, tempDir, {
        scope: { categories: [] },
      }),
    ).rejects.toThrow(/scope.categories must be non-empty/);
  });
});

describe("writeComponentTokens", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-comp-writer-"));
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  function makeComponentToken(
    componentName: string,
    path: string[],
    $type: string,
    $value: string,
  ): import("../../types/tokens.js").ComponentToken {
    return {
      tier: "component",
      category: "component",
      componentName,
      name: path.join("."),
      $type,
      $value,
      path,
    };
  }

  it("writes tokens/component/<name>.json with correct DTCG tree structure", async () => {
    const tokens = [
      makeComponentToken("button", ["button", "primary", "color", "background", "default"], "color", "{color.background.primary}"),
      makeComponentToken("button", ["button", "primary", "color", "background", "hover"], "color", "{color.background.secondary}"),
    ];

    const { writeComponentTokens } = await import("../json-writer.js");
    const files = await writeComponentTokens(tokens, tempDir);

    expect(files).toHaveLength(1);
    const filePath = join(tempDir, "tokens", "component", "button.json");
    expect(existsSync(filePath)).toBe(true);

    const parsed = JSON.parse(readFileSync(filePath, "utf-8"));
    expect(parsed.button.primary.color.background.default.$value).toBe("{color.background.primary}");
    expect(parsed.button.primary.color.background.hover.$value).toBe("{color.background.secondary}");
  });

  it("injects $metadata banner at the top of the file", async () => {
    const tokens = [
      makeComponentToken("modal", ["modal", "default", "color", "background"], "color", "{color.background.primary}"),
    ];

    const { writeComponentTokens } = await import("../json-writer.js");
    await writeComponentTokens(tokens, tempDir, {
      generatedAt: "2026-04-21T00:00:00.000Z",
    });

    const filePath = join(tempDir, "tokens", "component", "modal.json");
    const parsed = JSON.parse(readFileSync(filePath, "utf-8"));
    expect(parsed.$metadata).toEqual({
      generatedBy: "quieto-tokens",
      doNotEdit: true,
      generatedAt: "2026-04-21T00:00:00.000Z",
      notice: expect.stringContaining("tool-generated"),
    });

    const raw = readFileSync(filePath, "utf-8");
    expect(raw).toMatch(/^{\s*"\$metadata":/);
  });

  it("groups tokens by componentName into separate files", async () => {
    const tokens = [
      makeComponentToken("button", ["button", "primary", "color", "background"], "color", "{color.background.primary}"),
      makeComponentToken("modal", ["modal", "default", "color", "background"], "color", "{color.background.primary}"),
    ];

    const { writeComponentTokens } = await import("../json-writer.js");
    const files = await writeComponentTokens(tokens, tempDir);

    expect(files).toHaveLength(2);
    expect(existsSync(join(tempDir, "tokens", "component", "button.json"))).toBe(true);
    expect(existsSync(join(tempDir, "tokens", "component", "modal.json"))).toBe(true);
  });

  it("is also invoked via writeTokensToJson when collection.components is set", async () => {
    const tokens = [
      makeComponentToken("button", ["button", "primary", "color", "background"], "color", "{color.background.primary}"),
    ];
    const collection: ThemeCollection = {
      primitives: [makeColorPrimitive("blue", 500, "#3B82F6")],
      themes: [
        {
          name: "default",
          semanticTokens: [
            makeColorSemantic("background", "primary", "{color.blue.500}"),
          ],
        },
      ],
      components: tokens,
    };

    const files = await writeTokensToJson(collection, tempDir);
    const componentFile = join(tempDir, "tokens", "component", "button.json");
    expect(files).toContain(componentFile);
    expect(existsSync(componentFile)).toBe(true);
  });

  it("does not write component files when collection.components is undefined", async () => {
    const collection = sampleCollection(["default"]);
    await writeTokensToJson(collection, tempDir);
    expect(existsSync(join(tempDir, "tokens", "component"))).toBe(false);
  });
});

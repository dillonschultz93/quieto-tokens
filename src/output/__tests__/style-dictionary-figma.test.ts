import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writeTokensToJson } from "../json-writer.js";
import { buildFigmaJson } from "../style-dictionary.js";
import type {
  PrimitiveToken,
  SemanticToken,
  ThemeCollection,
} from "../../types/tokens.js";

function makeCollection(
  themeNames: string[],
  withComponent = false,
): ThemeCollection {
  const primitives: PrimitiveToken[] = [
    {
      tier: "primitive",
      category: "color",
      name: "color.blue.500",
      $type: "color",
      $value: "#3B82F6",
      path: ["color", "blue", "500"],
    },
  ];
  const semantics: SemanticToken[] = [
    {
      tier: "semantic",
      category: "color",
      name: "color.background.primary",
      $type: "color",
      $value: "{color.blue.500}",
      path: ["color", "background", "primary"],
    },
  ];
  const col: ThemeCollection = {
    primitives,
    themes: themeNames.map((name) => ({
      name,
      semanticTokens: semantics,
    })),
  };
  if (withComponent) {
    col.components = [
      {
        tier: "component",
        category: "color",
        componentName: "button",
        name: "button.primary.default",
        $type: "color",
        $value: "{color.background.primary}",
        path: ["button", "primary", "default"],
      },
    ];
  }
  return col;
}

describe("buildFigmaJson", () => {
  let tempDir: string;
  afterEach(() => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("names use / and nest; semantic ref preserved; single theme = one top-level key", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-figma-1-"));
    const c = makeCollection(["default"], true);
    await writeTokensToJson(c, tempDir);
    const paths = await buildFigmaJson(c, tempDir);
    expect(paths[0]).toBe(join(tempDir, "build", "tokens.figma.json"));
    const raw = readFileSync(paths[0]!, "utf-8");
    const j = JSON.parse(raw) as Record<string, unknown>;
    expect(Object.keys(j)).toEqual(["default"]);
    const def = j["default"] as Record<string, unknown>;
    expect(def["color"]).toBeDefined();
    const sem = def["semantic"] as Record<string, unknown>;
    const colBg = (sem["color"] as Record<string, unknown>)[
      "background"
    ] as Record<string, unknown>;
    const primary = (colBg["primary"] as { $type: string; $value: string });
    expect(primary.$value).toBe("{color.blue.500}");
    const comp = def["component"] as Record<string, unknown>;
    const buttonPrimary = (comp["button"] as Record<string, unknown>)[
      "primary"
    ] as Record<string, unknown>;
    expect(buttonPrimary).toBeDefined();
    // "default" must be a sibling of other states, not collapsed into the parent
    expect(buttonPrimary["default"]).toBeDefined();
  });

  it("multi-theme output has separate top-level keys", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-figma-2-"));
    const c = makeCollection(["light", "dark"], false);
    await writeTokensToJson(c, tempDir);
    await buildFigmaJson(c, tempDir);
    const raw = readFileSync(
      join(tempDir, "build", "tokens.figma.json"),
      "utf-8",
    );
    const j = JSON.parse(raw) as Record<string, unknown>;
    expect(new Set(Object.keys(j))).toEqual(new Set(["light", "dark"]));
  });
});

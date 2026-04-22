import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writeTokensToJson } from "../../output/json-writer.js";
import type { ThemeCollection } from "../../types/tokens.js";
import {
  makeColorPrimitive,
  makeColorSemantic,
  sampleCollection,
} from "../../types/__fixtures__/tokens.js";
import {
  loadPrimitivesFromDisk,
  loadSemanticTokensFromDisk,
} from "../load-from-disk.js";

describe("load-from-disk", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-load-disk-"));
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("round-trips color primitives via writeTokensToJson", async () => {
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
    await writeTokensToJson(collection, tempDir, { generatedAt: "fixed" });
    const loaded = await loadPrimitivesFromDisk(tempDir, "tokens", ["color"]);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]!.name).toBe("color.blue.500");
    expect(loaded[0]!.$value).toBe("#3B82F6");
  });

  it("tolerates a missing primitive file with a warn callback", async () => {
    const warns: string[] = [];
    const loaded = await loadPrimitivesFromDisk(tempDir, "tokens", ["color"], {
      warn: (m) => warns.push(m),
    });
    expect(loaded).toEqual([]);
    expect(warns.some((w) => w.includes("Missing primitive"))).toBe(true);
  });

  it("warns when $metadata is missing but still loads leaves", async () => {
    const path = join(tempDir, "tokens", "primitive", "spacing.json");
    mkdirSync(join(tempDir, "tokens", "primitive"), { recursive: true });
    writeFileSync(
      path,
      JSON.stringify({
        spacing: {
          "4": { $type: "dimension", $value: "4px" },
        },
      }) + "\n",
      "utf-8",
    );
    const warns: string[] = [];
    const loaded = await loadPrimitivesFromDisk(tempDir, "tokens", ["spacing"], {
      warn: (m) => warns.push(m),
    });
    expect(loaded.length).toBeGreaterThan(0);
    expect(warns.some((w) => w.includes("$metadata"))).toBe(true);
  });

  it("loads semantic tokens for a theme", async () => {
    const collection = sampleCollection(["default"]);
    await writeTokensToJson(collection, tempDir);
    const map = await loadSemanticTokensFromDisk(
      tempDir,
      "tokens",
      ["default"],
      ["color"],
    );
    const tokens = map.get("default") ?? [];
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens[0]!.tier).toBe("semantic");
  });
});

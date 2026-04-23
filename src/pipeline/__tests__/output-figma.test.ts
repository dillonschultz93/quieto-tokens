import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type {
  PrimitiveToken,
  SemanticToken,
  ThemeCollection,
} from "../../types/tokens.js";

vi.mock("@clack/prompts", () => ({
  log: {
    info: vi.fn(),
    step: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    message: vi.fn(),
  },
}));

const { writeTokensToJsonMock } = vi.hoisted(() => ({
  writeTokensToJsonMock: vi.fn(),
}));

vi.mock("../../output/json-writer.js", async (importActual) => {
  const actual =
    await importActual<typeof import("../../output/json-writer.js")>();
  writeTokensToJsonMock.mockImplementation(actual.writeTokensToJson);
  return {
    ...actual,
    writeTokensToJson: writeTokensToJsonMock,
  };
});

function makeCollection(): ThemeCollection {
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
  return {
    primitives,
    themes: [{ name: "default", semanticTokens: semantics }],
  };
}

describe("runOutputGeneration + figma", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-out-figma-"));
    vi.clearAllMocks();
    const actual = await vi.importActual<
      typeof import("../../output/json-writer.js")
    >("../../output/json-writer.js");
    writeTokensToJsonMock.mockImplementation(actual.writeTokensToJson);
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("produces CSS and Figma JSON when outputs include figma", async () => {
    const { runOutputGeneration } = await import("../output.js");
    const collection = makeCollection();
    const result = await runOutputGeneration(collection, tempDir, {
      outputs: ["css", "figma"],
    });
    expect(result).not.toBeNull();
    expect(result!.figmaFiles?.length).toBe(1);
    expect(existsSync(join(tempDir, "build", "tokens.figma.json"))).toBe(true);
    expect(existsSync(join(tempDir, "build", "tokens.css"))).toBe(true);
  });

  it("skips Figma when outputs is css only", async () => {
    const { runOutputGeneration } = await import("../output.js");
    const collection = makeCollection();
    const result = await runOutputGeneration(collection, tempDir, {
      outputs: ["css"],
    });
    expect(result).not.toBeNull();
    expect(result!.figmaFiles).toBeUndefined();
    expect(existsSync(join(tempDir, "build", "tokens.figma.json"))).toBe(
      false,
    );
  });

  it("Figma failure does not block CSS", async () => {
    const sd = await import("../../output/style-dictionary.js");
    const spy = vi
      .spyOn(sd, "buildFigmaJson")
      .mockRejectedValueOnce(new Error("figma boom"));

    const { runOutputGeneration } = await import("../output.js");
    const collection = makeCollection();
    const result = await runOutputGeneration(collection, tempDir, {
      outputs: ["css", "figma"],
    });
    expect(result).not.toBeNull();
    expect(result!.cssFiles.length).toBeGreaterThan(0);
    const clack = await import("@clack/prompts");
    expect(clack.log.warn).toHaveBeenCalledWith(
      expect.stringMatching(/Figma JSON build failed/),
    );
    spy.mockRestore();
  });
});

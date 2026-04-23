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
    {
      tier: "primitive",
      category: "spacing",
      name: "spacing.4",
      $type: "dimension",
      $value: "4px",
      path: ["spacing", "4"],
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

describe("runOutputGeneration + android", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-out-and-"));
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

  it("produces CSS and Android xml when outputs include android", async () => {
    const { runOutputGeneration } = await import("../output.js");
    const collection = makeCollection();
    const result = await runOutputGeneration(collection, tempDir, {
      outputs: ["css", "android"],
    });
    expect(result).not.toBeNull();
    expect(result!.androidFiles?.length).toBeGreaterThan(0);
    expect(
      existsSync(
        join(tempDir, "build", "android", "values", "colors.xml"),
      ),
    ).toBe(true);
  });

  it("skips android when not in outputs", async () => {
    const { runOutputGeneration } = await import("../output.js");
    const collection = makeCollection();
    const result = await runOutputGeneration(collection, tempDir, {
      outputs: ["css"],
    });
    expect(result!.androidFiles).toBeUndefined();
  });

  it("android build failure does not block CSS", async () => {
    const sd = await import("../../output/style-dictionary.js");
    const spy = vi
      .spyOn(sd, "buildAndroid")
      .mockRejectedValueOnce(new Error("android boom"));

    const { runOutputGeneration } = await import("../output.js");
    const collection = makeCollection();
    const result = await runOutputGeneration(collection, tempDir, {
      outputs: ["css", "android"],
    });
    expect(result).not.toBeNull();
    expect(result!.cssFiles.length).toBeGreaterThan(0);
    const clack = await import("@clack/prompts");
    expect(clack.log.warn).toHaveBeenCalledWith(
      expect.stringMatching(/Android build failed/),
    );
    spy.mockRestore();
  });
});

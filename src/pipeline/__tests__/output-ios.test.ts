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
    {
      tier: "primitive",
      category: "typography",
      name: "typography.font-size.base",
      $type: "fontSize",
      $value: "16px",
      path: ["typography", "font-size", "base"],
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

describe("runOutputGeneration + ios", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-out-ios-"));
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

  it("produces CSS and iOS Swift files when outputs include ios", async () => {
    const { runOutputGeneration } = await import("../output.js");
    const collection = makeCollection();
    const result = await runOutputGeneration(collection, tempDir, {
      outputs: ["css", "ios"],
    });
    expect(result).not.toBeNull();
    expect(result!.iosFiles?.length).toBe(3);
    expect(existsSync(join(tempDir, "build", "ios", "Color.swift"))).toBe(true);
    expect(existsSync(join(tempDir, "build", "ios", "Spacing.swift"))).toBe(true);
    expect(existsSync(join(tempDir, "build", "ios", "Typography.swift"))).toBe(true);
    expect(existsSync(join(tempDir, "build", "tokens.css"))).toBe(true);
  });

  it("skips iOS when outputs is css only", async () => {
    const { runOutputGeneration } = await import("../output.js");
    const collection = makeCollection();
    const result = await runOutputGeneration(collection, tempDir, {
      outputs: ["css"],
    });
    expect(result).not.toBeNull();
    expect(result!.iosFiles).toBeUndefined();
    expect(existsSync(join(tempDir, "build", "ios", "Color.swift"))).toBe(false);
  });

  it("iOS failure does not block CSS", async () => {
    const sd = await import("../../output/style-dictionary.js");
    const spy = vi
      .spyOn(sd, "buildIos")
      .mockRejectedValueOnce(new Error("ios boom"));

    const { runOutputGeneration } = await import("../output.js");
    const collection = makeCollection();
    const result = await runOutputGeneration(collection, tempDir, {
      outputs: ["css", "ios"],
    });
    expect(result).not.toBeNull();
    expect(result!.cssFiles.length).toBeGreaterThan(0);
    const clack = await import("@clack/prompts");
    expect(clack.log.warn).toHaveBeenCalledWith(
      expect.stringMatching(/iOS Swift build failed/),
    );
    spy.mockRestore();
  });

  it("produces CSS + Figma + iOS when all three are enabled", async () => {
    const { runOutputGeneration } = await import("../output.js");
    const collection = makeCollection();
    const result = await runOutputGeneration(collection, tempDir, {
      outputs: ["css", "figma", "ios"],
    });
    expect(result).not.toBeNull();
    expect(result!.cssFiles.length).toBeGreaterThan(0);
    expect(result!.figmaFiles?.length).toBe(1);
    expect(result!.iosFiles?.length).toBe(3);
  });
});

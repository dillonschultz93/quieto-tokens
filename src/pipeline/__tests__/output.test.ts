import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

function makeCollection(themeNames: string[]): ThemeCollection {
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
      name: "spacing.16",
      $type: "dimension",
      $value: "16px",
      path: ["spacing", "16"],
    },
    {
      tier: "primitive",
      category: "typography",
      name: "typography.scale.md",
      $type: "dimension",
      $value: "1rem",
      path: ["typography", "scale", "md"],
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
    themes: themeNames.map((name) => ({ name, semanticTokens: semantics })),
  };
}

describe("runOutputGeneration", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-output-"));
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

  it("writes JSON and CSS files and returns file lists", async () => {
    const { runOutputGeneration } = await import("../output.js");
    const collection = makeCollection(["default"]);
    const result = await runOutputGeneration(collection, tempDir);

    expect(result).not.toBeNull();
    expect(result!.jsonFiles.length).toBeGreaterThan(0);
    expect(result!.cssFiles.length).toBe(1);
    expect(existsSync(join(tempDir, "build", "tokens.css"))).toBe(true);
  });

  it("narrates each JSON file written via Clack log.info", async () => {
    const clack = await import("@clack/prompts");
    const { runOutputGeneration } = await import("../output.js");
    const collection = makeCollection(["default"]);

    await runOutputGeneration(collection, tempDir);

    const infoCalls = (clack.log.info as ReturnType<typeof vi.fn>).mock.calls
      .map((c: unknown[]) => c[0])
      .join("\n");
    expect(infoCalls).toMatch(/tokens[/\\]primitive[/\\]color\.json/);
  });

  it("narrates CSS output with variable counts", async () => {
    const clack = await import("@clack/prompts");
    const { runOutputGeneration } = await import("../output.js");
    const collection = makeCollection(["default"]);

    await runOutputGeneration(collection, tempDir);

    const infoCalls = (clack.log.info as ReturnType<typeof vi.fn>).mock.calls
      .map((c: unknown[]) => c[0])
      .join("\n");
    expect(infoCalls).toMatch(/build[/\\]tokens\.css.*variables/);
  });

  it("uses log.step for phase headers", async () => {
    const clack = await import("@clack/prompts");
    const { runOutputGeneration } = await import("../output.js");
    const collection = makeCollection(["default"]);

    await runOutputGeneration(collection, tempDir);

    const stepCalls = (clack.log.step as ReturnType<typeof vi.fn>).mock.calls
      .map((c: unknown[]) => c[0])
      .join("\n");
    expect(stepCalls).toMatch(/DTCG JSON/i);
    expect(stepCalls).toMatch(/CSS custom properties/i);
  });

  it("returns null and shows error when the JSON writer rejects (e.g. EACCES)", async () => {
    const clack = await import("@clack/prompts");
    const fsError = Object.assign(new Error("permission denied"), {
      code: "EACCES",
    });
    writeTokensToJsonMock.mockRejectedValueOnce(fsError);

    const { runOutputGeneration } = await import("../output.js");
    const collection = makeCollection(["default"]);
    const result = await runOutputGeneration(collection, tempDir);

    expect(result).toBeNull();
    expect(clack.log.error).toHaveBeenCalledWith(
      expect.stringMatching(/permission denied/),
    );
  });

  it("rolls back JSON files when CSS build fails (scoped-write atomicity / Story 2.4 review D2)", async () => {
    const sd = await import("../../output/style-dictionary.js");
    const spy = vi
      .spyOn(sd, "buildCss")
      .mockRejectedValueOnce(new Error("Style Dictionary boom"));

    const { runOutputGeneration } = await import("../output.js");
    const collection = makeCollection(["default"]);
    const result = await runOutputGeneration(collection, tempDir);

    expect(result).toBeNull();
    expect(
      existsSync(join(tempDir, "tokens", "primitive", "color.json")),
    ).toBe(false);

    spy.mockRestore();
  });

  /**
   * Story 2.4 code-review D3 — lighter substitute for snapshot tests on
   * Story 1.8 / 2.1 fixtures: `runOutputGeneration` with default options
   * must still emit every primitive category present in the collection
   * (proves `scope` defaults to `"all"` and init-scale output is not
   * regressed by the category-scoped `add` path).
   */
  it("writes one primitive JSON file per core category in the collection when scope is omitted (AC #3 structural guard)", async () => {
    const { runOutputGeneration } = await import("../output.js");
    const collection = makeCollection(["default"]);
    const result = await runOutputGeneration(collection, tempDir);

    expect(result).not.toBeNull();
    expect(
      existsSync(join(tempDir, "tokens", "primitive", "color.json")),
    ).toBe(true);
    expect(
      existsSync(join(tempDir, "tokens", "primitive", "spacing.json")),
    ).toBe(true);
    expect(
      existsSync(join(tempDir, "tokens", "primitive", "typography.json")),
    ).toBe(true);
  });
});

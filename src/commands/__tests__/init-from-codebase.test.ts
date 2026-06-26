import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import * as p from "@clack/prompts";
import { initCommand } from "../init.js";
import { quickStartFlow } from "../quick-start.js";
import { runColorGeneration } from "../../pipeline/color.js";
import { runSpacingGeneration } from "../../pipeline/spacing-typography.js";

vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn(),
  note: vi.fn(),
  isCancel: vi.fn(() => false),
  log: {
    step: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  },
  text: vi.fn(),
  select: vi.fn(),
  confirm: vi.fn(),
  multiselect: vi.fn().mockResolvedValue(["css"]),
}));

vi.mock("../../utils/config.js", () => ({
  configExists: vi.fn(() => false),
}));

// quick-start is mocked so we can assert it is NOT invoked in from-codebase mode.
vi.mock("../quick-start.js", () => ({
  quickStartFlow: vi.fn().mockResolvedValue({
    brandColor: "#000000",
    spacingBase: 4,
    typeScale: "balanced",
    generateThemes: false,
  }),
}));

vi.mock("../advanced.js", () => ({
  runAdvancedFlow: vi.fn(),
}));

// extract + infer-seed run for real against the fixture; only the heavy
// generation pipeline is mocked.
vi.mock("../../pipeline/color.js", () => ({
  runColorGeneration: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../pipeline/spacing-typography.js", () => ({
  runSpacingGeneration: vi.fn().mockReturnValue([]),
  runTypographyGeneration: vi.fn().mockReturnValue([]),
}));

vi.mock("../../mappers/semantic.js", () => ({
  generateSemanticTokens: vi.fn().mockReturnValue([]),
}));

vi.mock("../../generators/themes.js", () => ({
  generateThemes: vi.fn().mockReturnValue({
    primitives: [],
    themes: [{ name: "light", semanticTokens: [] }],
  }),
}));

vi.mock("../../ui/preview.js", () => ({
  previewAndConfirm: vi.fn().mockResolvedValue({
    collection: {
      primitives: [],
      themes: [{ name: "light", semanticTokens: [] }],
    },
    overrides: new Map<string, string>(),
  }),
}));

vi.mock("../../utils/overrides.js", () => ({
  applyPriorOverrides: vi.fn(),
}));

describe("initCommand — --from-codebase", () => {
  let dir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    dir = mkdtempSync(join(tmpdir(), "quieto-fcb-"));
    writeFileSync(
      join(dir, "theme.css"),
      [
        ".btn {",
        "  color: #3B82F6;",
        "  background: #3B82F6;",
        "  padding: 8px;",
        "  margin: 16px;",
        "  gap: 24px;",
        "}",
        ".alert { color: #EF4444; }",
        "",
      ].join("\n"),
    );
  });

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    process.exitCode = undefined;
  });

  it("infers the seed from stylesheets and skips the interactive questionnaire", async () => {
    await initCommand({ fromCodebase: dir, dryRun: true });

    // Did not prompt the user for inputs.
    expect(quickStartFlow).not.toHaveBeenCalled();

    // Brand color and spacing base were inferred from the CSS.
    expect(runColorGeneration).toHaveBeenCalledWith(
      "#3B82F6",
      expect.anything(),
    );
    expect(runSpacingGeneration).toHaveBeenCalledWith(8, undefined);

    // An inference summary was surfaced.
    const stepCalls = vi.mocked(p.log.step).mock.calls.map((c) => String(c[0]));
    expect(stepCalls.some((s) => s.includes("Inferred from"))).toBe(true);
  });

  it("errors gracefully when the target directory does not exist", async () => {
    await initCommand({ fromCodebase: join(dir, "nope"), dryRun: true });
    expect(p.log.error).toHaveBeenCalledWith(
      expect.stringContaining("Directory not found"),
    );
    expect(runColorGeneration).not.toHaveBeenCalled();
  });

  it("bails when stylesheets contain no design-relevant values", async () => {
    const empty = mkdtempSync(join(tmpdir(), "quieto-fcb-empty-"));
    writeFileSync(join(empty, "readme.md"), "# nothing");
    try {
      await initCommand({ fromCodebase: empty, dryRun: true });
      expect(p.log.error).toHaveBeenCalledWith(
        expect.stringContaining("Couldn't infer a token system"),
      );
      expect(runColorGeneration).not.toHaveBeenCalled();
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});

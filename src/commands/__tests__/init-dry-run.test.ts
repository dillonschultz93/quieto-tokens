import { describe, it, expect, vi, beforeEach } from "vitest";
import * as p from "@clack/prompts";
import { initCommand } from "../init.js";
import { runOutputGeneration } from "../../pipeline/output.js";
import { runConfigGeneration } from "../../pipeline/config.js";
import { appendChangelog } from "../../output/changelog-writer.js";

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

vi.mock("../quick-start.js", () => ({
  quickStartFlow: vi.fn().mockResolvedValue({
    brandColor: "#111111",
    spacingBase: 8,
    typeScale: "balanced",
    generateThemes: false,
  }),
}));

vi.mock("../advanced.js", () => ({
  runAdvancedFlow: vi.fn(),
}));

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

vi.mock("../../pipeline/output.js", () => ({
  runOutputGeneration: vi.fn().mockResolvedValue({
    jsonFiles: ["/f.json"],
    cssFiles: ["/b.css"],
  }),
}));

vi.mock("../../pipeline/config.js", () => ({
  runConfigGeneration: vi.fn().mockResolvedValue(true),
}));

vi.mock("../../output/changelog-writer.js", () => ({
  appendChangelog: vi
    .fn()
    .mockResolvedValue({ path: "/tmp/TOKENS_CHANGELOG.md" }),
}));

describe("initCommand — dry run (Story 3.3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(p.select).mockResolvedValue("quick" as never);
  });

  it("skips runOutputGeneration and runConfigGeneration when dryRun: true", async () => {
    await initCommand({ dryRun: true });

    expect(runOutputGeneration).not.toHaveBeenCalled();
    expect(runConfigGeneration).not.toHaveBeenCalled();
    expect(vi.mocked(appendChangelog)).not.toHaveBeenCalled();
    expect(p.outro).toHaveBeenCalledWith(
      "Dry run complete — no files were written.",
    );
    expect(p.log.info).toHaveBeenCalledWith("Dry run — skipping file writes.");
  });

  it("calls output + config when dryRun: false", async () => {
    await initCommand({ dryRun: false });

    expect(runOutputGeneration).toHaveBeenCalled();
    expect(runConfigGeneration).toHaveBeenCalled();
    expect(vi.mocked(appendChangelog)).toHaveBeenCalled();
  });
});

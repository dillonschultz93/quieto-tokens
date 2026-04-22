import { describe, it, expect, vi, beforeEach } from "vitest";

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
  multiselect: vi.fn(),
}));

import * as p from "@clack/prompts";
import { collectComponentInputs } from "../component-flow.js";
import type { SemanticToken, PrimitiveToken } from "../../types/tokens.js";

const SEMANTIC_TOKENS: SemanticToken[] = [
  {
    tier: "semantic",
    category: "color",
    name: "color.background.primary",
    $type: "color",
    $value: "{color.blue.500}",
    path: ["color", "background", "primary"],
  },
  {
    tier: "semantic",
    category: "color",
    name: "color.background.secondary",
    $type: "color",
    $value: "{color.neutral.100}",
    path: ["color", "background", "secondary"],
  },
  {
    tier: "semantic",
    category: "color",
    name: "color.content.primary",
    $type: "color",
    $value: "{color.neutral.900}",
    path: ["color", "content", "primary"],
  },
  {
    tier: "semantic",
    category: "color",
    name: "color.border.default",
    $type: "color",
    $value: "{color.neutral.200}",
    path: ["color", "border", "default"],
  },
  {
    tier: "semantic",
    category: "spacing",
    name: "spacing.md",
    $type: "dimension",
    $value: "{spacing.space-16}",
    path: ["spacing", "md"],
  },
];

const PRIMITIVES: PrimitiveToken[] = [];

describe("collectComponentInputs", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Re-establish module-level defaults after restore
    vi.mocked(p.isCancel).mockReturnValue(false);
  });

  // border-radius is SKIPPED (no border semantics → continue without p.confirm)
  // So only 5 properties call p.confirm, not 6.
  it("collects a single default variant with one property and default state", async () => {
    vi.mocked(p.confirm)
      .mockResolvedValueOnce(true)    // Use single default variant? YES
      .mockResolvedValueOnce(true)    // Include color-background? YES
      .mockResolvedValueOnce(false)   // Include color-content? NO
      .mockResolvedValueOnce(false)   // Include color-border? NO
      .mockResolvedValueOnce(false)   // Include spacing-padding? NO
      // border-radius skipped (no border semantics)
      .mockResolvedValueOnce(false);  // Include typography? NO

    vi.mocked(p.multiselect).mockResolvedValueOnce(["default"]);
    vi.mocked(p.select).mockResolvedValueOnce("{color.background.primary}");

    const result = await collectComponentInputs(
      SEMANTIC_TOKENS,
      PRIMITIVES,
      "button",
      undefined,
    );

    expect(result.variants).toEqual(["default"]);
    expect(result.cells).toHaveLength(1);
    expect(result.cells[0]).toMatchObject({
      variant: "default",
      property: "color-background",
      states: [
        { state: "default", value: "{color.background.primary}" },
      ],
    });
  });

  it("collects multi-variant with multiple states", async () => {
    vi.mocked(p.confirm)
      .mockResolvedValueOnce(false)   // Use single default variant? NO
      // primary variant properties (5 calls — border-radius skipped)
      .mockResolvedValueOnce(true)    // Include color-background for primary? YES
      .mockResolvedValueOnce(false)   // Include color-content? NO
      .mockResolvedValueOnce(false)   // Include color-border? NO
      .mockResolvedValueOnce(false)   // Include spacing-padding? NO
      .mockResolvedValueOnce(false)   // Include typography? NO
      // secondary variant properties (5 calls)
      .mockResolvedValueOnce(true)    // Include color-background for secondary? YES
      .mockResolvedValueOnce(false)   // Include color-content? NO
      .mockResolvedValueOnce(false)   // Include color-border? NO
      .mockResolvedValueOnce(false)   // Include spacing-padding? NO
      .mockResolvedValueOnce(false);  // Include typography? NO

    vi.mocked(p.text).mockResolvedValueOnce("primary, secondary");

    vi.mocked(p.multiselect)
      .mockResolvedValueOnce(["default", "hover"])
      .mockResolvedValueOnce(["default"]);

    vi.mocked(p.select)
      .mockResolvedValueOnce("{color.background.primary}")
      .mockResolvedValueOnce("{color.background.secondary}")
      .mockResolvedValueOnce("{color.background.secondary}");

    const result = await collectComponentInputs(
      SEMANTIC_TOKENS,
      PRIMITIVES,
      "button",
      undefined,
    );

    expect(result.variants).toEqual(["primary", "secondary"]);
    expect(result.cells).toHaveLength(2);

    const primaryCell = result.cells[0]!;
    expect(primaryCell.variant).toBe("primary");
    expect(primaryCell.states).toHaveLength(2);
    expect(primaryCell.states[0]!.state).toBe("default");
    expect(primaryCell.states[1]!.state).toBe("hover");
  });

  it("handles cancelled prompt by throwing Error('cancelled')", async () => {
    vi.mocked(p.confirm).mockResolvedValueOnce(Symbol("cancel") as never);
    vi.mocked(p.isCancel).mockReturnValueOnce(true);

    await expect(
      collectComponentInputs(SEMANTIC_TOKENS, PRIMITIVES, "button", undefined),
    ).rejects.toThrow("cancelled");
  });

  it("warns and skips border-radius when no border semantics exist", async () => {
    vi.mocked(p.confirm)
      .mockResolvedValueOnce(true)    // Use single default variant? YES
      .mockResolvedValueOnce(false)   // Include color-background? NO
      .mockResolvedValueOnce(false)   // Include color-content? NO
      .mockResolvedValueOnce(false)   // Include color-border? NO
      .mockResolvedValueOnce(false)   // Include spacing-padding? NO
      // border-radius skipped (no border semantics)
      .mockResolvedValueOnce(false);  // Include typography? NO

    const result = await collectComponentInputs(
      SEMANTIC_TOKENS,
      PRIMITIVES,
      "button",
      undefined,
    );

    expect(vi.mocked(p.log.warn)).toHaveBeenCalledWith(
      expect.stringContaining("Border category not configured"),
    );
    expect(result.cells).toHaveLength(0);
  });

  it("collects four-sides padding values", async () => {
    vi.mocked(p.confirm)
      .mockResolvedValueOnce(true)    // Use single default variant? YES
      .mockResolvedValueOnce(false)   // Include color-background? NO
      .mockResolvedValueOnce(false)   // Include color-content? NO
      .mockResolvedValueOnce(false)   // Include color-border? NO
      .mockResolvedValueOnce(true)    // Include spacing-padding? YES
      // border-radius skipped (no border semantics)
      .mockResolvedValueOnce(false);  // Include typography? NO

    vi.mocked(p.multiselect).mockResolvedValueOnce(["default"]);

    vi.mocked(p.select)
      .mockResolvedValueOnce("four-sides")
      .mockResolvedValueOnce("{spacing.md}")   // top
      .mockResolvedValueOnce("{spacing.md}")   // right
      .mockResolvedValueOnce("{spacing.md}")   // bottom
      .mockResolvedValueOnce("{spacing.md}");  // left

    const result = await collectComponentInputs(
      SEMANTIC_TOKENS,
      PRIMITIVES,
      "button",
      undefined,
    );

    expect(result.cells).toHaveLength(1);
    expect(result.cells[0]!.paddingShape).toBe("four-sides");
    expect(result.cells[0]!.states[0]!.value).toEqual({
      top: "{spacing.md}",
      right: "{spacing.md}",
      bottom: "{spacing.md}",
      left: "{spacing.md}",
    });
  });
});

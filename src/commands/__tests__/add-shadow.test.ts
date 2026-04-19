import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@clack/prompts", () => ({
  cancel: vi.fn(),
  isCancel: vi.fn(() => false),
  text: vi.fn(),
  select: vi.fn(),
}));

import * as p from "@clack/prompts";
import {
  collectShadowInputs,
  validateCustomColorRef,
  validateShadowLevels,
} from "../add-shadow.js";
import type { ShadowCategoryConfig } from "../../types/config.js";

describe("validateShadowLevels", () => {
  it("rejects empty / whitespace input", () => {
    expect(validateShadowLevels("")).toMatch(/number of elevation/i);
    expect(validateShadowLevels("   ")).toMatch(/number of elevation/i);
    expect(validateShadowLevels(undefined)).toMatch(/number of elevation/i);
  });

  it("rejects non-integer strings", () => {
    expect(validateShadowLevels("3.5")).toMatch(/whole number/i);
    expect(validateShadowLevels("abc")).toMatch(/whole number/i);
    expect(validateShadowLevels("-2")).toMatch(/whole number/i);
  });

  it("rejects values below the minimum", () => {
    expect(validateShadowLevels("0")).toMatch(/between 2 and 6/i);
    expect(validateShadowLevels("1")).toMatch(/between 2 and 6/i);
  });

  it("rejects values above the maximum", () => {
    expect(validateShadowLevels("7")).toMatch(/between 2 and 6/i);
    expect(validateShadowLevels("100")).toMatch(/between 2 and 6/i);
  });

  it("accepts the full permitted range", () => {
    for (const n of [2, 3, 4, 5, 6]) {
      expect(validateShadowLevels(String(n))).toBeUndefined();
    }
  });
});

describe("validateCustomColorRef", () => {
  it("rejects empty or malformed refs", () => {
    expect(validateCustomColorRef("")).toMatch(/DTCG color/i);
    expect(validateCustomColorRef(undefined)).toMatch(/DTCG color/i);
    expect(validateCustomColorRef("#112233")).toMatch(/color\.<hue>/);
    expect(validateCustomColorRef("{spacing.md}")).toMatch(/color\.<hue>/);
    expect(validateCustomColorRef("{color.neutral}")).toMatch(/color\.<hue>/);
  });

  it("accepts well-formed DTCG color refs", () => {
    expect(validateCustomColorRef("{color.neutral.900}")).toBeUndefined();
    expect(validateCustomColorRef("{color.brand.50}")).toBeUndefined();
    expect(validateCustomColorRef("{color.my-hue.500}")).toBeUndefined();
  });
});

/**
 * End-to-end prompt-flow coverage for `collectShadowInputs` — Story 2.4
 * Task 7.1 / AC #10. We drive every meaningful branch:
 *
 * - color-picker `select` → `"__custom__"` fallback routes into the
 *   second `p.text` prompt and accepts the user's free-text DTCG ref.
 * - default-vs-prior pre-fill: with no `prior`, the first invocation
 *   sees the `DEFAULT_SHADOW_CONFIG` pre-fill; with a `prior`, the
 *   second invocation sees the prior values surfaced as initial
 *   placeholders in both the text and select prompts.
 * - happy path where the user picks a listed color ref (not Custom).
 */
describe("collectShadowInputs — prompt flows", () => {
  const availableColorRefs = [
    "{color.neutral.900}",
    "{color.blue.500}",
    "{color.gray.800}",
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(p.isCancel).mockReturnValue(false);
  });

  it("routes the Custom… select through the second p.text prompt and uses the free-text value", async () => {
    // Sequence: levels (text), profile (select), colorRef (select → __custom__), custom (text).
    vi.mocked(p.text)
      .mockResolvedValueOnce("4")
      .mockResolvedValueOnce("{color.brand.700}");
    vi.mocked(p.select)
      .mockResolvedValueOnce("hard")
      .mockResolvedValueOnce("__custom__");

    const result = await collectShadowInputs(undefined, availableColorRefs);

    expect(result).toEqual({
      levels: 4,
      profile: "hard",
      colorRef: "{color.brand.700}",
    });
    const customPrompt = vi.mocked(p.text).mock.calls[1]![0] as {
      validate?: (v: string) => string | undefined;
    };
    expect(customPrompt.validate?.("not-a-dtcg-ref")).toMatch(/DTCG|color/i);
    expect(customPrompt.validate?.("{color.blue.500}")).toBeUndefined();
    // Exactly two `p.text` calls (levels + custom) and two `p.select`
    // calls (profile + colorRef picker). Any extra indicates an
    // unintentional prompt added to the flow.
    expect(p.text).toHaveBeenCalledTimes(2);
    expect(p.select).toHaveBeenCalledTimes(2);
  });

  it("uses DEFAULT_SHADOW_CONFIG as pre-fill on the first invocation (no prior)", async () => {
    vi.mocked(p.text).mockResolvedValueOnce("3");
    vi.mocked(p.select)
      .mockResolvedValueOnce("soft")
      .mockResolvedValueOnce(availableColorRefs[0]!);

    await collectShadowInputs(undefined, availableColorRefs);

    // The levels text prompt must be pre-filled with the default — the
    // user sees the canonical starting value when no prior config exists.
    const levelsCall = vi.mocked(p.text).mock.calls[0]![0];
    expect(levelsCall.initialValue).toBe("4");
    expect(levelsCall.placeholder).toBe("4");

    const profileCall = vi.mocked(p.select).mock.calls[0]![0];
    expect(profileCall.initialValue).toBe("soft");
  });

  it("uses the prior config as pre-fill on the second invocation", async () => {
    const prior: ShadowCategoryConfig = {
      levels: 6,
      profile: "hard",
      colorRef: "{color.blue.500}",
    };
    vi.mocked(p.text).mockResolvedValueOnce("6");
    vi.mocked(p.select)
      .mockResolvedValueOnce("hard")
      .mockResolvedValueOnce("{color.blue.500}");

    await collectShadowInputs(prior, availableColorRefs);

    // Every prompt must surface the prior values — the user is editing
    // an existing config, not starting fresh.
    const levelsCall = vi.mocked(p.text).mock.calls[0]![0];
    expect(levelsCall.initialValue).toBe("6");
    expect(levelsCall.placeholder).toBe("6");

    const profileCall = vi.mocked(p.select).mock.calls[0]![0];
    expect(profileCall.initialValue).toBe("hard");

    const colorCall = vi.mocked(p.select).mock.calls[1]![0];
    expect(colorCall.initialValue).toBe("{color.blue.500}");
  });

  it("accepts a listed color ref selection without taking the Custom branch", async () => {
    vi.mocked(p.text).mockResolvedValueOnce("3");
    vi.mocked(p.select)
      .mockResolvedValueOnce("soft")
      .mockResolvedValueOnce("{color.gray.800}");

    const result = await collectShadowInputs(undefined, availableColorRefs);

    expect(result.colorRef).toBe("{color.gray.800}");
    // Only one p.text call — the Custom fallback prompt never fires.
    expect(p.text).toHaveBeenCalledTimes(1);
  });
});

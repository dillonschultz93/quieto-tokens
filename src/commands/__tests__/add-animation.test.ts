import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@clack/prompts", () => ({
  cancel: vi.fn(),
  isCancel: vi.fn(() => false),
  text: vi.fn(),
  select: vi.fn(),
}));

import * as p from "@clack/prompts";
import { collectAnimationInputs, validateDurationList } from "../add-animation.js";
import type { AnimationCategoryConfig } from "../../types/config.js";

describe("validateDurationList", () => {
  it("rejects empty input", () => {
    expect(validateDurationList("")).toMatch(/at least one duration/i);
    expect(validateDurationList("   ")).toMatch(/at least one duration/i);
    expect(validateDurationList(undefined)).toMatch(/at least one duration/i);
  });

  it("rejects non-integer or non-positive entries", () => {
    expect(validateDurationList("100, 200ms")).toMatch(/positive integers/i);
    expect(validateDurationList("100,abc")).toMatch(/positive integers/i);
    expect(validateDurationList("0,100")).toMatch(/positive integers/i);
    expect(validateDurationList("100.5,200")).toMatch(/positive integers/i);
  });

  it("rejects lists over 9 entries", () => {
    expect(
      validateDurationList("1,2,3,4,5,6,7,8,9,10"),
    ).toMatch(/9 entries/);
  });

  it("accepts reasonable lists", () => {
    expect(validateDurationList("100")).toBeUndefined();
    expect(validateDurationList("100,150,250,400")).toBeUndefined();
    expect(validateDurationList("100, 150 , 250")).toBeUndefined();
  });
});

/**
 * End-to-end prompt-flow coverage for `collectAnimationInputs` —
 * Story 2.4 Task 7.3 / AC #10. Drives each of the three easing-select
 * branches (standard / emphasized / decelerated) and asserts
 * default-vs-prior pre-fill on a second invocation.
 */
describe("collectAnimationInputs — prompt flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(p.isCancel).mockReturnValue(false);
  });

  it.each(["standard", "emphasized", "decelerated"] as const)(
    "returns easing=%s when the user picks that branch",
    async (easing) => {
      vi.mocked(p.text).mockResolvedValueOnce("100,200,400");
      vi.mocked(p.select).mockResolvedValueOnce(easing);

      const result = await collectAnimationInputs(undefined);
      expect(result.easing).toBe(easing);
      expect(result.durations).toEqual([100, 200, 400]);
    },
  );

  it("uses DEFAULT_ANIMATION_CONFIG as pre-fill on the first invocation (no prior)", async () => {
    vi.mocked(p.text).mockResolvedValueOnce("100,150,250,400");
    vi.mocked(p.select).mockResolvedValueOnce("standard");

    await collectAnimationInputs(undefined);

    const durationsCall = vi.mocked(p.text).mock.calls[0]![0];
    expect(durationsCall.initialValue).toBe("100,150,250,400");
    expect(durationsCall.placeholder).toBe("100,150,250,400");

    const easingCall = vi.mocked(p.select).mock.calls[0]![0];
    expect(easingCall.initialValue).toBe("standard");
  });

  it("uses the prior config as pre-fill on the second invocation", async () => {
    const prior: AnimationCategoryConfig = {
      durations: [75, 200, 500],
      easing: "emphasized",
    };
    vi.mocked(p.text).mockResolvedValueOnce("75,200,500");
    vi.mocked(p.select).mockResolvedValueOnce("emphasized");

    await collectAnimationInputs(prior);

    const durationsCall = vi.mocked(p.text).mock.calls[0]![0];
    expect(durationsCall.initialValue).toBe("75,200,500");
    expect(durationsCall.placeholder).toBe("75,200,500");

    const easingCall = vi.mocked(p.select).mock.calls[0]![0];
    expect(easingCall.initialValue).toBe("emphasized");
  });
});

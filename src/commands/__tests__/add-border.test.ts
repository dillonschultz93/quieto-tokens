import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@clack/prompts", () => ({
  cancel: vi.fn(),
  isCancel: vi.fn(() => false),
  text: vi.fn(),
  confirm: vi.fn(),
}));

import * as p from "@clack/prompts";
import { collectBorderInputs, validateBorderList } from "../add-border.js";
import type { BorderCategoryConfig } from "../../types/config.js";

describe("validateBorderList", () => {
  it("rejects empty / whitespace input", () => {
    expect(validateBorderList("", "widths")).toMatch(/at least one width/i);
    expect(validateBorderList("   ", "radii")).toMatch(/at least one radius/i);
    expect(validateBorderList(undefined, "widths")).toMatch(
      /at least one width/i,
    );
  });

  it("rejects values that aren't comma-separated positive integers", () => {
    expect(validateBorderList("1, 2, abc", "widths")).toMatch(/positive integers/i);
    expect(validateBorderList("1;2;3", "widths")).toMatch(/positive integers/i);
    expect(validateBorderList("1.5,2", "widths")).toMatch(/positive integers/i);
  });

  it("rejects zero / negative entries", () => {
    expect(validateBorderList("0,1,2", "widths")).toMatch(/positive integers/i);
  });

  it("rejects lists longer than 9 entries", () => {
    expect(
      validateBorderList("1,2,3,4,5,6,7,8,9,10", "radii"),
    ).toMatch(/9 entries/);
  });

  it("accepts well-formed lists of various shapes", () => {
    expect(validateBorderList("1,2,4,8", "widths")).toBeUndefined();
    expect(validateBorderList("1, 2, 4, 8", "widths")).toBeUndefined();
    expect(validateBorderList("2", "widths")).toBeUndefined();
    expect(validateBorderList("2,4,8,16,999", "radii")).toBeUndefined();
  });
});

/**
 * End-to-end prompt-flow coverage for `collectBorderInputs` — Story 2.4
 * Task 7.2 / AC #10. Exercises both branches of the `pill` confirm
 * (accept + decline) and the default-vs-prior pre-fill on a second
 * invocation. Border has no canonical `profile` select — Story 2.4's
 * Task 7.2 is covered here by the analogous `pill` confirm branches,
 * which is the only binary decision in the border flow.
 */
describe("collectBorderInputs — prompt flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(p.isCancel).mockReturnValue(false);
  });

  it("returns pill=true when the user accepts the pill confirm", async () => {
    vi.mocked(p.text)
      .mockResolvedValueOnce("1,2,4,8")
      .mockResolvedValueOnce("2,4,8,16");
    vi.mocked(p.confirm).mockResolvedValueOnce(true);

    const result = await collectBorderInputs(undefined);
    expect(result).toEqual({
      widths: [1, 2, 4, 8],
      radii: [2, 4, 8, 16],
      pill: true,
    });
  });

  it("returns pill=false when the user declines the pill confirm", async () => {
    vi.mocked(p.text)
      .mockResolvedValueOnce("1,2,4,8")
      .mockResolvedValueOnce("2,4,8,16");
    vi.mocked(p.confirm).mockResolvedValueOnce(false);

    const result = await collectBorderInputs(undefined);
    expect(result.pill).toBe(false);
  });

  it("uses DEFAULT_BORDER_CONFIG as pre-fill on the first invocation (no prior)", async () => {
    vi.mocked(p.text)
      .mockResolvedValueOnce("1,2,4,8")
      .mockResolvedValueOnce("2,4,8,16");
    vi.mocked(p.confirm).mockResolvedValueOnce(false);

    await collectBorderInputs(undefined);

    const widthsCall = vi.mocked(p.text).mock.calls[0]![0];
    expect(widthsCall.initialValue).toBe("1,2,4,8");
    expect(widthsCall.placeholder).toBe("1,2,4,8");

    const radiiCall = vi.mocked(p.text).mock.calls[1]![0];
    expect(radiiCall.initialValue).toBe("2,4,8,16");

    const confirmCall = vi.mocked(p.confirm).mock.calls[0]![0];
    expect(confirmCall.initialValue).toBe(false);
  });

  it("uses the prior config as pre-fill on the second invocation", async () => {
    const prior: BorderCategoryConfig = {
      widths: [2, 6, 10],
      radii: [4, 12, 20],
      pill: true,
    };
    vi.mocked(p.text)
      .mockResolvedValueOnce("2,6,10")
      .mockResolvedValueOnce("4,12,20");
    vi.mocked(p.confirm).mockResolvedValueOnce(true);

    await collectBorderInputs(prior);

    const widthsCall = vi.mocked(p.text).mock.calls[0]![0];
    expect(widthsCall.initialValue).toBe("2,6,10");
    expect(widthsCall.placeholder).toBe("2,6,10");

    const radiiCall = vi.mocked(p.text).mock.calls[1]![0];
    expect(radiiCall.initialValue).toBe("4,12,20");

    const confirmCall = vi.mocked(p.confirm).mock.calls[0]![0];
    expect(confirmCall.initialValue).toBe(true);
  });
});

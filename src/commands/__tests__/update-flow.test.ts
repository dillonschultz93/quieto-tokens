import { describe, it, expect, vi, beforeEach } from "vitest";
import type { QuietoConfig } from "../../types/config.js";
import { deriveBaselineFromConfig } from "../modify.js";

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
}));

import * as p from "@clack/prompts";
import { collectUpdateInputs } from "../update-flow.js";

function minimalConfig(): QuietoConfig {
  return {
    version: "0.1.0",
    generated: "2026-01-01T00:00:00.000Z",
    inputs: {
      brandColor: "#5B21B6",
      spacingBase: 8,
      typeScale: "balanced",
      darkMode: false,
    },
    overrides: {},
    output: { tokensDir: "tokens", buildDir: "build", prefix: "quieto" },
    categories: ["color", "spacing", "typography"],
  };
}

describe("collectUpdateInputs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns no modified categories when the user picks Done immediately", async () => {
    vi.mocked(p.select).mockResolvedValueOnce("__done__" as never);
    const config = minimalConfig();
    const result = await collectUpdateInputs(config);
    expect(result.modifiedCategories).toEqual([]);
    expect(result.nextOptions).toEqual(deriveBaselineFromConfig(config));
    expect(result.nextAdvanced).toBeUndefined();
  });
});

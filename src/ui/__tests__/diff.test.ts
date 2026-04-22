import { describe, it, expect, vi, beforeEach } from "vitest";
import * as p from "@clack/prompts";
import {
  computeTokenDiff,
  extractDtcgRefPaths,
  renderTokenDiff,
  renderCascadeSummary,
} from "../diff.js";
import { supportsColor } from "../../utils/color-display.js";
import type { PrimitiveToken, ThemeCollection, SemanticToken } from "../../types/tokens.js";

vi.mock("@clack/prompts", () => ({
  log: {
    step: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  },
  isCancel: vi.fn(() => false),
  cancel: vi.fn(),
}));

const prim = (
  name: string,
  v: string,
  cat: PrimitiveToken["category"] = "color",
): PrimitiveToken => ({
  tier: "primitive",
  category: cat,
  name,
  $type: "color",
  $value: v,
  path: name.split("."),
});

const sem = (name: string, $value: string): SemanticToken => ({
  tier: "semantic",
  category: "color",
  name,
  $type: "color",
  $value,
  path: name.split("."),
});

describe("computeTokenDiff", () => {
  it("returns isEmpty for identical collections", () => {
    const p1 = [prim("color.brand.500", "#111")];
    const t: ThemeCollection = {
      primitives: p1,
      themes: [
        { name: "default", semanticTokens: [sem("color.background.primary", "{color.brand.500}")] },
      ],
    };
    const d = computeTokenDiff(t, structuredClone(t));
    expect(d.isEmpty).toBe(true);
    expect(d.primitiveChanges).toHaveLength(0);
    expect(d.semanticChanges.size).toBe(0);
  });

  it("detects added primitive", () => {
    const a: ThemeCollection = { primitives: [], themes: [] };
    const b: ThemeCollection = { primitives: [prim("color.teal.500", "#14b8a6")], themes: [] };
    const d = computeTokenDiff(a, b);
    expect(d.isEmpty).toBe(false);
    const added = d.primitiveChanges.find((c) => c.name === "color.teal.500");
    expect(added?.kind).toBe("added");
    expect(added?.newValue).toBe("#14b8a6");
  });

  it("detects removed primitive", () => {
    const a: ThemeCollection = {
      primitives: [prim("color.teal.500", "#14b8a6")],
      themes: [],
    };
    const b: ThemeCollection = { primitives: [], themes: [] };
    const d = computeTokenDiff(a, b);
    const r = d.primitiveChanges[0]!;
    expect(r.kind).toBe("removed");
    expect(r.oldValue).toBe("#14b8a6");
  });

  it("detects modified primitive (hex change)", () => {
    const a: ThemeCollection = { primitives: [prim("color.blue.500", "#000000")], themes: [] };
    const b: ThemeCollection = { primitives: [prim("color.blue.500", "#ffffff")], themes: [] };
    const d = computeTokenDiff(a, b);
    const m = d.primitiveChanges[0]!;
    expect(m.kind).toBe("modified");
    expect(m.oldValue).toBe("#000000");
    expect(m.newValue).toBe("#ffffff");
  });

  it("diffs semantics per theme", () => {
    const a: ThemeCollection = {
      primitives: [],
      themes: [
        {
          name: "default",
          semanticTokens: [sem("color.background.a", "{color.brand.500}")],
        },
      ],
    };
    const b: ThemeCollection = {
      primitives: [],
      themes: [
        {
          name: "default",
          semanticTokens: [sem("color.background.a", "{color.brand.600}")],
        },
      ],
    };
    const d = computeTokenDiff(a, b);
    const ch = d.semanticChanges.get("default");
    expect(ch).toBeDefined();
    const m = ch?.find((c) => c.name === "color.background.a");
    expect(m?.kind).toBe("modified");
  });
});

describe("extractDtcgRefPaths", () => {
  it("returns inner paths for brace refs", () => {
    expect(extractDtcgRefPaths("{color.blue.500}")).toEqual(["color.blue.500"]);
    expect(
      extractDtcgRefPaths("shadow(0) {color.neutral.900}"),
    ).toContain("color.neutral.900");
  });
});

describe("renderTokenDiff", () => {
  beforeEach(() => {
    vi.mocked(p.log.info).mockClear();
    vi.mocked(p.log.step).mockClear();
  });

  it("skips rendering when isEmpty", () => {
    const d = computeTokenDiff(
      { primitives: [], themes: [] },
      { primitives: [], themes: [] },
    );
    expect(d.isEmpty).toBe(true);
    renderTokenDiff(d, []);
    expect(p.log.step).not.toHaveBeenCalled();
  });

  it("filters by modifiedCategories when set", () => {
    const prior: ThemeCollection = {
      primitives: [prim("spacing.8", "8px", "spacing")],
      themes: [],
    };
    const curr: ThemeCollection = {
      primitives: [prim("spacing.8", "9px", "spacing")],
      themes: [],
    };
    const diff = computeTokenDiff(prior, curr);
    renderTokenDiff(diff, curr.primitives, { modifiedCategories: new Set(["color"]) });
    expect(p.log.info).not.toHaveBeenCalled();
  });
});

describe("renderCascadeSummary", () => {
  beforeEach(() => {
    vi.mocked(p.log.info).mockClear();
    vi.mocked(p.log.warn).mockClear();
  });

  it("warns on dangling refs to removed primitives", () => {
    const diff = computeTokenDiff(
      { primitives: [], themes: [] },
      { primitives: [], themes: [] },
    );
    // Force a synthetic "removed" primitive
    diff.primitiveChanges = [
      {
        kind: "removed",
        path: ["color", "teal", "500"],
        name: "color.teal.500",
        category: "color",
        $type: "color",
        oldValue: "#aabbcc",
      },
    ];
    const current: ThemeCollection = {
      primitives: [],
      themes: [
        {
          name: "default",
          semanticTokens: [
            sem("color.ui.bad", "{color.teal.500}"),
            sem("color.ui.ok", "{color.brand.500}"),
          ],
        },
      ],
    };
    renderCascadeSummary(diff, current);
    expect(p.log.warn).toHaveBeenCalledWith(
      expect.stringContaining("color.ui.bad"),
    );
  });

  it("does not emit a cascade 'No cascading' line when only semantic tokens differ", () => {
    vi.clearAllMocks();
    const prims = [
      prim("color.brand.500", "#111", "color"),
      prim("color.brand.600", "#222", "color"),
    ];
    const d = computeTokenDiff(
      {
        primitives: prims,
        themes: [
          {
            name: "default",
            semanticTokens: [sem("color.bg.a", "{color.brand.500}")],
          },
        ],
      },
      {
        primitives: prims,
        themes: [
          {
            name: "default",
            semanticTokens: [sem("color.bg.a", "{color.brand.600}")],
          },
        ],
      },
    );
    expect(d.primitiveChanges).toHaveLength(0);
    expect(d.isEmpty).toBe(false);
    renderCascadeSummary(d, {
      primitives: prims,
      themes: [
        {
          name: "default",
          semanticTokens: [sem("color.bg.a", "{color.brand.600}")],
        },
      ],
    });
    const infos = (vi.mocked(p.log.info).mock.calls as string[][]).map(
      (c) => c[0] as string,
    );
    expect(infos.some((s) => s.includes("No cascading"))).toBe(false);
  });
});

describe("supportsColor (diff)", () => {
  it("can be read from env in tests", () => {
    expect(typeof supportsColor()).toBe("boolean");
  });
});

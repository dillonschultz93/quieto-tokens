import { describe, it, expect, vi } from "vitest";
import { renderMarkdownReport, type InspectReport } from "../report.js";

function baseReport(overrides: Partial<InspectReport> = {}): InspectReport {
  return {
    summary: {
      totalByTier: { primitive: 2, semantic: 1, component: 0 },
      byCategory: {
        color: { primitive: 2, semantic: 1, component: 0 },
      },
      themeCount: 1,
      themeNames: ["default"],
    },
    orphans: [],
    brokenRefs: [],
    namingViolations: [],
    contrastPairs: [],
    ...overrides,
  };
}

describe("renderMarkdownReport", () => {
  it("includes summary section", () => {
    const md = renderMarkdownReport(baseReport());
    expect(md).toContain("# Token System Inspection Report");
    expect(md).toContain("**Total tokens:** 3");
    expect(md).toContain("**Primitives:** 2");
    expect(md).toContain("**Semantic (unique):** 1");
    expect(md).toContain("**Component:** 0");
    expect(md).toContain("**Themes:** 1 (default)");
  });

  it("includes category table", () => {
    const md = renderMarkdownReport(baseReport());
    expect(md).toContain("| color | 2 | 1 | 0 |");
  });

  it("reports orphans as bullet list", () => {
    const md = renderMarkdownReport(
      baseReport({
        orphans: [{ path: ["color", "red", "500"], category: "color" }],
      }),
    );
    expect(md).toContain("`color.red.500`");
  });

  it("reports broken references", () => {
    const md = renderMarkdownReport(
      baseReport({
        brokenRefs: [
          {
            tokenPath: ["color", "bg", "primary"],
            tier: "semantic",
            referenceValue: "{color.nope.500}",
            theme: "light",
          },
        ],
      }),
    );
    expect(md).toContain("`color.bg.primary`");
    expect(md).toContain("{color.nope.500}");
  });

  it("reports naming violations", () => {
    const md = renderMarkdownReport(
      baseReport({
        namingViolations: [
          {
            tokenPath: ["color", "Blue", "500"],
            tier: "primitive",
            reason: 'Segment "Blue" contains invalid characters',
          },
        ],
      }),
    );
    expect(md).toContain("`color.Blue.500`");
    expect(md).toContain("invalid characters");
  });

  it("includes contrast table with pass/fail", () => {
    const md = renderMarkdownReport(
      baseReport({
        contrastPairs: [
          {
            backgroundPath: ["color", "background", "primary"],
            contentPath: ["color", "content", "primary"],
            backgroundHex: "#F9FAFB",
            contentHex: "#111827",
            ratio: 17.4,
            passAA: true,
            theme: "light",
          },
          {
            backgroundPath: ["color", "background", "primary"],
            contentPath: ["color", "content", "primary"],
            backgroundHex: "#F3F4F6",
            contentHex: "#D1D5DB",
            ratio: 1.3,
            passAA: false,
            theme: "dark",
          },
        ],
      }),
    );
    expect(md).toContain("| Pass |");
    expect(md).toContain("| **Fail** |");
    expect(md).toContain("17.4:1");
  });

  it("shows 'None found' for clean sections", () => {
    const md = renderMarkdownReport(baseReport());
    expect(md).toContain("None found.");
  });
});

import * as p from "@clack/prompts";
import type { TokenSummary } from "./summary.js";
import type { OrphanedToken } from "./orphans.js";
import type { BrokenReference } from "./references.js";
import type { NamingViolation } from "./naming.js";
import type { ContrastPair } from "./contrast.js";

export interface InspectReport {
  summary: TokenSummary;
  orphans: OrphanedToken[];
  brokenRefs: BrokenReference[];
  namingViolations: NamingViolation[];
  contrastPairs: ContrastPair[];
}

export function renderTerminalReport(report: InspectReport): void {
  const { summary, orphans, brokenRefs, namingViolations, contrastPairs } =
    report;

  p.log.step("Token Summary");
  const { totalByTier, themeCount, themeNames } = summary;
  const total =
    totalByTier.primitive + totalByTier.semantic + totalByTier.component;
  p.log.info(
    [
      `Total tokens: ${total}`,
      `  Primitives: ${totalByTier.primitive}`,
      `  Semantic (unique):   ${totalByTier.semantic}`,
      `  Component:  ${totalByTier.component}`,
      `  Themes:     ${themeCount} (${themeNames.join(", ")})`,
    ].join("\n"),
  );

  const cats = Object.keys(summary.byCategory).sort();
  if (cats.length > 0) {
    const lines = cats.map((cat) => {
      const c = summary.byCategory[cat]!;
      return `  ${cat}: ${c.primitive} prim / ${c.semantic} sem / ${c.component} comp`;
    });
    p.log.info("By category:\n" + lines.join("\n"));
  }

  if (orphans.length === 0) {
    p.log.success("No orphaned primitives.");
  } else {
    p.log.warn(`${orphans.length} orphaned primitive(s):`);
    for (const o of orphans) {
      p.log.info(`  ${o.path.join(".")} (${o.category})`);
    }
  }

  if (brokenRefs.length === 0) {
    p.log.success("No broken references.");
  } else {
    p.log.warn(`${brokenRefs.length} broken reference(s):`);
    for (const r of brokenRefs) {
      const loc = r.theme ? ` [${r.theme}]` : "";
      p.log.info(
        `  ${r.tokenPath.join(".")} (${r.tier}${loc}) → ${r.referenceValue}`,
      );
    }
  }

  if (namingViolations.length === 0) {
    p.log.success("No naming violations.");
  } else {
    p.log.warn(`${namingViolations.length} naming violation(s):`);
    for (const v of namingViolations) {
      p.log.info(`  ${v.tokenPath.join(".")} (${v.tier}): ${v.reason}`);
    }
  }

  const failing = contrastPairs.filter((c) => !c.passAA);
  const passing = contrastPairs.filter((c) => c.passAA);
  if (contrastPairs.length === 0) {
    p.log.info("No background/content color pairs found for contrast analysis.");
  } else {
    if (passing.length > 0) {
      p.log.success(`${passing.length} contrast pair(s) pass WCAG AA.`);
    }
    if (failing.length > 0) {
      p.log.warn(`${failing.length} contrast pair(s) fail WCAG AA:`);
    }
    for (const c of contrastPairs) {
      const mark = c.passAA ? "✓" : "✗";
      p.log.info(
        `  ${mark} ${c.ratio}:1 — ${c.backgroundPath.join(".")} ↔ ${c.contentPath.join(".")} [${c.theme}]`,
      );
    }
  }
}

export function renderMarkdownReport(report: InspectReport): string {
  const { summary, orphans, brokenRefs, namingViolations, contrastPairs } =
    report;
  const lines: string[] = [];

  lines.push("# Token System Inspection Report\n");

  lines.push("## Summary\n");
  const { totalByTier, themeCount, themeNames } = summary;
  const total =
    totalByTier.primitive + totalByTier.semantic + totalByTier.component;
  lines.push(`- **Total tokens:** ${total}`);
  lines.push(`- **Primitives:** ${totalByTier.primitive}`);
  lines.push(`- **Semantic (unique):** ${totalByTier.semantic}`);
  lines.push(`- **Component:** ${totalByTier.component}`);
  lines.push(
    `- **Themes:** ${themeCount} (${themeNames.join(", ")})\n`,
  );

  const cats = Object.keys(summary.byCategory).sort();
  if (cats.length > 0) {
    lines.push("### By Category\n");
    lines.push("| Category | Primitives | Semantic | Component |");
    lines.push("|----------|-----------|----------|-----------|");
    for (const cat of cats) {
      const c = summary.byCategory[cat]!;
      lines.push(`| ${cat} | ${c.primitive} | ${c.semantic} | ${c.component} |`);
    }
    lines.push("");
  }

  lines.push("## Orphaned Primitives\n");
  if (orphans.length === 0) {
    lines.push("None found.\n");
  } else {
    for (const o of orphans) {
      lines.push(`- \`${o.path.join(".")}\` (${o.category})`);
    }
    lines.push("");
  }

  lines.push("## Broken References\n");
  if (brokenRefs.length === 0) {
    lines.push("None found.\n");
  } else {
    for (const r of brokenRefs) {
      const loc = r.theme ? ` [${r.theme}]` : "";
      lines.push(
        `- \`${r.tokenPath.join(".")}\` (${r.tier}${loc}) → ${r.referenceValue}`,
      );
    }
    lines.push("");
  }

  lines.push("## Naming Violations\n");
  if (namingViolations.length === 0) {
    lines.push("None found.\n");
  } else {
    for (const v of namingViolations) {
      lines.push(
        `- \`${v.tokenPath.join(".")}\` (${v.tier}): ${v.reason}`,
      );
    }
    lines.push("");
  }

  lines.push("## WCAG Contrast Analysis\n");
  if (contrastPairs.length === 0) {
    lines.push("No background/content color pairs found.\n");
  } else {
    lines.push(
      "| Background | Content | Ratio | AA | Theme |",
    );
    lines.push("|------------|---------|-------|----|-------|");
    for (const c of contrastPairs) {
      const mark = c.passAA ? "Pass" : "**Fail**";
      lines.push(
        `| ${c.backgroundPath.join(".")} | ${c.contentPath.join(".")} | ${c.ratio}:1 | ${mark} | ${c.theme} |`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

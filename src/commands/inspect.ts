import { writeFile } from "node:fs/promises";
import * as p from "@clack/prompts";
import { loadTokenSystem } from "../analysis/token-loader.js";
import { computeSummary } from "../analysis/summary.js";
import { detectOrphans } from "../analysis/orphans.js";
import { detectBrokenReferences } from "../analysis/references.js";
import { validateNaming } from "../analysis/naming.js";
import { analyzeContrast } from "../analysis/contrast.js";
import {
  renderTerminalReport,
  renderMarkdownReport,
  type InspectReport,
} from "../analysis/report.js";

export interface InspectCommandOptions {
  output?: string;
}

export async function inspectCommand(
  opts: InspectCommandOptions = {},
): Promise<void> {
  p.intro("◆  quieto-tokens inspect");

  const system = await loadTokenSystem();
  if (!system) {
    p.log.error(
      "No token system found. Run `quieto-tokens init` first.",
    );
    p.outro("");
    process.exitCode = 1;
    return;
  }

  const report: InspectReport = {
    summary: computeSummary(system),
    orphans: detectOrphans(system),
    brokenRefs: detectBrokenReferences(system),
    namingViolations: validateNaming(system),
    contrastPairs: analyzeContrast(system),
  };

  renderTerminalReport(report);

  if (opts.output) {
    try {
      const markdown = renderMarkdownReport(report);
      await writeFile(opts.output, markdown, "utf-8");
      p.log.success(`Report written to ${opts.output}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      p.log.warn(`Failed to write report file: ${message}`);
    }
  }

  const issues =
    report.orphans.length +
    report.brokenRefs.length +
    report.namingViolations.length +
    report.contrastPairs.filter((c) => !c.passAA).length;

  if (issues === 0) {
    p.outro("Token system is healthy.");
  } else {
    p.outro(`${issues} issue(s) found.`);
  }
}

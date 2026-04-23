import * as p from "@clack/prompts";
import { stat, writeFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import { loadTokenSystem } from "../analysis/token-loader.js";
import { buildTokenIndex } from "../analysis/token-index.js";
import { scanDirectory } from "../analysis/scanner.js";
import { applyReplacements } from "../analysis/applier.js";
import {
  renderMigrationMarkdownReport,
  renderMigrationTerminalReport,
} from "../analysis/migration-report.js";

export interface MigrateCommandOptions {
  mode: "scan" | "apply";
  target: string;
  output?: string;
}

function isGitDirty(cwd: string): boolean {
  try {
    const out = execSync("git status --porcelain", { cwd, stdio: "pipe" });
    return String(out).trim().length > 0;
  } catch {
    // If git isn't available or cwd isn't a repo, treat as "dirty" to be safe.
    return true;
  }
}

export async function migrateCommand(
  opts: MigrateCommandOptions,
): Promise<void> {
  p.intro("◆  quieto-tokens migrate");

  const cwd = process.cwd();
  const system = await loadTokenSystem(cwd);
  if (!system) {
    p.log.error("No token system found. Run `quieto-tokens init` first.");
    p.outro("");
    process.exitCode = 1;
    return;
  }

  try {
    const s = await stat(opts.target);
    if (!s.isDirectory()) {
      p.log.error(`Directory not found: ${opts.target}`);
      p.outro("");
      process.exitCode = 1;
      return;
    }
  } catch {
    p.log.error(`Directory not found: ${opts.target}`);
    p.outro("");
    process.exitCode = 1;
    return;
  }

  const index = buildTokenIndex(system);
  const scan = await scanDirectory(opts.target, index);

  if (scan.matches.length === 0) {
    p.log.success(
      "No hardcoded values found that match your token system. Your codebase may already be using tokens!",
    );
    if (opts.output) {
      const md = renderMigrationMarkdownReport(scan);
      await writeFile(opts.output, md, "utf-8");
      p.log.success(`Report written to ${opts.output}`);
    }
    p.outro("");
    return;
  }

  if (opts.mode === "scan") {
    renderMigrationTerminalReport(scan);
    if (opts.output) {
      const md = renderMigrationMarkdownReport(scan);
      await writeFile(opts.output, md, "utf-8");
      p.log.success(`Report written to ${opts.output}`);
    }
    p.outro("");
    return;
  }

  // apply mode
  if (isGitDirty(cwd)) {
    const ok = await p.confirm({
      message:
        "You have uncommitted changes. Automatic replacements will modify your files. Continue? (y/N)",
      initialValue: false,
    });
    if (!ok) {
      p.outro("Aborted — no files modified.");
      return;
    }
  }

  const apply = await applyReplacements(scan.matches, cwd);
  renderMigrationTerminalReport(scan, apply);

  if (opts.output) {
    const md = renderMigrationMarkdownReport(scan, apply);
    await writeFile(opts.output, md, "utf-8");
    p.log.success(`Report written to ${opts.output}`);
  }

  p.outro("");
}


import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import * as p from "@clack/prompts";
import { configExists, loadConfig } from "../utils/config.js";
import {
  readToolVersion,
  writeConfig,
} from "../output/config-writer.js";
import { appendChangelog } from "../output/changelog-writer.js";
import { buildComponentSummary } from "../output/changelog-summary.js";
import type { QuietoConfig } from "../types/config.js";
import { runComponent } from "../pipeline/component.js";
import { validateComponentName } from "../utils/validation.js";

export interface ComponentCommandOptions {
  name: string;
  /**
   * When true, run the walkthrough and generation but skip all writes
   * (Story 3.3).
   */
  dryRun?: boolean;
}

export async function componentCommand(
  options: ComponentCommandOptions,
): Promise<void> {
  const { dryRun = false } = options;
  const cwd = process.cwd();
  p.intro("◆  quieto-tokens — Component token generation.");

  try {
    const nameError = validateComponentName(options.name);
    if (nameError) {
      p.log.error(`Invalid component name: ${nameError}`);
      p.outro("Provide a valid kebab-case component name and re-run.");
      process.exitCode = 1;
      return;
    }

    if (!configExists(cwd)) {
      p.log.error(
        "No quieto.config.json found in this directory.",
      );
      p.outro(
        "Run `quieto-tokens init` first to create a token system.",
      );
      process.exitCode = 1;
      return;
    }

    const loadResult = loadConfig(cwd);

    switch (loadResult.status) {
      case "missing":
        p.log.error(
          "quieto.config.json disappeared between check and load.",
        );
        p.outro("Please try again.");
        process.exitCode = 1;
        return;

      case "corrupt":
      case "invalid": {
        const details =
          loadResult.status === "corrupt"
            ? loadResult.error.message
            : loadResult.errors.join("\n  • ");

        const action = await p.select({
          message: "Your config file has problems. What would you like to do?",
          options: [
            { value: "details", label: "Show details" },
            { value: "abort", label: "Abort" },
          ],
        });

        if (p.isCancel(action) || action === "abort") {
          p.outro("Nothing changed.");
          process.exitCode = 1;
          return;
        }

        p.log.error(`Config issues:\n  • ${details}`);
        p.outro("Fix quieto.config.json and re-run.");
        process.exitCode = 1;
        return;
      }

      case "ok":
        break;
    }

    const config: QuietoConfig = loadResult.config;

    const componentFile = join(cwd, "tokens", "component", `${options.name}.json`);
    const hadComponentFile = existsSync(componentFile);
    if (hadComponentFile) {
      const reauthor = await p.confirm({
        message: `Re-author "${options.name}"? Existing tokens will be replaced.`,
      });
      if (p.isCancel(reauthor) || !reauthor) {
        p.outro("Nothing changed.");
        return;
      }
    }

    const outcome = await runComponent(config, options.name, cwd, {
      dryRun,
    });

    switch (outcome.status) {
      case "cancelled":
        if (dryRun) {
          p.cancel("Dry run cancelled.");
        } else {
          p.outro("Nothing changed.");
        }
        return;

      case "error":
        p.log.error(outcome.message);
        p.outro("Component generation failed.");
        process.exitCode = 1;
        return;

      case "ok":
        break;
    }

    const { result } = outcome;

    if (dryRun) {
      p.log.info(
        `Generated ${result.tokenCount} component tokens (not written — dry run).`,
      );
      p.outro("Dry run complete — no files were written.");
      return;
    }

    let version: string;
    try {
      version = await readToolVersion();
    } catch {
      p.log.warn(
        "Could not read tool version — config version will be preserved.",
      );
      version = config.version;
    }

    const updatedConfig: QuietoConfig = {
      ...config,
      version,
      generated: new Date().toISOString(),
      components: {
        ...config.components,
        [options.name]: result.componentConfig,
      },
    };

    try {
      await writeConfig(updatedConfig, cwd);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      p.log.error(`Failed to write quieto.config.json: ${message}`);
      p.outro(
        "Component tokens were generated but config was not saved.",
      );
      process.exitCode = 1;
      return;
    }

    const changelogRes = await appendChangelog(
      {
        timestamp: new Date().toISOString(),
        toolVersion: version,
        command: `component ${options.name}`,
        categoriesAffected: ["component"],
        summary: buildComponentSummary(
          options.name,
          result.tokenCount,
          hadComponentFile,
          {
            jsonFiles: result.jsonFiles,
            cssFiles: result.cssFiles,
            figmaFiles: result.figmaFiles,
          },
        ),
      },
      cwd,
    );
    if ("error" in changelogRes) {
      p.log.warn(
        `Could not update TOKENS_CHANGELOG.md: ${changelogRes.error}`,
      );
    }

    const filePath = join("tokens", "component", `${options.name}.json`);
    p.log.success(
      `Wrote ${result.tokenCount} component tokens to ${filePath}`,
    );

    p.log.info(
      [
        "What's next:",
        "  • Import build/light.css (and build/dark.css) into your project",
        `  • Your component tokens are available as --quieto-component-${options.name}-* custom properties`,
      ].join("\n"),
    );

    p.outro(
      "Component saved — you can re-run to modify this component anytime.",
    );
  } catch (error) {
    if (error instanceof Error && error.message === "cancelled") {
      p.outro("Nothing changed.");
      return;
    }
    throw error;
  }
}

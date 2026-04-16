import * as p from "@clack/prompts";
import { configExists } from "../utils/config.js";
import { quickStartFlow } from "./quick-start.js";
import { runColorGeneration } from "../pipeline/color.js";
import {
  runSpacingGeneration,
  runTypographyGeneration,
} from "../pipeline/spacing-typography.js";

export async function initCommand(): Promise<void> {
  p.intro("◆  quieto-tokens — Design tokens, made yours.");

  try {
    const hasConfig = configExists();

    if (hasConfig) {
      const action = await p.select({
        message:
          "An existing token system was found. What would you like to do?",
        options: [
          {
            value: "modify" as const,
            label: "Modify existing system",
            hint: "Update specific categories while preserving your overrides",
          },
          {
            value: "fresh" as const,
            label: "Start fresh",
            hint: "Replace the current token system with a new one",
          },
        ],
      });

      if (p.isCancel(action)) {
        p.cancel("Operation cancelled.");
        return;
      }

      if (action === "modify") {
        p.log.info("Modify mode will be available in a future release.");
        p.outro("Nothing changed. Run again when ready.");
        return;
      }
    }

    const options = await quickStartFlow();

    const themeLabel = options.generateThemes ? "light + dark" : "single theme";
    p.log.step(
      [
        "Your preferences:",
        `  Brand color:   ${options.brandColor}`,
        `  Spacing base:  ${options.spacingBase}px`,
        `  Type scale:    ${options.typeScale}`,
        `  Themes:        ${themeLabel}`,
      ].join("\n"),
    );

    const colorTokens = await runColorGeneration(options.brandColor);

    const spacingTokens = runSpacingGeneration(options.spacingBase);
    const typographyTokens = runTypographyGeneration(options.typeScale);

    const allPrimitives = [
      ...colorTokens,
      ...spacingTokens,
      ...typographyTokens,
    ];

    p.log.info(
      `${allPrimitives.length} total primitives generated (${colorTokens.length} color, ${spacingTokens.length} spacing, ${typographyTokens.length} typography)`,
    );
    p.outro("Done — thanks for using quieto-tokens.");
  } catch (error) {
    if (error instanceof Error && error.message === "cancelled") {
      return;
    }
    p.cancel("Something went wrong.");
    throw error;
  }
}

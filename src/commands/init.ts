import * as p from "@clack/prompts";
import { configExists } from "../utils/config.js";

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

      if (action === "fresh") {
        p.log.info("Starting fresh token generation...");
      }
    }

    p.log.step("Ready to begin the quick-start flow.");
    p.log.info(
      "The quick-start prompt flow is coming in the next release. Stay tuned.",
    );

    p.outro("Done — thanks for using quieto-tokens.");
  } catch (error) {
    p.cancel("Something went wrong.");
    throw error;
  }
}

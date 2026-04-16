import * as p from "@clack/prompts";
import { initCommand } from "./commands/init.js";

const HELP_TEXT = `
  @quieto/tokens — Generate complete, accessible design token systems.

  Usage:
    quieto-tokens <command> [options]

  Commands:
    init        Create a new design token system (or modify an existing one)

  Options:
    --help, -h  Show this help message
    --version   Show version number
`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === "--help" || command === "-h") {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  if (command === "--version") {
    const { readFileSync } = await import("node:fs");
    const { resolve, dirname } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(
      readFileSync(resolve(__dirname, "..", "package.json"), "utf-8"),
    );
    console.log(pkg.version);
    process.exit(0);
  }

  if (!command) {
    console.error("No command provided.\n");
    console.log(HELP_TEXT);
    process.exit(1);
  }

  switch (command) {
    case "init":
      await initCommand();
      break;
    default:
      console.error(`Unknown command: ${command}\n`);
      console.log(HELP_TEXT);
      process.exit(1);
  }
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "An unexpected error occurred";
  p.cancel(message);
  process.exit(1);
});

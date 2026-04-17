import * as p from "@clack/prompts";
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { initCommand } from "./commands/init.js";

const HELP_TEXT = `
  @quieto/tokens — Generate complete, accessible design token systems.

  Usage:
    quieto-tokens <command> [options]

  Commands:
    init              Create a new design token system (or modify an existing one)

  Command options:
    --advanced        (init) Enter advanced mode: customize individual tokens
                      per category instead of taking the quick-start defaults.
                      Also accepts --advanced=true / --advanced=false.

  Global options:
    --help, -h        Show this help message
    --version         Show version number
`;

/**
 * Parse the argv slice after the command word into a structured options
 * object. Keeping this zero-dependency (no minimist/commander) is a
 * deliberate choice: the CLI surface is tiny and a hand-rolled parser lets
 * us control exactly which flags we accept — any unknown flag is rejected
 * instead of silently ignored.
 *
 * `--advanced` variants supported:
 *  - `--advanced`        → advanced = true
 *  - `--advanced=true`   → advanced = true
 *  - `--advanced=false`  → advanced = false
 *
 * The `key=value` form is required for explicit-value usage; `--advanced
 * false` (space-separated) is NOT accepted because that creates ambiguity
 * with positional args. Fail closed — users will see the error immediately.
 */
export function parseInitArgs(args: readonly string[]): {
  advanced: boolean;
  unknown: string[];
} {
  let advanced = false;
  const unknown: string[] = [];
  for (const arg of args) {
    if (arg === "--advanced") {
      advanced = true;
    } else if (arg === "--advanced=true") {
      advanced = true;
    } else if (arg === "--advanced=false") {
      advanced = false;
    } else {
      unknown.push(arg);
    }
  }
  return { advanced, unknown };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === "--help" || command === "-h") {
    // Plain stdout print: help text is structural CLI output, not user-
    // facing narrative. Every CLI does it this way so pipes/grep work.
    process.stdout.write(`${HELP_TEXT}\n`);
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
    process.stdout.write(`${pkg.version}\n`);
    process.exit(0);
  }

  if (!command) {
    p.intro("◆  quieto-tokens");
    p.log.error("No command provided.");
    p.note(HELP_TEXT.trim(), "Usage");
    p.outro("Run `quieto-tokens --help` for more.");
    process.exit(1);
  }

  switch (command) {
    case "init": {
      const { advanced, unknown } = parseInitArgs(args.slice(1));
      if (unknown.length > 0) {
        p.intro("◆  quieto-tokens");
        p.log.error(`Unknown option(s) for init: ${unknown.join(", ")}`);
        p.note(HELP_TEXT.trim(), "Usage");
        p.outro("Fix the options and re-run.");
        process.exit(1);
      }
      await initCommand({ advanced });
      break;
    }
    default:
      p.intro("◆  quieto-tokens");
      p.log.error(`Unknown command: ${command}`);
      p.note(HELP_TEXT.trim(), "Usage");
      p.outro("Run `quieto-tokens --help` for more.");
      process.exit(1);
  }
}

/**
 * Only auto-run when this module IS the entrypoint (`node cli.js`), not when
 * imported by a test file. Compare the URL of the loaded module against the
 * resolved URL of `argv[1]`, canonicalizing both ends through `realpathSync`
 * so symlinked installations (e.g. `npm link`, pnpm hoisting, macOS
 * `/var` → `/private/var` aliasing) still recognise the CLI as the
 * entrypoint instead of silently exiting 0.
 */
const isEntrypoint = (() => {
  if (!process.argv[1]) return false;
  try {
    const argvReal = realpathSync(process.argv[1]);
    const moduleReal = realpathSync(new URL(import.meta.url).pathname);
    return argvReal === moduleReal;
  } catch {
    // Either path failed to canonicalize — fall back to the strict URL
    // compare (handles e.g. ESM loaders that serve virtual files).
    try {
      return import.meta.url === pathToFileURL(process.argv[1]).href;
    } catch {
      return false;
    }
  }
})();

if (isEntrypoint) {
  main().catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";
    p.cancel(message);
    process.exit(1);
  });
}

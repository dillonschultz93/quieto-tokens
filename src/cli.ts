import * as p from "@clack/prompts";
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { initCommand } from "./commands/init.js";
import { addCommand } from "./commands/add.js";
import { componentCommand } from "./commands/component.js";
import { updateCommand } from "./commands/update.js";
import {
  ADDABLE_CATEGORIES,
  isAddableCategory,
  type AddableCategory,
} from "./utils/categories.js";
import { validateComponentName } from "./utils/validation.js";

const HELP_TEXT = `
  @quieto/tokens — Generate complete, accessible design token systems.

  Usage:
    quieto-tokens <command> [options]

  Commands:
    init              Create a new design token system (or modify an existing one)
    update            Modify specific token categories without regenerating everything
    add <category>    Add a new token category (shadow, border, animation) to an
                      existing token system. Omit the category to pick from a menu.
    component <name>  Generate tier-3 component tokens (e.g., button, modal) that
                      reference your semantic tokens. Walks through variants, states,
                      and property assignments interactively.

  Command options:
    --advanced        (init) Enter advanced mode: customize individual tokens
                      per category instead of taking the quick-start defaults.
                      Also accepts --advanced=true / --advanced=false.

  Global options:
    --dry-run         Run the full pipeline without writing any files
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
 *
 * `--dry-run` variants: `--dry-run`, `--dry-run=true`, `--dry-run=false`.
 */
export function parseInitArgs(args: readonly string[]): {
  advanced: boolean;
  dryRun: boolean;
  unknown: string[];
} {
  let advanced = false;
  let dryRun = false;
  const unknown: string[] = [];
  for (const arg of args) {
    if (arg === "--advanced") {
      advanced = true;
    } else if (arg === "--advanced=true") {
      advanced = true;
    } else if (arg === "--advanced=false") {
      advanced = false;
    } else if (arg === "--dry-run" || arg === "--dry-run=true") {
      dryRun = true;
    } else if (arg === "--dry-run=false") {
      dryRun = false;
    } else {
      unknown.push(arg);
    }
  }
  return { advanced, dryRun, unknown };
}

/**
 * Parse the argv slice after the `add` command word. Mirrors {@link
 * parseInitArgs}: hand-rolled, zero-dependency, fails closed on unknown
 * flags. A single recognised positional (one of `shadow`, `border`,
 * `animation`) becomes `category`; further positionals or unknown flags go
 * into `unknown`. A missing category is NOT an error — the command itself
 * prompts for it interactively.
 */
export function parseAddArgs(args: readonly string[]): {
  category?: AddableCategory;
  help?: boolean;
  dryRun: boolean;
  unknown: string[];
} {
  let category: AddableCategory | undefined;
  let help = false;
  let dryRun = false;
  const unknown: string[] = [];
  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "--dry-run" || arg === "--dry-run=true") {
      dryRun = true;
      continue;
    }
    if (arg === "--dry-run=false") {
      dryRun = false;
      continue;
    }
    if (arg.startsWith("--") || arg.startsWith("-")) {
      unknown.push(arg);
      continue;
    }
    if (isAddableCategory(arg)) {
      if (category === undefined) {
        category = arg;
      } else {
        unknown.push(arg);
      }
    } else {
      unknown.push(arg);
    }
  }
  const base: { help?: boolean; dryRun: boolean; unknown: string[] } = {
    dryRun,
    unknown,
  };
  if (help) base.help = true;
  return category !== undefined ? { ...base, category } : base;
}

/**
 * Parse argv after `update`. Only `--dry-run` and its `=true` / `=false`
 * forms are allowed; any other token is unknown.
 */
export function parseUpdateArgs(args: readonly string[]): {
  dryRun: boolean;
  unknown: string[];
} {
  let dryRun = false;
  const unknown: string[] = [];
  for (const arg of args) {
    if (arg === "--dry-run" || arg === "--dry-run=true") {
      dryRun = true;
    } else if (arg === "--dry-run=false") {
      dryRun = false;
    } else {
      unknown.push(arg);
    }
  }
  return { dryRun, unknown };
}

/**
 * Parse the argv slice after the `component` command word. The first
 * positional is the component name. `--dry-run` is allowed in any order
 * with the name.
 */
export function parseComponentArgs(args: readonly string[]): {
  name?: string;
  dryRun: boolean;
  unknown: string[];
} {
  let name: string | undefined;
  let dryRun = false;
  const unknown: string[] = [];
  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      unknown.push(arg);
      continue;
    }
    if (arg === "--dry-run" || arg === "--dry-run=true") {
      dryRun = true;
      continue;
    }
    if (arg === "--dry-run=false") {
      dryRun = false;
      continue;
    }
    if (arg.startsWith("--") || arg.startsWith("-")) {
      unknown.push(arg);
      continue;
    }
    if (name === undefined) {
      name = arg;
    } else {
      unknown.push(arg);
    }
  }
  return name !== undefined ? { name, dryRun, unknown } : { dryRun, unknown };
}

/**
 * Pure routing core extracted from `main()` for testability. Returns an
 * exit code instead of calling `process.exit`, and accepts an explicit
 * `argv` slice (already stripped of `node` + script path) so tests can
 * drive routing without mutating `process.argv`. `main()` remains the
 * thin `process.argv` / `process.exit` shim the CLI binary uses.
 */
export async function runCli(args: readonly string[]): Promise<number> {
  const command = args[0];

  if (command === "--help" || command === "-h") {
    // Plain stdout print: help text is structural CLI output, not user-
    // facing narrative. Every CLI does it this way so pipes/grep work.
    process.stdout.write(`${HELP_TEXT}\n`);
    return 0;
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
    return 0;
  }

  if (!command) {
    p.intro("◆  quieto-tokens");
    p.log.error("No command provided.");
    p.note(HELP_TEXT.trim(), "Usage");
    p.outro("Run `quieto-tokens --help` for more.");
    return 1;
  }

  switch (command) {
    case "init": {
      const { advanced, dryRun, unknown } = parseInitArgs(args.slice(1));
      if (unknown.length > 0) {
        p.intro("◆  quieto-tokens");
        p.log.error(`Unknown option(s) for init: ${unknown.join(", ")}`);
        p.note(HELP_TEXT.trim(), "Usage");
        p.outro("Fix the options and re-run.");
        return 1;
      }
      await initCommand({ advanced, dryRun });
      const initExit = process.exitCode;
      process.exitCode = undefined;
      return typeof initExit === "number" ? initExit : 0;
    }
    case "add": {
      const parsed = parseAddArgs(args.slice(1));
      if (parsed.help) {
        // `quieto-tokens add --help` prints help like the global `--help`
        // does; unknown args alongside `--help` are ignored because the
        // user just wanted docs.
        process.stdout.write(`${HELP_TEXT}\n`);
        return 0;
      }
      if (parsed.unknown.length > 0) {
        p.intro("◆  quieto-tokens");
        p.log.error(
          `Unknown argument(s) for add: ${parsed.unknown.join(", ")}`,
        );
        p.note(
          `Supported categories: ${ADDABLE_CATEGORIES.join(", ")}`,
          "Usage",
        );
        p.note(HELP_TEXT.trim(), "Help");
        p.outro("Fix the options and re-run.");
        return 1;
      }
      await addCommand({ category: parsed.category, dryRun: parsed.dryRun });
      const addExit = process.exitCode;
      process.exitCode = undefined;
      return typeof addExit === "number" ? addExit : 0;
    }
    case "update": {
      const { dryRun, unknown } = parseUpdateArgs(args.slice(1));
      if (unknown.length > 0) {
        p.intro("◆  quieto-tokens");
        p.log.error(`Unknown argument(s) for update: ${unknown.join(", ")}`);
        p.note(HELP_TEXT.trim(), "Usage");
        p.outro("Only `--dry-run` (and optional `=true` / `=false`) is valid besides bare `update`.");
        return 1;
      }
      await updateCommand({ dryRun });
      const updateExit = process.exitCode;
      process.exitCode = undefined;
      return typeof updateExit === "number" ? updateExit : 0;
    }
    case "component": {
      const parsed = parseComponentArgs(args.slice(1));
      if (parsed.unknown.length > 0) {
        p.intro("◆  quieto-tokens");
        p.log.error(
          `Unknown argument(s) for component: ${parsed.unknown.join(", ")}`,
        );
        p.note(HELP_TEXT.trim(), "Usage");
        p.outro("Fix the options and re-run.");
        return 1;
      }
      if (!parsed.name) {
        p.intro("◆  quieto-tokens");
        p.log.error("A component name is required.");
        p.note(HELP_TEXT.trim(), "Usage");
        p.outro(
          'Run `quieto-tokens component <name>` (e.g., "quieto-tokens component button").',
        );
        return 1;
      }
      const nameError = validateComponentName(parsed.name);
      if (nameError) {
        p.intro("◆  quieto-tokens");
        p.log.error(nameError);
        p.note(HELP_TEXT.trim(), "Usage");
        p.outro("Fix the component name and re-run.");
        return 1;
      }
      await componentCommand({ name: parsed.name, dryRun: parsed.dryRun });
      const componentExit = process.exitCode;
      process.exitCode = undefined;
      return typeof componentExit === "number" ? componentExit : 0;
    }
    default:
      p.intro("◆  quieto-tokens");
      p.log.error(`Unknown command: ${command}`);
      p.note(HELP_TEXT.trim(), "Usage");
      p.outro("Run `quieto-tokens --help` for more.");
      return 1;
  }
}

async function main(): Promise<void> {
  const code = await runCli(process.argv.slice(2));
  process.exit(code);
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

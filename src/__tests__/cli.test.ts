import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the command entrypoints so `runCli` exercises *only* its routing
// logic — we assert that (a) it calls the right command with the right
// options and (b) it reports the right exit code + p.log.error output
// for each unhappy-path branch. Actually running init/add would pull in
// the full pipeline + filesystem, which is out of scope for a CLI
// routing test and is covered by the pipeline E2E in add.test.ts.
vi.mock("../commands/init.js", () => ({
  initCommand: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../commands/add.js", () => ({
  addCommand: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../commands/component.js", () => ({
  componentCommand: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../commands/update.js", () => ({
  updateCommand: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn(),
  note: vi.fn(),
  isCancel: vi.fn(() => false),
  log: {
    step: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  },
  text: vi.fn(),
  select: vi.fn(),
  confirm: vi.fn(),
}));

import * as p from "@clack/prompts";
import {
  parseAddArgs,
  parseComponentArgs,
  parseInitArgs,
  parseUpdateArgs,
  runCli,
} from "../cli.js";
import { initCommand } from "../commands/init.js";
import { addCommand } from "../commands/add.js";
import { componentCommand } from "../commands/component.js";
import { updateCommand } from "../commands/update.js";

describe("parseInitArgs", () => {
  it("returns advanced=false and no unknowns for an empty arg list", () => {
    expect(parseInitArgs([])).toEqual({ advanced: false, unknown: [] });
  });

  it("returns advanced=true when --advanced is present", () => {
    expect(parseInitArgs(["--advanced"])).toEqual({
      advanced: true,
      unknown: [],
    });
  });

  it("collects unknown flags into the unknown list", () => {
    expect(parseInitArgs(["--fancy", "--advanced", "positional"])).toEqual({
      advanced: true,
      unknown: ["--fancy", "positional"],
    });
  });

  it("is idempotent across repeated --advanced flags", () => {
    expect(parseInitArgs(["--advanced", "--advanced"])).toEqual({
      advanced: true,
      unknown: [],
    });
  });

  it("accepts --advanced=true as equivalent to --advanced", () => {
    expect(parseInitArgs(["--advanced=true"])).toEqual({
      advanced: true,
      unknown: [],
    });
  });

  it("accepts --advanced=false to explicitly opt out", () => {
    expect(parseInitArgs(["--advanced=false"])).toEqual({
      advanced: false,
      unknown: [],
    });
  });

  it("honours the last --advanced=* wins in a value-flag sequence", () => {
    expect(parseInitArgs(["--advanced=true", "--advanced=false"])).toEqual({
      advanced: false,
      unknown: [],
    });
  });

  it("rejects unsupported short flags like -a as unknown", () => {
    expect(parseInitArgs(["-a"])).toEqual({
      advanced: false,
      unknown: ["-a"],
    });
  });
});

describe("parseAddArgs", () => {
  it("returns an empty result for no args (category is prompted interactively)", () => {
    expect(parseAddArgs([])).toEqual({ unknown: [] });
  });

  it("recognises the three addable categories as positional args", () => {
    expect(parseAddArgs(["shadow"])).toEqual({
      category: "shadow",
      unknown: [],
    });
    expect(parseAddArgs(["border"])).toEqual({
      category: "border",
      unknown: [],
    });
    expect(parseAddArgs(["animation"])).toEqual({
      category: "animation",
      unknown: [],
    });
  });

  it("collects unknown positionals into the unknown list", () => {
    expect(parseAddArgs(["typography"])).toEqual({
      unknown: ["typography"],
    });
    expect(parseAddArgs(["shadow", "extra"])).toEqual({
      category: "shadow",
      unknown: ["extra"],
    });
  });

  it("collects flags into the unknown list", () => {
    expect(parseAddArgs(["--dry-run"])).toEqual({
      unknown: ["--dry-run"],
    });
    expect(parseAddArgs(["-x"])).toEqual({
      unknown: ["-x"],
    });
    expect(parseAddArgs(["shadow", "--advanced"])).toEqual({
      category: "shadow",
      unknown: ["--advanced"],
    });
  });

  it("rejects a second category as unknown rather than silently overwriting the first", () => {
    expect(parseAddArgs(["shadow", "border"])).toEqual({
      category: "shadow",
      unknown: ["border"],
    });
  });
});

describe("parseUpdateArgs", () => {
  it("returns no unknowns for an empty arg list", () => {
    expect(parseUpdateArgs([])).toEqual({ unknown: [] });
  });

  it("treats any token as unknown (flags and positionals)", () => {
    expect(parseUpdateArgs(["--dry-run"])).toEqual({ unknown: ["--dry-run"] });
    expect(parseUpdateArgs(["foo"])).toEqual({ unknown: ["foo"] });
  });
});

describe("parseComponentArgs", () => {
  it("returns no name for an empty arg list", () => {
    expect(parseComponentArgs([])).toEqual({ unknown: [] });
  });

  it("captures the first positional as the component name", () => {
    expect(parseComponentArgs(["button"])).toEqual({
      name: "button",
      unknown: [],
    });
  });

  it("collects a second positional as unknown", () => {
    expect(parseComponentArgs(["button", "extra"])).toEqual({
      name: "button",
      unknown: ["extra"],
    });
  });

  it("collects flags as unknown", () => {
    expect(parseComponentArgs(["button", "--dry-run"])).toEqual({
      name: "button",
      unknown: ["--dry-run"],
    });
    expect(parseComponentArgs(["-x"])).toEqual({
      unknown: ["-x"],
    });
  });

  it("treats --help/-h as unknown (routing handles help at the top level)", () => {
    expect(parseComponentArgs(["--help"])).toEqual({
      unknown: ["--help"],
    });
    expect(parseComponentArgs(["-h"])).toEqual({
      unknown: ["-h"],
    });
  });
});

/**
 * End-to-end routing coverage for Story 2.4 AC #4 / Task 2. `runCli` is
 * the pure core extracted from `main()` so tests can assert exit codes
 * and command dispatch without mutating `process.argv` or shelling out
 * to a subprocess.
 *
 * We deliberately test only the routing surface — unknown args, menu
 * fallthrough, and happy-path dispatch — because the command bodies
 * themselves are covered by their own unit + integration tests.
 */
describe("runCli — routing (AC #4)", () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stdoutBuffer: string;

  beforeEach(() => {
    vi.clearAllMocks();
    stdoutBuffer = "";
    stdoutSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((chunk: unknown) => {
        stdoutBuffer += typeof chunk === "string" ? chunk : String(chunk);
        return true;
      });
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
  });

  it("returns 0 and prints help text for `--help`", async () => {
    const code = await runCli(["--help"]);
    expect(code).toBe(0);
    expect(stdoutBuffer).toMatch(/quieto-tokens/);
    expect(stdoutBuffer).toMatch(/Commands:/);
  });

  it("returns 1 and logs an error when no command is provided", async () => {
    const code = await runCli([]);
    expect(code).toBe(1);
    expect(vi.mocked(p.log.error)).toHaveBeenCalledWith("No command provided.");
    expect(initCommand).not.toHaveBeenCalled();
    expect(addCommand).not.toHaveBeenCalled();
  });

  it("returns 1 and lists the unknown command when one is passed", async () => {
    const code = await runCli(["bogus"]);
    expect(code).toBe(1);
    expect(vi.mocked(p.log.error)).toHaveBeenCalledWith(
      expect.stringContaining("Unknown command: bogus"),
    );
  });

  describe("add routing", () => {
    it("dispatches to addCommand with the parsed category on the happy path (`add shadow`)", async () => {
      const code = await runCli(["add", "shadow"]);
      expect(code).toBe(0);
      expect(addCommand).toHaveBeenCalledTimes(1);
      expect(addCommand).toHaveBeenCalledWith({ category: "shadow" });
    });

    it("dispatches to addCommand WITHOUT a category when the user invoked `add` bare (menu flow)", async () => {
      const code = await runCli(["add"]);
      expect(code).toBe(0);
      expect(addCommand).toHaveBeenCalledTimes(1);
      // category is omitted from the options object so that `addCommand`
      // knows to prompt the interactive menu.
      expect(addCommand).toHaveBeenCalledWith({});
    });

    it("returns 1 and reports the unknown category as non-zero exit (`add bogus`)", async () => {
      const code = await runCli(["add", "bogus"]);
      expect(code).toBe(1);
      expect(vi.mocked(p.log.error)).toHaveBeenCalledWith(
        expect.stringContaining("Unknown argument(s) for add"),
      );
      expect(vi.mocked(p.log.error)).toHaveBeenCalledWith(
        expect.stringContaining("bogus"),
      );
      expect(vi.mocked(p.note)).toHaveBeenCalledWith(
        expect.stringContaining("@quieto/tokens"),
        "Help",
      );
      expect(vi.mocked(p.intro)).toHaveBeenCalledWith("◆  quieto-tokens");
      expect(vi.mocked(p.outro)).toHaveBeenCalledWith(
        "Fix the options and re-run.",
      );
      expect(addCommand).not.toHaveBeenCalled();
    });

    it("returns 1 when addCommand sets process.exitCode and returns normally", async () => {
      const prior = process.exitCode;
      process.exitCode = undefined;
      vi.mocked(addCommand).mockImplementationOnce(async () => {
        process.exitCode = 1;
      });
      const code = await runCli(["add", "shadow"]);
      expect(code).toBe(1);
      expect(process.exitCode).toBeUndefined();
      process.exitCode = prior;
    });

    it("returns 1 and reports unknown flags on `add` (`add shadow --dry-run`)", async () => {
      const code = await runCli(["add", "shadow", "--dry-run"]);
      expect(code).toBe(1);
      expect(vi.mocked(p.log.error)).toHaveBeenCalledWith(
        expect.stringContaining("--dry-run"),
      );
      expect(addCommand).not.toHaveBeenCalled();
    });

    it("returns 0 and prints help for `add --help` without invoking addCommand", async () => {
      const code = await runCli(["add", "--help"]);
      expect(code).toBe(0);
      expect(stdoutBuffer).toMatch(/quieto-tokens/);
      expect(addCommand).not.toHaveBeenCalled();
    });
  });

  describe("component routing", () => {
    it("dispatches to componentCommand with the parsed name on happy path (`component button`)", async () => {
      const code = await runCli(["component", "button"]);
      expect(code).toBe(0);
      expect(componentCommand).toHaveBeenCalledTimes(1);
      expect(componentCommand).toHaveBeenCalledWith({ name: "button" });
    });

    it("returns 1 when no component name is provided (`component`)", async () => {
      const code = await runCli(["component"]);
      expect(code).toBe(1);
      expect(vi.mocked(p.log.error)).toHaveBeenCalledWith(
        "A component name is required.",
      );
      expect(componentCommand).not.toHaveBeenCalled();
    });

    it("returns 1 when the component name is invalid (`component Button`)", async () => {
      const code = await runCli(["component", "Button"]);
      expect(code).toBe(1);
      expect(vi.mocked(p.log.error)).toHaveBeenCalledWith(
        expect.stringContaining("lowercase kebab-case"),
      );
      expect(componentCommand).not.toHaveBeenCalled();
    });

    it("returns 1 when a reserved name is used (`component component`)", async () => {
      const code = await runCli(["component", "component"]);
      expect(code).toBe(1);
      expect(vi.mocked(p.log.error)).toHaveBeenCalledWith(
        expect.stringContaining("reserved"),
      );
      expect(componentCommand).not.toHaveBeenCalled();
    });

    it("returns 1 and reports unknown flags (`component button --dry-run`)", async () => {
      const code = await runCli(["component", "button", "--dry-run"]);
      expect(code).toBe(1);
      expect(vi.mocked(p.log.error)).toHaveBeenCalledWith(
        expect.stringContaining("--dry-run"),
      );
      expect(componentCommand).not.toHaveBeenCalled();
    });

    it("returns 1 when componentCommand sets process.exitCode", async () => {
      const prior = process.exitCode;
      process.exitCode = undefined;
      vi.mocked(componentCommand).mockImplementationOnce(async () => {
        process.exitCode = 1;
      });
      const code = await runCli(["component", "button"]);
      expect(code).toBe(1);
      expect(process.exitCode).toBeUndefined();
      process.exitCode = prior;
    });
  });

  describe("update routing", () => {
    it("dispatches to updateCommand on bare `update`", async () => {
      const code = await runCli(["update"]);
      expect(code).toBe(0);
      expect(updateCommand).toHaveBeenCalledTimes(1);
      expect(updateCommand).toHaveBeenCalledWith();
    });

    it("returns 1 and rejects unknown args (`update --dry-run`)", async () => {
      const code = await runCli(["update", "--dry-run"]);
      expect(code).toBe(1);
      expect(vi.mocked(p.log.error)).toHaveBeenCalledWith(
        expect.stringContaining("Unknown argument(s) for update"),
      );
      expect(updateCommand).not.toHaveBeenCalled();
    });
  });

  describe("init routing", () => {
    it("dispatches to initCommand with advanced=false on bare `init`", async () => {
      const code = await runCli(["init"]);
      expect(code).toBe(0);
      expect(initCommand).toHaveBeenCalledWith({ advanced: false });
    });

    it("dispatches to initCommand with advanced=true on `init --advanced`", async () => {
      const code = await runCli(["init", "--advanced"]);
      expect(code).toBe(0);
      expect(initCommand).toHaveBeenCalledWith({ advanced: true });
    });

    it("returns 1 and reports unknown flags on `init` (`init --bogus`)", async () => {
      const code = await runCli(["init", "--bogus"]);
      expect(code).toBe(1);
      expect(vi.mocked(p.log.error)).toHaveBeenCalledWith(
        expect.stringContaining("Unknown option(s) for init"),
      );
      expect(initCommand).not.toHaveBeenCalled();
    });
  });
});

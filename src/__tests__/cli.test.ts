import { describe, it, expect } from "vitest";
import { parseAddArgs, parseInitArgs } from "../cli.js";

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

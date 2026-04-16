import { describe, it, expect, vi, afterEach } from "vitest";
import { hexToRgb, hexToAnsi, supportsColor } from "../color-display.js";

describe("hexToRgb", () => {
  it("parses a 6-digit hex string", () => {
    expect(hexToRgb("#3B82F6")).toEqual({ r: 59, g: 130, b: 246 });
  });

  it("parses lowercase hex", () => {
    expect(hexToRgb("#ff0000")).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("parses hex without hash prefix", () => {
    expect(hexToRgb("00FF00")).toEqual({ r: 0, g: 255, b: 0 });
  });

  it("returns {0,0,0} for black", () => {
    expect(hexToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("returns {255,255,255} for white", () => {
    expect(hexToRgb("#FFFFFF")).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("expands 3-digit shorthand hex", () => {
    expect(hexToRgb("#f00")).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("throws on invalid hex", () => {
    expect(() => hexToRgb("not-a-color")).toThrow(/Invalid hex color/);
  });
});

describe("hexToAnsi", () => {
  it("produces ANSI 24-bit color escape sequence for a hex color", () => {
    const result = hexToAnsi("#FF0000");
    expect(result).toBe("\x1b[38;2;255;0;0m██\x1b[0m");
  });

  it("produces correct escape for blue", () => {
    const result = hexToAnsi("#0000FF");
    expect(result).toBe("\x1b[38;2;0;0;255m██\x1b[0m");
  });

  it("handles lowercase hex", () => {
    const result = hexToAnsi("#00ff00");
    expect(result).toBe("\x1b[38;2;0;255;0m██\x1b[0m");
  });
});

describe("supportsColor", () => {
  const originalEnv = process.env;
  const originalIsTTY = process.stdout.isTTY;

  afterEach(() => {
    process.env = originalEnv;
    Object.defineProperty(process.stdout, "isTTY", {
      value: originalIsTTY,
      writable: true,
      configurable: true,
    });
  });

  it("returns false when NO_COLOR is set", () => {
    process.env = { ...originalEnv, NO_COLOR: "1" };
    expect(supportsColor()).toBe(false);
  });

  it("returns true when FORCE_COLOR is set to a truthy value", () => {
    process.env = { ...originalEnv, FORCE_COLOR: "1", NO_COLOR: undefined };
    expect(supportsColor()).toBe(true);
  });

  it("returns false when FORCE_COLOR is 0", () => {
    process.env = {
      ...originalEnv,
      FORCE_COLOR: "0",
      NO_COLOR: undefined,
      COLORTERM: undefined,
      TERM: undefined,
    };
    Object.defineProperty(process.stdout, "isTTY", {
      value: true,
      writable: true,
      configurable: true,
    });
    expect(supportsColor()).toBe(false);
  });

  it("returns true when stdout is a TTY and COLORTERM is truecolor", () => {
    process.env = {
      ...originalEnv,
      NO_COLOR: undefined,
      FORCE_COLOR: undefined,
      COLORTERM: "truecolor",
      TERM: undefined,
    };
    Object.defineProperty(process.stdout, "isTTY", {
      value: true,
      writable: true,
      configurable: true,
    });
    expect(supportsColor()).toBe(true);
  });

  it("returns true when TERM indicates kitty (24-bit capable)", () => {
    process.env = {
      ...originalEnv,
      NO_COLOR: undefined,
      FORCE_COLOR: undefined,
      COLORTERM: undefined,
      TERM: "xterm-kitty",
    };
    Object.defineProperty(process.stdout, "isTTY", {
      value: true,
      writable: true,
      configurable: true,
    });
    expect(supportsColor()).toBe(true);
  });

  it("returns false when stdout is a TTY but no truecolor signal", () => {
    process.env = {
      ...originalEnv,
      NO_COLOR: undefined,
      FORCE_COLOR: undefined,
      COLORTERM: undefined,
      TERM: "dumb",
    };
    Object.defineProperty(process.stdout, "isTTY", {
      value: true,
      writable: true,
      configurable: true,
    });
    expect(supportsColor()).toBe(false);
  });

  it("returns false when stdout is not a TTY", () => {
    process.env = { ...originalEnv, NO_COLOR: undefined, FORCE_COLOR: undefined };
    Object.defineProperty(process.stdout, "isTTY", {
      value: false,
      writable: true,
      configurable: true,
    });
    expect(supportsColor()).toBe(false);
  });
});

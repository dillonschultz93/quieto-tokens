import { describe, it, expect } from "vitest";
import { validateComponentName } from "../validation.js";

describe("validateComponentName", () => {
  it("accepts valid lowercase kebab-case names", () => {
    expect(validateComponentName("button")).toBeUndefined();
    expect(validateComponentName("text-field")).toBeUndefined();
    expect(validateComponentName("dropdown-menu")).toBeUndefined();
    expect(validateComponentName("modal")).toBeUndefined();
    expect(validateComponentName("toast")).toBeUndefined();
    expect(validateComponentName("a")).toBeUndefined();
    expect(validateComponentName("card2")).toBeUndefined();
  });

  it("rejects empty or whitespace-only names", () => {
    expect(validateComponentName("")).toBeDefined();
    expect(validateComponentName("   ")).toBeDefined();
    expect(validateComponentName(undefined)).toBeDefined();
  });

  it("rejects uppercase characters", () => {
    expect(validateComponentName("Button")).toBeDefined();
    expect(validateComponentName("textField")).toBeDefined();
    expect(validateComponentName("MODAL")).toBeDefined();
  });

  it("rejects underscores", () => {
    expect(validateComponentName("button_primary")).toBeDefined();
  });

  it("rejects spaces", () => {
    expect(validateComponentName("button primary")).toBeDefined();
  });

  it("rejects leading digits", () => {
    expect(validateComponentName("2button")).toBeDefined();
  });

  it("rejects leading hyphens", () => {
    expect(validateComponentName("-button")).toBeDefined();
    expect(validateComponentName("---")).toBeDefined();
  });

  it("rejects names longer than 40 characters", () => {
    expect(validateComponentName("a".repeat(40))).toBeUndefined();
    expect(validateComponentName("a".repeat(41))).toBeDefined();
  });

  it("rejects all reserved names", () => {
    const reserved = [
      "color",
      "spacing",
      "typography",
      "shadow",
      "border",
      "animation",
      "primitive",
      "semantic",
      "component",
      "default",
    ];
    for (const name of reserved) {
      expect(validateComponentName(name)).toMatch(/reserved/i);
    }
  });

  it("trims whitespace before validating", () => {
    expect(validateComponentName("  button  ")).toBeUndefined();
  });
});

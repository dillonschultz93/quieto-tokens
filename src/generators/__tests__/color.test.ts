import { describe, it, expect } from "vitest";
import {
  hueNameFromAngle,
  generatePrimaryRamp,
  generateNeutralRamp,
  generateColorPrimitives,
} from "../color.js";
import type { ColorRamp } from "../color.js";

describe("hueNameFromAngle", () => {
  it("maps 0° to red", () => {
    expect(hueNameFromAngle(0)).toBe("red");
  });

  it("maps 230° to blue", () => {
    expect(hueNameFromAngle(230)).toBe("blue");
  });

  it("maps 150° to green", () => {
    expect(hueNameFromAngle(150)).toBe("green");
  });

  it("maps 350° to pink (OKLCH red wraps near 0°)", () => {
    expect(hueNameFromAngle(350)).toBe("pink");
  });

  it("maps 10° to red", () => {
    expect(hueNameFromAngle(10)).toBe("red");
  });

  it("normalizes negative angles", () => {
    expect(hueNameFromAngle(-10)).toBe("pink");
  });

  it("normalizes angles above 360", () => {
    expect(hueNameFromAngle(590)).toBe("blue");
  });
});

describe("generatePrimaryRamp", () => {
  const BRAND_BLUE = "#3B82F6";
  let ramp: ColorRamp;

  it("returns a ColorRamp with the correct hue name", () => {
    ramp = generatePrimaryRamp(BRAND_BLUE);
    // #3B82F6 has OKLCH hue ~260° → blue
    expect(ramp.hue).toBe("blue");
  });

  it("generates 11 steps", () => {
    ramp = generatePrimaryRamp(BRAND_BLUE);
    expect(ramp.steps).toHaveLength(11);
  });

  it("produces valid hex values for every step", () => {
    ramp = generatePrimaryRamp(BRAND_BLUE);
    for (const step of ramp.steps) {
      expect(step.hex).toMatch(/^#[0-9a-fA-F]{6}$/i);
    }
  });

  it("uses the conventional step labels (50–950)", () => {
    ramp = generatePrimaryRamp(BRAND_BLUE);
    const labels = ramp.steps.map((s) => s.step);
    expect(labels).toEqual([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]);
  });

  it("names each step as color.<hue>.<step>", () => {
    ramp = generatePrimaryRamp(BRAND_BLUE);
    expect(ramp.steps[0]!.name).toBe("color.blue.50");
    expect(ramp.steps[10]!.name).toBe("color.blue.950");
  });

  it("throws on an invalid hex", () => {
    expect(() => generatePrimaryRamp("not-a-color")).toThrow();
  });

  it("works with a red brand color", () => {
    // #E53E3E has OKLCH hue ~26° → red
    const ramp = generatePrimaryRamp("#E53E3E");
    expect(ramp.hue).toBe("red");
    expect(ramp.steps).toHaveLength(11);
  });

  it("works with a green brand color", () => {
    // #38A169 has OKLCH hue ~156° → green
    const ramp = generatePrimaryRamp("#38A169");
    expect(ramp.hue).toBe("green");
    expect(ramp.steps).toHaveLength(11);
  });
});

describe("generateNeutralRamp", () => {
  it("returns a ramp with hue 'neutral'", () => {
    const ramp = generateNeutralRamp("#3B82F6");
    expect(ramp.hue).toBe("neutral");
  });

  it("generates 11 steps", () => {
    const ramp = generateNeutralRamp("#3B82F6");
    expect(ramp.steps).toHaveLength(11);
  });

  it("names steps as color.neutral.<step>", () => {
    const ramp = generateNeutralRamp("#3B82F6");
    expect(ramp.steps[0]!.name).toBe("color.neutral.50");
    expect(ramp.steps[5]!.name).toBe("color.neutral.500");
  });

  it("produces low-saturation colors (near-gray)", () => {
    const ramp = generateNeutralRamp("#3B82F6");
    for (const step of ramp.steps) {
      expect(step.hex).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

describe("generateColorPrimitives", () => {
  it("returns exactly two ramps (primary + neutral)", () => {
    const ramps = generateColorPrimitives("#3B82F6");
    expect(ramps).toHaveLength(2);
  });

  it("first ramp is the primary hue, second is neutral", () => {
    const ramps = generateColorPrimitives("#3B82F6");
    // #3B82F6 has OKLCH hue ~260° → blue
    expect(ramps[0]!.hue).toBe("blue");
    expect(ramps[1]!.hue).toBe("neutral");
  });

  it("produces 22 total color primitives (11 + 11)", () => {
    const ramps = generateColorPrimitives("#3B82F6");
    const total = ramps.reduce((sum, r) => sum + r.steps.length, 0);
    expect(total).toBe(22);
  });
});

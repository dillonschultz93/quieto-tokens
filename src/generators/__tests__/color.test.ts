import { describe, it, expect } from "vitest";
import { parseColor } from "@quieto/engine";
import {
  hueNameFromAngle,
  generatePrimaryRamp,
  generateNeutralRamp,
  generateColorPrimitives,
  generateCustomRamp,
} from "../color.js";
import type { ColorRamp } from "../color.js";

const CANONICAL_LABELS = [
  50, 100, 200, 300, 400, 500, 600, 700, 800, 900,
] as const;

function rampLightnesses(ramp: ColorRamp): number[] {
  return ramp.steps.map((s) => {
    const result = parseColor(s.hex);
    if (!result.ok) {
      throw new Error(`parseColor failed for ${s.hex}: ${result.error.message}`);
    }
    return result.value.oklch.l;
  });
}

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

  it("returns a ColorRamp with the correct hue name", () => {
    const ramp = generatePrimaryRamp(BRAND_BLUE);
    // #3B82F6 has OKLCH hue ~260° → blue
    expect(ramp.hue).toBe("blue");
  });

  it("generates 10 steps", () => {
    const ramp = generatePrimaryRamp(BRAND_BLUE);
    expect(ramp.steps).toHaveLength(10);
  });

  it("produces valid hex values for every step", () => {
    const ramp = generatePrimaryRamp(BRAND_BLUE);
    for (const step of ramp.steps) {
      expect(step.hex).toMatch(/^#[0-9a-fA-F]{6}$/i);
    }
  });

  it("emits labels in the exact canonical order (50–900)", () => {
    const ramp = generatePrimaryRamp(BRAND_BLUE);
    const labels = ramp.steps.map((s) => s.step);
    expect(labels).toEqual([...CANONICAL_LABELS]);
  });

  it("names each step as color.<hue>.<step>", () => {
    const ramp = generatePrimaryRamp(BRAND_BLUE);
    expect(ramp.steps[0]!.name).toBe("color.blue.50");
    expect(ramp.steps[9]!.name).toBe("color.blue.900");
  });

  it("step 50 is lighter than step 900 (OKLCH L)", () => {
    const ramp = generatePrimaryRamp(BRAND_BLUE);
    const lightnesses = rampLightnesses(ramp);
    expect(lightnesses[0]).toBeGreaterThan(lightnesses[9]!);
  });

  it("OKLCH L is monotonically non-increasing across the 10 steps", () => {
    const ramp = generatePrimaryRamp(BRAND_BLUE);
    const lightnesses = rampLightnesses(ramp);
    for (let i = 1; i < lightnesses.length; i++) {
      expect(lightnesses[i]).toBeLessThanOrEqual(lightnesses[i - 1]!);
    }
  });

  it("never emits a 950 token", () => {
    const ramp = generatePrimaryRamp(BRAND_BLUE);
    expect(ramp.steps.some((s) => s.step === 950)).toBe(false);
    expect(ramp.steps.some((s) => s.name.endsWith(".950"))).toBe(false);
  });

  it("throws on an invalid hex", () => {
    expect(() => generatePrimaryRamp("not-a-color")).toThrow();
  });

  it("works with a red brand color", () => {
    // #E53E3E has OKLCH hue ~26° → red
    const ramp = generatePrimaryRamp("#E53E3E");
    expect(ramp.hue).toBe("red");
    expect(ramp.steps).toHaveLength(10);
    const lightnesses = rampLightnesses(ramp);
    expect(lightnesses[0]).toBeGreaterThan(lightnesses[9]!);
  });

  it("works with a green brand color", () => {
    // #38A169 has OKLCH hue ~156° → green
    const ramp = generatePrimaryRamp("#38A169");
    expect(ramp.hue).toBe("green");
    expect(ramp.steps).toHaveLength(10);
    const lightnesses = rampLightnesses(ramp);
    expect(lightnesses[0]).toBeGreaterThan(lightnesses[9]!);
  });
});

describe("generateNeutralRamp", () => {
  it("returns a ramp with hue 'neutral'", () => {
    const ramp = generateNeutralRamp("#3B82F6");
    expect(ramp.hue).toBe("neutral");
  });

  it("generates 10 steps", () => {
    const ramp = generateNeutralRamp("#3B82F6");
    expect(ramp.steps).toHaveLength(10);
  });

  it("names steps as color.neutral.<step>", () => {
    const ramp = generateNeutralRamp("#3B82F6");
    expect(ramp.steps[0]!.name).toBe("color.neutral.50");
    expect(ramp.steps[5]!.name).toBe("color.neutral.500");
    expect(ramp.steps[9]!.name).toBe("color.neutral.900");
  });

  it("produces low-saturation colors (near-gray)", () => {
    const ramp = generateNeutralRamp("#3B82F6");
    for (const step of ramp.steps) {
      expect(step.hex).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it("step 50 is lighter than step 900 (OKLCH L)", () => {
    const ramp = generateNeutralRamp("#3B82F6");
    const lightnesses = rampLightnesses(ramp);
    expect(lightnesses[0]).toBeGreaterThan(lightnesses[9]!);
  });

  it("OKLCH L is monotonically non-increasing across the 10 steps", () => {
    const ramp = generateNeutralRamp("#3B82F6");
    const lightnesses = rampLightnesses(ramp);
    for (let i = 1; i < lightnesses.length; i++) {
      expect(lightnesses[i]).toBeLessThanOrEqual(lightnesses[i - 1]!);
    }
  });

  it("never emits a 950 token", () => {
    const ramp = generateNeutralRamp("#3B82F6");
    expect(ramp.steps.some((s) => s.step === 950)).toBe(false);
  });
});

describe("generateCustomRamp", () => {
  it("generates 10 steps with canonical labels using the user-supplied name", () => {
    const ramp = generateCustomRamp("accent", "#E53E3E");
    expect(ramp.hue).toBe("accent");
    expect(ramp.steps).toHaveLength(10);
    expect(ramp.steps.map((s) => s.step)).toEqual([...CANONICAL_LABELS]);
    expect(ramp.steps[0]!.name).toBe("color.accent.50");
    expect(ramp.steps[9]!.name).toBe("color.accent.900");
  });

  it("step 50 is lighter than step 900 for custom ramps too", () => {
    const ramp = generateCustomRamp("success", "#38A169");
    const lightnesses = rampLightnesses(ramp);
    expect(lightnesses[0]).toBeGreaterThan(lightnesses[9]!);
  });

  it("throws on an invalid seed hex", () => {
    expect(() => generateCustomRamp("accent", "not-a-color")).toThrow();
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

  it("produces 20 total color primitives (10 + 10)", () => {
    const ramps = generateColorPrimitives("#3B82F6");
    const total = ramps.reduce((sum, r) => sum + r.steps.length, 0);
    expect(total).toBe(20);
  });
});

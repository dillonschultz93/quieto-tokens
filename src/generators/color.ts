import { parseColor, generateRamp } from "@quieto/engine";
import type { Ramp, RampStep } from "@quieto/engine";

export interface ColorPrimitive {
  name: string;
  step: number;
  hex: string;
}

export interface ColorRamp {
  hue: string;
  steps: ColorPrimitive[];
}

const STEP_LABELS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

const RAMP_STEPS = STEP_LABELS.length;

const RAMP_CONFIG = {
  range: { min: 0.05, max: 0.97 },
  distribution: "eased" as const,
};

const HUE_NAMES: Array<{ min: number; max: number; name: string }> = [
  { min: 0, max: 40, name: "red" },
  { min: 40, max: 60, name: "orange" },
  { min: 60, max: 90, name: "yellow" },
  { min: 90, max: 130, name: "lime" },
  { min: 130, max: 170, name: "green" },
  { min: 170, max: 200, name: "teal" },
  { min: 200, max: 230, name: "cyan" },
  { min: 230, max: 270, name: "blue" },
  { min: 270, max: 300, name: "violet" },
  { min: 300, max: 330, name: "purple" },
  { min: 330, max: 360, name: "pink" },
];

export function hueNameFromAngle(hueAngle: number): string {
  const normalized = ((hueAngle % 360) + 360) % 360;
  const match = HUE_NAMES.find(
    (entry) => normalized >= entry.min && normalized < entry.max,
  );
  return match?.name ?? "gray";
}

function engineRampToColorRamp(ramp: Ramp, hueName: string): ColorRamp {
  if (ramp.steps.length !== STEP_LABELS.length) {
    throw new Error(
      `Expected ${STEP_LABELS.length} steps from engine, got ${ramp.steps.length}`,
    );
  }

  const steps: ColorPrimitive[] = ramp.steps.map(
    (step: RampStep, index: number) => ({
      name: `color.${hueName}.${STEP_LABELS[index]}`,
      step: STEP_LABELS[index]!,
      hex: step.hex,
    }),
  );
  return { hue: hueName, steps };
}

export function generatePrimaryRamp(brandHex: string): ColorRamp {
  const parsed = parseColor(brandHex);
  if (!parsed.ok) {
    throw new Error(
      `Failed to parse brand color "${brandHex}": ${parsed.error.message}`,
    );
  }

  const { oklch } = parsed.value;
  const hueName = hueNameFromAngle(oklch.h);

  const result = generateRamp({
    seed: oklch,
    steps: RAMP_STEPS,
    ...RAMP_CONFIG,
    name: hueName,
  });

  if (!result.ok) {
    throw new Error(
      `Failed to generate primary ramp: ${result.error.message}`,
    );
  }

  return engineRampToColorRamp(result.value, hueName);
}

export function generateNeutralRamp(brandHex: string): ColorRamp {
  const parsed = parseColor(brandHex);
  if (!parsed.ok) {
    throw new Error(
      `Failed to parse brand color "${brandHex}": ${parsed.error.message}`,
    );
  }

  const neutralSeed = {
    l: parsed.value.oklch.l,
    c: 0.01,
    h: parsed.value.oklch.h,
  };

  const result = generateRamp({
    seed: neutralSeed,
    steps: RAMP_STEPS,
    ...RAMP_CONFIG,
    name: "neutral",
  });

  if (!result.ok) {
    throw new Error(
      `Failed to generate neutral ramp: ${result.error.message}`,
    );
  }

  return engineRampToColorRamp(result.value, "neutral");
}

export function generateColorPrimitives(brandHex: string): ColorRamp[] {
  const primary = generatePrimaryRamp(brandHex);
  const neutral = generateNeutralRamp(brandHex);
  return [primary, neutral];
}

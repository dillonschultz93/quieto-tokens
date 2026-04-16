import type { ColorRamp } from "../generators/color.js";

export interface PrimitiveToken {
  tier: "primitive";
  category: string;
  name: string;
  $type: string;
  $value: string;
  path: string[];
}

export function colorRampToTokens(ramp: ColorRamp): PrimitiveToken[] {
  return ramp.steps.map((step) => ({
    tier: "primitive" as const,
    category: "color",
    name: step.name,
    $type: "color",
    $value: step.hex,
    path: ["color", ramp.hue, String(step.step)],
  }));
}

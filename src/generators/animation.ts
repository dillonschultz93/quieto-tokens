import type { PrimitiveToken } from "../types/tokens.js";
import type { AnimationCategoryConfig } from "../types/config.js";

export type EasingPreset = "standard" | "emphasized" | "decelerated";

/**
 * Map of preset → named bezier curves. The preset hides the raw four-number
 * cubic-bezier behind a semantic name because typing curves at a Clack text
 * prompt is user-hostile. Values are from Material 3 and Carbon's motion
 * specs (standard = spec defaults, emphasized = more dramatic, decelerated
 * = pure ease-out).
 */
const EASING_PRESETS: Record<
  EasingPreset,
  { enter: number[]; exit: number[]; default: number[] }
> = {
  standard: {
    enter: [0.4, 0, 0.2, 1],
    exit: [0.4, 0, 1, 1],
    default: [0.4, 0, 0.6, 1],
  },
  emphasized: {
    enter: [0.2, 0, 0, 1],
    exit: [0.3, 0, 0.8, 0.15],
    default: [0.2, 0, 0, 1],
  },
  decelerated: {
    enter: [0, 0, 0.2, 1],
    exit: [0.4, 0, 1, 1],
    default: [0, 0, 0.2, 1],
  },
};

export function generateAnimationPrimitives(
  input: AnimationCategoryConfig,
): PrimitiveToken[] {
  const durations = dedupeSorted(input.durations);
  const tokens: PrimitiveToken[] = [];

  for (const ms of durations) {
    tokens.push({
      tier: "primitive",
      category: "animation",
      name: `animation.duration.${ms}`,
      $type: "duration",
      $value: `${ms}ms`,
      path: ["animation", "duration", String(ms)],
    });
  }

  const preset = EASING_PRESETS[input.easing] ?? EASING_PRESETS.standard;
  for (const name of ["default", "enter", "exit"] as const) {
    const bezier = preset[name];
    tokens.push({
      tier: "primitive",
      category: "animation",
      name: `animation.easing.${name}`,
      $type: "cubicBezier",
      $value: JSON.stringify(bezier),
      path: ["animation", "easing", name],
    });
  }

  return tokens;
}

function dedupeSorted(values: number[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const v of values) {
    if (!Number.isFinite(v) || !Number.isInteger(v) || v <= 0) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out.sort((a, b) => a - b);
}

export { EASING_PRESETS as ANIMATION_EASING_PRESETS };

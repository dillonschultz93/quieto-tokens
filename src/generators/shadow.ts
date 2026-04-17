import type { PrimitiveToken } from "../types/tokens.js";
import type { ShadowCategoryConfig } from "../types/config.js";
import { DTCG_COLOR_REF_RE } from "../utils/defaults.js";

/**
 * Per-level offset/blur/spread tuples for the two elevation profiles.
 * Arrays are 1-indexed visually (position 0 → level 1, etc.) and the
 * generator clamps to the configured `levels` count, picking from the
 * start of the array so lower levels stay visually consistent across
 * different `levels` choices.
 *
 * Soft = subtle UI chrome (toasts, cards). Hard = chunky, crisper shadows
 * you'd find on buttons or decorative surfaces.
 */
const SOFT_PROFILE = [
  { offsetY: 1, blur: 2, spread: 0 },
  { offsetY: 2, blur: 4, spread: 0 },
  { offsetY: 4, blur: 8, spread: 0 },
  { offsetY: 8, blur: 16, spread: 0 },
  { offsetY: 12, blur: 24, spread: 0 },
  { offsetY: 20, blur: 40, spread: 0 },
] as const;

const HARD_PROFILE = [
  { offsetY: 1, blur: 0, spread: 0 },
  { offsetY: 2, blur: 2, spread: 0 },
  { offsetY: 4, blur: 4, spread: 1 },
  { offsetY: 6, blur: 6, spread: 1 },
  { offsetY: 8, blur: 10, spread: 2 },
  { offsetY: 12, blur: 14, spread: 3 },
] as const;

const MAX_LEVELS = 6;
const MIN_LEVELS = 2;

/**
 * Produce a ramp of `levels`-many elevation tokens. Each token carries a
 * DTCG-compliant `$type: "shadow"` and a JSON-stringified composite
 * object for `$value` — Style Dictionary v5's DTCG reader understands
 * both object-form and stringified-object-form values via its
 * `shadow/css/shorthand` transform (see Dev Notes for the fallback path
 * if SD ever changes that).
 */
export function generateShadowPrimitives(
  input: ShadowCategoryConfig,
): PrimitiveToken[] {
  const levels = clampLevels(input.levels);
  const profile = input.profile === "hard" ? HARD_PROFILE : SOFT_PROFILE;
  const colorRef = input.colorRef;
  if (typeof colorRef !== "string" || !DTCG_COLOR_REF_RE.test(colorRef)) {
    // Defence-in-depth: the prompt + schema validator already enforce
    // this shape, but a programmatic caller could still pass garbage.
    // Throwing here keeps the DTCG `$value` honest — Style Dictionary
    // would otherwise fail with a much less actionable error later.
    throw new Error(
      `generateShadowPrimitives: colorRef "${String(colorRef)}" is not a DTCG color reference (expected {color.<hue>.<step>})`,
    );
  }

  const tokens: PrimitiveToken[] = [];
  for (let i = 1; i <= levels; i++) {
    const step = profile[i - 1] ?? profile[profile.length - 1]!;
    const value = {
      color: colorRef,
      offsetX: "0px",
      offsetY: `${step.offsetY}px`,
      blur: `${step.blur}px`,
      spread: `${step.spread}px`,
    };
    tokens.push({
      tier: "primitive",
      category: "shadow",
      name: `shadow.elevation.${i}`,
      $type: "shadow",
      $value: JSON.stringify(value),
      path: ["shadow", "elevation", String(i)],
    });
  }
  return tokens;
}

function clampLevels(levels: number): number {
  if (!Number.isFinite(levels)) return 4;
  const rounded = Math.round(levels);
  if (rounded < MIN_LEVELS) return MIN_LEVELS;
  if (rounded > MAX_LEVELS) return MAX_LEVELS;
  return rounded;
}

export { MIN_LEVELS as SHADOW_MIN_LEVELS, MAX_LEVELS as SHADOW_MAX_LEVELS };

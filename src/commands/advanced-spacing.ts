import * as p from "@clack/prompts";
import type { AdvancedSpacingConfig } from "../types/config.js";
import type { PriorContext } from "./modify.js";
import { SPACING_RAMP_4, SPACING_RAMP_8 } from "../generators/spacing.js";

function handleCancel(value: unknown): asserts value is string | number | boolean {
  if (p.isCancel(value)) {
    p.cancel("Operation cancelled.");
    throw new Error("cancelled");
  }
}

/**
 * Validate a single spacing-override input line. Accepts `"space-4=20"` or
 * `"space-4 = 20"` or `"space-4:20"`. Returns the parsed pair or a
 * human-readable error.
 */
export function parseSpacingOverrideLine(
  line: string,
  allowedKeys: readonly string[],
): { ok: true; key: string; value: number } | { ok: false; error: string } {
  const trimmed = line.trim();
  if (!trimmed) return { ok: false, error: "Empty line" };

  const match = trimmed.match(/^([a-zA-Z0-9._-]+)\s*[:=]\s*(-?\d+(?:\.\d+)?)\s*(?:px)?$/);
  if (!match) {
    return {
      ok: false,
      error: `"${trimmed}" — expected "<token>=<pixels>" (e.g. "space-4=20")`,
    };
  }

  const key = match[1]!;
  const value = Number.parseFloat(match[2]!);
  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, error: `"${key}" must be a positive number.` };
  }
  if (!allowedKeys.includes(key)) {
    return {
      ok: false,
      error: `Unknown token "${key}". Pick one of: ${allowedKeys.join(", ")}`,
    };
  }
  return { ok: true, key, value };
}

/**
 * Walk the user through the advanced spacing step. Two-step UX:
 *  1. Show the current ramp values at their chosen base.
 *  2. Offer a single multi-line text input for overrides (`space-4=20`
 *     one per line) so power users can paste several at once without
 *     drilling through N prompts.
 *
 * A single prompt is deliberately chosen over per-step prompts — spacing
 * typically needs only a couple of overrides, and users would quickly tire
 * of answering "keep 4px? keep 8px? keep 12px?" for every step.
 */
export async function collectAdvancedSpacing(
  base: 4 | 8,
  priorContext: PriorContext | null,
): Promise<AdvancedSpacingConfig | undefined> {
  const ramp = base === 4 ? SPACING_RAMP_4 : SPACING_RAMP_8;
  const allowedKeys = ramp.map((v) => `space-${v}`);
  const prior = priorContext?.config.advanced?.spacing?.customValues ?? {};

  const priorSummary =
    Object.keys(prior).length > 0
      ? Object.entries(prior)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ")
      : "(none)";

  const wantsOverrides = await p.confirm({
    message: `Override specific spacing steps? Current ramp: ${ramp.join(", ")}px. Prior overrides: ${priorSummary}.`,
    initialValue: Object.keys(prior).length > 0,
  });
  handleCancel(wantsOverrides);

  if (!wantsOverrides && Object.keys(prior).length > 0) {
    return { customValues: {} };
  }
  if (!wantsOverrides) {
    return undefined;
  }

  const priorText = Object.entries(prior)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const raw = await p.text({
    message:
      "Enter overrides, one per line (e.g. space-4=20). Leave blank to skip.",
    placeholder: "space-4=20\nspace-8=18",
    initialValue: priorText,
    validate: (value) => {
      const lines = (value ?? "")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      if (lines.length === 0) return undefined;
      for (const line of lines) {
        const result = parseSpacingOverrideLine(line, allowedKeys);
        if (!result.ok) return result.error;
      }
      return undefined;
    },
  });
  handleCancel(raw);

  const customValues: Record<string, number> = {};
  const lines = String(raw)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  for (const line of lines) {
    const parsed = parseSpacingOverrideLine(line, allowedKeys);
    if (parsed.ok) {
      customValues[parsed.key] = parsed.value;
    }
  }

  if (Object.keys(customValues).length === 0) {
    return undefined;
  }

  return { customValues };
}

import * as p from "@clack/prompts";
import type { AdvancedColorConfig } from "../types/config.js";
import type { PriorContext } from "./modify.js";
import { normalizeHex } from "../utils/color.js";
import { validateHexColor } from "../utils/validation.js";

function handleCancel(value: unknown): asserts value is string | number | boolean {
  if (p.isCancel(value)) {
    p.cancel("Operation cancelled.");
    throw new Error("cancelled");
  }
}

/**
 * Validate that a proposed hue label is plausible. We keep the rules liberal
 * (any non-empty string, trimmed, ≤ 32 chars, slug-y) because the label is
 * what the user sees in their DTCG output — too-strict rules frustrate
 * rather than protect.
 */
export function validateHueName(
  value: string | undefined,
  existing: readonly string[] = [],
): string | undefined {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "Please enter a name for this hue.";
  if (trimmed.length > 32) return "Hue names must be 32 characters or fewer.";
  if (!/^[a-zA-Z][a-zA-Z0-9-]*$/.test(trimmed)) {
    return "Use letters, numbers, and hyphens only (must start with a letter).";
  }
  if (existing.includes(trimmed)) {
    return `"${trimmed}" is already defined. Pick a different name.`;
  }
  return undefined;
}

/**
 * Walk the user through the advanced color step:
 *  1. Ask whether they want additional hue ramps beyond the primary.
 *  2. For each additional hue, collect a name and a seed hex.
 *  3. Offer "Add another" until they say no.
 *
 * The return value is fed into the pipeline (Task 10) as extra seed inputs
 * for `@quieto/engine`'s ramp generator.
 *
 * `priorContext.config.advanced?.color.additionalHues` — when present —
 * is offered as the starting list so the user can keep, edit, or prune
 * previously-saved ramps instead of re-entering them.
 */
export async function collectAdvancedColor(
  priorContext: PriorContext | null,
): Promise<AdvancedColorConfig | undefined> {
  const prior = priorContext?.config.advanced?.color?.additionalHues ?? [];

  const wantsExtra = await p.confirm({
    message:
      prior.length > 0
        ? `Keep the ${prior.length} extra hue${prior.length === 1 ? "" : "s"} from your last run (accent, error, …)?`
        : "Add additional hue ramps beyond your primary brand color?",
    initialValue: prior.length > 0,
  });
  handleCancel(wantsExtra);

  if (!wantsExtra && prior.length > 0) {
    // User wants to drop prior extras — return an empty list so the pipeline
    // explicitly clears them instead of silently inheriting.
    return { additionalHues: [] };
  }
  if (!wantsExtra) {
    return undefined;
  }

  const hues: Array<{ name: string; seed: string }> = prior.length > 0
    ? prior.map((h) => ({ name: h.name, seed: h.seed }))
    : [];

  while (true) {
    const nameRaw = await p.text({
      message: `Name for hue #${hues.length + 1}:`,
      placeholder: hues.length === 0 ? "accent" : "error",
      validate: (v) => validateHueName(v, hues.map((h) => h.name)),
    });
    handleCancel(nameRaw);

    const seedRaw = await p.text({
      message: `Seed hex color for "${String(nameRaw).trim()}":`,
      placeholder: "#FF00AA",
      validate: validateHexColor,
    });
    handleCancel(seedRaw);

    hues.push({
      name: String(nameRaw).trim(),
      seed: normalizeHex(String(seedRaw).trim()),
    });

    const addAnother = await p.confirm({
      message: "Add another hue?",
      initialValue: false,
    });
    handleCancel(addAnother);
    if (!addAnother) break;
  }

  return { additionalHues: hues };
}

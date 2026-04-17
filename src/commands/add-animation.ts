import * as p from "@clack/prompts";
import type { AnimationCategoryConfig } from "../types/config.js";
import { DEFAULT_ANIMATION_CONFIG, INPUT_LIMITS } from "../utils/defaults.js";

function handleCancel(
  value: unknown,
): asserts value is string | number | boolean {
  if (p.isCancel(value)) {
    p.cancel("Operation cancelled.");
    throw new Error("cancelled");
  }
}

const DURATION_LIST_RE = /^\d+(\s*,\s*\d+)*$/;

export function validateDurationList(
  value: string | undefined,
): string | undefined {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "Please enter at least one duration.";
  if (!DURATION_LIST_RE.test(trimmed)) {
    return "Use comma-separated positive integers, e.g. 100,150,250,400.";
  }
  const parts = trimmed.split(",").map((s) => Number.parseInt(s.trim(), 10));
  if (parts.some((n) => !Number.isFinite(n) || n <= 0)) {
    return "Durations must be positive integers.";
  }
  if (parts.some((n) => n > INPUT_LIMITS.maxDurationMs)) {
    return `Each duration must be ≤ ${INPUT_LIMITS.maxDurationMs}ms.`;
  }
  if (parts.length > INPUT_LIMITS.maxEntries) {
    return `Please limit to ${INPUT_LIMITS.maxEntries} entries.`;
  }
  return undefined;
}

function parseList(value: string): number[] {
  return value
    .split(",")
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter(
      (n) => Number.isFinite(n) && n > 0 && n <= INPUT_LIMITS.maxDurationMs,
    );
}

export async function collectAnimationInputs(
  prior: AnimationCategoryConfig | undefined,
): Promise<AnimationCategoryConfig> {
  const priorDurations =
    prior?.durations?.join(",") ?? DEFAULT_ANIMATION_CONFIG.durations.join(",");

  const durationsRaw = await p.text({
    message: "Durations (comma-separated milliseconds):",
    placeholder: priorDurations,
    initialValue: priorDurations,
    validate: validateDurationList,
  });
  handleCancel(durationsRaw);

  const easingRaw = await p.select({
    message: "Easing preset?",
    options: [
      {
        value: "standard" as const,
        label: "Standard",
        hint: "Familiar material-style curves",
      },
      {
        value: "emphasized" as const,
        label: "Emphasized",
        hint: "More dramatic acceleration",
      },
      {
        value: "decelerated" as const,
        label: "Decelerated",
        hint: "Pure ease-out, settles softly",
      },
    ],
    initialValue: prior?.easing ?? DEFAULT_ANIMATION_CONFIG.easing,
  });
  handleCancel(easingRaw);

  return {
    durations: parseList(String(durationsRaw)),
    easing:
      easingRaw === "emphasized" || easingRaw === "decelerated"
        ? easingRaw
        : "standard",
  };
}

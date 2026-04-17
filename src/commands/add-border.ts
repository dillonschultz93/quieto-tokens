import * as p from "@clack/prompts";
import type { BorderCategoryConfig } from "../types/config.js";
import { DEFAULT_BORDER_CONFIG, INPUT_LIMITS } from "../utils/defaults.js";

function handleCancel(
  value: unknown,
): asserts value is string | number | boolean {
  if (p.isCancel(value)) {
    p.cancel("Operation cancelled.");
    throw new Error("cancelled");
  }
}

const WIDTH_LIST_RE = /^\d+(\s*,\s*\d+)*$/;

/**
 * Validate a comma-separated list of positive integers. Returns `undefined`
 * when valid or a human-readable error.
 *
 * Enforces the same caps the schema validator applies so the prompt and
 * hand-edited configs agree on what's in range: max
 * {@link INPUT_LIMITS.maxEntries} entries, each between `1` and
 * {@link INPUT_LIMITS.maxPixelSize} pixels.
 *
 * Exported so the unit tests can exercise it without mocking Clack.
 */
export function validateBorderList(
  value: string | undefined,
  label: "widths" | "radii",
): string | undefined {
  const trimmed = (value ?? "").trim();
  if (!trimmed)
    return `Please enter at least one ${label === "widths" ? "width" : "radius"}.`;
  if (!WIDTH_LIST_RE.test(trimmed)) {
    return "Use comma-separated positive integers, e.g. 1,2,4,8.";
  }
  const parts = trimmed.split(",").map((s) => Number.parseInt(s.trim(), 10));
  if (parts.some((n) => !Number.isFinite(n) || n <= 0)) {
    return "Entries must be positive integers.";
  }
  if (parts.some((n) => n > INPUT_LIMITS.maxPixelSize)) {
    return `Each entry must be ≤ ${INPUT_LIMITS.maxPixelSize}px.`;
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
      (n) => Number.isFinite(n) && n > 0 && n <= INPUT_LIMITS.maxPixelSize,
    );
}

export async function collectBorderInputs(
  prior: BorderCategoryConfig | undefined,
): Promise<BorderCategoryConfig> {
  const priorWidths =
    prior?.widths?.join(",") ?? DEFAULT_BORDER_CONFIG.widths.join(",");
  const priorRadii =
    prior?.radii?.join(",") ?? DEFAULT_BORDER_CONFIG.radii.join(",");

  const widthsRaw = await p.text({
    message: "Border widths (comma-separated pixels):",
    placeholder: priorWidths,
    initialValue: priorWidths,
    validate: (v) => validateBorderList(v, "widths"),
  });
  handleCancel(widthsRaw);

  const radiiRaw = await p.text({
    message: "Border radii (comma-separated pixels):",
    placeholder: priorRadii,
    initialValue: priorRadii,
    validate: (v) => validateBorderList(v, "radii"),
  });
  handleCancel(radiiRaw);

  // Opt-in pill prompt. AC #11 said "the pill step uses $value: '9999px'
  // regardless" but the previous implementation silently overwrote the
  // user's largest radius — a surprising side-effect for anyone typing
  // literal values like `2,4,8`. The explicit confirm makes the
  // overwrite visible and keeps the literal path honest when the user
  // declines.
  const pillRaw = await p.confirm({
    message:
      "Include a pill marker? (largest radius becomes 9999px for fully-rounded shapes)",
    initialValue: prior?.pill ?? DEFAULT_BORDER_CONFIG.pill,
  });
  handleCancel(pillRaw);

  return {
    widths: parseList(String(widthsRaw)),
    radii: parseList(String(radiiRaw)),
    pill: pillRaw === true,
  };
}

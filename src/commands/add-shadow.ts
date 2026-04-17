import * as p from "@clack/prompts";
import type { ShadowCategoryConfig } from "../types/config.js";
import {
  SHADOW_MAX_LEVELS,
  SHADOW_MIN_LEVELS,
} from "../generators/shadow.js";
import { DEFAULT_SHADOW_CONFIG, DTCG_COLOR_REF_RE } from "../utils/defaults.js";

// Re-export for modules that imported the regex from the shadow
// command before it moved. `src/generators/shadow.ts` keeps its own
// copy to stay self-contained; the schema validator imports from
// `utils/defaults.ts` directly.
export { DTCG_COLOR_REF_RE };

function handleCancel(
  value: unknown,
): asserts value is string | number | boolean {
  if (p.isCancel(value)) {
    p.cancel("Operation cancelled.");
    throw new Error("cancelled");
  }
}

export function validateShadowLevels(
  value: string | undefined,
): string | undefined {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "Please enter a number of elevation levels.";
  if (!/^\d+$/.test(trimmed)) return "Levels must be a whole number.";
  const n = Number.parseInt(trimmed, 10);
  if (n < SHADOW_MIN_LEVELS || n > SHADOW_MAX_LEVELS) {
    return `Levels must be between ${SHADOW_MIN_LEVELS} and ${SHADOW_MAX_LEVELS}.`;
  }
  return undefined;
}

/**
 * Validate a free-text DTCG color reference. When
 * {@link availableColorRefs} is provided (the normal case — pulled
 * from the loaded config's generated color primitives), the ref
 * must resolve to an existing color token. Without the whitelist
 * (only exercised by the unit tests that target the regex directly),
 * the check falls back to DTCG shape only.
 *
 * The strict-whitelist rule is D6 from the Story 2.2 code review:
 * a user who types `{color.emerald.500}` when the current config
 * only has neutral/blue would otherwise ship a dangling DTCG ref
 * through the generator and blow up Style Dictionary later.
 */
export function validateCustomColorRef(
  value: string | undefined,
  availableColorRefs?: readonly string[],
): string | undefined {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "Please enter a DTCG color reference.";
  if (!DTCG_COLOR_REF_RE.test(trimmed)) {
    return 'Use the form "{color.<hue>.<step>}" (e.g. {color.neutral.900}).';
  }
  if (availableColorRefs && availableColorRefs.length > 0) {
    if (!availableColorRefs.includes(trimmed)) {
      const hint = summarizeAvailableRefs(availableColorRefs);
      return `Reference must match an existing color token. ${hint}`;
    }
  }
  return undefined;
}

function summarizeAvailableRefs(refs: readonly string[]): string {
  if (refs.length <= 5) return `Available: ${refs.join(", ")}.`;
  const head = refs.slice(0, 5).join(", ");
  return `Available include: ${head} (+ ${refs.length - 5} more).`;
}

/**
 * Prompt the user for the three shadow inputs (levels, profile, color ref).
 * `prior` is the user's previously-saved choices (e.g. from a prior `add
 * shadow` run on the same config) — when present each prompt pre-fills with
 * it so re-authoring is fast.
 *
 * `availableColorRefs` is the list of color refs we know exist in the
 * current token tree (pulled from the loaded config's generated primitives).
 * It drives the color picker; "Custom" opens a free-text prompt guarded by
 * the DTCG ref regex and by the whitelist itself (see
 * {@link validateCustomColorRef}).
 */
export async function collectShadowInputs(
  prior: ShadowCategoryConfig | undefined,
  availableColorRefs: readonly string[],
): Promise<ShadowCategoryConfig> {
  const levelsRaw = await p.text({
    message: `How many elevation levels? (${SHADOW_MIN_LEVELS}-${SHADOW_MAX_LEVELS})`,
    placeholder: String(prior?.levels ?? DEFAULT_SHADOW_CONFIG.levels),
    initialValue: String(prior?.levels ?? DEFAULT_SHADOW_CONFIG.levels),
    validate: validateShadowLevels,
  });
  handleCancel(levelsRaw);
  const levels = Number.parseInt(String(levelsRaw).trim(), 10);

  const profileRaw = await p.select({
    message: "Shadow profile?",
    options: [
      {
        value: "soft" as const,
        label: "Soft",
        hint: "Airy blur, subtle UI chrome",
      },
      {
        value: "hard" as const,
        label: "Hard",
        hint: "Crisp, chunky shadows for buttons",
      },
    ],
    initialValue: prior?.profile ?? DEFAULT_SHADOW_CONFIG.profile,
  });
  handleCancel(profileRaw);

  const priorRef = prior?.colorRef ?? DEFAULT_SHADOW_CONFIG.colorRef;
  // Build the picker list: always include the prior selection and the
  // default. We only offer "Custom…" when the whitelist contains at
  // least one entry we can validate against, so the user can't end up
  // in a free-text dead-end for an empty token system.
  const pickerRefs = dedupeColorRefs(
    [priorRef, DEFAULT_SHADOW_CONFIG.colorRef, ...availableColorRefs].filter(
      (ref): ref is string =>
        typeof ref === "string" && availableColorRefs.includes(ref),
    ),
  );
  // If the prior ref isn't in `availableColorRefs` (e.g. the user
  // hand-edited the config and the hue is gone), fall back to the
  // full availableColorRefs list so the picker never comes up empty.
  const uniqueRefs =
    pickerRefs.length > 0 ? pickerRefs : dedupeColorRefs(availableColorRefs);

  const colorOptions: Array<{ value: string; label: string }> = uniqueRefs.map(
    (ref) => ({ value: ref, label: ref }),
  );
  if (availableColorRefs.length > 0) {
    colorOptions.push({ value: "__custom__", label: "Custom…" });
  }

  const initial = uniqueRefs.includes(priorRef) ? priorRef : uniqueRefs[0]!;
  const selected = await p.select({
    message: "Which color should shadows inherit?",
    options: colorOptions,
    initialValue: initial,
  });
  handleCancel(selected);

  let colorRef: string;
  if (selected === "__custom__") {
    const customRaw = await p.text({
      message: "Enter a DTCG color reference:",
      placeholder: initial,
      initialValue: initial,
      validate: (v) => validateCustomColorRef(v, availableColorRefs),
    });
    handleCancel(customRaw);
    colorRef = String(customRaw).trim();
  } else {
    colorRef = String(selected);
  }

  return {
    levels,
    colorRef,
    profile: profileRaw === "hard" ? "hard" : "soft",
  };
}

function dedupeColorRefs(refs: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const ref of refs) {
    if (seen.has(ref)) continue;
    seen.add(ref);
    out.push(ref);
  }
  return out;
}

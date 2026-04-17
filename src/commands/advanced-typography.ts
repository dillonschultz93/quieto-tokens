import * as p from "@clack/prompts";
import type { AdvancedTypographyConfig } from "../types/config.js";
import type { PriorContext } from "./modify.js";
import {
  TYPE_SCALE_BALANCED,
  TYPE_SCALE_COMPACT,
  TYPE_SCALE_SPACIOUS,
} from "../generators/typography.js";

function handleCancel(value: unknown): asserts value is string | number | boolean {
  if (p.isCancel(value)) {
    p.cancel("Operation cancelled.");
    throw new Error("cancelled");
  }
}

const ALLOWED_WEIGHTS = new Set([100, 200, 300, 400, 500, 600, 700, 800, 900]);

const LETTER_SPACING_PATTERN = /^-?\d+(?:\.\d+)?(em|rem|px)$/;

export function validateFontFamily(value: string | undefined): string | undefined {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return undefined;
  if (trimmed.length > 200) return "Font stack is too long (max 200 chars).";
  return undefined;
}

export function validateLineHeight(value: number | null): string | undefined {
  if (value === null) return undefined;
  if (!Number.isFinite(value) || value <= 0 || value > 3) {
    return "Line-height must be a positive number between 0 and 3 (unitless multiplier).";
  }
  return undefined;
}

/**
 * Validator shared between the heading/body line-height prompts. Empty
 * input is allowed (means "skip"); any non-empty input must parse to a
 * finite positive number in (0, 3].
 *
 * Returns an error string for non-numeric / non-finite text so users get
 * a clear "that's not a number" message instead of having junk silently
 * stored as NaN / Infinity downstream.
 */
export function validateLineHeightPrompt(
  value: string | undefined,
): string | undefined {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return undefined;
  const num = Number.parseFloat(trimmed);
  if (!Number.isFinite(num)) {
    return "Enter a numeric value (e.g. 1.5) or leave blank to skip.";
  }
  return validateLineHeight(num);
}

export function validateLetterSpacing(value: string | undefined): string | undefined {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return undefined;
  if (!LETTER_SPACING_PATTERN.test(trimmed)) {
    return "Use a CSS length, e.g. -0.02em, 0.5px, or 0.025rem";
  }
  return undefined;
}

/**
 * Parse a single `"font-size-lg=18"` override line. Keys are validated
 * against the active type-scale's labels.
 */
export function parseSizeOverrideLine(
  line: string,
  allowedLabels: readonly string[],
): { ok: true; key: string; value: number } | { ok: false; error: string } {
  const trimmed = line.trim();
  if (!trimmed) return { ok: false, error: "Empty line" };
  const match = trimmed.match(
    /^font-size-([a-zA-Z0-9]+)\s*[:=]\s*(\d+(?:\.\d+)?)\s*(?:px)?$/,
  );
  if (!match) {
    return {
      ok: false,
      error: `"${trimmed}" — expected "font-size-<label>=<pixels>"`,
    };
  }
  const key = `font-size-${match[1]!}`;
  const value = Number.parseFloat(match[2]!);
  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, error: `"${key}" must be a positive number.` };
  }
  if (!allowedLabels.includes(match[1]!)) {
    return {
      ok: false,
      error: `Unknown size "${match[1]}". Pick one of: ${allowedLabels.join(", ")}`,
    };
  }
  return { ok: true, key, value };
}

/**
 * Parse a `"font-weight-heading=600"` override line.
 */
export function parseWeightOverrideLine(
  line: string,
): { ok: true; key: string; value: number } | { ok: false; error: string } {
  const trimmed = line.trim();
  if (!trimmed) return { ok: false, error: "Empty line" };
  const match = trimmed.match(
    /^font-weight-([a-zA-Z0-9-]+)\s*[:=]\s*(\d+)$/,
  );
  if (!match) {
    return {
      ok: false,
      error: `"${trimmed}" — expected "font-weight-<role>=<100..900>"`,
    };
  }
  const value = Number.parseInt(match[2]!, 10);
  if (!ALLOWED_WEIGHTS.has(value)) {
    return {
      ok: false,
      error: `Weight ${value} is not a valid CSS numeric weight (100, 200, …, 900).`,
    };
  }
  return { ok: true, key: `font-weight-${match[1]!}`, value };
}

function scaleLabels(
  scale: "compact" | "balanced" | "spacious",
): readonly string[] {
  const source =
    scale === "compact"
      ? TYPE_SCALE_COMPACT
      : scale === "balanced"
        ? TYPE_SCALE_BALANCED
        : TYPE_SCALE_SPACIOUS;
  return source.map((s) => s.label);
}

/**
 * Walk the user through the advanced typography step. The step is broken
 * into five focused sub-prompts so users can skip the ones they don't need:
 *
 *  1. Font-family stacks (heading / body / mono)
 *  2. Per-role font-size overrides in pixels
 *  3. Per-role font-weight overrides (numeric 100–900)
 *  4. Line-height overrides (heading / body, unitless)
 *  5. Letter-spacing overrides (heading / body, CSS length)
 *
 * Each section confirms first; a "No" immediately skips. Every override is
 * optional — the returned object only contains keys the user touched.
 */
export async function collectAdvancedTypography(
  scale: "compact" | "balanced" | "spacious",
  priorContext: PriorContext | null,
): Promise<AdvancedTypographyConfig | undefined> {
  const prior = priorContext?.config.advanced?.typography ?? {};
  const labels = scaleLabels(scale);

  const wantsTypography = await p.confirm({
    message: "Customize typography (fonts, sizes, weights, spacing)?",
    initialValue: Object.keys(prior).length > 0,
  });
  handleCancel(wantsTypography);
  if (!wantsTypography) return undefined;

  const result: AdvancedTypographyConfig = {};

  // --- Font family ---
  const wantsFonts = await p.confirm({
    message: "Set custom font-family stacks?",
    initialValue: Boolean(prior.fontFamily),
  });
  handleCancel(wantsFonts);
  if (wantsFonts) {
    const heading = await p.text({
      message: "Heading font stack (blank = default):",
      placeholder: "'Inter', system-ui, sans-serif",
      initialValue: prior.fontFamily?.heading ?? "",
      validate: validateFontFamily,
    });
    handleCancel(heading);
    const body = await p.text({
      message: "Body font stack (blank = default):",
      placeholder: "'Inter', system-ui, sans-serif",
      initialValue: prior.fontFamily?.body ?? "",
      validate: validateFontFamily,
    });
    handleCancel(body);
    const mono = await p.text({
      message: "Monospace font stack (blank = default):",
      placeholder: "'JetBrains Mono', monospace",
      initialValue: prior.fontFamily?.mono ?? "",
      validate: validateFontFamily,
    });
    handleCancel(mono);

    const fontFamily: NonNullable<AdvancedTypographyConfig["fontFamily"]> = {};
    if (String(heading).trim()) fontFamily.heading = String(heading).trim();
    if (String(body).trim()) fontFamily.body = String(body).trim();
    if (String(mono).trim()) fontFamily.mono = String(mono).trim();
    if (Object.keys(fontFamily).length > 0) result.fontFamily = fontFamily;
  }

  // --- Font size overrides ---
  const priorSizes = prior.customSizes ?? {};
  const sizeSeed = Object.entries(priorSizes)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const wantsSizes = await p.confirm({
    message: `Override specific font sizes? Available: ${labels.join(", ")}.`,
    initialValue: Object.keys(priorSizes).length > 0,
  });
  handleCancel(wantsSizes);
  if (wantsSizes) {
    const raw = await p.text({
      message:
        "Size overrides, one per line (e.g. font-size-lg=18). Blank to skip.",
      placeholder: "font-size-base=17\nfont-size-lg=22",
      initialValue: sizeSeed,
      validate: (value) => {
        const lines = (value ?? "")
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.length > 0);
        for (const line of lines) {
          const parsed = parseSizeOverrideLine(line, labels);
          if (!parsed.ok) return parsed.error;
        }
        return undefined;
      },
    });
    handleCancel(raw);
    const customSizes: Record<string, number> = {};
    for (const line of String(raw).split("\n")) {
      const parsed = parseSizeOverrideLine(line, labels);
      if (parsed.ok) customSizes[parsed.key] = parsed.value;
    }
    if (Object.keys(customSizes).length > 0) result.customSizes = customSizes;
  }

  // --- Font weight overrides ---
  const priorWeights = prior.customWeights ?? {};
  const weightSeed = Object.entries(priorWeights)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const wantsWeights = await p.confirm({
    message: "Override font-weights for any role?",
    initialValue: Object.keys(priorWeights).length > 0,
  });
  handleCancel(wantsWeights);
  if (wantsWeights) {
    const raw = await p.text({
      message:
        "Weight overrides, one per line (e.g. font-weight-heading=600). Blank to skip.",
      placeholder: "font-weight-heading=700",
      initialValue: weightSeed,
      validate: (value) => {
        const lines = (value ?? "")
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.length > 0);
        for (const line of lines) {
          const parsed = parseWeightOverrideLine(line);
          if (!parsed.ok) return parsed.error;
        }
        return undefined;
      },
    });
    handleCancel(raw);
    const customWeights: Record<string, number> = {};
    for (const line of String(raw).split("\n")) {
      const parsed = parseWeightOverrideLine(line);
      if (parsed.ok) customWeights[parsed.key] = parsed.value;
    }
    if (Object.keys(customWeights).length > 0) {
      result.customWeights = customWeights;
    }
  }

  // --- Line height ---
  const wantsLineHeight = await p.confirm({
    message: "Set custom line-height values for headings or body?",
    initialValue: Boolean(prior.lineHeight),
  });
  handleCancel(wantsLineHeight);
  if (wantsLineHeight) {
    const headingRaw = await p.text({
      message: "Heading line-height (unitless, blank = default):",
      placeholder: "1.2",
      initialValue:
        prior.lineHeight?.heading !== undefined
          ? String(prior.lineHeight.heading)
          : "",
      validate: validateLineHeightPrompt,
    });
    handleCancel(headingRaw);
    const bodyRaw = await p.text({
      message: "Body line-height (unitless, blank = default):",
      placeholder: "1.5",
      initialValue:
        prior.lineHeight?.body !== undefined
          ? String(prior.lineHeight.body)
          : "",
      validate: validateLineHeightPrompt,
    });
    handleCancel(bodyRaw);

    const lineHeight: NonNullable<AdvancedTypographyConfig["lineHeight"]> = {};
    const headingStr = String(headingRaw).trim();
    const bodyStr = String(bodyRaw).trim();
    if (headingStr) {
      const num = Number.parseFloat(headingStr);
      // Validator above guarantees this is finite & in range; belt-and-
      // suspenders guard protects against a future validator regression
      // silently leaking NaN into the written config.
      if (Number.isFinite(num) && num > 0 && num <= 3) {
        lineHeight.heading = num;
      }
    }
    if (bodyStr) {
      const num = Number.parseFloat(bodyStr);
      if (Number.isFinite(num) && num > 0 && num <= 3) {
        lineHeight.body = num;
      }
    }
    if (Object.keys(lineHeight).length > 0) result.lineHeight = lineHeight;
  }

  // --- Letter spacing ---
  const wantsLetterSpacing = await p.confirm({
    message: "Set custom letter-spacing values?",
    initialValue: Boolean(prior.letterSpacing),
  });
  handleCancel(wantsLetterSpacing);
  if (wantsLetterSpacing) {
    const headingRaw = await p.text({
      message: "Heading letter-spacing (CSS length, blank = default):",
      placeholder: "-0.02em",
      initialValue: prior.letterSpacing?.heading ?? "",
      validate: validateLetterSpacing,
    });
    handleCancel(headingRaw);
    const bodyRaw = await p.text({
      message: "Body letter-spacing (CSS length, blank = default):",
      placeholder: "0.01em",
      initialValue: prior.letterSpacing?.body ?? "",
      validate: validateLetterSpacing,
    });
    handleCancel(bodyRaw);

    const letterSpacing: NonNullable<AdvancedTypographyConfig["letterSpacing"]> = {};
    if (String(headingRaw).trim()) {
      letterSpacing.heading = String(headingRaw).trim();
    }
    if (String(bodyRaw).trim()) {
      letterSpacing.body = String(bodyRaw).trim();
    }
    if (Object.keys(letterSpacing).length > 0) {
      result.letterSpacing = letterSpacing;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

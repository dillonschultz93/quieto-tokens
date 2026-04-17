import type {
  AnimationCategoryConfig,
  BorderCategoryConfig,
  ShadowCategoryConfig,
} from "../types/config.js";

/**
 * Single source of truth for the default values used by the `add`
 * subcommand's three category flows. Both the interactive prompts
 * (`src/commands/add-*.ts`) and the pipeline's "rebuild a previously
 * added category" fallback (`src/pipeline/add.ts`) import from here so
 * the two cannot drift independently — a change to, say, the default
 * duration ramp propagates everywhere at once.
 *
 * These values are frozen to make the sharing explicit: anyone who
 * wants a mutable copy must clone first, which surfaces the mutation
 * intent in review rather than silently landing in another importer.
 */

export const DEFAULT_SHADOW_CONFIG: Readonly<ShadowCategoryConfig> =
  Object.freeze({
    levels: 4,
    colorRef: "{color.neutral.900}",
    profile: "soft",
  });

export const DEFAULT_BORDER_CONFIG: Readonly<BorderCategoryConfig> =
  Object.freeze({
    widths: Object.freeze([1, 2, 4, 8]) as unknown as number[],
    radii: Object.freeze([2, 4, 8, 16]) as unknown as number[],
    pill: false,
  });

export const DEFAULT_ANIMATION_CONFIG: Readonly<AnimationCategoryConfig> =
  Object.freeze({
    durations: Object.freeze([100, 150, 250, 400]) as unknown as number[],
    easing: "standard",
  });

/**
 * DTCG color reference shape accepted by the shadow color picker and
 * by the config schema validator. Shared so the two layers agree on
 * what a ref looks like (and so the schema validator doesn't have to
 * reach into a `commands/` module, which would be directionally wrong).
 *
 * Shape is `{color.<hue>.<step>}` where `<hue>` is the hue name produced
 * by `runColorGeneration` (lowercase alpha + digits, optional `-`/`_`)
 * and `<step>` is the ramp step (50..900 or 1..9). Multi-segment refs
 * like `{color.brand.primary.500}` are intentionally rejected because
 * the color generator never produces that shape today.
 */
export const DTCG_COLOR_REF_RE = /^\{color\.[a-zA-Z][a-zA-Z0-9_-]*\.\d+\}$/;

/**
 * Input limits shared between prompt validators and schema validators.
 * Centralising them here prevents the two layers from drifting: a
 * hand-edited `quieto.config.json` cannot smuggle values past the
 * schema validator that the interactive prompts would have rejected.
 *
 * The ceilings are "sane" rather than "hard" — they exist primarily to
 * catch typos (`100000` when the user meant `100`) and to prevent
 * Number.parseInt from overflowing into float notation like `1e+22`.
 */
export const INPUT_LIMITS = Object.freeze({
  /** Max comma-separated entries accepted by any category prompt. */
  maxEntries: 9,
  /** Max duration in milliseconds (1 minute — longer than any UI anim). */
  maxDurationMs: 60_000,
  /** Max width or radius in pixels (sanity-cap, well below any UI). */
  maxPixelSize: 10_000,
});

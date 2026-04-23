/**
 * Shape of the `quieto.config.json` file written to the user's project root
 * after a successful `quieto-tokens init` run.
 *
 * The schema is intentionally **forward-compatible**: future epics add fields
 * (advanced-mode authoring, additional categories, update history) without
 * breaking existing configs. Keep it flat and well-namespaced — deep nesting
 * is harder to extend and diff.
 *
 * Related stories:
 * - Story 1.1 established the filename convention and config detection.
 * - Story 1.9 shipped v1 (inputs + overrides + output).
 * - Story 2.1 added `advanced` and `categories` (this file).
 * - Story 2.2 will push new category names into `categories`.
 * - Story 3.1 will read this file to drive diff-based re-entrant editing.
 * - Story 4.1 adds `outputs` for multi-platform build targets.
 */
export const OUTPUT_PLATFORMS = ["css", "figma", "ios", "android"] as const;
export type OutputPlatform = (typeof OUTPUT_PLATFORMS)[number];

export interface QuietoConfig {
  /** Optional JSON Schema URL. Reserved for future hosted schema (not MVP). */
  $schema?: string;
  /** Tool version that generated this config (from package.json). */
  version: string;
  /** ISO 8601 timestamp of generation (`new Date().toISOString()`). */
  generated: string;
  /** Quick-start prompt answers — the recipe that reproduces the token system. */
  inputs: {
    /** Brand color hex, normalized to `#RRGGBB` uppercase. */
    brandColor: string;
    /** Spacing base unit in pixels. */
    spacingBase: 4 | 8;
    /** Type-scale ratio preference. */
    typeScale: "compact" | "balanced" | "spacious";
    /** Whether both light and dark themes were generated. */
    darkMode: boolean;
  };
  /**
   * Semantic overrides the user applied in the preview step.
   *
   * Keys are semantic token names (e.g. `color.background.primary`) and
   * values are DTCG primitive references (e.g. `{color.blue.500}`).
   * Empty object when no overrides were made.
   */
  overrides: Record<string, string>;
  /** Output paths and naming used by the writer/build steps. */
  output: {
    /** Relative directory for DTCG JSON sources. Default: `"tokens"`. */
    tokensDir: string;
    /** Relative directory for built CSS. Default: `"build"`. */
    buildDir: string;
    /** CSS custom-property prefix. Default: `"quieto"`. */
    prefix: string;
  };
  /**
   * Build targets to generate on each run. `css` is always included; legacy
   * configs without this field are treated as `["css"]` in {@link loadConfig}.
   */
  outputs: OutputPlatform[];
  /**
   * When {@link outputs} includes `"android"`, the Android asset style:
   * XML resource files (default) or Jetpack Compose Kotlin. Omitted when
   * Android is not a build target.
   */
  androidFormat?: "xml" | "compose";
  /**
   * Active token categories. Epic 1 configs always generated
   * `["color", "spacing", "typography"]`; Epic 2.2's `add` subcommand will
   * push new names onto this list.
   *
   * Per ADR-001, this array is the canonical manifest — stale-output cleanup
   * diffs the on-disk file list against this array.
   */
  categories: string[];
  /**
   * Advanced-mode authoring details. `undefined` for quick-start configs.
   * Each sub-block is independently optional so the user can skip a category
   * while still supplying advanced input for another.
   */
  advanced?: AdvancedConfig;
  /**
   * Per-category authoring inputs for non-core categories added via
   * `quieto-tokens add`. Keyed by category name; missing entries mean
   * "defaults" for that category (safe to regenerate deterministically
   * from the default generator params).
   *
   * Legacy (Epic 1 / Story 2.1) configs have no `categoryConfigs` block.
   * `loadConfig` returns `undefined` here — NOT `{}` — so the absence is
   * distinguishable from an empty map. Quick-start configs NEVER populate
   * this block; color/spacing/typography stay in `inputs` + `advanced`.
   */
  categoryConfigs?: CategoryConfigs;
  /**
   * Tier-3 component token configs keyed by component name. Each entry
   * captures the user's walkthrough inputs so re-runs are deterministic.
   * `undefined` on legacy configs (Epic 1 / 2.1 / 2.2); first
   * `component` run adds the block.
   */
  components?: Record<string, ComponentTokenConfig>;
}

/**
 * Per-category parameters collected by `quieto-tokens add`. Each entry is
 * optional — missing entries either mean the category hasn't been added yet
 * or the user accepted all defaults for it (in which case the category still
 * appears in `categories[]` but the config block is absent).
 */
export interface CategoryConfigs {
  shadow?: ShadowCategoryConfig;
  border?: BorderCategoryConfig;
  animation?: AnimationCategoryConfig;
}

export interface ShadowCategoryConfig {
  /** Number of elevation levels; enforced 2..6 at prompt + validator. */
  levels: number;
  /** DTCG color reference, e.g. `{color.neutral.900}`. */
  colorRef: string;
  /** Blur/spread profile — soft = airy, hard = crisp. */
  profile: "soft" | "hard";
}

export interface BorderCategoryConfig {
  /** Integer pixel widths (all > 0). */
  widths: number[];
  /**
   * Integer pixel radii (all > 0). When {@link pill} is `true`, the
   * largest entry is emitted as `9999px` rather than its literal value;
   * when `false` every entry is emitted literally.
   */
  radii: number[];
  /**
   * Whether to treat the largest radius as the pill marker. Defaulting
   * this to `false` keeps the generator's behavior predictable — the
   * `add` prompt asks explicitly before overwriting the user's literal.
   */
  pill: boolean;
}

export interface AnimationCategoryConfig {
  /** Integer millisecond durations (all > 0). */
  durations: number[];
  /** Easing preset — hides the four-number cubic-bezier. */
  easing: "standard" | "emphasized" | "decelerated";
}

/**
 * Per-category extensions collected by `init --advanced`. Only categories the
 * user customized are populated — a missing sub-block means "use the
 * quick-start defaults for this category".
 */
export interface AdvancedConfig {
  color?: AdvancedColorConfig;
  spacing?: AdvancedSpacingConfig;
  typography?: AdvancedTypographyConfig;
}

export interface AdvancedColorConfig {
  /**
   * Additional hue ramps beyond the primary brand hue. Each entry gets its
   * own seed hex fed to `@quieto/engine`, producing a full 50–900 ramp.
   *
   * `name` is the semantic role (`accent`, `error`, ...) or a user-defined
   * label; `seed` is a `#RRGGBB` hex. Order matters for preview ordering.
   */
  additionalHues: Array<{
    name: string;
    seed: string;
  }>;
}

export interface AdvancedSpacingConfig {
  /**
   * Overrides for individual spacing steps. Keys match the primitive token
   * names generated by the spacing ramp (`"space-4"`, `"space-6"` …); values
   * are the desired pixel count for that step. Omitted keys fall back to the
   * preset-derived value.
   */
  customValues: Record<string, number>;
}

export interface AdvancedTypographyConfig {
  /** Font-family stacks per role. `undefined` means "use default stack". */
  fontFamily?: {
    heading?: string;
    body?: string;
    mono?: string;
  };
  /** Per-role size override in pixels (e.g. `{"font-size-lg": 18}`). */
  customSizes?: Record<string, number>;
  /** Per-role weight override (CSS numeric, 100–900). */
  customWeights?: Record<string, number>;
  /** Line-height overrides (unitless multiplier). */
  lineHeight?: {
    heading?: number;
    body?: number;
  };
  /** Letter-spacing overrides (CSS length token, e.g. `"-0.02em"`). */
  letterSpacing?: {
    heading?: string;
    body?: string;
  };
}

/**
 * Default output paths — kept in one place so writer + config stay in sync.
 * Frozen so an importer that mutates it cannot poison subsequent
 * `buildConfig` calls.
 */
export const DEFAULT_OUTPUT_CONFIG: Readonly<QuietoConfig["output"]> =
  Object.freeze({
    tokensDir: "tokens",
    buildDir: "build",
    prefix: "quieto",
  });

/** Every run emits CSS. Additional platforms (e.g. Figma JSON) are opt-in. */
export const DEFAULT_OUTPUTS: readonly OutputPlatform[] = Object.freeze([
  "css",
]);

/**
 * Canonical list of core categories generated by quick-start. Stored as a
 * frozen tuple so legacy-config fallback paths can share one reference.
 */
export const DEFAULT_CATEGORIES: readonly string[] = Object.freeze([
  "color",
  "spacing",
  "typography",
]);

export type ComponentProperty =
  | "color-background"
  | "color-content"
  | "color-border"
  | "spacing-padding"
  | "border-radius"
  | "typography";

export type ComponentState =
  | "default"
  | "hover"
  | "active"
  | "focus"
  | "disabled";

export interface ComponentTokenConfig {
  variants: string[];
  cells: ComponentCell[];
}

export interface ComponentCell {
  variant: string;
  property: ComponentProperty;
  paddingShape?: "single" | "four-sides";
  states: ComponentCellState[];
}

export interface ComponentCellState {
  state: ComponentState;
  value: string | { top: string; right: string; bottom: string; left: string };
}

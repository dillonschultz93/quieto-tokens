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
 * - Story 2.1 will add an `advanced` block.
 * - Story 2.2 will add a `categories` block.
 * - Story 3.1 will read this file to drive re-entrant editing.
 */
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

import type { QuickStartOptions } from "../types.js";
import type { QuietoConfig } from "../types/config.js";

/**
 * Context about the user's previous token system, derived from a
 * successfully-loaded `quieto.config.json`. Handed to the advanced flow so
 * each step can pre-fill its defaults with the user's last answers instead
 * of starting from scratch.
 *
 * `config` is kept as-is so downstream consumers can reach into any field
 * (including future schema additions) without a widening refactor here.
 */
export interface PriorContext {
  config: QuietoConfig;
}

/**
 * Project the baseline quick-start answers out of a previously-saved config.
 * Modify-flow uses this to avoid re-prompting the user for settings they've
 * already expressed — the baseline is then fed into advanced mode where
 * only deltas are collected.
 *
 * Pure function: no filesystem, no prompts. Trivial to unit-test.
 */
export function deriveBaselineFromConfig(
  config: QuietoConfig,
): QuickStartOptions {
  return {
    brandColor: config.inputs.brandColor,
    spacingBase: config.inputs.spacingBase,
    typeScale: config.inputs.typeScale,
    generateThemes: config.inputs.darkMode,
  };
}

export function buildPriorContext(config: QuietoConfig): PriorContext {
  return { config };
}

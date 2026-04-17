import type { ThemeCollection } from "../types/tokens.js";

/**
 * Mutate `collection` so every semantic token whose name appears in
 * `priorOverrides` carries the recorded DTCG reference. Used on the modify
 * and `add` paths so the preview reflects the user's last saved choices
 * instead of the mapper's fresh defaults.
 *
 * Extracted from `src/commands/init.ts` in Story 2.2 so both the init and
 * add pipelines share one implementation. Keep this pure — no Clack I/O,
 * no filesystem access — so it stays trivially testable.
 *
 * Policy: override keys whose target token no longer exists (e.g. a
 * semantic role was renamed between versions) are silently dropped rather
 * than throwing. Same policy as the write side.
 */
export function applyPriorOverrides(
  collection: ThemeCollection,
  priorOverrides: Record<string, string>,
): void {
  for (const [tokenName, value] of Object.entries(priorOverrides)) {
    for (const theme of collection.themes) {
      const match = theme.semanticTokens.find((t) => t.name === tokenName);
      if (match) match.$value = value;
    }
  }
}

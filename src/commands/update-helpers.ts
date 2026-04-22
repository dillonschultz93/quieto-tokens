import type { AdvancedConfig, QuietoConfig } from "../types/config.js";
import type { QuickStartOptions } from "../types.js";
import { runColorGeneration } from "../pipeline/color.js";

/**
 * Build the DTCG `{color.*.*}` whitelist for shadow color-ref validation,
 * using the current brand + advanced color inputs.
 */
export async function buildAvailableColorRefsForConfig(
  config: QuietoConfig,
  baseline: QuickStartOptions,
  workingAdvanced: AdvancedConfig | undefined,
): Promise<string[]> {
  const tokens = await runColorGeneration(
    baseline.brandColor,
    workingAdvanced?.color ?? config.advanced?.color,
  );
  const refs: string[] = [];
  const seen = new Set<string>();
  for (const t of tokens) {
    if (t.category !== "color") continue;
    const hue = t.path[1];
    const step = t.path[2];
    if (!hue || !step) continue;
    const ref = `{color.${hue}.${step}}`;
    if (seen.has(ref)) continue;
    seen.add(ref);
    refs.push(ref);
  }
  return refs;
}

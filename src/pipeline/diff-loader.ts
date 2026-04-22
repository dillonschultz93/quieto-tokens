import { access } from "node:fs/promises";
import { join } from "node:path";
import type { QuietoConfig } from "../types/config.js";
import type { Theme, ThemeCollection } from "../types/tokens.js";
import {
  loadComponentTokensFromDisk,
  loadPrimitivesFromDisk,
  loadSemanticTokensFromDisk,
} from "./load-from-disk.js";
import type { DiskLoadLogger } from "./load-from-disk.js";

function isEnoent(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as NodeJS.ErrnoException).code === "ENOENT"
  );
}

export function themeNamesFromConfig(config: QuietoConfig): string[] {
  return config.inputs.darkMode ? ["light", "dark"] : ["default"];
}

/**
 * Reconstruct a {@link ThemeCollection} from on-disk DTCG JSON. Used to diff
 * the prior token state before `update` writes. Missing `tokens/` yields an
 * empty collection (all tokens will appear "added" in the diff).
 */
export async function loadPriorCollection(
  config: QuietoConfig,
  cwd: string,
  logger?: DiskLoadLogger,
): Promise<ThemeCollection> {
  const tokensDir = config.output.tokensDir;
  const base = join(cwd, tokensDir);
  try {
    await access(base);
  } catch (e: unknown) {
    if (isEnoent(e)) {
      return { primitives: [], themes: [] };
    }
    throw e;
  }

  const silent: DiskLoadLogger = logger ?? { warn: () => {} };
  const primitives = await loadPrimitivesFromDisk(
    cwd,
    tokensDir,
    config.categories,
    silent,
  );
  const themeNames = themeNamesFromConfig(config);
  const semanticByTheme = await loadSemanticTokensFromDisk(
    cwd,
    tokensDir,
    themeNames,
    config.categories,
    silent,
  );
  const themes: Theme[] = themeNames.map((name) => ({
    name,
    semanticTokens: semanticByTheme.get(name) ?? [],
  }));
  const components = await loadComponentTokensFromDisk(
    cwd,
    tokensDir,
    silent,
  );
  const collection: ThemeCollection = { primitives, themes };
  if (components.length > 0) {
    collection.components = components;
  }
  return collection;
}

import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { QuietoConfig } from "../types/config.js";
import type {
  ComponentToken,
  PrimitiveToken,
  SemanticToken,
} from "../types/tokens.js";
import { loadConfig } from "../utils/config.js";
import {
  loadComponentTokensFromDisk,
  loadPrimitivesFromDisk,
  loadSemanticTokensFromDisk,
} from "../pipeline/load-from-disk.js";

export interface LoadedTokenSystem {
  primitives: PrimitiveToken[];
  themes: { name: string; semantics: SemanticToken[] }[];
  components: ComponentToken[];
  config: QuietoConfig;
}

export async function loadTokenSystem(
  cwd: string = process.cwd(),
): Promise<LoadedTokenSystem | null> {
  const result = loadConfig(cwd, { logger: { warn: () => {} } });
  if (result.status !== "ok") return null;

  const config = result.config;
  const tokensDir = config.output.tokensDir;

  const primitives = await loadPrimitivesFromDisk(
    cwd,
    tokensDir,
    config.categories,
  );

  let themeNames: string[];
  try {
    const semanticDir = join(cwd, tokensDir, "semantic");
    const entries = await readdir(semanticDir, { withFileTypes: true });
    themeNames = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    themeNames = [];
  }

  const semanticMap = await loadSemanticTokensFromDisk(
    cwd,
    tokensDir,
    themeNames,
    config.categories,
  );

  const themes = themeNames.map((name) => ({
    name,
    semantics: semanticMap.get(name) ?? [],
  }));

  const components = await loadComponentTokensFromDisk(cwd, tokensDir);

  if (
    themeNames.length === 0 &&
    primitives.length === 0 &&
    components.length === 0
  ) {
    return null;
  }

  return { primitives, themes, components, config };
}

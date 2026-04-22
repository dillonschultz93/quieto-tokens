import * as p from "@clack/prompts";
import type {
  QuietoConfig,
  ComponentTokenConfig,
} from "../types/config.js";
import type {
  PrimitiveToken,
  SemanticToken,
  ThemeCollection,
} from "../types/tokens.js";
import { runColorGeneration } from "./color.js";
import {
  runSpacingGeneration,
  runTypographyGeneration,
} from "./spacing-typography.js";
import { generateShadowPrimitives } from "../generators/shadow.js";
import { generateBorderPrimitives } from "../generators/border.js";
import { generateAnimationPrimitives } from "../generators/animation.js";
import {
  generateSemanticTokens,
  mapShadowSemantics,
  mapBorderSemantics,
  mapAnimationSemantics,
} from "../mappers/semantic.js";
import { generateThemes } from "../generators/themes.js";
import { applyPriorOverrides } from "../utils/overrides.js";
import { generateComponentTokens } from "../generators/component.js";
import { collectComponentInputs } from "../commands/component-flow.js";
import { writeComponentTokens } from "../output/json-writer.js";
import { buildCss } from "../output/style-dictionary.js";
import { prune } from "../output/pruner.js";
import { sortCategoriesCanonical } from "../utils/categories.js";
import {
  DEFAULT_SHADOW_CONFIG,
  DEFAULT_BORDER_CONFIG,
  DEFAULT_ANIMATION_CONFIG,
} from "../utils/defaults.js";

export interface ComponentPipelineResult {
  componentConfig: ComponentTokenConfig;
  tokenCount: number;
  jsonFiles: string[];
  cssFiles: string[];
}

export type ComponentPipelineOutcome =
  | { status: "ok"; result: ComponentPipelineResult }
  | { status: "cancelled" }
  | { status: "error"; message: string };

export interface RunComponentOptions {
  /**
   * When true, run prompts and token generation but skip component JSON,
   * CSS rebuild, and prune (Story 3.3).
   */
  dryRun?: boolean;
}

export async function runComponent(
  config: QuietoConfig,
  name: string,
  cwd: string,
  options: RunComponentOptions = {},
): Promise<ComponentPipelineOutcome> {
  const { dryRun = false } = options;
  try {
    p.log.step("Rebuilding token system…");
    const collection = await rebuildCollectionFromConfig(config);

    const allSemantics: SemanticToken[] = [];
    for (const theme of collection.themes) {
      allSemantics.push(...theme.semanticTokens);
    }
    const uniqueSemantics = deduplicateSemantics(allSemantics);

    const prior = config.components?.[name];

    const componentConfig = await collectComponentInputs(
      uniqueSemantics,
      collection.primitives,
      name,
      prior,
    );

    p.log.step("Generating component tokens…");
    const componentTokens = generateComponentTokens(
      name,
      componentConfig,
      uniqueSemantics,
      collection.primitives,
    );

    if (componentTokens.length === 0) {
      return { status: "cancelled" };
    }

    collection.components = componentTokens;

    if (dryRun) {
      p.log.info("Dry run — skipping file writes.");
      return {
        status: "ok",
        result: {
          componentConfig,
          tokenCount: componentTokens.length,
          jsonFiles: [],
          cssFiles: [],
        },
      };
    }

    p.log.step("Writing component tokens…");
    const jsonFiles = await writeComponentTokens(componentTokens, cwd);

    p.log.step("Rebuilding CSS…");
    const cssFiles = await buildCss(collection, cwd);

    const knownComponents = Object.keys({
      ...config.components,
      [name]: componentConfig,
    });
    const themeNames = collection.themes.map((t) => t.name);
    await prune(
      cwd,
      sortCategoriesCanonical(config.categories),
      themeNames,
      knownComponents,
    );

    return {
      status: "ok",
      result: {
        componentConfig,
        tokenCount: componentTokens.length,
        jsonFiles,
        cssFiles,
      },
    };
  } catch (error) {
    if (error instanceof Error && error.message === "cancelled") {
      return { status: "cancelled" };
    }
    const message = error instanceof Error ? error.message : String(error);
    return { status: "error", message };
  }
}

function deduplicateSemantics(tokens: SemanticToken[]): SemanticToken[] {
  const seen = new Set<string>();
  const unique: SemanticToken[] = [];
  for (const t of tokens) {
    const key = t.path.join(".");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(t);
  }
  return unique;
}

export async function rebuildCollectionFromConfig(
  config: QuietoConfig,
): Promise<ThemeCollection> {
  const primitives: PrimitiveToken[] = [];

  primitives.push(
    ...(await runColorGeneration(
      config.inputs.brandColor,
      config.advanced?.color,
    )),
  );
  primitives.push(
    ...runSpacingGeneration(config.inputs.spacingBase, config.advanced?.spacing),
  );
  primitives.push(
    ...runTypographyGeneration(
      config.inputs.typeScale,
      config.advanced?.typography,
    ),
  );

  const seenCategories = new Set<string>();
  for (const cat of config.categories) {
    if (seenCategories.has(cat)) continue;
    seenCategories.add(cat);
    if (cat === "color" || cat === "spacing" || cat === "typography") continue;

    if (cat === "shadow") {
      const cfg = config.categoryConfigs?.shadow ?? DEFAULT_SHADOW_CONFIG;
      primitives.push(...generateShadowPrimitives(cfg));
    } else if (cat === "border") {
      const cfg = config.categoryConfigs?.border ?? DEFAULT_BORDER_CONFIG;
      primitives.push(...generateBorderPrimitives(cfg));
    } else if (cat === "animation") {
      const cfg = config.categoryConfigs?.animation ?? DEFAULT_ANIMATION_CONFIG;
      primitives.push(...generateAnimationPrimitives(cfg));
    }
  }

  const extraSemantics: SemanticToken[] = [];
  const seenExtra = new Set<string>();
  for (const cat of config.categories) {
    if (seenExtra.has(cat)) continue;
    seenExtra.add(cat);
    if (cat === "shadow") {
      extraSemantics.push(
        ...mapShadowSemantics(
          primitives.filter((t) => t.category === "shadow"),
        ),
      );
    } else if (cat === "border") {
      extraSemantics.push(
        ...mapBorderSemantics(
          primitives.filter((t) => t.category === "border"),
        ),
      );
    } else if (cat === "animation") {
      extraSemantics.push(
        ...mapAnimationSemantics(
          primitives.filter((t) => t.category === "animation"),
        ),
      );
    }
  }

  const coreSemantics = generateSemanticTokens(primitives);
  const allSemantics = [...coreSemantics, ...extraSemantics];

  const collection = generateThemes(
    allSemantics,
    primitives,
    config.inputs.darkMode,
  );

  const priorOverrides = config.overrides ?? {};
  if (Object.keys(priorOverrides).length > 0) {
    applyPriorOverrides(collection, priorOverrides);
  }

  return collection;
}

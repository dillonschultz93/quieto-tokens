import type {
  AnimationCategoryConfig,
  BorderCategoryConfig,
  CategoryConfigs,
  QuietoConfig,
  ShadowCategoryConfig,
} from "../types/config.js";
import type { QuickStartOptions } from "../types.js";
import type { PrimitiveToken, SemanticToken, ThemeCollection } from "../types/tokens.js";
import { deriveBaselineFromConfig } from "../commands/modify.js";
import { runColorGeneration } from "./color.js";
import {
  runSpacingGeneration,
  runTypographyGeneration,
} from "./spacing-typography.js";
import {
  generateSemanticTokens,
  mapAnimationSemantics,
  mapBorderSemantics,
  mapShadowSemantics,
} from "../mappers/semantic.js";
import { generateThemes } from "../generators/themes.js";
import { generateShadowPrimitives } from "../generators/shadow.js";
import { generateBorderPrimitives } from "../generators/border.js";
import { generateAnimationPrimitives } from "../generators/animation.js";
import {
  DEFAULT_ANIMATION_CONFIG,
  DEFAULT_BORDER_CONFIG,
  DEFAULT_SHADOW_CONFIG,
} from "../utils/defaults.js";
import type { UpdateResult } from "../commands/update-flow.js";
import {
  loadComponentTokensFromDisk,
  loadPrimitivesFromDisk,
  loadSemanticTokensFromDisk,
} from "./load-from-disk.js";
import type { DiskLoadLogger } from "./load-from-disk.js";

export interface UpdatePipelineResult {
  collection: ThemeCollection;
  modifiedCategories: readonly string[];
}

const CORE = new Set(["color", "spacing", "typography"]);
const ADDON = new Set(["shadow", "border", "animation"]);

function shadowCfg(
  next: CategoryConfigs,
  prev: QuietoConfig,
): ShadowCategoryConfig {
  return next.shadow ?? prev.categoryConfigs?.shadow ?? DEFAULT_SHADOW_CONFIG;
}

function borderCfg(next: CategoryConfigs, prev: QuietoConfig): BorderCategoryConfig {
  return next.border ?? prev.categoryConfigs?.border ?? DEFAULT_BORDER_CONFIG;
}

function animationCfg(
  next: CategoryConfigs,
  prev: QuietoConfig,
): AnimationCategoryConfig {
  return (
    next.animation ??
    prev.categoryConfigs?.animation ??
    DEFAULT_ANIMATION_CONFIG
  );
}

/**
 * Selectively rebuild primitives + semantics for an `update` run.
 */
export async function runUpdate(
  config: QuietoConfig,
  updateResult: UpdateResult,
  cwd: string,
  logger?: DiskLoadLogger,
): Promise<UpdatePipelineResult | null> {
  const modified = new Set(updateResult.modifiedCategories);
  const tokensDir = config.output.tokensDir;
  const options: QuickStartOptions = {
    ...deriveBaselineFromConfig(config),
    ...updateResult.nextOptions,
  };
  const nextCatCfg = updateResult.nextCategoryConfigs;
  const nextAdvanced = updateResult.nextAdvanced;

  const corePrimitives: PrimitiveToken[] = [];
  const coreCategories = config.categories.filter((c) => CORE.has(c));

  for (const cat of coreCategories) {
    if (modified.has(cat)) {
      if (cat === "color") {
        corePrimitives.push(
          ...(await runColorGeneration(
            options.brandColor,
            nextAdvanced?.color,
          )),
        );
      } else if (cat === "spacing") {
        corePrimitives.push(
          ...runSpacingGeneration(options.spacingBase, nextAdvanced?.spacing),
        );
      } else if (cat === "typography") {
        corePrimitives.push(
          ...runTypographyGeneration(
            options.typeScale,
            nextAdvanced?.typography,
          ),
        );
      }
    } else {
      corePrimitives.push(
        ...(await loadPrimitivesFromDisk(cwd, tokensDir, [cat], logger)),
      );
    }
  }

  const addonPrimitives: PrimitiveToken[] = [];
  const addonSemanticsScratch: SemanticToken[] = [];

  const addonCats = config.categories.filter((c) => ADDON.has(c));

  for (const cat of addonCats) {
    if (modified.has(cat)) {
      if (cat === "shadow") {
        const input = shadowCfg(nextCatCfg, config);
        const pr = generateShadowPrimitives(input);
        addonPrimitives.push(...pr);
        addonSemanticsScratch.push(...mapShadowSemantics(pr));
      } else if (cat === "border") {
        const input = borderCfg(nextCatCfg, config);
        const pr = generateBorderPrimitives(input);
        addonPrimitives.push(...pr);
        addonSemanticsScratch.push(...mapBorderSemantics(pr));
      } else if (cat === "animation") {
        const input = animationCfg(nextCatCfg, config);
        const pr = generateAnimationPrimitives(input);
        addonPrimitives.push(...pr);
        addonSemanticsScratch.push(...mapAnimationSemantics(pr));
      }
    } else {
      addonPrimitives.push(
        ...(await loadPrimitivesFromDisk(cwd, tokensDir, [cat], logger)),
      );
    }
  }

  const allPrimitives = [...corePrimitives, ...addonPrimitives];
  const baseSemantics = generateSemanticTokens(allPrimitives);
  const collection = generateThemes(
    baseSemantics,
    allPrimitives,
    options.generateThemes,
  );

  for (const theme of collection.themes) {
    const extra: SemanticToken[] = [];
    for (const cat of addonCats) {
      if (modified.has(cat)) {
        const mine = addonSemanticsScratch.filter((t) => t.category === cat);
        extra.push(...mine);
      } else {
        const loaded = await loadSemanticTokensFromDisk(
          cwd,
          tokensDir,
          [theme.name],
          [cat],
          logger,
        );
        extra.push(...(loaded.get(theme.name) ?? []));
      }
    }
    if (extra.length > 0) {
      theme.semanticTokens = [...theme.semanticTokens, ...extra];
    }
  }

  const components = await loadComponentTokensFromDisk(cwd, tokensDir, logger);
  if (components.length > 0) {
    collection.components = components;
  } else {
    delete collection.components;
  }

  const modifiedForWrite = [...modified].filter((c) => {
    if (ADDON.has(c)) return true;
    if (CORE.has(c)) return true;
    return false;
  });

  return {
    collection,
    modifiedCategories: sortModifiedForScope(modifiedForWrite, config),
  };
}

/** Scoped JSON writes expect categories in stable order. */
function sortModifiedForScope(
  modified: readonly string[],
  config: QuietoConfig,
): string[] {
  const order = new Map(
    config.categories.map((c, i) => [c, i] as const),
  );
  return [...modified].sort((a, b) => {
    const ia = order.get(a) ?? 999;
    const ib = order.get(b) ?? 999;
    return ia - ib;
  });
}

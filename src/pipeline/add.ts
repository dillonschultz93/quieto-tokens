import { unlink } from "node:fs/promises";
import * as p from "@clack/prompts";
import type {
  AnimationCategoryConfig,
  BorderCategoryConfig,
  CategoryConfigs,
  QuietoConfig,
  ShadowCategoryConfig,
} from "../types/config.js";
import type {
  PrimitiveToken,
  SemanticToken,
  Theme,
} from "../types/tokens.js";
import type { AddableCategory } from "../utils/categories.js";
import {
  CANONICAL_CATEGORY_ORDER,
  sortCategoriesCanonical,
} from "../utils/categories.js";
import {
  DEFAULT_ANIMATION_CONFIG,
  DEFAULT_BORDER_CONFIG,
  DEFAULT_SHADOW_CONFIG,
} from "../utils/defaults.js";
import { runColorGeneration } from "./color.js";
import {
  runSpacingGeneration,
  runTypographyGeneration,
} from "./spacing-typography.js";
import { generateAnimationPrimitives } from "../generators/animation.js";
import { generateBorderPrimitives } from "../generators/border.js";
import { generateShadowPrimitives } from "../generators/shadow.js";
import { generateThemes } from "../generators/themes.js";
import {
  generateSemanticTokens,
  mapAnimationSemantics,
  mapBorderSemantics,
  mapShadowSemantics,
} from "../mappers/semantic.js";
import { collectAnimationInputs } from "../commands/add-animation.js";
import { collectBorderInputs } from "../commands/add-border.js";
import { collectShadowInputs } from "../commands/add-shadow.js";
import { applyPriorOverrides } from "../utils/overrides.js";
import { runOutputGeneration } from "./output.js";
import type { OutputResult } from "./output.js";
import { prune } from "../output/pruner.js";

/**
 * Discriminated outcome of {@link runAdd}. Callers need to distinguish
 * "the user cancelled" (exit 0) from "something failed" (exit 1) from
 * "all good" — collapsing the three to `null` would swallow the
 * difference.
 */
export type AddPipelineOutcome =
  | { status: "ok"; result: AddPipelineResult }
  | { status: "cancelled" }
  | { status: "error"; message: string };

export interface AddPipelineResult {
  categories: string[];
  categoryConfigs: CategoryConfigs;
  output: OutputResult;
  /**
   * Token files written specifically for the category that was just
   * added. On a `writeConfig` failure the caller uses this list to
   * roll back — existing core files and previously-added-category
   * files are NOT in this list, so rollback leaves them untouched.
   */
  newFiles: string[];
}

/**
 * Orchestrate a `quieto-tokens add <category>` run. Always returns an
 * outcome — never throws for expected cancellation/error cases.
 *
 * Pipeline:
 *   1. Re-derive primitives for every category already in `config.categories`
 *      (color/spacing/typography from their inputs + advanced blocks; any
 *      previously-added shadow/border/animation from `categoryConfigs`).
 *   2. Rebuild core semantics + themes; re-apply `config.overrides` so the
 *      user's previously-saved semantic overrides are preserved.
 *   3. Collect prompts for the new category and generate its primitives +
 *      semantics.
 *   4. Merge into the collection and write JSON + CSS.
 *   5. Prune orphan files (categories the user removed from `categories`
 *      between runs, and inactive theme directories) — best-effort.
 */
export async function runAdd(
  category: AddableCategory,
  config: QuietoConfig,
  cwd: string,
): Promise<AddPipelineOutcome> {
  const priorCategoryConfig = config.categoryConfigs?.[category];

  // --- Step 1: rebuild core primitives from the saved inputs ---
  const corePrimitives: PrimitiveToken[] = [];
  corePrimitives.push(
    ...(await runColorGeneration(
      config.inputs.brandColor,
      config.advanced?.color,
    )),
  );
  corePrimitives.push(
    ...runSpacingGeneration(config.inputs.spacingBase, config.advanced?.spacing),
  );
  corePrimitives.push(
    ...runTypographyGeneration(
      config.inputs.typeScale,
      config.advanced?.typography,
    ),
  );

  // --- Step 1b: rebuild previously-added category primitives ---
  // Dedupe `config.categories` before iterating — a hand-edited config
  // with `["shadow", "shadow"]` would otherwise emit duplicate primitive
  // paths and break `tokensToDtcgTree`'s uniqueness check.
  const extraPrimitives: PrimitiveToken[] = [];
  const extraSemantics: SemanticToken[] = [];
  const seenPrev = new Set<string>();
  for (const prevCategory of config.categories) {
    if (seenPrev.has(prevCategory)) continue;
    seenPrev.add(prevCategory);
    if (prevCategory === category) continue;
    if (
      prevCategory === "color" ||
      prevCategory === "spacing" ||
      prevCategory === "typography"
    )
      continue;
    const { primitives, semantics } = rebuildPreviousCategory(
      prevCategory,
      config.categoryConfigs,
    );
    extraPrimitives.push(...primitives);
    extraSemantics.push(...semantics);
  }

  // --- Step 2: core semantics + themes, then apply prior overrides ---
  const coreSemantics = generateSemanticTokens(corePrimitives);
  const collection = generateThemes(
    coreSemantics,
    [...corePrimitives, ...extraPrimitives],
    config.inputs.darkMode,
  );

  // Append previously-added category semantics to every theme (they are
  // theme-agnostic — none of shadow/border/animation differs per theme in
  // 2.2 scope).
  for (const theme of collection.themes) {
    theme.semanticTokens = [...theme.semanticTokens, ...extraSemantics];
  }

  const priorOverrides = config.overrides ?? {};
  if (Object.keys(priorOverrides).length > 0) {
    applyPriorOverrides(collection, priorOverrides);
  }

  // --- Step 3: collect prompts + generate the new category ---
  const availableColorRefs = buildAvailableColorRefs(corePrimitives);
  let newConfigBlock:
    | ShadowCategoryConfig
    | BorderCategoryConfig
    | AnimationCategoryConfig;
  let newPrimitives: PrimitiveToken[];
  let newSemantics: SemanticToken[];

  try {
    if (category === "shadow") {
      const input = await collectShadowInputs(
        priorCategoryConfig as ShadowCategoryConfig | undefined,
        availableColorRefs,
      );
      newConfigBlock = input;
      newPrimitives = generateShadowPrimitives(input);
      newSemantics = mapShadowSemantics(newPrimitives);
    } else if (category === "border") {
      const input = await collectBorderInputs(
        priorCategoryConfig as BorderCategoryConfig | undefined,
      );
      newConfigBlock = input;
      newPrimitives = generateBorderPrimitives(input);
      newSemantics = mapBorderSemantics(newPrimitives);
    } else {
      const input = await collectAnimationInputs(
        priorCategoryConfig as AnimationCategoryConfig | undefined,
      );
      newConfigBlock = input;
      newPrimitives = generateAnimationPrimitives(input);
      newSemantics = mapAnimationSemantics(newPrimitives);
    }
  } catch (error) {
    if (error instanceof Error && error.message === "cancelled") {
      return { status: "cancelled" };
    }
    // Unexpected error from the collector — surface it gracefully
    // instead of letting a raw stack trace hit the user.
    const message = error instanceof Error ? error.message : String(error);
    p.log.error(`Failed to collect ${category} inputs: ${message}`);
    return { status: "error", message };
  }

  p.log.info(
    `${newPrimitives.length} ${category} primitives generated, ${newSemantics.length} semantic tokens`,
  );

  // --- Step 4: merge + write ---
  collection.primitives.push(...newPrimitives);
  for (const theme of collection.themes) {
    theme.semanticTokens = [...theme.semanticTokens, ...newSemantics];
  }

  const output = await runOutputGeneration(collection, cwd);
  if (!output) return { status: "error", message: "output generation failed" };

  // --- Step 5: prune orphan files ---
  // Whitelist against `CANONICAL_CATEGORY_ORDER` before passing to
  // `prune` — otherwise a hand-edited typo like `"shadows"` in
  // `config.categories` would be treated as canonical and the real
  // `tokens/primitive/shadow.json` would become an orphan that never
  // gets swept. Unknown names are dropped silently with a warning so
  // the user notices.
  const mergedCategories = sortCategoriesCanonical([
    ...new Set([...config.categories, category]),
  ]);
  const unknownCategories = mergedCategories.filter(
    (c) => !CANONICAL_CATEGORY_ORDER.includes(c),
  );
  if (unknownCategories.length > 0) {
    p.log.warn(
      `Ignoring unknown categories in config: ${unknownCategories.join(", ")}`,
    );
  }
  const canonicalCategories = mergedCategories.filter((c) =>
    CANONICAL_CATEGORY_ORDER.includes(c),
  );
  const themeNames = collection.themes.map((t: Theme) => t.name);
  await prune(cwd, canonicalCategories, themeNames);

  const mergedCategoryConfigs: CategoryConfigs = {
    ...(config.categoryConfigs ?? {}),
    [category]: newConfigBlock,
  };

  // Identify the files that are *new* to this run. They are the
  // subset of `output` paths whose basename is `<category>.json` or
  // whose build-output name matches the category. Previously-added
  // categories are excluded, so rollback never touches them.
  const newFiles = collectNewFilePaths(output, category, config.categories);

  return {
    status: "ok",
    result: {
      categories: canonicalCategories,
      categoryConfigs: mergedCategoryConfigs,
      output,
      newFiles,
    },
  };
}

/**
 * Best-effort delete of files produced by this run's new category.
 * Used by `addCommand` when `writeConfig` fails after tokens have
 * landed — without rollback the next run would rebuild only the
 * *old* config's categories and treat the fresh-on-disk files as
 * orphans.
 *
 * Errors are logged individually but never thrown; the rollback is
 * advisory because the command has already failed.
 */
export async function rollbackNewFiles(
  paths: readonly string[],
  cwd: string,
): Promise<void> {
  if (paths.length === 0) return;
  for (const path of paths) {
    try {
      await unlink(path);
    } catch (error) {
      if (isErrnoException(error) && error.code === "ENOENT") continue;
      const message = error instanceof Error ? error.message : String(error);
      p.log.warn(`Rollback: could not remove ${relPath(path, cwd)}: ${message}`);
    }
  }
}

function collectNewFilePaths(
  output: OutputResult,
  category: string,
  priorCategories: readonly string[],
): string[] {
  const wasPreviouslyAdded = priorCategories.includes(category);
  if (wasPreviouslyAdded) {
    // Re-author: the files already existed before this run; nothing
    // to roll back because the old contents aren't recoverable
    // anyway. We return an empty list so `addCommand` skips rollback.
    return [];
  }
  const matching = (path: string): boolean => {
    // JSON: `.../tokens/primitive/<category>.json` or
    //       `.../tokens/semantic/<theme>/<category>.json`.
    if (path.endsWith(`/${category}.json`) || path.endsWith(`\\${category}.json`))
      return true;
    // CSS build output: naming conventions vary — the only safe
    // over-approximation is to include every file the writer reports
    // under a `build/` segment that was written this run. The
    // `output.cssFiles` list is already scoped to this run's writes,
    // so include it wholesale.
    return false;
  };
  const jsonNew = output.jsonFiles.filter(matching);
  return [...jsonNew, ...output.cssFiles];
}

function relPath(absolute: string, cwd: string): string {
  if (absolute.startsWith(cwd)) {
    const rest = absolute.slice(cwd.length);
    return rest.startsWith("/") || rest.startsWith("\\")
      ? rest.slice(1)
      : rest;
  }
  return absolute;
}

function rebuildPreviousCategory(
  category: string,
  categoryConfigs: CategoryConfigs | undefined,
): { primitives: PrimitiveToken[]; semantics: SemanticToken[] } {
  if (category === "shadow") {
    const input =
      categoryConfigs?.shadow ??
      (DEFAULT_SHADOW_CONFIG as ShadowCategoryConfig);
    const primitives = generateShadowPrimitives(input);
    return { primitives, semantics: mapShadowSemantics(primitives) };
  }
  if (category === "border") {
    const input =
      categoryConfigs?.border ??
      (DEFAULT_BORDER_CONFIG as BorderCategoryConfig);
    const primitives = generateBorderPrimitives(input);
    return { primitives, semantics: mapBorderSemantics(primitives) };
  }
  if (category === "animation") {
    const input =
      categoryConfigs?.animation ??
      (DEFAULT_ANIMATION_CONFIG as AnimationCategoryConfig);
    const primitives = generateAnimationPrimitives(input);
    return { primitives, semantics: mapAnimationSemantics(primitives) };
  }
  // Unknown category names are passed through `categories[]` but cannot be
  // regenerated here — Story 2.2 recognises exactly the six canonical names.
  return { primitives: [], semantics: [] };
}

function buildAvailableColorRefs(colorPrimitives: PrimitiveToken[]): string[] {
  const refs: string[] = [];
  const seen = new Set<string>();
  for (const t of colorPrimitives) {
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

function isErrnoException(value: unknown): value is NodeJS.ErrnoException {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    typeof (value as { code?: unknown }).code === "string"
  );
}

import * as p from "@clack/prompts";
import type {
  AdvancedConfig,
  CategoryConfigs,
  QuietoConfig,
} from "../types/config.js";
import type { QuickStartOptions } from "../types.js";
import type { PriorContext } from "./modify.js";
import { buildPriorContext, deriveBaselineFromConfig } from "./modify.js";
import { collectAdvancedColor } from "./advanced-color.js";
import { collectAdvancedSpacing } from "./advanced-spacing.js";
import { collectAdvancedTypography } from "./advanced-typography.js";
import { collectShadowInputs } from "./add-shadow.js";
import { collectBorderInputs } from "./add-border.js";
import { collectAnimationInputs } from "./add-animation.js";
import { isAddableCategory } from "../utils/categories.js";
import { sortCategoriesCanonical } from "../utils/categories.js";
import { normalizeHex } from "../utils/color.js";
import { validateHexColor } from "../utils/validation.js";
import { buildAvailableColorRefsForConfig } from "./update-helpers.js";

function handleCancel<T>(value: T | symbol): asserts value is T {
  if (p.isCancel(value)) {
    p.cancel("Operation cancelled.");
    throw new Error("cancelled");
  }
}

export interface UpdateResult {
  /** Categories whose inputs actually changed vs the loaded config. */
  modifiedCategories: string[];
  /** Merged quick-start options after the update session. */
  nextOptions: QuickStartOptions;
  /** Advanced block after the session (`undefined` when nothing customized). */
  nextAdvanced: AdvancedConfig | undefined;
  /** Category configs after the session (may be empty object). */
  nextCategoryConfigs: CategoryConfigs;
}

function stableJson(value: unknown): string {
  if (value === undefined) return "undefined";
  return JSON.stringify(value);
}

function hintForCategory(config: QuietoConfig, cat: string): string {
  if (cat === "color") {
    const hues = config.advanced?.color?.additionalHues?.length ?? 0;
    const hueHint =
      hues > 0 ? ` + ${hues} additional hue${hues === 1 ? "" : "s"}` : "";
    return `Brand: ${config.inputs.brandColor}${hueHint}`;
  }
  if (cat === "spacing") {
    const n = Object.keys(config.advanced?.spacing?.customValues ?? {}).length;
    const custom = n > 0 ? `, ${n} custom value${n === 1 ? "" : "s"}` : "";
    return `Base: ${config.inputs.spacingBase}px${custom}`;
  }
  if (cat === "typography") {
    let n = 0;
    const typo = config.advanced?.typography;
    if (typo?.customSizes) n += Object.keys(typo.customSizes).length;
    if (typo?.customWeights) n += Object.keys(typo.customWeights).length;
    if (typo?.fontFamily) n += Object.keys(typo.fontFamily).length;
    const custom = n > 0 ? `, ${n} custom override${n === 1 ? "" : "s"}` : "";
    return `Scale: ${config.inputs.typeScale}${custom}`;
  }
  if (cat === "shadow") {
    const c = config.categoryConfigs?.shadow;
    return c
      ? `${c.levels} levels, ${c.profile}`
      : "defaults (not yet authored)";
  }
  if (cat === "border") {
    const c = config.categoryConfigs?.border;
    return c
      ? `${c.widths.length} widths / ${c.radii.length} radii`
      : "defaults (not yet authored)";
  }
  if (cat === "animation") {
    const c = config.categoryConfigs?.animation;
    return c
      ? `${c.durations.length} durations, ${c.easing}`
      : "defaults (not yet authored)";
  }
  return cat;
}

/**
 * Interactive category picker + per-category collectors for `update`.
 */
export async function collectUpdateInputs(
  config: QuietoConfig,
): Promise<UpdateResult> {
  const priorContext: PriorContext = buildPriorContext(config);
  const startBaseline = deriveBaselineFromConfig(config);
  let baseline = { ...startBaseline };
  let workingAdvanced: AdvancedConfig | undefined =
    config.advanced !== undefined ? { ...config.advanced } : undefined;
  let workingCategoryConfigs: CategoryConfigs = {
    ...(config.categoryConfigs ?? {}),
  };

  const modified = new Set<string>();
  /** Categories the user already stepped through this session (picker exclusion). */
  const visited = new Set<string>();

  let done = false;
  while (!done) {
    const remaining = sortCategoriesCanonical([...config.categories]).filter(
      (c) => !visited.has(c),
    );
    if (remaining.length === 0) {
      p.log.info("Every configured category has already been edited.");
      break;
    }

    const picked = await p.select({
      message: "Which category would you like to update?",
      options: [
        ...remaining.map((c) => ({
          value: c,
          label: c,
          hint: hintForCategory(
            {
              ...config,
              inputs: { ...config.inputs, ...baseline },
              advanced: workingAdvanced,
              categoryConfigs: workingCategoryConfigs,
            },
            c,
          ),
        })),
        { value: "__done__" as const, label: "Done — proceed to preview" },
      ],
    });
    handleCancel(picked);

    if (picked === "__done__") {
      done = true;
      break;
    }

    const category = picked as string;
    const beforeBaseline = { ...baseline };
    const beforeAdvanced =
      workingAdvanced !== undefined ? { ...workingAdvanced } : undefined;
    const beforeCatCfg = { ...workingCategoryConfigs };

    if (category === "color") {
      const brandRaw = await p.text({
        message: "Primary brand color (hex)",
        placeholder: baseline.brandColor,
        initialValue: baseline.brandColor,
        validate: validateHexColor,
      });
      handleCancel(brandRaw);
      baseline = {
        ...baseline,
        brandColor: normalizeHex(String(brandRaw).trim()),
      };
      const colorAdv = await collectAdvancedColor(priorContext);
      if (colorAdv !== undefined) {
        workingAdvanced = { ...workingAdvanced, color: colorAdv };
      } else if (workingAdvanced?.color !== undefined) {
        const cleared: AdvancedConfig = { ...workingAdvanced };
        delete cleared.color;
        workingAdvanced =
          Object.keys(cleared).length > 0 ? cleared : undefined;
      }
    } else if (category === "spacing") {
      const basePick = await p.select({
        message: "Spacing base unit",
        options: [
          {
            value: 4 as const,
            label: "4px base",
            hint: "Tighter layouts",
          },
          {
            value: 8 as const,
            label: "8px base",
            hint: "Roomier layouts",
          },
        ],
        initialValue: baseline.spacingBase,
      });
      handleCancel(basePick);
      baseline = { ...baseline, spacingBase: basePick as 4 | 8 };
      const spacingAdv = await collectAdvancedSpacing(
        baseline.spacingBase,
        priorContext,
      );
      if (spacingAdv !== undefined) {
        workingAdvanced = { ...workingAdvanced, spacing: spacingAdv };
      } else if (workingAdvanced?.spacing !== undefined) {
        const cleared: AdvancedConfig = { ...workingAdvanced };
        delete cleared.spacing;
        workingAdvanced =
          Object.keys(cleared).length > 0 ? cleared : undefined;
      }
    } else if (category === "typography") {
      const scale = await p.select({
        message: "Type scale",
        options: [
          {
            value: "compact" as const,
            label: "Compact (Minor Third)",
          },
          {
            value: "balanced" as const,
            label: "Balanced (Major Third)",
          },
          {
            value: "spacious" as const,
            label: "Spacious (Perfect Fourth)",
          },
        ],
        initialValue: baseline.typeScale,
      });
      handleCancel(scale);
      baseline = { ...baseline, typeScale: scale };
      const typoAdv = await collectAdvancedTypography(
        baseline.typeScale,
        priorContext,
      );
      if (typoAdv !== undefined) {
        workingAdvanced = { ...workingAdvanced, typography: typoAdv };
      } else if (workingAdvanced?.typography !== undefined) {
        const cleared: AdvancedConfig = { ...workingAdvanced };
        delete cleared.typography;
        workingAdvanced =
          Object.keys(cleared).length > 0 ? cleared : undefined;
      }
    } else if (isAddableCategory(category)) {
      const colorRefs = await buildAvailableColorRefsForConfig(
        config,
        baseline,
        workingAdvanced,
      );
      if (category === "shadow") {
        const input = await collectShadowInputs(
          workingCategoryConfigs.shadow,
          colorRefs,
        );
        workingCategoryConfigs = { ...workingCategoryConfigs, shadow: input };
      } else if (category === "border") {
        const input = await collectBorderInputs(workingCategoryConfigs.border);
        workingCategoryConfigs = { ...workingCategoryConfigs, border: input };
      } else {
        const input = await collectAnimationInputs(
          workingCategoryConfigs.animation,
        );
        workingCategoryConfigs = {
          ...workingCategoryConfigs,
          animation: input,
        };
      }
    } else {
      p.log.warn(`Unknown category "${category}" — skipping.`);
      continue;
    }

    let changed = false;
    if (category === "color") {
      changed =
        stableJson(beforeBaseline.brandColor) !==
          stableJson(baseline.brandColor) ||
        stableJson(beforeAdvanced?.color) !== stableJson(workingAdvanced?.color);
    } else if (category === "spacing") {
      changed =
        beforeBaseline.spacingBase !== baseline.spacingBase ||
        stableJson(beforeAdvanced?.spacing) !==
          stableJson(workingAdvanced?.spacing);
    } else if (category === "typography") {
      changed =
        beforeBaseline.typeScale !== baseline.typeScale ||
        stableJson(beforeAdvanced?.typography) !==
          stableJson(workingAdvanced?.typography);
    } else if (isAddableCategory(category)) {
      changed =
        stableJson(beforeCatCfg[category]) !==
        stableJson(workingCategoryConfigs[category]);
    }

    if (changed) {
      modified.add(category);
    }
    visited.add(category);

    const again = await p.confirm({
      message: "Modify another category?",
      initialValue: false,
    });
    handleCancel(again);
    if (!again) {
      done = true;
    }
  }

  return {
    modifiedCategories: [...modified],
    nextOptions: baseline,
    nextAdvanced: workingAdvanced,
    nextCategoryConfigs: workingCategoryConfigs,
  };
}

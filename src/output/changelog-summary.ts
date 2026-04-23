import type { OutputResult } from "../pipeline/output.js";
import type { QuietoConfig } from "../types/config.js";
import type { QuickStartOptions } from "../types.js";
import { sortCategoriesCanonical } from "../utils/categories.js";
import { normalizeHex } from "../utils/color.js";
import {
  extractDtcgRefPaths,
  type TokenChange,
  type TokenDiff,
} from "../ui/diff.js";
import type { ThemeCollection } from "../types/tokens.js";

export type InitChangelogContext = "initial" | "regenerate" | "modify";

function countByKind(changes: readonly TokenChange[], kind: TokenChange["kind"]): number {
  return changes.filter((c) => c.kind === kind).length;
}

function semanticChangeTotal(diff: TokenDiff): number {
  let n = 0;
  for (const ch of diff.semanticChanges.values()) {
    n += ch.length;
  }
  return n;
}

/**
 * Reuses the same primitive-name → affected-semantics count as
 * `renderCascadeSummary` for a concise changelog line.
 */
function buildCascadeChangelogLine(diff: TokenDiff, current: ThemeCollection): string | null {
  const nPrim = diff.primitiveChanges.length;
  if (nPrim === 0) {
    return null;
  }
  const byCatCount = new Map<string, number>();
  for (const c of diff.primitiveChanges) {
    byCatCount.set(c.category, (byCatCount.get(c.category) ?? 0) + 1);
  }
  const catParts: string[] = [];
  for (const cat of sortCategoriesCanonical([...byCatCount.keys()])) {
    const n = byCatCount.get(cat) ?? 0;
    if (n > 0) {
      catParts.push(`${n} ${cat} primitive${n === 1 ? "" : "s"}`);
    }
  }
  const modPrim = diff.primitiveChanges.filter((c) => c.kind === "modified");
  const addPrim = diff.primitiveChanges.filter((c) => c.kind === "added");
  const remPrim = diff.primitiveChanges.filter((c) => c.kind === "removed");
  const head =
    catParts.length > 0
      ? `Changing ${catParts.join(" and ")}`
      : `Changing ${nPrim} token${nPrim === 1 ? "" : "s"}`;

  const changedNames = new Set(
    [
      ...modPrim.map((c) => c.name),
      ...addPrim.map((c) => c.name),
      ...remPrim.map((c) => c.name),
    ],
  );
  let mAffected = 0;
  for (const t of current.themes) {
    for (const st of t.semanticTokens) {
      for (const ref of extractDtcgRefPaths(st.$value)) {
        if (changedNames.has(ref)) {
          mAffected += 1;
          break;
        }
      }
    }
  }
  if (mAffected === 0) {
    return "No semantic tokens reference the changed primitives.";
  }
  return `${head} affected ${mAffected} semantic token${mAffected === 1 ? "" : "s"}.`;
}

/**
 * @param context - `initial` = no prior `quieto.config.json`. `regenerate` =
 *   `init` on a project that had a config and chose “start fresh”. `modify` =
 *   the modify flow from an existing system.
 */
function figmaChangelogLine(output: OutputResult | undefined): string {
  if (output?.figmaFiles && output.figmaFiles.length > 0) {
    return [
      "",
      "- Also generated Figma / Tokens Studio JSON at `build/tokens.figma.json` (alongside CSS in `build/`).",
    ].join("\n");
  }
  return "";
}

export function buildInitSummary(
  collection: ThemeCollection,
  context: InitChangelogContext = "initial",
  output?: OutputResult,
): string {
  const nPrim = collection.primitives.length;
  const nSem = collection.themes.reduce(
    (acc, t) => acc + t.semanticTokens.length,
    0,
  );
  const k = collection.themes.length;
  if (context === "modify") {
    return `Regenerated token system via init modify-flow. Created ${nPrim} primitives, ${nSem} semantic tokens.${figmaChangelogLine(output)}`;
  }
  if (context === "regenerate") {
    return [
      "Regenerated token system.",
      "",
      `- Created ${nPrim} primitives, ${nSem} semantic tokens across ${k} theme${k === 1 ? "" : "s"}.`,
      figmaChangelogLine(output),
    ]
      .filter((line) => line.length > 0)
      .join("\n");
  }
  return [
    "Initial token system generated.",
    "",
    `- Created ${nPrim} primitives, ${nSem} semantic tokens across ${k} theme${k === 1 ? "" : "s"}.`,
    figmaChangelogLine(output),
  ]
    .filter((line) => line.length > 0)
    .join("\n");
}

export interface ConfigDelta {
  changes: string[];
}

export function detectConfigDelta(
  prior: QuietoConfig,
  current: Partial<QuickStartOptions>,
): ConfigDelta {
  const changes: string[] = [];
  if (current.brandColor !== undefined) {
    let a: string;
    let b: string;
    try {
      a = normalizeHex(prior.inputs.brandColor);
    } catch {
      a = prior.inputs.brandColor;
    }
    try {
      b = normalizeHex(current.brandColor);
    } catch {
      b = current.brandColor;
    }
    if (a.toLowerCase() !== b.toLowerCase()) {
      changes.push(`Brand color changed from ${a} to ${b}.`);
    }
  }
  if (current.spacingBase !== undefined) {
    if (prior.inputs.spacingBase !== current.spacingBase) {
      changes.push(
        `Spacing base changed from ${prior.inputs.spacingBase} to ${current.spacingBase}.`,
      );
    }
  }
  if (current.typeScale !== undefined) {
    if (prior.inputs.typeScale !== current.typeScale) {
      changes.push(
        `Type scale changed from ${prior.inputs.typeScale} to ${current.typeScale}.`,
      );
    }
  }
  if (current.generateThemes !== undefined) {
    if (prior.inputs.darkMode !== current.generateThemes) {
      const from = prior.inputs.darkMode ? "light + dark" : "light only";
      const to = current.generateThemes ? "light + dark" : "light only";
      changes.push(
        `Theme generation changed from ${from} to ${to}.`,
      );
    }
  }
  return { changes };
}

/**
 * Renders a markdown summary for a selective `update` run using the
 * existing {@link TokenDiff} from the terminal diff.
 */
export function buildUpdateSummary(
  diff: TokenDiff,
  current: ThemeCollection,
  configDelta?: ConfigDelta,
  output?: OutputResult,
): string {
  const pMod = countByKind(diff.primitiveChanges, "modified");
  const pAdd = countByKind(diff.primitiveChanges, "added");
  const pRem = countByKind(diff.primitiveChanges, "removed");
  const semTotal = semanticChangeTotal(diff);
  const themeWithSem = diff.semanticChanges.size;

  const lines: string[] = [];
  if (configDelta && configDelta.changes.length > 0) {
    for (const c of configDelta.changes) {
      lines.push(c);
    }
    lines.push("");
  }

  lines.push(
    `- **Primitives:** ${pMod} modified, ${pAdd} added, ${pRem} removed`,
  );
  lines.push(
    `- **Semantics:** ${semTotal} remapped across ${themeWithSem} theme${themeWithSem === 1 ? "" : "s"}`,
  );
  if (output?.figmaFiles && output.figmaFiles.length > 0) {
    lines.push(
      "- **Figma JSON:** `build/tokens.figma.json` regenerated (alongside CSS).",
    );
  }
  const cascade = buildCascadeChangelogLine(diff, current);
  if (cascade) {
    lines.push(`- ${cascade}`);
  }
  return lines.join("\n");
}

/**
 * For `quieto-tokens add` — the collection must contain the new category
 * the pipeline just added.
 */
export function buildAddSummary(
  category: string,
  collection: ThemeCollection,
  output?: OutputResult,
): string {
  const primN = collection.primitives.filter((p) => p.category === category).length;
  let semN = 0;
  for (const th of collection.themes) {
    for (const st of th.semanticTokens) {
      if (st.category === category) semN += 1;
    }
  }
  const figma =
    output?.figmaFiles && output.figmaFiles.length > 0
      ? [
          "",
          "- Figma JSON at `build/tokens.figma.json` was regenerated (alongside CSS).",
        ].join("\n")
      : "";
  return [
    `Added ${category} category.`,
    "",
    `- Created ${primN} primitive token${primN === 1 ? "" : "s"}, ${semN} semantic token${semN === 1 ? "" : "s"}.`,
    figma,
  ]
    .filter((s) => s.length > 0)
    .join("\n");
}

export function buildComponentSummary(
  componentName: string,
  tokenCount: number,
  isReauthor: boolean,
  output?: OutputResult,
): string {
  const first = isReauthor
    ? `Re-authored component tokens for ${componentName}.`
    : `Added component tokens for ${componentName}.`;
  const figma =
    output?.figmaFiles && output.figmaFiles.length > 0
      ? [
          "",
          "- Figma JSON at `build/tokens.figma.json` was regenerated (alongside CSS).",
        ].join("\n")
      : "";
  return [first, "", `- Created ${tokenCount} component token${tokenCount === 1 ? "" : "s"}.`, figma]
    .filter((s) => s.length > 0)
    .join("\n");
}

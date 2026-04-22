import { mkdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
  ComponentToken,
  PrimitiveToken,
  SemanticToken,
  ThemeCollection,
} from "../types/tokens.js";
import { sortCategoriesCanonical } from "../utils/categories.js";

type DtcgLeaf = {
  $type: string;
  /**
   * DTCG leaf value. Scalar types (`color`, `dimension`, …) serialize as
   * strings; composite types (`shadow`, `cubicBezier`, …) serialize as
   * parsed objects/arrays so Style Dictionary's DTCG reader can walk into
   * them for nested reference resolution (e.g. `{color.neutral.900}`
   * embedded in a shadow's `color` field). If we left composites as
   * JSON-stringified blobs, SD would treat the whole `"{...}"` string as
   * one unresolvable ref and fail the build with "broken references".
   */
  $value: string | object;
  $description?: string;
};

type DtcgTree = { [key: string]: DtcgTree | DtcgLeaf };

/**
 * Generators that stringify composite shapes in-memory (`shadow`,
 * `cubicBezier`) — see `generateShadowPrimitives` / `generateAnimationPrimitives`.
 * Only those `$type`s are decoded at the write boundary; all other types
 * keep `$value` as a string so a scalar that happens to look like JSON
 * (e.g. a future `"[1,2,3]"` literal) is never reinterpreted.
 */
const COMPOSITE_JSON_DECODE_TYPES = new Set<string>(["shadow", "cubicBezier"]);

function parsedCompositeHasBannedKeys(node: unknown): boolean {
  if (node === null || typeof node !== "object") return false;
  if (Array.isArray(node)) {
    return node.some((item) => parsedCompositeHasBannedKeys(item));
  }
  const obj = node as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(obj, "__proto__")) return true;
  if (Object.prototype.hasOwnProperty.call(obj, "constructor")) return true;
  return Object.values(obj).some((v) => parsedCompositeHasBannedKeys(v));
}

/**
 * Decode a stringified-JSON composite `$value` into a native object/array
 * for known composite `$type`s only. Leading whitespace is ignored before
 * the `{` / `[` probe and before `JSON.parse`. DTCG refs (`{color.blue.500}`)
 * are not valid JSON — `JSON.parse` throws and the original string is kept.
 *
 * Parsed trees containing `__proto__` or `constructor` own keys (at any
 * depth) are rejected — they would serialize back into prototype-pollution
 * hazards on disk.
 */
function decodeCompositeValue(value: string, $type: string): string | object {
  if (!COMPOSITE_JSON_DECODE_TYPES.has($type)) return value;
  const trimmed = value.trimStart();
  if (trimmed.length === 0) return value;
  const first = trimmed[0];
  if (first !== "{" && first !== "[") return value;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (typeof parsed !== "object" || parsed === null) return value;
    if (parsedCompositeHasBannedKeys(parsed)) {
      throw new Error(
        `Refusing to decode composite $value for $type "${$type}": forbidden key __proto__ or constructor`,
      );
    }
    return parsed;
  } catch (e) {
    if (e instanceof SyntaxError) return value;
    throw e;
  }
}

async function bestEffortUnlinkPaths(paths: readonly string[]): Promise<void> {
  for (const filePath of paths) {
    try {
      await unlink(filePath);
    } catch {
      // advisory cleanup — ignore ENOENT and other races
    }
  }
}

/**
 * Root-level banner written to every generated DTCG JSON file. Marks the
 * file as tool-generated per ADR-001 so users do not hand-edit it expecting
 * their changes to survive `add`/`init` re-runs.
 *
 * DTCG reserves `$`-prefixed keys at the group level; Style Dictionary's
 * DTCG reader ignores them when walking for tokens, so this is safe to
 * place alongside the token tree.
 */
export interface DtcgMetadata {
  generatedBy: "quieto-tokens";
  /**
   * AC 16 / ADR-001 contract: every generated DTCG JSON file carries
   * `doNotEdit: true` at its `$metadata` root so downstream consumers and
   * humans inspecting the file have an unambiguous signal not to hand-edit.
   */
  doNotEdit: true;
  generatedAt: string;
  notice: string;
}

export function buildDtcgMetadata(
  generatedAt: string = new Date().toISOString(),
): DtcgMetadata {
  return {
    generatedBy: "quieto-tokens",
    doNotEdit: true,
    generatedAt,
    notice:
      "This file is tool-generated. Edit quieto.config.json and re-run `quieto-tokens init` instead.",
  };
}

/**
 * Serialized document shape — `$metadata` plus the token tree. Kept as a
 * `Record<string, unknown>` because TypeScript cannot express "index
 * signature excluding one known key" without contortions, and the file is
 * only consumed via `JSON.stringify`.
 */
type DtcgDocument = Record<string, unknown>;

type AnyToken = PrimitiveToken | SemanticToken | ComponentToken;

export function tokensToDtcgTree(tokens: AnyToken[]): DtcgTree {
  const root: DtcgTree = {};

  for (const token of tokens) {
    if (token.path.length === 0) continue;

    let cursor: DtcgTree = root;
    for (let i = 0; i < token.path.length - 1; i++) {
      const segment = token.path[i]!;
      const next = cursor[segment];
      if (next === undefined) {
        const branch: DtcgTree = {};
        cursor[segment] = branch;
        cursor = branch;
      } else if (isLeaf(next)) {
        // DTCG allows a node to be both a token ($type/$value) and a group
        // with child tokens — e.g. component default state at `button.primary.color.background`
        // alongside hover state at `button.primary.color.background.hover`.
        cursor = next as unknown as DtcgTree;
      } else {
        cursor = next;
      }
    }

    const leafKey = token.path[token.path.length - 1]!;
    const existing = cursor[leafKey];
    if (existing !== undefined) {
      if (isLeaf(existing)) {
        throw new Error(
          `Duplicate token path: "${token.path.join(".")}" is defined more than once.`,
        );
      }
      // Node already exists as a group (children placed first); merge token
      // definition into it — valid DTCG (a group that is also a token).
      const group = existing as Record<string, unknown>;
      // Guard: if this group was already merged with token data (e.g. same path
      // repeated after a prior group→leaf merge), treat it as a duplicate rather
      // than silently overwriting the stored $type/$value.
      if ("$type" in group || "$value" in group) {
        throw new Error(
          `Duplicate token path: "${token.path.join(".")}" is defined more than once.`,
        );
      }
      group.$type = token.$type;
      group.$value = decodeCompositeValue(token.$value, token.$type);
      if (token.description !== undefined && token.description.length > 0) {
        group.$description = token.description;
      }
    } else {
      const leaf: DtcgLeaf = {
        $type: token.$type,
        $value: decodeCompositeValue(token.$value, token.$type),
      };
      if (token.description !== undefined && token.description.length > 0) {
        leaf.$description = token.description;
      }
      cursor[leafKey] = leaf;
    }
  }

  return root;
}

function isLeaf(node: DtcgTree | DtcgLeaf): node is DtcgLeaf {
  return "$value" in node && "$type" in node;
}

async function writeJsonFile(
  filePath: string,
  content: DtcgTree,
  metadata: DtcgMetadata,
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  // `$metadata` must land at the top for human readability AND must not be
  // clobberable by a future token tree that happens to emit a root-level
  // `$metadata` key. Spread `content` first, then assign `$metadata` last
  // to guarantee the banner wins regardless of tree shape.
  const document: DtcgDocument = { ...content };
  document.$metadata = metadata;
  // Re-key so `$metadata` is first in iteration order (matters for
  // JSON.stringify output ordering — users eyeball the file top-down).
  const ordered: DtcgDocument = { $metadata: metadata };
  for (const key of Object.keys(document)) {
    if (key === "$metadata") continue;
    ordered[key] = document[key];
  }
  await writeFile(filePath, JSON.stringify(ordered, null, 2) + "\n", "utf-8");
}

function byCategory<T extends { category: string }>(
  tokens: T[],
  category: string,
): T[] {
  return tokens.filter((t) => t.category === category);
}

function collectCategories(tokens: ReadonlyArray<{ category: string }>): string[] {
  const set = new Set<string>();
  for (const t of tokens) set.add(t.category);
  // Route every iteration through the canonical order helper so file-write
  // order + log output stay deterministic regardless of the caller's input
  // sequence. New categories tacked onto the end of an existing list
  // (story 2.2's add flow) still land in the stable spot.
  return sortCategoriesCanonical([...set]);
}

/**
 * Subset of categories the writer is allowed to emit for a given call.
 *
 * - `"all"` (default): every category present in `collection.primitives` /
 *   `theme.semanticTokens` is written — the behaviour Story 1.8 / 2.1
 *   relies on for the `init` flow.
 * - `{ categories }`: only files whose basename matches one of the listed
 *   category names are written. The in-memory collection can still carry
 *   other categories (for CSS source-from-disk to see a complete tree);
 *   the writer simply won't touch their JSON files.
 *
 * Introduced by Story 2.4 to enforce Story 2.2 AC #16 on the `add`
 * pipeline: `quieto-tokens add border` must only (re)write
 * `tokens/primitive/border.json` and `tokens/semantic/<theme>/border.json`,
 * leaving every other category's mtime stable.
 */
export type WriteScope = "all" | { categories: readonly string[] };

export interface WriteTokensOptions {
  /**
   * Override for deterministic `$metadata.generatedAt`. Defaults to
   * `new Date().toISOString()` at call-time.
   */
  generatedAt?: string;
  /**
   * Restrict which categories land on disk. See {@link WriteScope}.
   * Defaults to `"all"` — the historical Epic 1 behaviour.
   */
  scope?: WriteScope;
}

function isCategoryInScope(
  scope: WriteScope | undefined,
  category: string,
): boolean {
  if (scope === undefined || scope === "all") return true;
  return scope.categories.includes(category);
}

export async function writeTokensToJson(
  collection: ThemeCollection,
  outputDir: string,
  options: WriteTokensOptions = {},
): Promise<string[]> {
  const themeNames = collection.themes.map((t) => t.name);
  if (new Set(themeNames).size !== themeNames.length) {
    throw new Error(
      `Duplicate theme names in collection: ${themeNames.join(", ")}`,
    );
  }

  if (
    options.scope !== undefined &&
    typeof options.scope === "object" &&
    options.scope.categories.length === 0
  ) {
    throw new Error(
      'writeTokensToJson: scope.categories must be non-empty when using a scoped write; use scope: "all" instead.',
    );
  }

  // One metadata object per run, reused across every file — the timestamp
  // stays identical across all files generated in a single init pass so
  // users can correlate them at a glance.
  const metadata = buildDtcgMetadata(options.generatedAt);

  const written: string[] = [];
  try {
    const primitiveCategories = collectCategories(collection.primitives);
    for (const category of primitiveCategories) {
      if (!isCategoryInScope(options.scope, category)) continue;
      const primitivesInCategory = byCategory(collection.primitives, category);
      if (primitivesInCategory.length === 0) continue;

      const tree = tokensToDtcgTree(primitivesInCategory);
      const filePath = join(
        outputDir,
        "tokens",
        "primitive",
        `${category}.json`,
      );
      await writeJsonFile(filePath, tree, metadata);
      written.push(filePath);
    }

    for (const theme of collection.themes) {
      const semanticCategories = collectCategories(theme.semanticTokens);
      for (const category of semanticCategories) {
        if (!isCategoryInScope(options.scope, category)) continue;
        const semanticsInCategory = byCategory(theme.semanticTokens, category);
        if (semanticsInCategory.length === 0) continue;

        const tree = tokensToDtcgTree(semanticsInCategory);
        const filePath = join(
          outputDir,
          "tokens",
          "semantic",
          theme.name,
          `${category}.json`,
        );
        await writeJsonFile(filePath, tree, metadata);
        written.push(filePath);
      }
    }
  } catch (err) {
    await bestEffortUnlinkPaths(written);
    throw err;
  }

  if (
    options.scope !== undefined &&
    typeof options.scope === "object" &&
    "categories" in options.scope
  ) {
    for (const c of options.scope.categories) {
      const produced = written.some(
        (w) => w.endsWith(`/${c}.json`) || w.endsWith(`\\${c}.json`),
      );
      if (!produced) {
        throw new Error(
          `writeTokensToJson: scope category "${c}" produced no JSON files — no tokens for that category in the collection`,
        );
      }
    }
  }

  if (collection.components?.length) {
    const componentFiles = await writeComponentTokens(
      collection.components,
      outputDir,
      { generatedAt: options.generatedAt },
    );
    written.push(...componentFiles);
  }

  return written;
}

export async function writeComponentTokens(
  tokens: ComponentToken[],
  outputDir: string,
  options: { generatedAt?: string } = {},
): Promise<string[]> {
  const metadata = buildDtcgMetadata(options.generatedAt);
  const written: string[] = [];

  const byComponent = new Map<string, ComponentToken[]>();
  for (const t of tokens) {
    const existing = byComponent.get(t.componentName);
    if (existing) {
      existing.push(t);
    } else {
      byComponent.set(t.componentName, [t]);
    }
  }

  try {
    for (const [componentName, componentTokens] of byComponent) {
      const tree = tokensToDtcgTree(componentTokens);
      const filePath = join(
        outputDir,
        "tokens",
        "component",
        `${componentName}.json`,
      );
      await writeJsonFile(filePath, tree, metadata);
      written.push(filePath);
    }
  } catch (err) {
    await bestEffortUnlinkPaths(written);
    throw err;
  }

  return written;
}

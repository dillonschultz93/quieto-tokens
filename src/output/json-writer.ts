import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
  PrimitiveToken,
  SemanticToken,
  ThemeCollection,
} from "../types/tokens.js";
import { sortCategoriesCanonical } from "../utils/categories.js";

type DtcgLeaf = {
  $type: string;
  $value: string;
  $description?: string;
};

type DtcgTree = { [key: string]: DtcgTree | DtcgLeaf };

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

type AnyToken = PrimitiveToken | SemanticToken;

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
        throw new Error(
          `Token path collision: "${token.path.slice(0, i + 1).join(".")}" is already a leaf but token "${token.path.join(".")}" requires it as a group.`,
        );
      } else {
        cursor = next;
      }
    }

    const leafKey = token.path[token.path.length - 1]!;
    if (cursor[leafKey] !== undefined) {
      throw new Error(
        `Duplicate token path: "${token.path.join(".")}" is defined more than once.`,
      );
    }

    const leaf: DtcgLeaf = {
      $type: token.$type,
      $value: token.$value,
    };
    if (token.description !== undefined && token.description.length > 0) {
      leaf.$description = token.description;
    }
    cursor[leafKey] = leaf;
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

export interface WriteTokensOptions {
  /**
   * Override for deterministic `$metadata.generatedAt`. Defaults to
   * `new Date().toISOString()` at call-time.
   */
  generatedAt?: string;
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

  // One metadata object per run, reused across every file — the timestamp
  // stays identical across all files generated in a single init pass so
  // users can correlate them at a glance.
  const metadata = buildDtcgMetadata(options.generatedAt);

  const written: string[] = [];

  const primitiveCategories = collectCategories(collection.primitives);
  for (const category of primitiveCategories) {
    const primitivesInCategory = byCategory(collection.primitives, category);
    if (primitivesInCategory.length === 0) continue;

    const tree = tokensToDtcgTree(primitivesInCategory);
    const filePath = join(outputDir, "tokens", "primitive", `${category}.json`);
    await writeJsonFile(filePath, tree, metadata);
    written.push(filePath);
  }

  for (const theme of collection.themes) {
    const semanticCategories = collectCategories(theme.semanticTokens);
    for (const category of semanticCategories) {
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

  return written;
}

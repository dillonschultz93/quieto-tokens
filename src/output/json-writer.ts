import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
  PrimitiveToken,
  SemanticToken,
  ThemeCollection,
} from "../types/tokens.js";

type DtcgLeaf = {
  $type: string;
  $value: string;
  $description?: string;
};

type DtcgTree = { [key: string]: DtcgTree | DtcgLeaf };

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
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(content, null, 2) + "\n", "utf-8");
}

const CATEGORIES = ["color", "spacing", "typography"] as const;
type Category = (typeof CATEGORIES)[number];

function byCategory<T extends { category: string }>(
  tokens: T[],
  category: Category,
): T[] {
  return tokens.filter((t) => t.category === category);
}

export async function writeTokensToJson(
  collection: ThemeCollection,
  outputDir: string,
): Promise<string[]> {
  const themeNames = collection.themes.map((t) => t.name);
  if (new Set(themeNames).size !== themeNames.length) {
    throw new Error(
      `Duplicate theme names in collection: ${themeNames.join(", ")}`,
    );
  }

  const written: string[] = [];

  for (const category of CATEGORIES) {
    const primitivesInCategory = byCategory(collection.primitives, category);
    if (primitivesInCategory.length === 0) continue;

    const tree = tokensToDtcgTree(primitivesInCategory);
    const filePath = join(outputDir, "tokens", "primitive", `${category}.json`);
    await writeJsonFile(filePath, tree);
    written.push(filePath);
  }

  for (const theme of collection.themes) {
    for (const category of CATEGORIES) {
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
      await writeJsonFile(filePath, tree);
      written.push(filePath);
    }
  }

  return written;
}

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type {
  ComponentToken,
  PrimitiveToken,
  SemanticToken,
} from "../types/tokens.js";

export interface DiskLoadLogger {
  warn: (msg: string) => void;
}

const COMPOSITE_TYPES = new Set<string>(["shadow", "cubicBezier"]);

function isEnoent(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as NodeJS.ErrnoException).code === "ENOENT"
  );
}

function leafValueToString($type: string, $value: unknown): string {
  if (typeof $value === "string") return $value;
  if (
    COMPOSITE_TYPES.has($type) &&
    $value !== null &&
    typeof $value === "object"
  ) {
    return JSON.stringify($value);
  }
  return String($value);
}

function checkMetadata(
  doc: Record<string, unknown>,
  filePath: string,
  logger: DiskLoadLogger | undefined,
): void {
  const meta = doc.$metadata;
  if (!meta || typeof meta !== "object") {
    logger?.warn(
      `Missing $metadata in ${filePath} — file may not be tool-generated.`,
    );
    return;
  }
  if (!(meta as { doNotEdit?: unknown }).doNotEdit) {
    logger?.warn(
      `Missing doNotEdit in $metadata for ${filePath} — proceeding with load.`,
    );
  }
}

type LeafCallback = (
  pathSegments: string[],
  $type: string,
  $value: unknown,
  description?: string,
) => void;

function walkDtcgLeaves(
  node: unknown,
  prefix: string[],
  cb: LeafCallback,
): void {
  if (node === null || typeof node !== "object" || Array.isArray(node)) {
    return;
  }
  const obj = node as Record<string, unknown>;
  for (const [key, child] of Object.entries(obj)) {
    if (key === "$metadata") continue;
    if (
      child !== null &&
      typeof child === "object" &&
      !Array.isArray(child) &&
      typeof (child as Record<string, unknown>).$type === "string" &&
      Object.prototype.hasOwnProperty.call(child, "$value")
    ) {
      const leaf = child as Record<string, unknown>;
      cb(
        [...prefix, key],
        leaf.$type as string,
        leaf.$value,
        typeof leaf.$description === "string" ? leaf.$description : undefined,
      );
      continue;
    }
    walkDtcgLeaves(child, [...prefix, key], cb);
  }
}

/**
 * Load DTCG primitive tokens for the listed categories from
 * `<projectRoot>/<tokensRelativeDir>/primitive/<category>.json`.
 */
export async function loadPrimitivesFromDisk(
  projectRoot: string,
  tokensRelativeDir: string,
  categories: readonly string[],
  logger?: DiskLoadLogger,
): Promise<PrimitiveToken[]> {
  const out: PrimitiveToken[] = [];
  const base = join(projectRoot, tokensRelativeDir, "primitive");
  for (const category of categories) {
    const filePath = join(base, `${category}.json`);
    try {
      const raw = await readFile(filePath, "utf-8");
      const doc = JSON.parse(raw) as Record<string, unknown>;
      checkMetadata(doc, filePath, logger);
      walkDtcgLeaves(doc, [], (segments, $type, $value, description) => {
        const pathSegs = segments;
        const cat = pathSegs[0] ?? category;
        const t: PrimitiveToken = {
          tier: "primitive",
          category: cat,
          name: pathSegs.join("."),
          $type,
          $value: leafValueToString($type, $value),
          path: pathSegs,
        };
        if (description !== undefined && description.length > 0) {
          t.description = description;
        }
        out.push(t);
      });
    } catch (e: unknown) {
      if (isEnoent(e)) {
        logger?.warn(
          `Missing primitive file for category "${category}" at ${filePath} — skipping.`,
        );
        continue;
      }
      throw e;
    }
  }
  return out;
}

/**
 * Load semantic tokens for the given themes and semantic categories from
 * `tokens/semantic/<theme>/<category>.json`. Returns a map of theme name →
 * concatenated semantic tokens for that pass.
 */
export async function loadSemanticTokensFromDisk(
  projectRoot: string,
  tokensRelativeDir: string,
  themes: readonly string[],
  categories: readonly string[],
  logger?: DiskLoadLogger,
): Promise<Map<string, SemanticToken[]>> {
  const map = new Map<string, SemanticToken[]>();
  for (const theme of themes) {
    map.set(theme, []);
  }
  for (const theme of themes) {
    const bucket = map.get(theme)!;
    for (const category of categories) {
      const filePath = join(
        projectRoot,
        tokensRelativeDir,
        "semantic",
        theme,
        `${category}.json`,
      );
      try {
        const raw = await readFile(filePath, "utf-8");
        const doc = JSON.parse(raw) as Record<string, unknown>;
        checkMetadata(doc, filePath, logger);
        walkDtcgLeaves(doc, [], (segments, $type, $value, description) => {
          const pathSegs = segments;
          const cat = pathSegs[0] ?? category;
          const t: SemanticToken = {
            tier: "semantic",
            category: cat,
            name: pathSegs.join("."),
            $type,
            $value: leafValueToString($type, $value),
            path: pathSegs,
          };
          if (description !== undefined && description.length > 0) {
            t.description = description;
          }
          bucket.push(t);
        });
      } catch (e: unknown) {
        if (isEnoent(e)) {
          logger?.warn(
            `Missing semantic file for theme "${theme}" category "${category}" at ${filePath} — skipping.`,
          );
          continue;
        }
        throw e;
      }
    }
  }
  return map;
}

/**
 * Load all component token JSON files from `tokens/component/*.json`.
 */
export async function loadComponentTokensFromDisk(
  projectRoot: string,
  tokensRelativeDir: string,
  logger?: DiskLoadLogger,
): Promise<ComponentToken[]> {
  const dir = join(projectRoot, tokensRelativeDir, "component");
  let names: string[];
  try {
    names = await readdir(dir);
  } catch (e: unknown) {
    if (isEnoent(e)) {
      return [];
    }
    throw e;
  }
  const out: ComponentToken[] = [];
  for (const name of names) {
    if (!name.endsWith(".json") || name.startsWith(".")) continue;
    const componentName = name.replace(/\.json$/i, "");
    const filePath = join(dir, name);
    try {
      const raw = await readFile(filePath, "utf-8");
      const doc = JSON.parse(raw) as Record<string, unknown>;
      checkMetadata(doc, filePath, logger);
      walkDtcgLeaves(doc, [], (segments, $type, $value, description) => {
        const pathSegs = [componentName, ...segments];
        const t: ComponentToken = {
          tier: "component",
          category: "component",
          componentName,
          name: pathSegs.join("."),
          $type,
          $value: leafValueToString($type, $value),
          path: pathSegs,
        };
        if (description !== undefined && description.length > 0) {
          t.description = description;
        }
        out.push(t);
      });
    } catch (e: unknown) {
      if (isEnoent(e)) {
        logger?.warn(`Missing component file ${filePath} — skipping.`);
        continue;
      }
      throw e;
    }
  }
  return out;
}

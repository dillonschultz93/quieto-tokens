import * as fsPromises from "node:fs/promises";
import { join, relative } from "node:path";
import * as p from "@clack/prompts";

/**
 * Test seam: every fs call the pruner makes is routed through this
 * object. Tests can override individual methods to exercise error
 * branches without resorting to ESM namespace spies (which the test
 * runner disallows) or to fragile real-disk permission tricks.
 *
 * `lstat` is used rather than `stat` throughout so symlinks don't
 * smuggle us into unrelated directories.
 */
export const _fs: {
  readdir: (dir: string) => Promise<string[]>;
  unlink: (path: string) => Promise<void>;
  lstat: (path: string) => Promise<{
    isFile: () => boolean;
    isDirectory: () => boolean;
    isSymbolicLink: () => boolean;
  }>;
  rmdir: (path: string) => Promise<void>;
} = {
  readdir: (dir) => fsPromises.readdir(dir),
  unlink: (path) => fsPromises.unlink(path),
  lstat: (path) => fsPromises.lstat(path),
  rmdir: (path) => fsPromises.rmdir(path),
};

export interface PruneResult {
  removed: string[];
  errors: Array<{ path: string; error: Error }>;
}

/**
 * Prune per-category token JSON files that no longer belong to
 * `canonicalCategories`. The canonical list is the source of truth —
 * anything on disk whose basename falls outside it is deleted.
 *
 * Scope:
 * - `<cwd>/tokens/primitive/*.json` is scanned.
 * - `<cwd>/tokens/semantic/` is scanned wholesale; any subdirectory
 *   not in {@link activeThemes} is treated as a fully-orphaned theme
 *   (from a prior run that used different theme settings) — every
 *   `*.json` inside is removed and the directory itself is removed if
 *   it ends up empty. Subdirectories IN {@link activeThemes} are
 *   scanned for category orphans only.
 * - `tokens/component/*.json` is explicitly NOT touched — Story 2.3's
 *   component pruner owns that directory.
 *
 * Hardening:
 * - Dotfiles are skipped (a user-placed `.user-notes.json` inside
 *   `tokens/primitive/` must not be deleted).
 * - Entries are stat'd before `unlink` so a directory named e.g.
 *   `shadow.json/` can't produce a misleading `EISDIR` error.
 * - Symlinks are never followed and never deleted — always skipped
 *   with a warning.
 *
 * Best-effort: an `unlink` failure does NOT abort the sweep. Failures
 * are collected into `errors` and surfaced via `p.log.warn`, so the
 * user sees what stayed put without having to re-run.
 */
export async function prune(
  cwd: string,
  canonicalCategories: readonly string[],
  activeThemes: readonly string[],
  knownComponents?: readonly string[],
): Promise<PruneResult> {
  const canonical = new Set(canonicalCategories);
  const active = new Set(activeThemes);
  const result: PruneResult = { removed: [], errors: [] };

  const primitiveDir = join(cwd, "tokens", "primitive");
  await pruneDirectory(primitiveDir, canonical, result, cwd);

  await pruneSemanticRoot(cwd, canonical, active, result);

  if (knownComponents !== undefined) {
    await pruneComponentDir(cwd, new Set(knownComponents), result);
  }

  return result;
}

/**
 * Scan `tokens/semantic/` and dispatch each subdirectory:
 * - in {@link activeThemes}: prune orphan category JSON (standard pass)
 * - not in {@link activeThemes}: wipe every JSON and remove the now-empty
 *   theme directory. This cleans up `tokens/semantic/dark/*.json` left
 *   behind after the user toggled `darkMode: false`.
 */
async function pruneSemanticRoot(
  cwd: string,
  canonical: Set<string>,
  activeThemes: Set<string>,
  result: PruneResult,
): Promise<void> {
  const semanticDir = join(cwd, "tokens", "semantic");

  let entries: string[];
  try {
    entries = await _fs.readdir(semanticDir);
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") return;
    result.errors.push({
      path: semanticDir,
      error: error instanceof Error ? error : new Error(String(error)),
    });
    return;
  }

  for (const entry of entries) {
    if (entry.startsWith(".")) continue;
    const themeDir = join(semanticDir, entry);
    let stat;
    try {
      stat = await _fs.lstat(themeDir);
    } catch (error) {
      result.errors.push({
        path: themeDir,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      continue;
    }
    if (stat.isSymbolicLink()) {
      p.log.warn(
        `Skipping symlinked theme directory ${relative(cwd, themeDir)}`,
      );
      continue;
    }
    if (!stat.isDirectory()) continue;

    if (activeThemes.has(entry)) {
      await pruneDirectory(themeDir, canonical, result, cwd);
    } else {
      // Orphan theme — remove every category JSON and the dir itself.
      await pruneDirectory(themeDir, new Set<string>(), result, cwd);
      await tryRemoveEmptyDir(themeDir, cwd, result);
    }
  }
}

async function tryRemoveEmptyDir(
  dir: string,
  cwd: string,
  result: PruneResult,
): Promise<void> {
  try {
    const remaining = await _fs.readdir(dir);
    if (remaining.length > 0) return;
    await _fs.rmdir(dir);
    p.log.info(`✗ Removed empty theme ${relative(cwd, dir)}`);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    result.errors.push({ path: dir, error: err });
    p.log.warn(
      `Could not remove ${relative(cwd, dir)}: ${err.message}`,
    );
  }
}

async function pruneDirectory(
  dir: string,
  canonical: Set<string>,
  result: PruneResult,
  cwd: string,
): Promise<void> {
  let stat;
  try {
    stat = await _fs.lstat(dir);
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") return;
    result.errors.push({
      path: dir,
      error: error instanceof Error ? error : new Error(String(error)),
    });
    return;
  }
  if (stat.isSymbolicLink()) {
    p.log.warn(
      `Skipping symlinked directory ${relative(cwd, dir)} — not following into unrelated locations`,
    );
    return;
  }
  if (!stat.isDirectory()) return;

  let entries: string[];
  try {
    entries = await _fs.readdir(dir);
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      return;
    }
    result.errors.push({
      path: dir,
      error: error instanceof Error ? error : new Error(String(error)),
    });
    return;
  }

  for (const entry of entries) {
    // Dotfiles are never category tokens — skip rather than delete a
    // user's `.user-notes.json` or editor scratch file.
    if (entry.startsWith(".")) continue;
    if (!entry.endsWith(".json")) continue;
    const basename = entry.slice(0, -".json".length);
    if (canonical.has(basename)) continue;

    const fullPath = join(dir, entry);

    // stat before unlink so we don't blow up on a directory named
    // `shadow.json/` or follow a symlink into an unrelated file.
    let entryStat;
    try {
      entryStat = await _fs.lstat(fullPath);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      result.errors.push({ path: fullPath, error: err });
      continue;
    }
    if (entryStat.isSymbolicLink()) {
      p.log.warn(
        `Skipping symlinked entry ${relative(cwd, fullPath)} — not deleting into unrelated locations`,
      );
      continue;
    }
    if (!entryStat.isFile()) continue;

    try {
      await _fs.unlink(fullPath);
      const rel = relative(cwd, fullPath);
      result.removed.push(fullPath);
      p.log.info(`✗ Removed ${rel.length > 0 ? rel : fullPath}`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      result.errors.push({ path: fullPath, error: err });
      const rel = relative(cwd, fullPath);
      p.log.warn(
        `Could not remove ${rel.length > 0 ? rel : fullPath}: ${err.message}`,
      );
    }
  }
}

async function pruneComponentDir(
  cwd: string,
  knownComponents: Set<string>,
  result: PruneResult,
): Promise<void> {
  const componentDir = join(cwd, "tokens", "component");

  let entries: string[];
  try {
    entries = await _fs.readdir(componentDir);
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") return;
    result.errors.push({
      path: componentDir,
      error: error instanceof Error ? error : new Error(String(error)),
    });
    return;
  }

  for (const entry of entries) {
    if (entry.startsWith(".")) continue;
    if (!entry.endsWith(".json")) continue;
    const basename = entry.slice(0, -".json".length);
    if (knownComponents.has(basename)) continue;

    const fullPath = join(componentDir, entry);

    let entryStat;
    try {
      entryStat = await _fs.lstat(fullPath);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      result.errors.push({ path: fullPath, error: err });
      continue;
    }
    if (entryStat.isSymbolicLink()) {
      p.log.warn(
        `Skipping symlinked entry ${relative(cwd, fullPath)}`,
      );
      continue;
    }
    if (!entryStat.isFile()) continue;

    try {
      await _fs.unlink(fullPath);
      const rel = relative(cwd, fullPath);
      result.removed.push(fullPath);
      p.log.info(`✗ Removed ${rel.length > 0 ? rel : fullPath}`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      result.errors.push({ path: fullPath, error: err });
      p.log.warn(
        `Could not remove ${relative(cwd, fullPath)}: ${err.message}`,
      );
    }
  }
}

function isErrnoException(value: unknown): value is NodeJS.ErrnoException {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    typeof (value as { code?: unknown }).code === "string"
  );
}

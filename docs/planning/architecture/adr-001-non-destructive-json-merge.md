# ADR-001: Non-Destructive JSON Merge Strategy

- **Status:** Accepted
- **Date:** 2026-04-16
- **Deciders:** Dillon (project lead)
- **Related action item:** Epic 1 retrospective, **A4**
- **Blocks:** Story 2.2 (`add <category>` subcommand), Story 2.3 (`component <name>` subcommand)
- **Informs:** Story 2.1 (advanced mode), Story 3.1 (re-entrant editing)

---

## Context

Epic 1 produced an **overwrite-on-every-run** output pipeline: each `init` run regenerates every file under `tokens/` from scratch, based on the answers captured in `quieto.config.json`. That was fine for the quick-start single-shot experience.

Epic 2 changes the operating model:

- **Story 2.2** introduces `quieto-tokens add shadow` (and `border`, `animation`). Its acceptance criteria are explicit: *"integrates the new tokens into the existing DTCG JSON source files (not overwriting existing tokens)."*
- **Story 2.3** introduces `quieto-tokens component <name>` which writes per-component files under `tokens/component/` without touching `tokens/primitive/` or `tokens/semantic/`.
- **Story 2.1** (advanced mode) extends core categories (color/spacing/typography) — still regenerates, but from a richer config input.

We need an architectural decision on **how** to incrementally add, update, and remove token files without destroying the user's existing system or accumulating orphaned files.

### Existing on-disk layout (post-Epic 1)

```
tokens/
├── primitive/
│   ├── color.json          ← one file per category
│   ├── spacing.json
│   └── typography.json
└── semantic/
    └── <theme>/
        ├── color.json
        ├── spacing.json
        └── typography.json
build/
└── <theme>/
    └── tokens.css          ← Style Dictionary output
```

### Current write semantics

`src/output/json-writer.ts::writeTokensToJson` iterates `CATEGORIES = ["color", "spacing", "typography"]` and writes one file per category per theme. Style Dictionary (`src/output/style-dictionary.ts`) reads the whole `tokens/` tree via glob and emits CSS with a custom `name/quieto` transform.

**Key observation:** the category-per-file layout is already there. Adding `shadow.json` alongside `color.json` requires no restructuring — only leaving `color.json` alone when `shadow.json` is being written.

---

## Decision Drivers

1. **Never silently destroy user intent.** A developer who has manually tuned a token file should not lose those edits to a regeneration.
2. **Minimize merge complexity.** JSON key-level merging is notoriously fragile; we want to avoid it if possible.
3. **Keep the mental model simple.** `quieto.config.json` is already positioned as the recipe — the single source of user intent.
4. **Support stale cleanup.** When a category is removed or renamed, its orphaned files should be detectable and removable.
5. **Work with Style Dictionary's glob-based source loading.** SD already reads any `.json` under `tokens/` — file count doesn't matter, shape does.
6. **Keep the decision reversible.** Epic 2 is about to start; we should not lock in a structure that blocks Epic 3's re-entrant editing or Epic 4's multi-platform output.

---

## Options Considered

### Option A — Read-merge-write per file

When `add shadow` runs: read `tokens/primitive/shadow.json` if present, deep-merge new keys in, write back.

- **Pros:** Tolerates file-level hand edits (user-added keys survive).
- **Cons:**
  - Deep-merge semantics are ambiguous: what wins on key conflict? Does array replace or append? What about `$description` changes?
  - Stale keys cannot be removed without a second mechanism (orphan tracking).
  - Encourages hand-editing JSON files, which collides with the config-as-recipe model.
  - DTCG `$value` references are strings — merging them is just string replacement, but across-file merging requires loading the whole token graph to validate.

### Option B — Per-category files + config-as-manifest

Keep the existing category-per-file layout. Treat `quieto.config.json` as the authoritative manifest:

- To **add** a category: write the new file(s); never touch files for categories the config doesn't mention as changed.
- To **update** a category (advanced mode): overwrite that category's files from config inputs. Other categories' files are left untouched.
- To **remove** a category: delete its file(s) based on a diff of `config.categories` before/after.

User-tunable intent lives in `quieto.config.json` (overrides, advanced parameters). User hand-edits to the generated JSON files are not preserved — and that's a documented contract.

- **Pros:**
  - Zero merge logic. Ever.
  - Maps 1:1 to the current on-disk layout.
  - Stale cleanup is trivial: diff the category list.
  - Per-file scope matches SD's source globs.
  - Keeps config-as-recipe model intact.
- **Cons:**
  - Hand-edits to `tokens/primitive/color.json` will be blown away on next regeneration. **This must be documented prominently** (README + config file banner comment).
  - If a category's shape ever requires split across multiple files (e.g., color ramps per hue family), we'd need nested files. Manageable but worth watching.

### Option C — Separate manifest file (`quieto.manifest.json`)

Introduce a second JSON file that tracks, per generated output file, which keys/paths quieto owns. On regeneration, only quieto-owned paths are touched; user-added paths survive.

- **Pros:** Strongest user-edit preservation guarantee.
- **Cons:**
  - Another file to keep in sync.
  - Requires writing a diff algorithm over DTCG trees.
  - Over-engineered for a tool whose stated model is "config is the recipe."
  - No concrete use case yet demands it; re-evaluate only if hand-editing JSON becomes a common user workflow.

---

## Decision

**Option B — per-category files, with `quieto.config.json` as the canonical manifest.**

Specifically:

1. **On-disk layout stays as-is.** One JSON file per `(tier, category, theme)` combination. No structural change required.
2. **Category-file ownership is exclusive to quieto.** User intent lives in `quieto.config.json` (via `overrides` and the incoming `advanced`/`categories` blocks). The generated JSON files are outputs, not inputs.
3. **`add <category>` writes only the new category's files** and never reads/merges other categories' existing files.
4. **Stale cleanup** uses `quieto.config.json`'s `categories` block as the authoritative list of "what should exist" on disk. A post-write prune step deletes any `tokens/primitive/<cat>.json` or `tokens/semantic/<theme>/<cat>.json` whose `<cat>` is not in that list.
5. **Core category updates (advanced mode)** overwrite files for modified categories only. Non-modified categories' files are left untouched. This is a safe optimization because the pipeline is deterministic for a given config.
6. **Component tokens** (`tokens/component/<name>.json`) follow the same per-file model: one file per component, owned exclusively by quieto. Stale cleanup uses a `components` block in the config.
7. **No manifest file is added.** If user-edit preservation becomes a concrete need later, we revisit Option C as a follow-up ADR.

---

## Consequences

### Positive

- **Zero merge code.** No deep-merge library, no conflict semantics, no key-collision tests. Story 2.2 does not have to design a merge algorithm.
- **Stale cleanup is a one-screen function.** Read `config.categories`, list files, unlink anything not in the list.
- **Atomic writes (from Story 1.9) generalize naturally** — every file write uses the temp-file + rename pattern per file, no cross-file transactions needed.
- **Style Dictionary config stays unchanged.** Globs pick up new files automatically; removing files trims the glob set.

### Negative / accepted trade-offs

- **User hand-edits to generated JSON files are not preserved.** We'll document this in three places:
  - README "How it works" section
  - A banner comment inserted at the top of every generated JSON file: `// Generated by quieto-tokens — edit quieto.config.json, not this file.` (Note: DTCG JSON doesn't allow comments; we'll use a reserved `$metadata` key at the root instead.)
  - The `outro` message printed by `init` and `add`.
- **Removing a category deletes its files without confirmation** in the default flow. We'll gate destructive deletions behind a `--confirm` prompt or show them as a dry-run preview before executing. (Maps to Story 3.3's `--dry-run`.)

### Neutral

- **Component files** follow the same pattern; no additional structure needed for Story 2.3.
- **Theme variants** remain a sub-folder of `tokens/semantic/`; each theme's files are independent. Adding a theme adds a folder; removing a theme deletes the folder.

---

## Implementation Notes (for Story 2.1 and downstream)

- Extend `QuietoConfig` with a required `categories: string[]` block (Story 2.1 scope, part of action item **A3**). Default: `["color", "spacing", "typography"]` for Epic 1-generated configs.
- Add a `categories?: Record<string, CategoryConfig>` block for advanced-mode parameters (Story 2.1).
- Introduce a `src/output/pruner.ts` module that takes `config.categories`, the current on-disk file list, and produces a delete plan. Wire it into the pipeline after `writeTokensToJson`. (Story 2.2 scope, action item **A5**.)
- Add a root-level `$metadata` key to each generated DTCG JSON: `{ "$metadata": { "generatedBy": "quieto-tokens", "doNotEdit": true }, ... }`. DTCG tools ignore unknown root keys; SD will not emit them as tokens because they lack `$type`/`$value`.
- When a legacy (Epic 1) config is loaded that lacks the `categories` block, fall back to `["color", "spacing", "typography"]` — this keeps Story 2.1's "modify vs fresh" flow compatible with Epic 1 configs.

---

## Follow-ups

- **ADR-002** (this session): story-status single source of truth.
- **ADR-003** (future, if warranted): re-evaluate Option C (manifest) if hand-edit preservation becomes a demanded feature. Trigger: two+ user reports or a concrete downstream use case.
- **Story 2.2 prep**: design the `pruner.ts` API signature during story drafting; this ADR gives it a clear contract.

---

## References

- Epic 1 retro action items **A4** and **A5** — `_bmad-output/implementation-artifacts/epic-1-retro-2026-04-16.md`
- Existing writer: `src/output/json-writer.ts`
- SD source config: `src/output/style-dictionary.ts`
- Config schema: `src/types/config.ts`
- Epics: `docs/planning/epics.md` — Stories 2.1, 2.2, 2.3

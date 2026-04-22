# Story 3.4: Design System Changelog

Status: review

## Story

As a **solo developer managing a living design system**,
I want a changelog generated automatically when I modify my tokens,
so that I have a record of what changed and why, useful for my own reference and for communicating changes to collaborators.

## Story Scope Note

This is the **final story of Epic 3** and builds directly on Story 3.2's diff engine (`computeTokenDiff`). Every command that writes files (`init`, `update`, `add`, `component`) will append an entry to `TOKENS_CHANGELOG.md` at the token output root. The changelog is structured markdown ordered newest-first, combining a human-readable summary with parseable frontmatter per entry.

**What this story IS:**
- Automatic changelog generation after every successful write for all four commands.
- A `TOKENS_CHANGELOG.md` file created (first run) or prepended to (subsequent runs) in the project root alongside `quieto.config.json`.
- Each entry includes: timestamp, tool version, command that triggered the change, categories affected, and a human-readable summary of token additions/modifications/removals with cascade counts.
- The first `init` run creates the initial entry: "Initial token system generated."
- Structured markdown that is also parseable programmatically (entries delimited by `## [timestamp]` headings).

**What this story is NOT:**
- Not a git-integrated changelog (no commit hashes or branch references).
- Not a persisted diff (the changelog summarizes changes, it does not reproduce the full diff output from Story 3.2).
- Not written during `--dry-run` mode (Story 3.3 — dry-run suppresses all writes, including the changelog).

## Acceptance Criteria

### Changelog creation

1. **Given** no `TOKENS_CHANGELOG.md` exists, **When** `quieto-tokens init` runs for the first time and writes output, **Then** `TOKENS_CHANGELOG.md` is created in the project root with a title line (`# Design System Changelog`) and a single entry summarizing the initial generation.
2. **Given** `TOKENS_CHANGELOG.md` already exists, **When** any command writes output, **Then** a new entry is prepended after the title line (newest-first ordering). Existing entries are preserved.

### Entry format

3. **Given** a write completes, **When** the changelog entry is generated, **Then** it contains:
   - A level-2 heading with the ISO timestamp: `## [2026-04-22T15:30:00.000Z]`
   - `**Tool version:** 0.1.0`
   - `**Command:** init` (or `update`, `add shadow`, `component button`)
   - `**Categories affected:** color, spacing` (list of categories whose files were written)
   - A **Summary** section with a human-readable description
4. **Given** the first-ever `init` run, **When** the entry is written, **Then** the summary reads: "Initial token system generated." followed by the token count: "Created N primitives, M semantic tokens across K themes."
5. **Given** a subsequent `update` run that modified tokens, **When** the entry is written, **Then** the summary includes:
   - Number of tokens added, modified, and removed per tier (primitives and semantics).
   - Cascade summary (e.g., "Changing 3 color primitives affected 12 semantic tokens").
   - Config delta that triggered the change (e.g., "Brand color changed from #2563eb to #1d4ed8").
6. **Given** an `add shadow` run, **When** the entry is written, **Then** the summary reads: "Added shadow category." followed by the token count for the new category.
7. **Given** a `component button` run, **When** the entry is written, **Then** the summary reads: "Added component tokens for button." (or "Re-authored component tokens for button." if re-authoring) followed by the component token count.

### Changelog structure

8. **Given** the changelog has multiple entries, **When** it is read, **Then** entries are ordered newest-first (most recent entry immediately after the `# Design System Changelog` title).
9. **Given** the changelog is read programmatically, **When** entries are parsed, **Then** each `## [timestamp]` heading reliably delimits an entry. Metadata lines (`**Tool version:**`, `**Command:**`, `**Categories affected:**`) follow a consistent key-value format.
10. **Given** the changelog exists, **When** it is opened in any markdown viewer, **Then** it renders as readable, well-formatted documentation.

### Integration with existing commands

11. **Given** `init` writes output successfully, **When** the config generation step completes, **Then** the changelog entry is appended after the config write but before the outro.
12. **Given** `update` writes output successfully (user accepted changes), **When** the config generation step completes, **Then** the changelog entry is appended. The diff from Story 3.2 (`TokenDiff`) is used to generate the summary.
13. **Given** `add` writes output successfully, **When** the config generation step completes, **Then** the changelog entry is appended.
14. **Given** `component` writes output successfully, **When** the config generation step completes, **Then** the changelog entry is appended.
15. **Given** `--dry-run` mode is active (Story 3.3), **When** the pipeline completes, **Then** no changelog entry is written (dry-run suppresses all writes).
16. **Given** the write step fails (e.g., `runOutputGeneration` returns `null`), **When** the error is handled, **Then** no changelog entry is written. The changelog is only appended on successful writes.

### Edge cases

17. **Given** `TOKENS_CHANGELOG.md` exists but is empty (user deleted contents), **When** a new entry is written, **Then** the title line is re-added and the entry is appended below it.
18. **Given** `TOKENS_CHANGELOG.md` exists but is not writable, **When** the changelog write fails, **Then** the error is caught and surfaced via `p.log.warn` — the token system write has already succeeded, so a changelog failure is non-fatal.
19. **Given** multiple commands run in quick succession, **When** entries are written, **Then** each entry has its own unique timestamp and they stack correctly in newest-first order.

## Tasks / Subtasks

- [x] **Task 1: Changelog writer module (AC: #1, #2, #3, #8, #9, #10, #17, #18)**
  - [x] 1.1: Create `src/output/changelog-writer.ts` exporting:
    ```typescript
    export interface ChangelogEntry {
      timestamp: string;       // ISO 8601
      toolVersion: string;
      command: string;         // "init", "update", "add shadow", "component button"
      categoriesAffected: string[];
      summary: string;         // multi-line markdown
    }

    export function formatChangelogEntry(entry: ChangelogEntry): string;
    export async function appendChangelog(entry: ChangelogEntry, cwd?: string): Promise<string>;
    ```
  - [x] 1.2: `formatChangelogEntry` renders a single entry as markdown:
    ```markdown
    ## [2026-04-22T15:30:00.000Z]

    **Tool version:** 0.1.0
    **Command:** update
    **Categories affected:** color, spacing

    ### Summary

    Changed brand color from #2563eb to #1d4ed8.

    - **Primitives:** 10 modified, 0 added, 0 removed
    - **Semantics:** 12 remapped across 2 themes
    - Changing 10 color primitives affected 12 semantic tokens

    ---
    ```
  - [x] 1.3: `appendChangelog` reads `TOKENS_CHANGELOG.md` from `cwd`. If it doesn't exist, creates it with the `# Design System Changelog\n\n` title. Prepends the new entry after the title line (newest-first). Writes back atomically (tmp + rename, matching `writeConfig` pattern). Returns the absolute path.
  - [x] 1.4: Handle edge cases: empty file (re-add title), read failure (create fresh), write failure (catch, return error — caller surfaces via `p.log.warn`).

- [x] **Task 2: Summary builders per command type (AC: #4, #5, #6, #7)**
  - [x] 2.1: Create `src/output/changelog-summary.ts` exporting summary builder functions:
    ```typescript
    export function buildInitSummary(collection: ThemeCollection): string;
    export function buildUpdateSummary(diff: TokenDiff, configDelta?: ConfigDelta): string;
    export function buildAddSummary(category: string, collection: ThemeCollection): string;
    export function buildComponentSummary(componentName: string, tokenCount: number, isReauthor: boolean): string;
    ```
  - [x] 2.2: `buildInitSummary` produces: "Initial token system generated.\n\n- Created N primitives, M semantic tokens across K themes."
  - [x] 2.3: `buildUpdateSummary` uses the `TokenDiff` from Story 3.2 to produce:
    - Per-tier counts: "Primitives: N modified, M added, R removed"
    - "Semantics: N remapped across K themes"
    - Cascade line: "Changing N <category> primitives affected M semantic tokens"
    - Config delta line (if provided): "Brand color changed from X to Y" / "Spacing base changed from X to Y"
  - [x] 2.4: `buildAddSummary` produces: "Added <category> category.\n\n- Created N primitive tokens, M semantic tokens."
  - [x] 2.5: `buildComponentSummary` produces: "Added component tokens for <name>." or "Re-authored component tokens for <name>." followed by "- Created N component tokens."

- [x] **Task 3: Config delta detection (AC: #5)**
  - [x] 3.1: In `src/output/changelog-summary.ts`, export:
    ```typescript
    export interface ConfigDelta {
      changes: string[]; // human-readable lines
    }
    export function detectConfigDelta(prior: QuietoConfig, current: Partial<QuickStartOptions>): ConfigDelta;
    ```
  - [x] 3.2: Compare `prior.inputs.brandColor` vs `current.brandColor`, `prior.inputs.spacingBase` vs `current.spacingBase`, `prior.inputs.typeScale` vs `current.typeScale`, `prior.inputs.darkMode` vs `current.generateThemes`. For each difference, produce a line: "Brand color changed from #2563eb to #1d4ed8".
  - [x] 3.3: Only used by `update` — `init` (first run) has no prior config to compare against.

- [x] **Task 4: Wire changelog into `init` (AC: #1, #4, #11, #15, #16)**
  - [x] 4.1: In `src/commands/init.ts`, after `runConfigGeneration` succeeds and before the outro:
    - Build entry via `buildInitSummary(collection)` for first-run, or `buildUpdateSummary(diff, configDelta)` for modify-flow (though modify-flow doesn't have a diff — use a simplified "Full regeneration" summary for modify-flow: "Regenerated token system via init modify-flow. Created N primitives, M semantic tokens.").
    - Call `appendChangelog(entry, cwd)`.
    - On failure → `p.log.warn("Could not update TOKENS_CHANGELOG.md: <error>")`.
  - [x] 4.2: Skip changelog write when `dryRun` is true (Story 3.3).

- [x] **Task 5: Wire changelog into `update` (AC: #2, #5, #12, #15, #16)**
  - [x] 5.1: In `src/commands/update.ts`, after the write step succeeds:
    - The `TokenDiff` from Story 3.2 is already computed. Pass it to `buildUpdateSummary(diff, configDelta)`.
    - Detect config delta by comparing the prior config (loaded at the start of `updateCommand`) against the new inputs from `updateResult`.
    - Call `appendChangelog(entry, cwd)`.
    - On failure → `p.log.warn`.
  - [x] 5.2: Skip when `dryRun` is true.

- [x] **Task 6: Wire changelog into `add` (AC: #6, #13, #15, #16)**
  - [x] 6.1: In `src/commands/add.ts`, after config write succeeds:
    - Build entry via `buildAddSummary(category, collection)`.
    - Call `appendChangelog(entry, cwd)`.
    - On failure → `p.log.warn`.
  - [x] 6.2: Skip when `dryRun` is true.

- [x] **Task 7: Wire changelog into `component` (AC: #7, #14, #15, #16)**
  - [x] 7.1: In `src/commands/component.ts`, after config write succeeds:
    - Build entry via `buildComponentSummary(name, tokenCount, isReauthor)`.
    - Call `appendChangelog(entry, cwd)`.
    - On failure → `p.log.warn`.
  - [x] 7.2: Skip when `dryRun` is true.

- [x] **Task 8: Tests (AC: all)**
  - [x] 8.1: `src/output/__tests__/changelog-writer.test.ts` — changelog writer unit tests:
    - `formatChangelogEntry` produces expected markdown.
    - `appendChangelog` creates new file with title + entry.
    - `appendChangelog` prepends to existing file (newest-first).
    - Empty file → title re-added.
    - Write failure → error returned (not thrown).
  - [x] 8.2: `src/output/__tests__/changelog-summary.test.ts` — summary builder tests:
    - `buildInitSummary` with various token counts.
    - `buildUpdateSummary` with added/modified/removed/cascade.
    - `buildAddSummary` for each category.
    - `buildComponentSummary` for new + re-author.
    - `detectConfigDelta` with changed/unchanged fields.
  - [x] 8.3: `src/commands/__tests__/init.test.ts` (or extend) — verify `appendChangelog` called after successful writes, NOT called on failure, NOT called when `dryRun`.
  - [x] 8.4: `src/commands/__tests__/update.test.ts` — verify `appendChangelog` called with `TokenDiff`-based summary, NOT called on dry-run or cancel.
  - [x] 8.5: `src/commands/__tests__/add.test.ts` — verify `appendChangelog` called with add summary.
  - [x] 8.6: `src/commands/__tests__/component.test.ts` — verify `appendChangelog` called with component summary.
  - [x] 8.7: Pipeline E2E: full `init` in a tmp dir → `TOKENS_CHANGELOG.md` exists, has title + one entry. Run `update` (mocked prompts) → file has two entries, newest first.
  - [x] 8.8: `npm run type-check`, `npm test`, `npm run build`, `npm run validate:sprint` — all clean.

- [x] **Task 9: Close-out**
  - [x] 9.1: Update README.md to document the automatic changelog behavior under a new "Design System Changelog" section.
  - [x] 9.2: Update `src/pipeline/config.ts` "What's next" to mention the changelog.
  - [x] 9.3: Move this story to `review`, then to `done` after code review.

## Dev Notes

### Relevant ADRs

- **[ADR-001](../architecture/adr-001-non-destructive-json-merge.md)** — The changelog file is an output artifact alongside `tokens/` and `build/`. It is NOT managed by the pruner and NOT gated by `WriteScope`. It is always written to the project root (same location as `quieto.config.json`).
- **[ADR-002](../architecture/adr-002-story-status-single-source-of-truth.md)** — `npm run validate:sprint` must pass after every status transition.

### Previous Story Intelligence

**From Story 3.2 (token diff display):**
- `computeTokenDiff(prior, current): TokenDiff` is already available in `src/ui/diff.ts`. The changelog's `buildUpdateSummary` consumes this same `TokenDiff` to generate the summary. No need to re-compute the diff — pass it through from `updateCommand`.
- `TokenDiff.primitiveChanges` and `TokenDiff.semanticChanges` provide the per-change data needed for the "N modified, M added, R removed" counts.

**From Story 3.1 (re-entrant editing):**
- `updateCommand` loads the prior config at the start of the flow. The changelog's `detectConfigDelta` can compare `priorConfig.inputs` against the new inputs to produce config-change lines.
- `loadPriorCollection` is already available for computing the diff.

**From Story 3.3 (dry-run mode):**
- `--dry-run` suppresses all writes including the changelog. The `dryRun` boolean is available in every command orchestrator — guard the `appendChangelog` call with it.

**From Story 2.3 (component tokens):**
- `componentCommand` knows whether it's a first-author or re-author flow (the `tokens/component/<name>.json` existence check). Pass `isReauthor` to `buildComponentSummary`.

### Changelog File Format

```markdown
# Design System Changelog

## [2026-04-22T16:00:00.000Z]

**Tool version:** 0.1.0
**Command:** update
**Categories affected:** color

### Summary

Changed brand color from #2563eb to #1d4ed8.

- **Primitives:** 10 modified, 0 added, 0 removed
- **Semantics:** 12 remapped across 2 themes
- Changing 10 color primitives affected 12 semantic tokens

---

## [2026-04-22T15:00:00.000Z]

**Tool version:** 0.1.0
**Command:** add shadow
**Categories affected:** shadow

### Summary

Added shadow category.

- Created 6 primitive tokens, 6 semantic tokens

---

## [2026-04-22T14:00:00.000Z]

**Tool version:** 0.1.0
**Command:** init
**Categories affected:** color, spacing, typography

### Summary

Initial token system generated.

- Created 43 primitives, 78 semantic tokens across 2 themes

---
```

### Atomic Write Pattern

`appendChangelog` follows the same atomic write pattern as `writeConfig` (in `src/output/config-writer.ts:122–131`): write to a `.tmp` sibling file, then `rename(2)` over the target. This ensures a crash mid-write doesn't corrupt the existing changelog.

Prepending to an existing file requires: read → insert after title → write. The read + write are not atomic across concurrent processes, but concurrent quieto-tokens runs are not a supported scenario (one CLI invocation at a time is the documented model).

### Technical Stack

| Concern | Choice | Version |
|---------|--------|---------|
| Runtime | Node.js | >=18 (LTS) |
| Language | TypeScript | ^5.x |
| Build | tsup | ^8.x |
| CLI prompts | `@clack/prompts` | ^1.2.0 |
| Test runner | Vitest | ^4.x |
| Output transforms | Style Dictionary | ^5.4.0 |
| Color engine | `@quieto/engine` | ^0.1.1 |

### What NOT to Build

- **Do NOT integrate with git.** The changelog records tool-level changes, not git commits. Users can commit the changelog alongside their token changes.
- **Do NOT persist the full diff.** The changelog summarizes changes (counts + highlights). The terminal diff from Story 3.2 is the detailed view.
- **Do NOT add a `--no-changelog` flag.** If users don't want the changelog, they can delete the file. Adding another flag is premature.
- **Do NOT make the changelog format configurable.** One format, well-documented. Future stories can add format options if needed.
- **Do NOT write the changelog during `--dry-run`.** Dry-run suppresses all writes (Story 3.3).
- **Do NOT make changelog failures fatal.** A failed changelog write should not prevent the token system from being generated. Surface the error via `p.log.warn` and continue.
- **Do NOT migrate `compareVersions`, extract the shared version resolver, or add lockfile protection.** All still deferred per `docs/planning/deferred-work.md`.

### File Structure (final target)

```
src/
├── cli.ts                            ← unchanged
├── commands/
│   ├── init.ts                       ← modified (changelog write after config)
│   ├── update.ts                     ← modified (changelog write with diff summary)
│   ├── add.ts                        ← modified (changelog write)
│   ├── component.ts                  ← modified (changelog write)
│   └── ...                           ← unchanged
├── output/
│   ├── changelog-writer.ts           ← NEW (formatChangelogEntry, appendChangelog)
│   ├── changelog-summary.ts          ← NEW (buildInitSummary, buildUpdateSummary, etc.)
│   ├── __tests__/
│   │   ├── changelog-writer.test.ts  ← NEW
│   │   └── changelog-summary.test.ts ← NEW
│   └── ...                           ← unchanged
├── pipeline/
│   └── ...                           ← unchanged
├── ui/
│   └── diff.ts                       ← unchanged (TokenDiff reused by changelog)
```

### References

- [Source: docs/planning/epics.md#Story 3.4: Design System Changelog]
- [Source: docs/planning/stories/3-2-token-diff-display.md] — TokenDiff, computeTokenDiff (consumed by buildUpdateSummary)
- [Source: docs/planning/stories/3-3-dry-run-mode.md] — dryRun flag suppresses changelog writes
- [Source: docs/planning/stories/3-1-re-entrant-editing.md] — update command, prior config loading
- [Source: src/output/config-writer.ts#writeConfig] — atomic write pattern (lines 122–131)
- [Source: src/output/config-writer.ts#readToolVersion] — tool version resolution (lines 22–51)
- [Source: src/pipeline/config.ts#runConfigGeneration] — config write + outro (lines 58–149), insertion point for changelog
- [Source: src/commands/init.ts#initCommand] — init orchestrator (lines 37–313), insertion point
- [Source: src/commands/update.ts] — update orchestrator, TokenDiff available for summary
- [Source: src/ui/diff.ts] — TokenDiff type, computeTokenDiff (from Story 3.2)
- [Source: docs/planning/deferred-work.md] — deferred items that remain out of scope

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

### Completion Notes List

- Implemented `TOKENS_CHANGELOG.md` writer (atomic tmp + rename) and summary builders for `init` (initial / regenerate / modify flows), `update` (TokenDiff + `detectConfigDelta`), `add`, and `component`.
- Wired all four commands after successful config/tokens writes; dry-run and failed writes skip the changelog; changelog errors are non-fatal (`p.log.warn`).
- Extended `AddPipelineResult` with `collection` for add-summary counts; documented behavior in README and `runConfigGeneration` “What’s next”.
- `appendChangelog` returns `{ path } | { error }` (not `Promise<string>`) so callers can warn without throwing; aligns with task 1.4 / 8.1.

### File List

- `src/output/changelog-writer.ts`
- `src/output/changelog-summary.ts`
- `src/output/__tests__/changelog-writer.test.ts`
- `src/output/__tests__/changelog-summary.test.ts`
- `src/commands/init.ts`
- `src/commands/update.ts`
- `src/commands/add.ts`
- `src/commands/component.ts`
- `src/pipeline/add.ts`
- `src/pipeline/config.ts`
- `src/pipeline/__tests__/config.test.ts`
- `src/commands/__tests__/init-dry-run.test.ts`
- `src/commands/__tests__/update.test.ts`
- `src/commands/__tests__/add.test.ts`
- `src/commands/__tests__/component.test.ts`
- `README.md`
- `docs/planning/sprint-status.yaml`
- `docs/planning/stories/3-4-design-system-changelog.md`

### Change Log

- 2026-04-22: Story 3.4 — automatic `TOKENS_CHANGELOG.md`, integration in init/update/add/component, tests, README and pipeline outro. Status → `review`.

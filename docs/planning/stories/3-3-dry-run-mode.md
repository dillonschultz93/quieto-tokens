# Story 3.3: Dry Run Mode

Status: review

## Story

As a **solo developer evaluating changes**,
I want to run the CLI in dry-run mode to see what would be generated without writing anything,
so that I can evaluate the output before committing to it.

## Story Scope Note

This story adds a `--dry-run` flag that works across all four commands (`init`, `update`, `add`, `component`). The flag lets the full pipeline run — prompts, generation, auto-mapping, preview — but suppresses all file writes (DTCG JSON, CSS, config). The user sees exactly what would be generated, confirms it looks right, and walks away without any filesystem side effects.

**What this story IS:**
- A `--dry-run` flag parsed by every command's arg parser (`parseInitArgs`, `parseUpdateArgs`, `parseAddArgs`, `parseComponentArgs`).
- A `dryRun` option threaded through every command orchestrator and into `runOutputGeneration` and `runConfigGeneration`.
- When `dryRun` is true: the preview renders as normal, the token count summary appears, but `writeTokensToJson`, `buildCss`, `writeConfig`, and `prune` are all skipped. A final message confirms "Dry run complete — no files were written."
- Works with the diff display from Story 3.2 when used with `update --dry-run`.

**What this story is NOT:**
- Not changelog generation (Story 3.4).
- Not a new command — `--dry-run` is a flag, not a subcommand.
- Not a simulation of file-level output (e.g., "would write tokens/primitive/color.json") — the user gets the preview and token count, not a file manifest. The existing narrative output already names files; we suppress that narrative in dry-run mode.

## Acceptance Criteria

### Flag parsing

1. **Given** any command, **When** the user passes `--dry-run`, **Then** the flag is parsed and `dryRun: true` is set. The flag also accepts `--dry-run=true` / `--dry-run=false` for scripting.
2. **Given** the user passes `--dry-run` alongside other valid flags (e.g., `init --advanced --dry-run`), **When** the args are parsed, **Then** both flags are correctly parsed. Flag order does not matter.
3. **Given** the user passes `--dry-run` to `component` or `add`, **When** those parsers run, **Then** `dryRun` is returned alongside the existing parsed fields (`name`, `category`, etc.).

### init --dry-run

4. **Given** the user runs `quieto-tokens init --dry-run` on a fresh project, **When** the full init pipeline runs, **Then** the quick-start prompts run, primitives are generated, semantic mapping runs, themes are generated, the preview displays, and the token count summary appears. No files are written — no `tokens/` directory, no `build/` directory, no `quieto.config.json`.
5. **Given** the user runs `quieto-tokens init --dry-run` with an existing config (modify path), **When** the modify flow runs, **Then** the same dry-run behavior applies — preview but no writes.
6. **Given** the user runs `quieto-tokens init --advanced --dry-run`, **When** the advanced flow completes, **Then** the preview includes all advanced customizations. No files are written.

### update --dry-run

7. **Given** the user runs `quieto-tokens update --dry-run`, **When** the update pipeline runs, **Then** the category picker runs, selective regeneration runs, the diff display from Story 3.2 renders (if changes detected), and the preview is available. No files are written.
8. **Given** the user runs `update --dry-run` and the diff shows changes, **When** the post-diff prompt runs, **Then** the "Accept changes and write" option is replaced with "End dry run" (since writing is suppressed). The "Review full token preview" option still works. "Go back and modify further" still works.

### add --dry-run

9. **Given** the user runs `quieto-tokens add shadow --dry-run`, **When** the add pipeline runs, **Then** the category prompts run, tokens are generated, the preview displays. No new JSON files are written, no CSS rebuild, no config update.
10. **Given** the user runs `quieto-tokens add --dry-run` (no category), **When** the category menu is presented, **Then** dry-run mode works with the interactive category selection.

### component --dry-run

11. **Given** the user runs `quieto-tokens component button --dry-run`, **When** the component walkthrough runs, **Then** the variant/property/state prompts run, component tokens are generated, the preview displays. No `tokens/component/button.json` is written, no CSS rebuild, no config update.

### Dry-run messaging

12. **Given** dry-run mode is active, **When** the pipeline reaches the write step, **Then** the CLI displays `p.log.info("Dry run — skipping file writes.")` in place of the normal "Writing DTCG JSON source files…" / "Building CSS custom properties…" / "Saving config…" steps.
13. **Given** dry-run mode is active, **When** the pipeline completes, **Then** the CLI prints `p.outro("Dry run complete — no files were written.")` as the final message.
14. **Given** dry-run mode is active, **When** the preview runs, **Then** the preview UI works identically to the non-dry-run case. The user can still use the override editor (their overrides affect the in-memory preview but are never persisted).

### Edge cases

15. **Given** the user runs `update --dry-run` and makes no changes (selects a category, re-enters the same values), **When** the diff is computed, **Then** the "No changes to apply" early-exit still activates — dry-run doesn't bypass the no-change detection.
16. **Given** the user cancels mid-flow during a dry run, **When** the cancel is caught, **Then** the same clean exit occurs (no files written, because dry-run mode never writes anyway — but the cancel message reflects the dry-run context: `p.cancel("Dry run cancelled.")`).
17. **Given** the user passes `--dry-run` with `component` but no name, **When** the CLI validates args, **Then** the missing-name error fires before dry-run mode is relevant. Validation precedes pipeline execution.

## Tasks / Subtasks

- [x] **Task 1: Add `--dry-run` to all arg parsers (AC: #1, #2, #3)**
  - [x] 1.1: In `src/cli.ts`, update `parseInitArgs` to accept `--dry-run` / `--dry-run=true` / `--dry-run=false`. Return `dryRun: boolean` (default `false`).
  - [x] 1.2: Update `parseUpdateArgs` to accept `--dry-run` (same pattern).
  - [x] 1.3: Update `parseAddArgs` to accept `--dry-run` (same pattern).
  - [x] 1.4: Update `parseComponentArgs` to accept `--dry-run` (same pattern).
  - [x] 1.5: Update `HELP_TEXT` to document `--dry-run` as a global option: `"--dry-run         Run the full pipeline without writing any files"`.

- [x] **Task 2: Thread `dryRun` through command orchestrators (AC: #4, #5, #6, #7, #9, #10, #11)**
  - [x] 2.1: Add `dryRun?: boolean` to `InitCommandOptions`. In `initCommand`, when `dryRun` is true, skip the calls to `runOutputGeneration` and `runConfigGeneration`. Still run the preview via `previewAndConfirm`.
  - [x] 2.2: Add `dryRun?: boolean` to the `updateCommand` signature (or its internal options). When `dryRun` is true, skip `runOutputGeneration` and `runConfigGeneration` after the diff/preview step.
  - [x] 2.3: Add `dryRun?: boolean` to `AddCommandOptions`. In `addCommand`, when `dryRun` is true, skip `runOutputGeneration`, `writeConfig`, and `prune`.
  - [x] 2.4: Add `dryRun?: boolean` to `ComponentCommandOptions`. In `componentCommand`, when `dryRun` is true, skip `writeComponentTokens`, `buildCss`, `writeConfig`, and `prune`.

- [x] **Task 3: Wire `--dry-run` into CLI routing (AC: #1, #2, #3)**
  - [x] 3.1: In `src/cli.ts`, pass `dryRun` from each parser's result into the corresponding command function:
    - `init` case: `await initCommand({ advanced, dryRun })`.
    - `update` case: `await updateCommand({ dryRun })`.
    - `add` case: `await addCommand({ category, dryRun })`.
    - `component` case: `await componentCommand({ name, dryRun })`.

- [x] **Task 4: Dry-run messaging (AC: #12, #13, #14, #16)**
  - [x] 4.1: In each command, when `dryRun` is true and the pipeline reaches the write step, emit `p.log.info("Dry run — skipping file writes.")` instead of "Writing DTCG JSON source files…" / "Building CSS…" / "Saving config…".
  - [x] 4.2: At the end of each command, when `dryRun` is true, emit `p.outro("Dry run complete — no files were written.")` instead of the normal success outro.
  - [x] 4.3: On cancel during dry-run, emit `p.cancel("Dry run cancelled.")`.
  - [x] 4.4: When `dryRun` is true and the command is `init`, show a leading indicator: `p.log.info("🔍 Dry run mode — no files will be written.")` immediately after `p.intro`.

- [x] **Task 5: update --dry-run post-diff prompt adjustment (AC: #8, #15)**
  - [x] 5.1: In `src/commands/update.ts`, when the post-diff `p.select` runs during a dry run, replace the "Accept changes and write" option with `{ value: "end", label: "End dry run", hint: "Exit — no files will be written" }`.
  - [x] 5.2: When `"end"` is selected, emit the dry-run outro and return.
  - [x] 5.3: "Review full token preview" and "Go back and modify further" still function normally in dry-run mode — only the write path is suppressed.
  - [x] 5.4: The no-changes early-exit (`diff.isEmpty`) still activates during dry-run — emit "No changes to apply" and return.

- [x] **Task 6: Tests (AC: all)**
  - [x] 6.1: `src/__tests__/cli.test.ts` — extend with `--dry-run` parsing for each command:
    - `init --dry-run` → `dryRun: true`.
    - `init --advanced --dry-run` → `advanced: true, dryRun: true`.
    - `init --dry-run=false` → `dryRun: false`.
    - `update --dry-run` → `dryRun: true`.
    - `add shadow --dry-run` → `category: "shadow", dryRun: true`.
    - `add --dry-run` → `dryRun: true` (no category).
    - `component button --dry-run` → `name: "button", dryRun: true`.
    - Unknown flag `--dry-runs` still rejected.
  - [x] 6.2: `src/commands/__tests__/init.test.ts` (or new file) — init with `dryRun: true`:
    - Full pipeline runs (mock prompts, assert generation functions called).
    - `runOutputGeneration` NOT called.
    - `runConfigGeneration` NOT called.
    - Dry-run outro message emitted.
  - [x] 6.3: `src/commands/__tests__/update.test.ts` — extend with:
    - `dryRun: true`: pipeline runs, diff renders, "End dry run" in post-diff select.
    - No `runOutputGeneration` or `runConfigGeneration` calls.
  - [x] 6.4: `src/commands/__tests__/add.test.ts` (or extend existing) — add with `dryRun: true`:
    - Prompts run, tokens generated, preview displayed.
    - No file writes, no CSS rebuild, no config update.
  - [x] 6.5: `src/commands/__tests__/component.test.ts` — extend with `dryRun: true`:
    - Walkthrough completes, tokens generated.
    - No writes.
  - [x] 6.6: `npm run type-check`, `npm test`, `npm run build`, `npm run validate:sprint` — all clean.

- [x] **Task 7: Close-out**
  - [x] 7.1: Update README.md to document `--dry-run` as a global option available on all commands.
  - [x] 7.2: Move this story to `review`, then to `done` after code review. *(→ `review` done; set `done` in story + sprint after human code review.)*

## Dev Notes

### Relevant ADRs

- **[ADR-001](../architecture/adr-001-non-destructive-json-merge.md)** — Dry-run respects the per-category write model. The flag suppresses writes at the `runOutputGeneration` and `runConfigGeneration` level, not at the individual file-writer level. This keeps the suppression clean — one boolean check per command, not scattered through the write stack.
- **[ADR-002](../architecture/adr-002-story-status-single-source-of-truth.md)** — `npm run validate:sprint` must pass after every status transition.

### Previous Story Intelligence

**From Story 3.2 (token diff display):**
- The `update` command now has a post-diff prompt with four options: "Accept changes and write", "Review full token preview", "Go back and modify further", "Cancel". Dry-run replaces "Accept changes and write" with "End dry run" (Task 5.1).
- `computeTokenDiff` and `renderTokenDiff` run identically in dry-run mode — they are pure/display-only and have no write side effects.

**From Story 3.1 (re-entrant editing):**
- `updateCommand` in `src/commands/update.ts` calls `runOutputGeneration(collection, cwd, { scope: { categories: modifiedCategories } })` and then `runConfigGeneration(...)`. Both calls are guarded by the dry-run check.
- `loadPriorCollection` and `computeTokenDiff` are already side-effect-free.

**From Story 2.3 (component tokens):**
- `componentCommand` in `src/commands/component.ts` calls `writeComponentTokens`, `buildCss`, `writeConfig`, and `prune` as separate steps. All are guarded.

**From Story 2.2 (add subcommand):**
- `addCommand` in `src/commands/add.ts` calls `runOutputGeneration` and then has inline config-write + prune logic. Guard both.

### Architecture

The dry-run suppression is implemented at the **command orchestrator level**, not deep in the write stack. Each command already has a clear sequence:

1. Prompts / collection
2. Preview / diff
3. Write JSON + CSS
4. Write config + prune

Dry-run skips steps 3 and 4. This is cleaner than passing a `dryRun` flag into `writeTokensToJson` / `buildCss` / `writeConfig` because:
- No risk of partial writes (the flag is checked once, before any write call).
- The preview and generation code paths are completely unchanged.
- Testing is simple: mock the write functions and assert they're NOT called when `dryRun` is true.

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

- **Do NOT add a simulated file manifest.** Dry-run does not list "would write tokens/primitive/color.json" — the preview is the output. Adding a file manifest is a future enhancement.
- **Do NOT suppress prompts in dry-run mode.** The user still answers questions interactively. The only difference is that no files are written.
- **Do NOT add dry-run logic inside `writeTokensToJson` or `buildCss`.** The suppression lives at the command level (see Architecture note above).
- **Do NOT implement changelog generation.** That is Story 3.4.
- **Do NOT migrate `compareVersions`, extract the shared version resolver, or add lockfile protection.** All still deferred per `docs/planning/deferred-work.md`.

### File Structure (final target)

```
src/
├── cli.ts                            ← modified (--dry-run in all parsers, HELP_TEXT)
├── commands/
│   ├── init.ts                       ← modified (dryRun option, skip writes)
│   ├── update.ts                     ← modified (dryRun option, post-diff prompt adjustment)
│   ├── add.ts                        ← modified (dryRun option, skip writes)
│   ├── component.ts                  ← modified (dryRun option, skip writes)
│   └── ...                           ← unchanged
├── pipeline/
│   └── ...                           ← unchanged (writes skipped at command level, not pipeline level)
├── output/
│   └── ...                           ← unchanged
├── ui/
│   └── ...                           ← unchanged (preview renders normally)
├── __tests__/
│   └── cli.test.ts                   ← modified (dry-run parsing tests)
```

### References

- [Source: docs/planning/epics.md#Story 3.3: Dry Run Mode]
- [Source: docs/planning/stories/3-1-re-entrant-editing.md] — update command orchestrator
- [Source: docs/planning/stories/3-2-token-diff-display.md] — post-diff prompt (accept/preview/back/cancel)
- [Source: src/cli.ts#parseInitArgs] — existing arg parser pattern (lines 56–74)
- [Source: src/cli.ts#runCli] — command routing switch (lines 165–291)
- [Source: src/commands/init.ts#initCommand] — init orchestrator, runOutputGeneration + runConfigGeneration calls (lines 286–304)
- [Source: src/commands/update.ts] — update orchestrator with diff and post-diff prompt
- [Source: src/pipeline/output.ts#runOutputGeneration] — JSON + CSS write orchestrator (lines 59–123)
- [Source: src/pipeline/config.ts#runConfigGeneration] — config write + prune orchestrator (lines 58–149)
- [Source: docs/planning/deferred-work.md] — deferred items that remain out of scope

## Dev Agent Record

### Agent Model Used

Composer (Cursor)

### Debug Log References

(none)

### Implementation Plan (brief)

- Parse `--dry-run` / `=true` / `=false` in all four arg parsers; route `dryRun` from `runCli` into each command.
- For `add` and `component`, add optional 4th-arg options to `runAdd` / `runComponent` to skip the write stack while keeping generation.
- `update` dry-run: swap post-diff "Accept" for "End dry run", pass `dryRun` into `previewAndConfirm` for cancel copy; preview path continues the loop after preview without `finalizeWrite`.
- `init` and `add` / `component`: dry-run cancels and preview cancel use context-specific `p.cancel` / `p.outro` from AC 4 and 16.

### Completion Notes List

- `update` does not use `runConfigGeneration` (it uses `finalizeWrite` with `writeConfig`); the dry-run test asserts `runOutputGeneration` and `writeConfig` are not invoked.
- Story task 6.3 wording references `runConfigGeneration` for update; implementation matches actual update close-out (output + `writeConfig` in `finalizeWrite`).

### File List

- `src/cli.ts`
- `src/commands/add.ts`
- `src/commands/component.ts`
- `src/commands/init.ts`
- `src/commands/update.ts`
- `src/pipeline/add.ts`
- `src/pipeline/component.ts`
- `src/ui/preview.ts`
- `src/__tests__/cli.test.ts`
- `src/commands/__tests__/add.test.ts`
- `src/commands/__tests__/component.test.ts`
- `src/commands/__tests__/init-dry-run.test.ts`
- `src/commands/__tests__/update.test.ts`
- `README.md`
- `docs/planning/sprint-status.yaml`
- `docs/planning/stories/3-3-dry-run-mode.md`

### Change Log

- 2026-04-22: Story 3.3 — `--dry-run` on all commands, orchestrator-level write suppression, update post-diff "End dry run" option, README and tests. Status → `review`.

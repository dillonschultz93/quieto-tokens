# Story 2.4: Story 2.2 Post-Review Hardening

Status: done

<!-- Carries forward the 10 unchecked `[Review][Patch]` items from Story 2.2's code-review findings (2026-04-17). See `docs/planning/stories/2-2-add-subcommand-for-new-token-categories.md` → Review Findings for full context per item. -->

## Story

As a **maintainer of the Quieto Tokens CLI**,
I want the deferred patches and missing test coverage from Story 2.2's code review landed in a dedicated follow-up,
so that Story 2.2's acceptance criteria are fully enforced on disk and the `add` pipeline is covered by the tests Task 9.4 required.

## Story Scope Note

This is a **post-review hardening story** against Story 2.2. No new user-facing feature work is introduced. Two concerns are bundled:

1. **D5 refactor — enforce AC #16 on `add`.** Split `runOutputGeneration` so `add` only writes the one category's JSON (primitive + per-theme semantic) and rebuilds CSS by re-sourcing from disk. Today `add` idempotently rewrites every core category's JSON on every run, which violates the "don't touch what you already have" contract the AC codified.
2. **Missing test coverage.** Task 9.4 in Story 2.2 required CLI-routing, pipeline-E2E, validator, json-writer dynamic-category, collector prompt-flow, and pruner integration tests. Only `parseAddArgs` and a subset of validators shipped. This story completes that coverage.

The items below map 1:1 to the unchecked `[Review][Patch]` entries in `docs/planning/stories/2-2-add-subcommand-for-new-token-categories.md` (Review Findings section). Each AC cites the owning file(s) so the dev agent can find the original review note verbatim for full technical context.

## Acceptance Criteria

### D5 refactor (Story 2.2 AC #16 enforcement)

1. **Given** a `quieto.config.json` with `color`, `spacing`, `typography`, and at least one added category (e.g. `shadow`) on disk, **When** `quieto-tokens add border` runs to completion, **Then** only `tokens/primitive/border.json` and `tokens/semantic/<theme>/border.json` (plus CSS) are written / updated; the mtimes on `tokens/primitive/color.json`, `tokens/primitive/spacing.json`, `tokens/primitive/typography.json`, `tokens/primitive/shadow.json`, and every non-border semantic file remain unchanged.
2. **Given** the refactored pipeline, **When** CSS is rebuilt, **Then** the build sources from the on-disk JSON tree (not from the in-memory `TokenCollection`), so the `build/*.css` outputs reflect the newly-added category alongside the pre-existing on-disk tokens.
3. **Given** the refactored pipeline, **When** `quieto-tokens init` runs (both fresh + modify paths), **Then** output generation behaviour is unchanged — all core categories are written as today — i.e. the refactor does not regress Story 1.8 / 2.1.

### Missing test coverage

4. **Given** `src/__tests__/cli.test.ts`, **When** the suite runs, **Then** it covers: unknown category name exits non-zero with help text; missing category routes through the menu flow (with mocked prompts); unknown flag on `add` is reported; `add shadow` happy-path routes into `addCommand`. (Story 2.2 Task 9.4.)
5. **Given** `src/commands/__tests__/add.test.ts` (or equivalent), **When** a corrupt config triggers the recovery prompt, **Then** the "Abort only" branch is asserted: non-zero exit, no files written, `p.log.error` fired with the parse-failure summary. (Story 2.2 AC #5.)
6. **Given** `src/commands/__tests__/add.test.ts`, **When** `add shadow` is invoked twice in a row against the same cwd, **Then** both the accept and decline branches of the re-author `p.confirm` are asserted end-to-end. (Story 2.2 AC #6.)
7. **Given** `src/pipeline/__tests__/add.test.ts`, **When** the smoke test runs, **Then** it drives a full `runAdd` against a tmp-dir fixture with prompts mocked at module scope and asserts the on-disk file tree (primitives, semantics under each theme, CSS) plus the persisted `categoryConfigs` block round-trips through `writeConfig`. (Story 2.2 Task 9.4.)
8. **Given** `src/utils/__tests__/config.test.ts`, **When** the `categoryConfigs` validator cases run, **Then** they cover: `buildConfig → writeConfig → loadConfig` round-trip; out-of-range `shadow.levels` rejection surfacing the `categoryConfigs.shadow.levels` error path; prototype-pollution guard (`categoryConfigs.shadow.__proto__`) rejection. (Story 2.2 AC #23, #24.)
9. **Given** `src/output/__tests__/json-writer.test.ts`, **When** the dynamic-category test runs, **Then** it exercises a non-hardcoded category (e.g. `shadow`) through the writer and asserts the emitted JSON shape is preserved identically to the hardcoded-category path. (Story 2.2 Task 3.5 refactor.)
10. **Given** `src/commands/__tests__/add-shadow.test.ts`, `add-border.test.ts`, `add-animation.test.ts`, **When** each collector-prompt flow is driven end-to-end with mocked Clack, **Then** the following branches are asserted: color-picker `select` → Custom fallback (shadow); **pill confirm** (border — there is no separate “profile select” prompt for border); easing select (animation); default-vs-prior pre-fill on second invocation. (Story 2.2 AC #7, #10, #13.)
11. **Given** `src/output/__tests__/pruner.test.ts` (or a higher-level integration test), **When** the manual-category-removal sequence runs (`add border` → user edits `config.categories` to remove `"border"` → **`add shadow`** — *not* `add animation` until Story 2.5 fixes the `animation.ease.<role>` primitive/semantic path collision), **Then** `tokens/primitive/border.json` and each `tokens/semantic/<theme>/border.json` are deleted by the pruner. (Story 2.2 Testing Strategy #4.)
12. **Given** `src/commands/__tests__/add.test.ts`, **When** `add shadow` runs in a cwd with no `quieto.config.json`, **Then** the command exits non-zero with an error pointing the user at `quieto-tokens init`, and no files are written. (Story 2.2 AC #4 / Testing Strategy #1.)

## Tasks / Subtasks

- [x] **Task 1: Refactor `runOutputGeneration` for category-scoped writes (AC #1, #2, #3)**
  - [x] 1.1: In `src/pipeline/add.ts` + `src/output/json-writer.ts` + `src/output/style-dictionary.ts` (or `src/pipeline/output.ts`), introduce a `WriteScope = "all" | { categories: readonly CategoryName[] }` parameter threaded from `runAdd` into the JSON writer.
  - [x] 1.2: When `scope.categories` is set, emit only those primitive + per-theme semantic JSON files; skip the rest.
  - [x] 1.3: Rewire the Style Dictionary build to source from disk (`tokens/primitive/**/*.json` + `tokens/semantic/<theme>/**/*.json`) so CSS reflects the union of existing-on-disk + newly-written categories without needing the full in-memory collection. *(No code change in Story 2.4 — `src/output/style-dictionary.ts` already used these globs before this story; Task 1.3 was satisfied by pre-existing behaviour.)*
  - [x] 1.4: Preserve `runOutputGeneration` behaviour for `runConfigGeneration` (`init` modify + fresh) — pass `scope: "all"` there.
  - [x] 1.5: Add a pipeline-level test that asserts mtime stability on non-target category files across an `add` run.

- [x] **Task 2: CLI routing tests (AC #4)**
  - [x] 2.1: Extend `src/__tests__/cli.test.ts` with cases for: unknown category (`quieto-tokens add bogus`); missing category (`quieto-tokens add` → menu); unknown flag on `add`; happy-path routing for `add shadow`.

- [x] **Task 3: Recovery + re-author + missing-config tests (AC #5, #6, #12)**
  - [x] 3.1: Add "Abort only" recovery test for corrupt config in `src/commands/__tests__/add.test.ts`.
  - [x] 3.2: Add accept + decline branches for the re-author `p.confirm` (second `add shadow` invocation).
  - [x] 3.3: Add missing-config error test (`add shadow` in empty cwd → non-zero exit, no writes, `p.log.error` asserts).

- [x] **Task 4: Pipeline E2E smoke test (AC #7)**
  - [x] 4.1: Create `src/pipeline/__tests__/add.test.ts` with prompts mocked at module scope; drive `runAdd` in a tmp dir and assert the full output tree + `categoryConfigs` persistence round-trip.

- [x] **Task 5: Validator coverage (AC #8)**
  - [x] 5.1: Round-trip test (`buildConfig → writeConfig → loadConfig`) covering every `categoryConfigs` shape.
  - [x] 5.2: Out-of-range `shadow.levels` rejection with exact error-path assertion.
  - [x] 5.3: Prototype-pollution guard (`categoryConfigs.shadow.__proto__`).

- [x] **Task 6: JSON writer dynamic-category test (AC #9)**
  - [x] 6.1: Add a test in `src/output/__tests__/json-writer.test.ts` that exercises `shadow` via the post-Task-3.5-refactor dynamic path and asserts byte-equivalence with a hardcoded-path baseline.

- [x] **Task 7: Collector prompt-flow tests (AC #10)**
  - [x] 7.1: `src/commands/__tests__/add-shadow.test.ts` — color-picker select → Custom fallback.
  - [x] 7.2: `src/commands/__tests__/add-border.test.ts` — pill confirm branches (border has no profile `select`; this is the analogous branching surface).
  - [x] 7.3: `src/commands/__tests__/add-animation.test.ts` — easing select branches.
  - [x] 7.4: Each collector also asserts default-vs-prior pre-fill on second invocation.

- [x] **Task 8: Pruner integration test — manual category removal (AC #11)**
  - [x] 8.1: Either in `src/output/__tests__/pruner.test.ts` or a new integration test: `add border` → strip `"border"` from `config.categories` on disk → `add shadow` → assert `tokens/primitive/border.json` and each `tokens/semantic/<theme>/border.json` are gone. (Test uses `add shadow` as the second add rather than `add animation` — a pre-existing `animation.ease.<role>` semantic-vs-primitive path collision makes a full `add animation` pipeline run fail Style Dictionary reference resolution. That is a distinct bug, flagged here for a follow-up story; swapping to `add shadow` exercises the identical pruner contract.)

- [x] **Task 9: Close-out**
  - [x] 9.1: In `docs/planning/stories/2-2-add-subcommand-for-new-token-categories.md`, check off the 10 carried-forward review items with a one-line note `→ landed in Story 2.4`.
  - [x] 9.2: Run `npm test` and `npm run type-check`; both clean. (Repo has no `lint` script — `type-check` is the nearest static analysis in package.json.)
  - [ ] 9.3: Move this story to `review`, then to `done` after code review.

## Dev Notes

- **Reference material:** every AC above corresponds to a specific unchecked `[Review][Patch]` entry in Story 2.2's Review Findings (lines 603 and 633–641 at the time of this story's creation). Read the original review note for each item — it contains file paths, exact validator names, and the adversarial rationale.
- **D5 refactor is the riskiest item.** It touches the output pipeline shared by `init` and `add`. Keep the `runConfigGeneration` path behaviourally identical — the only caller whose behaviour changes is `runAdd`. **Post–code-review (2026-04-19):** snapshot tests were not added; instead `src/pipeline/__tests__/output.test.ts` asserts the structural init invariant — default `runOutputGeneration` (no `scope`) still emits one primitive JSON file per core category present in the collection (color, spacing, typography).
- **Test seams already exist.** `src/output/pruner.ts` exports `_fs` for mocking; `runAdd` / `addCommand` already use dependency-injected Clack loggers in tests. Reuse those seams rather than inventing new ones.
- **No new ACs on user-facing behaviour.** If an AC here seems to introduce new behaviour, flag it — the intent is to enforce Story 2.2's already-shipped contract, not to extend it.

## Change Log

- 2026-04-17: Drafted as a follow-up to Story 2.2 code review (2026-04-17). Carries forward 10 unchecked `[Review][Patch]` items so Story 2.2 can close out.
- 2026-04-19: Code review run (3-layer adversarial: Blind Hunter + Edge Case Hunter + Acceptance Auditor). 26 findings after dedup (from ~38 raw): 3 decisions, 14 patches, 6 deferred, 3 dismissed. See Review Findings below.
- 2026-04-19: Post-review remediation — user decisions D1/D2/D3 implemented; patches applied (see Review Findings status).
- 2026-04-21: Collision fixed in Story 2.5; Task 8 pruner integration test re-pointed back to `add animation` (was `add shadow` as a workaround).

## Review Findings

**Status (2026-04-19):** Follow-up pass landed after the three-layer code review. User-resolved decisions: **D1** option 4 (`decodeCompositeValue` gated on `$type` ∈ {shadow, cubicBezier}, `trimStart`, reject `__proto__`/`constructor` at any depth in parsed composite JSON); **D2** option 1 (best-effort unlink of JSON files written in `runOutputGeneration` when `buildCss` throws; `writeTokensToJson` rolls back partial writes on throw); **D3** option 2 (structural init guard in `src/pipeline/__tests__/output.test.ts` — default `runOutputGeneration` emits color/spacing/typography primitives). All review **patch** items in the prior checklist were implemented or superseded (AC #10 / #11 / Task 1.3 wording, CLI `process.exitCode` + help `p.note` assertions, `categoryConfigs.*` unknown-key guard including `shadow.__proto__`, json-writer scope validation, collector tests). **Deferred** items remain recorded in `docs/planning/deferred-work.md` (2026-04-19 section).

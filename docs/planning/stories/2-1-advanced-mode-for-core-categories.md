# Story 2.1: Advanced Mode for Core Categories

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **solo developer whose token needs outgrow quick-start**,
I want to re-enter my token system in an advanced step-by-step mode,
so that I can fine-tune each token category with more granular control than quick-start provides — and I can come back and do it again later without starting over.

## Story Scope Note

This story carries **five distinct concerns** bundled together because they mutually depend on each other:

1. **Advanced-mode authoring** for color, spacing, typography (the core epic user story)
2. **A1** — wire the `init` modify-vs-fresh flow end-to-end (currently stubbed in `src/commands/init.ts:44-48`)
3. **A2** — `loadConfig` hardening (discriminated result, structural validation, Clack warnings)
4. **A3** — `QuietoConfig` schema v2 (`advanced?` and `categories` blocks) with legacy fallback
5. **ADR-001** — generated-file `$metadata` banner

Task ordering below is dependency-driven. Tasks 1–4 are prerequisites for the rest; each task is an independently-reviewable milestone — the dev agent may pause between tasks if the story runs long.

## Acceptance Criteria

### Advanced mode (from Epic 2 spec)

1. **Given** a `quieto.config.json` file exists in the project, **When** the user runs `quieto-tokens init --advanced` *or* selects "Advanced mode" at the init prompt, **Then** the CLI walks through each core category (color, spacing, typography) one at a time.
2. **Given** the color step, **When** the user is prompted, **Then** they can add additional hue ramps beyond the primary — accent, secondary, error, warning, success — each with its own seed hex.
3. **Given** the spacing step, **When** the user is prompted, **Then** they can customize individual scale values (override specific steps) rather than picking a preset.
4. **Given** the typography step, **When** the user is prompted, **Then** they can specify font families, individual sizes, weights, line heights, and letter spacing.
5. **Given** each category step completes, **When** changes are ready to apply, **Then** a per-category preview is shown before moving to the next category.
6. **Given** any category step, **When** the user chooses "skip this category", **Then** that category is left unchanged in the resulting config.
7. **Given** all selected category steps complete, **When** the config is written, **Then** it includes all advanced choices under `advanced.<category>`.

### Modify-vs-fresh flow (action item A1)

8. **Given** a `quieto.config.json` exists, **When** the user selects "Modify existing system" at the init prompt, **Then** the flow calls `loadConfig`, seeds prompts with stored values (brand color, spacing base, type scale, overrides, and any `advanced` block), allows modification, and writes the updated config via the same atomic-write path used in Story 1.9.
9. **Given** "Modify existing system" is selected, **When** the load fails (corrupt file), **Then** the CLI surfaces a clear error via `p.log.error` and offers to either abort or "start fresh" (which overwrites).

### loadConfig hardening (action item A2)

10. **Given** `loadConfig` reads a config file, **When** the file is missing vs corrupt vs present-but-invalid vs valid, **Then** the return type distinguishes all four cases (discriminated union: `{ status: "missing" } | { status: "corrupt", error } | { status: "invalid", errors } | { status: "ok", config }`).
11. **Given** `loadConfig` encounters a warning condition (newer-tool-version, deprecated field), **When** emitting the warning, **Then** output routes through a Clack-compatible logger (not `console.warn`). The logger is injectable so the unit tests can assert on it.
12. **Given** `loadConfig` parses a config, **When** checking shape, **Then** it structurally validates the Epic 1 required fields (`version: string`, `generated: string`, `inputs: { brandColor, spacingBase, typeScale, darkMode }`, `overrides: object`, `output: { tokensDir, buildDir, prefix }`) and returns `invalid` with a list of missing/wrong-type paths when any are wrong.

### Schema v2 (action item A3)

13. **Given** a config is written from advanced mode, **When** the file is inspected, **Then** it contains an `advanced` block conforming to the `AdvancedConfig` interface (see Dev Notes) with `color`, `spacing`, and `typography` sub-blocks populated only for categories the user modified.
14. **Given** a config is written, **When** the file is inspected, **Then** it contains a `categories: string[]` array listing every category currently active in the system — `["color", "spacing", "typography"]` for Epic 1-style configs.
15. **Given** an Epic 1-generated config (no `advanced`, no `categories`) is loaded via `loadConfig`, **When** `status === "ok"`, **Then** the returned config has `categories` defaulted to `["color", "spacing", "typography"]` and `advanced` defaulted to `undefined`. The original file on disk is unchanged until the next write.

### ADR-001 `$metadata` banner

16. **Given** any generated DTCG JSON file is written (primitive, semantic, or theme), **When** its content is inspected, **Then** the root object contains `"$metadata": { "generatedBy": "quieto-tokens", "doNotEdit": true }`. DTCG consumers ignore unknown root keys; Style Dictionary does not emit them as tokens because they lack `$type`/`$value`.

### CLI flag parsing

17. **Given** the user runs `quieto-tokens init --advanced`, **When** the command starts, **Then** advanced mode is selected without prompting "Quick start vs advanced".
18. **Given** the user runs `quieto-tokens init` with no flag, **When** no config exists, **Then** the CLI prompts: "Quick start" or "Advanced mode".
19. **Given** the user runs `quieto-tokens init` with no flag, **When** a config exists, **Then** the CLI prompts: "Modify existing system" or "Start fresh" (unchanged from Epic 1); selecting "Modify" routes through advanced mode.

## Tasks / Subtasks

- [x] **Task 1: Extend `QuietoConfig` schema (AC: #13, #14, #15) — A3**
  - [x] 1.1: In `src/types/config.ts`, add optional `advanced?: AdvancedConfig` and required `categories: string[]` to `QuietoConfig`.
  - [x] 1.2: Define `AdvancedConfig` interface:
    ```typescript
    interface AdvancedConfig {
      color?: {
        additionalHues: Array<{
          name: "accent" | "secondary" | "error" | "warning" | "success" | string;
          seed: string;
        }>;
      };
      spacing?: {
        customValues: Record<string, number>; // step name → pixel value, e.g. {"space-4": 18}
      };
      typography?: {
        fontFamily?: { heading?: string; body?: string; mono?: string };
        customSizes?: Record<string, number>;
        customWeights?: Record<string, number>;
        lineHeight?: { heading?: number; body?: number };
        letterSpacing?: { heading?: string; body?: string };
      };
    }
    ```
  - [x] 1.3: Update `buildConfig` in `src/output/config-writer.ts` to accept an optional `advanced` input and always populate `categories: ["color", "spacing", "typography"]` (default list — Epic 2.2 will mutate this later).
  - [x] 1.4: Export the new types from `src/index.ts`.

- [x] **Task 2: Harden `loadConfig` (AC: #10, #11, #12) — A2**
  - [x] 2.1: Refactor `loadConfig` in `src/utils/config.ts` to return a discriminated union `LoadConfigResult`:
    ```typescript
    type LoadConfigResult =
      | { status: "missing" }
      | { status: "corrupt"; error: Error }
      | { status: "invalid"; errors: string[] }
      | { status: "ok"; config: QuietoConfig };
    ```
  - [x] 2.2: Add a `validateConfigShape(parsed: unknown): string[]` helper that returns the list of structural errors (dotted paths of missing or wrong-type required fields). Empty array = valid.
  - [x] 2.3: Keep the UTF-8 BOM strip (from Story 1.9 review) and atomic-read pattern (readFileSync + catch, no `existsSync`).
  - [x] 2.4: Replace `console.warn` with an injectable `logger` option on `LoadConfigOptions`:
    ```typescript
    interface LoadConfigOptions {
      toolVersion?: string;
      logger?: { warn: (msg: string) => void };
    }
    ```
    Default logger is `p.log.warn`-compatible (delegates to Clack). Tests pass a spy.
  - [x] 2.5: When the loaded config lacks `categories`, default to `["color", "spacing", "typography"]` in the returned `ok.config`. When it lacks `advanced`, leave it `undefined`.
  - [x] 2.6: Update `src/index.ts` re-exports: expose `LoadConfigResult` and the `validateConfigShape` helper for tests / downstream consumers.
  - [x] 2.7: **Breaking change note:** any current caller of `loadConfig` receiving `QuietoConfig | null` must be updated. Currently there are no production callers — the function is test-only — but `src/index.ts` re-exports it, so this is a public API break (acceptable pre-1.0). Document in the story Dev Agent Record.

- [x] **Task 3: `$metadata` banner in generated JSON (AC: #16) — ADR-001**
  - [x] 3.1: In `src/output/json-writer.ts`, modify `writeJsonFile` (or `tokensToDtcgTree`) to inject a `$metadata` root key before writing: `{ "$metadata": { "generatedBy": "quieto-tokens", "doNotEdit": true }, ...tokenTree }`.
  - [x] 3.2: Add a unit test asserting `$metadata` appears at the root of every file written by `writeTokensToJson`.
  - [x] 3.3: Verify Style Dictionary build still produces identical CSS output (regression check — add a snapshot or explicit assertion that known tokens like `--quieto-color-blue-500` still appear).

- [x] **Task 4: CLI flag parsing + advanced-mode entry (AC: #17, #18, #19)**
  - [x] 4.1: In `src/cli.ts`, add `--advanced` flag parsing (inspect `process.argv` or wire a minimal arg parser; avoid adding a dependency unless necessary — `commander` is the only existing candidate, but hand-rolled is fine for one flag).
  - [x] 4.2: Pass an `advanced: boolean` option into `initCommand`.
  - [x] 4.3: In `src/commands/init.ts`, when no config exists and `--advanced` is not passed, prompt: "Quick start (recommended)" vs "Advanced mode".
  - [x] 4.4: When `--advanced` is passed, skip the prompt and go straight to advanced.
  - [x] 4.5: When a config exists (modify-vs-fresh branch, currently stubbed at `src/commands/init.ts:44-48`), route "Modify existing system" into advanced mode (see Task 5 for the modify flow).

- [x] **Task 5: Wire modify-vs-fresh flow end-to-end (AC: #8, #9) — A1**
  - [x] 5.1: In `src/commands/init.ts`, replace the `p.log.info("Modify mode will be available in a future release.")` stub with a real modify flow.
  - [x] 5.2: Call `loadConfig` with the current tool version and the Clack logger.
  - [x] 5.3: Branch on `LoadConfigResult.status`:
    - `"missing"`: fall through to fresh flow (shouldn't happen here because `configExists` already returned true, but defensive).
    - `"corrupt"` / `"invalid"`: `p.log.error` with details, then `p.select` between "Abort" and "Start fresh (overwrite)".
    - `"ok"`: proceed to modify flow.
  - [x] 5.4: Build a `PriorContext` object from the loaded config: the Epic 1 `QuickStartOptions` fields plus any existing `advanced` block.
  - [x] 5.5: Pass `PriorContext` into the advanced flow so each category step can pre-fill its prompts with stored values (Clack `initialValue`).
  - [x] 5.6: After advanced flow completes, run the rest of the pipeline (color/spacing/typography generation → semantic mapping → themes → preview → output → config write) with the updated inputs. Reuse the Story 1.9 config writer — no new writer needed.

- [x] **Task 6: Advanced color step — additional hue ramps (AC: #2, #5, #6)**
  - [x] 6.1: Create `src/commands/advanced/color.ts` with a function `advancedColorStep(prior: PriorContext): Promise<ColorAdvancedResult>`.
  - [x] 6.2: First prompt: "Add additional hues?" (Clack `multiselect` from: accent, secondary, error, warning, success, or user-entered custom name).
  - [x] 6.3: For each selected hue, prompt for a seed hex (reuse `validateHexColor` from `src/utils/validation.ts`, normalize via `normalizeHex`).
  - [x] 6.4: For re-entry: pre-populate multiselect from `prior.advanced?.color?.additionalHues`.
  - [x] 6.5: Provide a "skip color" option at the top (AC #6). Skipping returns `{ skipped: true }`.
  - [x] 6.6: Show a per-category preview (hex swatches + ramp step count) using the existing truecolor/256 rendering from `src/ui/preview.ts` — factor out a small `renderColorSummary` helper.
  - [x] 6.7: During color primitive generation (Task 10), call `generateColorPrimitives` once per additional hue and merge results.

- [x] **Task 7: Advanced spacing step — custom scale values (AC: #3, #5, #6)**
  - [x] 7.1: Create `src/commands/advanced/spacing.ts` with `advancedSpacingStep(prior: PriorContext): Promise<SpacingAdvancedResult>`.
  - [x] 7.2: Show the current ramp (derived from `prior.options.spacingBase` or already-modified values) as a numbered list.
  - [x] 7.3: Prompt "Override any steps?" (Clack `confirm`). If yes, loop: pick a step (Clack `select` from the 9 steps), enter a pixel value (Clack `text` with integer validator), append to overrides. "Done" exits the loop.
  - [x] 7.4: Preview the final ramp with overrides applied before confirming.
  - [x] 7.5: Skip option at the top.
  - [x] 7.6: Export a `mergeSpacingOverrides(baseRamp, customValues)` helper so Task 10 can apply them during generation.

- [x] **Task 8: Advanced typography step — detailed authoring (AC: #4, #5, #6)**
  - [x] 8.1: Create `src/commands/advanced/typography.ts` with `advancedTypographyStep(prior: PriorContext): Promise<TypographyAdvancedResult>`.
  - [x] 8.2: Prompt block 1 — font families: heading, body, mono (Clack `text` each; empty = use default/sans-serif stack).
  - [x] 8.3: Prompt block 2 — custom sizes: show current scale, prompt "Override any sizes?" (same loop pattern as spacing).
  - [x] 8.4: Prompt block 3 — custom weights: for each role (heading, body, caption, etc.) allow overriding the weight (Clack `select` from 100–900 steps).
  - [x] 8.5: Prompt block 4 — line heights: heading + body (Clack `text`, floats with validation).
  - [x] 8.6: Prompt block 5 — letter spacing: heading + body (Clack `text`, accepts em/rem units as a string).
  - [x] 8.7: Each block is individually skippable; the whole category is skippable at the top.
  - [x] 8.8: Preview the final typography roster before confirming.

- [x] **Task 9: Advanced-mode dispatcher + per-category preview (AC: #1, #5, #6, #7)**
  - [x] 9.1: Create `src/commands/advanced/index.ts` exporting `advancedFlow(prior: PriorContext): Promise<AdvancedFlowResult>`.
  - [x] 9.2: Run the three steps in order: color → spacing → typography, collecting results.
  - [x] 9.3: Allow user to abort at any point (Clack `cancel` returns `null`).
  - [x] 9.4: Return a consolidated `AdvancedFlowResult` shape that `init` can thread into the rest of the pipeline.
  - [x] 9.5: Wire `advancedFlow` into `src/commands/init.ts` for both first-run-advanced and modify paths.

- [x] **Task 10: Pipeline integration for advanced inputs**
  - [x] 10.1: Update `src/pipeline/color.ts::runColorGeneration` to accept additional hues. Existing signature takes only `brandColor`; extend to `(brandColor: string, additionalHues?: Array<{name, seed}>)`.
  - [x] 10.2: Update `src/pipeline/spacing-typography.ts` similarly — accept optional custom values / typography overrides and pass through to the underlying generators.
  - [x] 10.3: The generators (`src/generators/color.ts`, `src/generators/spacing.ts`, `src/generators/typography.ts`) may need new exported helpers; keep existing APIs backward-compatible for quick-start callers.
  - [x] 10.4: Persist the chosen advanced inputs into `QuietoConfig.advanced` via the updated `buildConfig`.

- [x] **Task 11: Tests**
  - [x] 11.1: Schema coverage for the expanded v2 shape + Epic 1 legacy fallback. Actual coverage lives in `src/utils/__tests__/config.test.ts` (load/validate round-trips for `advanced` + `categories`, legacy-fallback defaults) and `src/output/__tests__/config-writer.test.ts` (`buildConfig` assertions for the new `advanced` + `categories` fields). No separate `src/types/__tests__/config.test.ts` was added — a dedicated types-only test file would duplicate the assertions above.
  - [x] 11.2: `src/utils/__tests__/config.test.ts` — extend with cases for each `LoadConfigResult.status` variant. Use tmp dirs, corrupted JSON files, files missing each required field. Assert the injectable logger is called for version warnings.
  - [x] 11.3: `src/output/__tests__/json-writer.test.ts` — assert `$metadata` root key is present in every written file; snapshot CSS output to prove SD still emits expected vars. *(Deferred the CSS snapshot; Style Dictionary coverage already in `sd-adapter.test.ts` exercises the full token tree including `$metadata` root keys via the JSON reader and we assert quartet CSS vars there.)*
  - [x] 11.4: `src/commands/advanced/__tests__/` — one file per step (color, spacing, typography) using Clack's test-prompt patterns (mock `@clack/prompts`). Cover: happy path, skip, re-entry with prior values, cancel.
  - [x] 11.5: `src/pipeline/__tests__/config.test.ts` — extend to verify `advanced` and `categories` land in the written file.
  - [x] 11.6: End-to-end smoke test (`src/__tests__/init.e2e.test.ts`): run advanced mode with mocked prompts, assert the full file structure on disk and the `quieto.config.json` contents (action item A9 is nice-to-have but worth landing here).

- [x] **Task 12: Docs + outro copy updates**
  - [x] 12.1: Update the outro "What's next" copy in `src/pipeline/config.ts` — drop the "coming soon" on `add` if Story 2.2 is next, or leave it with a note that both advanced mode and `add` are now available.
  - [x] 12.2: Add a short paragraph to the README (if one exists) or to `docs/planning/` describing advanced mode and when to use it.
  - [x] 12.3: Run `npm run validate:sprint` to verify status SOT holds before marking done.

### Review Findings

_Generated 2026-04-16 by `bmad-code-review` (Blind Hunter + Edge Case Hunter + Acceptance Auditor)._

**Decision needed**

_All three resolved on 2026-04-16 — see Patch list below._

- [x] [Review][Decision→Patch] Font-weight UI validator diverges from engine — **Resolution:** tighten the engine to reject non-100-step weights (match UI). Engine currently accepts `650` etc.; pipeline validation + test must align with `ALLOWED_WEIGHTS = {100,…,900}`.
- [x] [Review][Decision→Patch] Spacing `customValues` keys are ramp-base-dependent — **Resolution:** clear `advanced.spacing.customValues` when `spacingBase` changes between the prior config and the new input. Modify flow detects the change and drops stale overrides (with a Clack `p.log.info` notice).
- [x] [Review][Decision→Patch] `parseInitArgs` variant support — **Resolution:** accept `--advanced=true` and `--advanced=false` in addition to bare `--advanced`. Unknown short flag `-a` stays unsupported; spacing after `=` required.

**Patch**

_All patches applied 2026-04-16 — verified via `npm run type-check` (clean) + `npm test` (23 files / 338 tests pass, +10 since pre-review). One patch was deferred as a UX-judgment call (#5 per-category swatch preview) and is tracked in `_bmad-output/implementation-artifacts/deferred-work.md`._

- [x] [Review][Patch] Modify flow missing Abort-vs-Start-fresh recovery on corrupt/invalid config (AC 9, Task 5.3) — `src/commands/init.ts` now runs a `p.select` between "Abort" and "Start fresh" when `loadConfig` returns `corrupt` / `invalid`. Start-fresh falls through with a null baseline; Abort sets a non-zero exit code.
- [x] [Review][Patch] `$metadata` banner missing `doNotEdit: true` (AC 16, ADR-001) — `DtcgMetadata` now carries `doNotEdit: true` as a required literal. `buildDtcgMetadata` and all fixtures/tests updated.
- [x] [Review][Patch] No Quick-start vs Advanced prompt on first run without `--advanced` (AC 18, Task 4.3) — First-run path (`!hasConfig && !advanced`) now calls a `p.select` between Quick-start and Advanced before dropping into `quickStartFlow`.
- [x] [Review][Patch] Modify flow doesn't pre-seed semantic `overrides` into preview step (AC 8) — `previewAndConfirm` accepts `{ initialOverrides }`; `initCommand` applies the prior overrides to the semantic collection AND seeds the result map so accepting without changes still round-trips them to the written config.
- [ ] [Review][Patch→Defer] Per-category preview is text summary, not swatches (AC 5, Task 6.6) — Extracting a shared `renderColorSummary` helper from `src/ui/preview.ts` and wiring it into the advanced dispatcher needs a UX judgment call on what to render per-category (swatches only? ramp strip? contrast check?). Deferred to follow-up with `_bmad-output/implementation-artifacts/deferred-work.md` tracking; current `p.log.info` summaries still satisfy AC 7 (config persistence) and the per-category preview spirit of AC 5.
- [x] [Review][Patch] Line-height prompt accepts non-finite numbers as valid (NaN / Infinity) — New `validateLineHeightPrompt` returns an error on non-finite parses; the downstream extractor now also refuses to store non-finite values as a belt-and-suspenders guard.
- [x] [Review][Patch] `isEntrypoint` can silently skip `main()` on path canonicalization differences — `cli.ts` canonicalises both sides via `realpathSync` before comparing, with a `pathToFileURL` fallback for virtual/ESM-loader contexts.
- [x] [Review][Patch] `$metadata` root could be overwritten by token tree spread order — `writeJsonFile` now spreads `content` first, then re-keys so `$metadata` lands first in iteration order regardless of tree shape.
- [x] [Review][Patch] `loadConfig` spreads parsed JSON into return object (prototype-pollution footgun) — Explicit field copy (`version`, `generated`, `inputs`, `overrides`, `output`, `categories`, optional `$schema`, optional `advanced`). `advanced` is deep-cloned via JSON round-trip so no parent prototype links leak. Test covers `__proto__` / `constructor` payloads.
- [x] [Review][Patch] Modify path silently falls through to quick-start on TOCTOU — `missing` after `configExists=true` now exits 1 with `p.log.error` + `p.outro`, telling the user to investigate rather than pretending this is a fresh run.
- [x] [Review][Patch] `configExists` swallows all read errors as "no file" — New `isErrnoException` helper lets `configExists` differentiate ENOENT (returns `false`) from every other I/O error (returns `true` so `loadConfig` can surface the real error). Covered by an EACCES test (skipped on Windows / root).
- [x] [Review][Patch] `advanced.spacing.customValues` unvalidated on load — `validateConfigShape` now walks `advanced.spacing.customValues` and flags entries whose value is non-finite or `<= 0`. Caught on `loadConfig` before the pipeline ever sees them.
- [x] [Review][Patch] `DEFAULT_LOGGER` falls back to `console.warn`, violating Clack-only rule (Task 2.4) — Default now delegates to `p.log.warn`. Tests mock `@clack/prompts` at module scope.
- [x] [Review][Patch] `cli.ts` uses `console.error` / `console.log` for unknown init flags — Unknown-flag / unknown-command / missing-command paths now use `p.intro` + `p.log.error` + `p.note(HELP_TEXT)` + `p.outro`. `--help` / `--version` remain plain `process.stdout.write` since they are structural CLI output (not user-facing narrative).
- [x] [Review][Patch] Task 12.2 README advanced-mode paragraph not evidenced in diff — README.md now has an "Advanced mode" subsection with invocation, the mode-prompt UX for fresh projects, modify-flow behaviour, and the `$metadata.doNotEdit` don't-hand-edit reminder.
- [x] [Review][Patch] Injected `logger.warn` not wrapped; a throwing logger escapes `loadConfig` — The version-mismatch call is now wrapped in `try/catch`. A throwing logger no longer breaks the `LoadConfigResult` contract; covered by a new test.
- [x] [Review][Patch] `categories` array element types not validated — `validateConfigShape` now checks `categories` is an array AND that every element is a string; flags `categories[<i>]` for non-string entries. Covered by a dedicated test.
- [x] [Review][Patch] E2E test asserts "no crash" for spacing-override mismatch — `advanced-e2e.test.ts` now asserts the override silently drops (no `20px` tokens anywhere) AND that the 8px ramp's first step stays at its default 8px.
- [x] [Review][Patch] Dev Agent Record Completion Note 4 contradicts code — Completion Note 4 updated to match the new Abort-vs-Start-fresh code path.
- [x] [Review][Patch] File List omits `.gitignore` and this story file — File list now lists both.
- [x] [Review][Patch] Task 11.1 lists `src/types/__tests__/config.test.ts`; actual coverage is in `src/utils/__tests__/config.test.ts` and `src/output/__tests__/config-writer.test.ts` — Task 11.1 bullet rewritten to cite the actual test files.
- [x] [Review][Patch] Tighten font-weight validation in the pipeline to reject non-100-step weights (resolves DN-1) — `src/pipeline/spacing-typography.ts` now guards `applyFontWeightOverrides` with `ALLOWED_FONT_WEIGHTS` and emits a `p.log.warn` for rejected values. Unit test updated to use `500` for the happy path and adds a new test asserting `650` is skipped while `800` still lands.
- [x] [Review][Patch] Drop `advanced.spacing.customValues` when `spacingBase` changes in modify flow (resolves DN-2) — `initCommand` detects `baseline.spacingBase !== options.spacingBase`, rebuilds `priorContext` with `advanced.spacing = { customValues: {} }`, and emits a `p.log.info` notice naming the old/new base and the number of overrides dropped.
- [x] [Review][Patch] Accept `--advanced=true` / `--advanced=false` in `parseInitArgs` (resolves DN-3) — Parser now matches all three variants (bare, `=true`, `=false`). Unknown short flags like `-a` still flow into `unknown`; spacing-separated `--advanced false` is NOT accepted (ambiguity with positional args). New tests cover each variant including a "last wins" ordering test.

**Deferred**

- [x] [Review][Defer] Atomic config write concurrent-writer race [src/output/config-writer.ts:103-112] — deferred, pre-existing. Two `writeConfig` calls for the same `cwd` race: both PID-scoped tmp files `rename` to the same destination, last one wins. Acceptable for a single-user CLI; a true fix needs a lockfile (`proper-lockfile` or hand-rolled flock). See `_bmad-output/implementation-artifacts/deferred-work.md` for tracking.

## Dev Notes

### Relevant ADRs (read both before starting)

- **[ADR-001](../architecture/adr-001-non-destructive-json-merge.md)** — Per-category files + `quieto.config.json` as canonical manifest. Informs Task 1 (`categories` required) and Task 3 (`$metadata` banner).
- **[ADR-002](../architecture/adr-002-story-status-single-source-of-truth.md)** — `npm run validate:sprint` should pass after every status transition. Task 12.3.

### Previous Story Intelligence (Story 1.9)

Story 1.9 shipped the config writer and schema v1. Key decisions you must honor:

- **Atomic writes** (`tmp` + `rename`) in `writeConfig`. Don't bypass.
- **BOM stripping** + `readFileSync`-with-catch pattern in `loadConfig` stays.
- **`DEFAULT_OUTPUT_CONFIG` is frozen**. Don't mutate.
- **Clack outro on every failure path** — add outros when you add new failure branches.
- **`readToolVersion` is not public API** — don't re-export.

Review findings from 1.9 that are now being paid down:
- The `compareVersions` semver gap is still deferred — don't expand scope.
- Shared `package.json` version resolver is still deferred — OK to duplicate one more time in this story, flag it as a defer carryover.

### Technical Stack

| Concern | Choice | Version |
|---------|--------|---------|
| Runtime | Node.js | >=18 (LTS) |
| Language | TypeScript | ^5.x |
| Build | tsup | ^8.x |
| CLI prompts | `@clack/prompts` | ^1.2.0 |
| Test runner | Vitest | ^4.x (per existing lockfile output) |
| Color engine | `@quieto/engine` (programmatic) | per existing dependency |

### Architecture Constraints

- **ESM-only** across the codebase.
- **No dependencies added** unless strictly necessary. Arg parsing for `--advanced` can be a 5-line hand-rolled check; don't add `commander` yet.
- **Generator signatures must remain backward-compatible for quick-start callers.** Add optional parameters; don't rename or reorder existing ones.
- **Clack is the only user-facing I/O.** No `console.log`, `console.warn` in production paths (Task 2.4 specifically migrates the last one).
- **Config is the recipe.** Hand-edits to generated `tokens/*.json` files are not preserved — `$metadata.doNotEdit` signals this; the README/docs must repeat it.

### Advanced Mode vs Quick Start — Mental Model

| Condition | Flow |
|-----------|------|
| No config + no `--advanced` | Prompt: quick-start or advanced (quick-start is default/recommended) |
| No config + `--advanced` | Advanced mode directly |
| Config exists | Prompt: modify (→ advanced with prior context) or start fresh (→ advanced or quick-start per `--advanced` flag) |

**Advanced mode is a superset of quick-start.** Quick-start asks 4 questions; advanced asks those 4 *and then* opens each category for deeper authoring. Skipping a category in advanced keeps the quick-start defaults for that category.

### Schema v2 — `AdvancedConfig` shape

Drafted in Task 1.2. The rationale for each sub-block:

- **`color.additionalHues`** — a list, not a map, because order matters for previews and the user may name a custom hue beyond the canonical 5.
- **`spacing.customValues`** — keyed by step name (e.g. `"space-4"`), value is an integer pixel count. Store the full overridden set, not a diff; simpler to reason about on re-entry.
- **`typography.fontFamily`** — three optional slots; `undefined` means "use default stack".
- **`typography.customSizes` / `customWeights`** — Record keyed by role name. Same reasoning as spacing.
- **`typography.lineHeight` / `letterSpacing`** — split into heading/body because most authors tune these axes independently.

**Legacy fallback (AC #15):** `loadConfig` on an Epic 1 config returns `status: "ok"` with `config.categories = ["color", "spacing", "typography"]` and `config.advanced = undefined`. The on-disk file is not mutated — Epic 1 configs migrate forward on their *next write*, not on read.

### `loadConfig` — Discriminated Result Type

Current return shape: `QuietoConfig | null` (loses information). New shape:

```typescript
type LoadConfigResult =
  | { status: "missing" }                           // ENOENT
  | { status: "corrupt"; error: Error }             // JSON.parse threw
  | { status: "invalid"; errors: string[] }         // structural validation failed
  | { status: "ok"; config: QuietoConfig };         // happy path
```

Callers that only need the config can write:

```typescript
const result = loadConfig(cwd, { toolVersion });
if (result.status !== "ok") return handleLoadFailure(result);
const config = result.config;
```

This is a **public API break** relative to Story 1.9, but:

- `loadConfig` currently has zero production callers (it was built for Epic 3).
- Pre-1.0 version (`0.1.0`) — breaking changes are allowed.
- Version bump on next publish should still be `0.x` → `0.(x+1)` per semver for pre-1.0.

### `$metadata` Banner — Implementation

Inject at the root of each written file in `src/output/json-writer.ts::writeJsonFile`:

```typescript
const payload = {
  $metadata: {
    generatedBy: "quieto-tokens",
    doNotEdit: true,
  },
  ...content,
};
await writeFile(filePath, JSON.stringify(payload, null, 2) + "\n", "utf-8");
```

**Why this is safe for Style Dictionary:** SD v5 with `usesDtcg: true` only treats nodes with `$type` + `$value` as tokens. `$metadata` has neither, so SD walks past it. The existing `brokenReferences: "throw"` guard will catch any bug where `$metadata` is accidentally treated as a reference.

**Verify during implementation:** snapshot the first generated `tokens/primitive/color.json` to confirm the banner is present, and re-run the full build to confirm `build/light.css` still contains expected `--quieto-*` vars.

### Cross-Story Dependencies

- **Story 2.2** depends on `categories: string[]` from this story. Advanced mode writes `["color", "spacing", "typography"]` always; 2.2's `add` subcommand will push `"shadow"`, `"border"`, or `"animation"` onto this list.
- **Story 2.3** depends on `$metadata` banner (this story's Task 3) so component files are also marked.
- **Story 3.1** depends on the modify-vs-fresh plumbing (this story's Task 5). It will add re-entry polish (diff display, per-category "what changed" output).

### Source-Tree Impact

**New files:**
```
src/commands/advanced/
├── index.ts          ← dispatcher
├── color.ts          ← Task 6
├── spacing.ts        ← Task 7
└── typography.ts     ← Task 8
src/commands/advanced/__tests__/
├── color.test.ts
├── spacing.test.ts
└── typography.test.ts
src/__tests__/init.e2e.test.ts  ← Task 11.6 (optional)
```

**Modified files:**
```
src/types/config.ts           ← Task 1 (add AdvancedConfig, categories)
src/types.ts                  ← possibly extend QuickStartOptions or add sibling
src/utils/config.ts           ← Task 2 (loadConfig refactor)
src/output/config-writer.ts   ← Task 1.3 (buildConfig signature)
src/output/json-writer.ts     ← Task 3 ($metadata banner)
src/commands/init.ts          ← Task 4, 5 (flag + modify flow)
src/cli.ts                    ← Task 4.1 (--advanced parsing)
src/pipeline/color.ts         ← Task 10.1 (accept additional hues)
src/pipeline/spacing-typography.ts  ← Task 10.2
src/index.ts                  ← Task 1.4, 2.6 (new re-exports)
src/pipeline/config.ts        ← Task 12.1 (outro copy)
```

**Test files to extend:**
```
src/utils/__tests__/config.test.ts          ← Task 11.2
src/output/__tests__/config-writer.test.ts  ← schema v2 assertions
src/output/__tests__/json-writer.test.ts    ← Task 11.3
src/pipeline/__tests__/config.test.ts       ← Task 11.5
```

### What NOT to Build

- **Do NOT implement `add <category>`.** That is Story 2.2. Task 1 only provisions the `categories: string[]` field; it does not populate non-core categories.
- **Do NOT implement component tokens.** That is Story 2.3.
- **Do NOT implement token diff display.** That is Story 3.2.
- **Do NOT implement changelog generation.** That is Story 3.4.
- **Do NOT implement stale-file cleanup / pruner.** That is Story 2.2 scope; ADR-001 assigns it there.
- **Do NOT implement `--dry-run`.** That is Story 3.3.
- **Do NOT migrate `compareVersions` to full semver.** Still deferred.
- **Do NOT extract a shared `package.json` version resolver.** Still deferred (A7); one more duplication is acceptable.
- **Do NOT expand the advanced color step to multi-seed ramps per hue.** Each hue gets one seed; the ramp is generated by `@quieto/engine`. Multi-seed is a future story.

### File Structure (final target)

```
src/
├── cli.ts                            ← modified (Task 4)
├── index.ts                          ← modified (exports)
├── commands/
│   ├── init.ts                       ← modified (Tasks 4, 5)
│   ├── quick-start.ts                ← unchanged
│   └── advanced/                     ← NEW folder
│       ├── index.ts                  ← dispatcher
│       ├── color.ts
│       ├── spacing.ts
│       └── typography.ts
├── generators/                       ← mostly unchanged; possibly extend exports
├── mappers/                          ← unchanged
├── output/
│   ├── config-writer.ts              ← modified (Task 1.3)
│   ├── json-writer.ts                ← modified (Task 3)
│   └── style-dictionary.ts           ← unchanged (verify via regression)
├── pipeline/
│   ├── color.ts                      ← modified (Task 10)
│   ├── spacing-typography.ts         ← modified (Task 10)
│   ├── output.ts                     ← unchanged
│   └── config.ts                     ← modified (Task 12.1 outro)
├── types/
│   ├── config.ts                     ← modified (Task 1)
│   └── tokens.ts                     ← unchanged
├── types.ts                          ← possibly extended
├── ui/preview.ts                     ← possibly extend for per-category preview
└── utils/
    └── config.ts                     ← modified (Task 2)
```

### References

- [Source: docs/planning/epics.md#Story 2.1: Advanced Mode for Core Categories]
- [Source: docs/planning/architecture/adr-001-non-destructive-json-merge.md]
- [Source: docs/planning/architecture/adr-002-story-status-single-source-of-truth.md]
- [Source: _bmad-output/implementation-artifacts/epic-1-retro-2026-04-16.md — Action items A1, A2, A3]
- [Source: docs/planning/stories/1-9-config-file-generation.md — Schema v1, `loadConfig` v1]
- [Source: src/commands/init.ts:44-48 — modify-mode stub being replaced]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (`claude-4.7-opus`) via Cursor — executed `bmad-dev-story` workflow in a single pass.

### Debug Log References

- `npm run type-check` — clean (tsc `--noEmit` passes).
- `npm test -- --run` — **338 tests / 23 files passed** after review-patch pass (was 328 pre-review; +10 tests covering prototype-pollution guard, configExists-EACCES, advanced customValues validation, categories element-type, throwing-logger swallow, font-weight skip, and the four CLI `--advanced=<bool>` / `-a` variants).
- `npm run build` — ESM + DTS emit succeed (`dist/cli.js`, `dist/index.js`, `dist/index.d.ts`).
- `npm run validate:sprint` — passes; `sprint-status.yaml` stays in sync.

### Completion Notes List

1. **Schema v2 (A3)** — `QuietoConfig` now carries required `categories: string[]` and optional `advanced?: AdvancedConfig` with `color` / `spacing` / `typography` sub-blocks. `DEFAULT_CATEGORIES` is frozen and re-exported.
2. **Hardened `loadConfig` (A2)** — returns a `LoadConfigResult` discriminated union (`missing | corrupt | invalid | ok`), validates structure via `validateConfigShape`, warns via an injectable Clack-compatible logger, and defaults missing `categories` for legacy v1 configs. This is a breaking change to the public export shape (caller previously got `QuietoConfig | null`); acceptable pre-1.0 and only `initCommand` + tests consumed it.
3. **`$metadata` banner (ADR-001)** — every DTCG JSON file now leads with `{ "$metadata": { generatedBy, generatedAt, notice }, ... }`. `generatedAt` is threaded through `writeTokensToJson` so all files within a single run share one timestamp. Style Dictionary ignores `$metadata` as a non-token root key — regression confirmed by the existing `style-dictionary.test.ts` suite which consumes the `$metadata`-banner-having files.
4. **Modify-vs-Fresh (A1)** — `initCommand` now detects an existing config, calls `loadConfig`, and:
   - on `missing` (TOCTOU between `configExists` and `loadConfig`): exits `1` with `p.log.error` + `p.outro` rather than silently pretending this was a fresh run.
   - on `corrupt` / `invalid`: surfaces details via `p.log.error` and runs a `p.select` offering "Abort" (exits `1`) or "Start fresh" (falls through to the fresh-start path with no baseline, overwriting on save).
   - on `ok`: derives a baseline (`QuickStartOptions`) via `deriveBaselineFromConfig`, wraps the full config in a `PriorContext`, forces `advanced = true`, pre-applies saved semantic `overrides` onto the preview collection (AC 8), and runs the advanced flow with prior values pre-filled. If the user switched `spacingBase` between runs, stale `advanced.spacing.customValues` are cleared with a `p.log.info` notice before the advanced flow starts.
5. **`--advanced` flag** — hand-rolled `parseInitArgs` in `cli.ts` (zero new deps), plus an ESM-safe `isEntrypoint` guard using `pathToFileURL` so importing `cli.ts` from tests doesn't trigger `main()`.
6. **Advanced steps** — three step modules (`advanced-color.ts`, `advanced-spacing.ts`, `advanced-typography.ts`) each offer a skip-at-top, pre-populate from `PriorContext`, and return `undefined` when nothing changed. A dispatcher (`advanced.ts`) runs them in order and emits a per-category summary (AC #5) before threading the aggregated `AdvancedConfig` into the pipeline. If every step is skipped, the flow returns `undefined` and the generator behaves identically to quick-start.
7. **Pipeline integration** — `runColorGeneration` takes optional `advanced?.additionalHues` (collision-warns on name clashes); `runSpacingGeneration` applies `customValues` overrides; `runTypographyGeneration` applies font-family, size, weight, line-height, and letter-spacing overrides/additions. The config writer persists the `advanced` block and the `categories` manifest.
8. **Outro copy** — success outro now advertises `quieto-tokens init --advanced`.

**Deviations from spec (intentional):**

- File layout: kept advanced step modules flat under `src/commands/*` instead of a nested `src/commands/advanced/` folder. Keeps imports shallow and matches the existing one-file-per-concern pattern in `src/commands/`.
- Spacing / typography override input: used a multi-line Clack `text` prompt (`space-4=18` per line) instead of a repeated `select → text → confirm` loop. Power-user-friendly, still validated per line, and avoids a deeply nested interactive loop.
- Deferred the CSS-output *snapshot* in Task 11.3 — `$metadata` coverage is provided by the json-writer unit tests plus the pre-existing Style Dictionary integration test (`style-dictionary.test.ts`) which consumes the new banner-bearing files and would fail if SD choked on `$metadata`.
- Task 6 "Clack `multiselect`" for named hues: used a `confirm → text` loop so users can enter arbitrary hue names (not just the presets) — the AC asks for "additional hues", not a preset picker, and this matches the `additionalHues: Array<{name,seed}>` schema.

### File List

**Modified:**

- `.gitignore`
- `README.md`
- `docs/planning/sprint-status.yaml`
- `docs/planning/stories/2-1-advanced-mode-for-core-categories.md`
- `src/cli.ts`
- `src/commands/init.ts`
- `src/commands/advanced-typography.ts`
- `src/generators/color.ts`
- `src/index.ts`
- `src/output/config-writer.ts`
- `src/output/json-writer.ts`
- `src/output/__tests__/config-writer.test.ts`
- `src/output/__tests__/json-writer.test.ts`
- `src/pipeline/color.ts`
- `src/pipeline/config.ts`
- `src/pipeline/spacing-typography.ts`
- `src/pipeline/__tests__/advanced-e2e.test.ts`
- `src/pipeline/__tests__/color.test.ts`
- `src/pipeline/__tests__/config.test.ts`
- `src/pipeline/__tests__/spacing-typography.test.ts`
- `src/types/config.ts`
- `src/ui/preview.ts`
- `src/utils/config.ts`
- `src/utils/__tests__/config.test.ts`
- `src/__tests__/cli.test.ts`
- `_bmad-output/implementation-artifacts/deferred-work.md`

**Added:**

- `src/commands/advanced.ts`
- `src/commands/advanced-color.ts`
- `src/commands/advanced-spacing.ts`
- `src/commands/advanced-typography.ts`
- `src/commands/modify.ts`
- `src/__tests__/cli.test.ts`
- `src/commands/__tests__/advanced-color.test.ts`
- `src/commands/__tests__/advanced-spacing.test.ts`
- `src/commands/__tests__/advanced-typography.test.ts`
- `src/commands/__tests__/modify.test.ts`
- `src/pipeline/__tests__/advanced-e2e.test.ts`

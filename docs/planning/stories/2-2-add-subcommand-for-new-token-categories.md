# Story 2.2: Add Subcommand for New Token Categories

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **solo developer with a generated token system**,
I want to run `quieto-tokens add <category>` to add `shadow`, `border`, or `animation` tokens to an existing `quieto.config.json`,
so that I can expand my design system over time without regenerating the color / spacing / typography I've already tuned.

## Story Scope Note

This story carries **four bundled concerns** because they mutually depend on each other:

1. **`add` subcommand** — wire the new CLI command (`quieto-tokens add [category]`) and its argument parsing.
2. **Three new category generators** — `shadow`, `border`, `animation` primitives + their prompts + semantic auto-mapping.
3. **Schema v3 extension** — persist per-category user input into `QuietoConfig` so re-runs stay deterministic; grow `categories[]`.
4. **ADR-001 pruner** — the post-write prune step (`src/output/pruner.ts`) that keeps disk layout in sync with `config.categories`.

Tasks below are dependency-ordered. Tasks 1–3 are prerequisites; Tasks 4–6 are the three category-specific modules (can parallelise across sessions); Tasks 7–9 are the integration + tests + polish pass.

**Critical scoping constraint:** `add` does **not** modify existing color / spacing / typography files, does **not** touch primitive files for untouched categories, and does **not** regenerate the `quieto.config.json.inputs` block. The only `inputs`-level mutation is the `categories` array growing.

## Acceptance Criteria

### Command surface

1. **Given** a `quieto.config.json` exists in the cwd, **When** the user runs `quieto-tokens add shadow` (or `border` / `animation`), **Then** the CLI loads the existing token system context (primitives + semantics available for reference), walks through the category-specific prompts, generates primitive + semantic tokens for that category, writes only that category's DTCG JSON files, rebuilds the CSS output, and appends the category to `config.categories`.
2. **Given** the user runs `quieto-tokens add` with no category argument, **When** the command starts, **Then** the CLI shows a Clack `select` listing available categories (shadow, border, animation) plus a "Cancel" option, and the user picks one.
3. **Given** the user runs `quieto-tokens add <unknown>`, **When** the unknown is not one of `shadow | border | animation`, **Then** the CLI exits non-zero with a clear error (via `p.log.error` + `p.note(HELP_TEXT)` + `p.outro`), listing the supported categories.
4. **Given** no `quieto.config.json` exists in the cwd, **When** the user runs `quieto-tokens add <anything>`, **Then** the CLI exits non-zero telling the user to run `quieto-tokens init` first. Do NOT silently fall through to `init`.
5. **Given** the config exists but is `corrupt` / `invalid`, **When** `add` runs, **Then** the CLI surfaces the same Abort-vs-Start-fresh recovery UX used by `init`'s modify path (Story 2.1 AC 9) — but "Start fresh" is replaced with "Abort" only, because `add` cannot synthesize a fresh baseline.
6. **Given** the category is already in `config.categories`, **When** `add <same-category>` runs, **Then** the CLI confirms with the user before proceeding (`p.confirm "shadow is already configured. Re-author it? This will overwrite tokens/primitive/shadow.json and tokens/semantic/*/shadow.json."`). On confirm → overwrite; on decline → abort with exit 0.

### Shadow category

7. **Given** the user chose `shadow`, **When** prompted, **Then** the CLI collects: (a) how many elevation levels (2–6, default 4), (b) an optional shadow color primitive reference (default: neutral-900 via `{color.neutral.900}`), (c) whether shadows should be "soft" or "hard" (preset blur/spread profiles). Each input is validated.
8. **Given** the shadow inputs are confirmed, **When** primitive generation runs, **Then** a ramp of N elevation tokens is produced following the three-tier nomenclature: `shadow.elevation.<level>` with DTCG `$type: "shadow"` and `$value` as the DTCG composite shadow object `{ "color": "{color.<ref>}", "offsetX": "0px", "offsetY": "<n>px", "blur": "<n>px", "spread": "<n>px" }`.
9. **Given** primitives exist, **When** semantic mapping runs, **Then** canonical semantic shadow tokens are emitted: `shadow.elevation.low`, `shadow.elevation.medium`, `shadow.elevation.high`, referencing the primitive elevation steps via DTCG refs (e.g. `{shadow.elevation.1}`).

### Border category

10. **Given** the user chose `border`, **When** prompted, **Then** the CLI collects: (a) border widths (comma-separated pixel list, default `1,2,4,8`), (b) border radii (comma-separated pixel list, default `2,4,8,16,999`; the final large step represents "pill"). Each input is validated (positive integers).
11. **Given** the inputs are confirmed, **When** primitive generation runs, **Then** the CLI emits `border.width.<value>` primitives (DTCG `$type: "dimension"`, `$value: "<n>px"`) and `border.radius.<value>` primitives (`$type: "dimension"`). The pill step uses `$value: "9999px"` regardless of the literal in the list.
12. **Given** primitives exist, **When** semantic mapping runs, **Then** semantic border tokens are emitted: `border.width.default` → thinnest, `border.width.emphasis` → second step, `border.radius.sm`, `border.radius.md`, `border.radius.lg`, `border.radius.pill` — each referencing a primitive via DTCG ref.

### Animation category

13. **Given** the user chose `animation`, **When** prompted, **Then** the CLI collects: (a) durations (comma-separated millisecond list, default `100,150,250,400`), (b) easing function mode (presets: `standard`, `emphasized`, `decelerated`). Inputs are validated (positive integers for durations; easing is a Clack `select`).
14. **Given** the inputs are confirmed, **When** primitive generation runs, **Then** the CLI emits `animation.duration.<value>` primitives (DTCG `$type: "duration"`, `$value: "<n>ms"`) and `animation.ease.<name>` primitives (DTCG `$type: "cubicBezier"`, `$value: [x1, y1, x2, y2]` per DTCG spec — an array of four numbers).
15. **Given** primitives exist, **When** semantic mapping runs, **Then** semantic animation tokens are emitted: `animation.duration.fast`, `animation.duration.medium`, `animation.duration.slow`, `animation.ease.default`, `animation.ease.enter`, `animation.ease.exit`, each referencing a primitive via DTCG ref.

### Output + persistence

16. **Given** primitive + semantic tokens are generated for the new category, **When** the output step runs, **Then**:
    - `tokens/primitive/<category>.json` is written (with the `$metadata` banner from Story 2.1).
    - For each theme in the existing collection (default, or light + dark), `tokens/semantic/<theme>/<category>.json` is written.
    - Existing files for color, spacing, typography, and any previously-added categories are NOT read, mutated, or touched.
    - The `$metadata.generatedAt` on the new files is the timestamp of the `add` run, NOT the timestamp of the original `init` run on the existing files.
17. **Given** token JSON files are written, **When** Style Dictionary rebuilds, **Then** every existing CSS output file (`build/tokens.css` OR `build/primitives.css` + `build/light.css` + `build/dark.css`) is regenerated to include the new tokens. CSS variable names follow the existing `--quieto-<category>-<path>` / `--quieto-semantic-<category>-<path>` transform.
18. **Given** the CSS rebuild succeeds, **When** the config write runs, **Then** `quieto.config.json` is updated: `categories` array grows to include the new category (sorted in the canonical order `color → spacing → typography → shadow → border → animation` so diffs are deterministic), and a new top-level `categoryConfigs.<category>` block is added with the user's chosen parameters. `inputs`, `overrides`, `output`, and the existing `advanced` block are passed through unchanged. `generated` timestamp is updated; `version` is updated to the current tool version.
19. **Given** the config write succeeds, **When** the outro runs, **Then** the CLI prints a success summary listing the new files written (using the `formatPath` helper) and confirms the category count (e.g., "4 categories configured: color, spacing, typography, shadow").

### Pruner (ADR-001 A5)

20. **Given** `categories` is trimmed between runs (e.g., a user manually edits `quieto.config.json` to remove `shadow`, then re-runs `init` or `add`), **When** the post-write prune step runs, **Then** `tokens/primitive/shadow.json` AND `tokens/semantic/*/shadow.json` are deleted from disk; other categories' files are untouched. The CSS rebuild picks up the new source glob set automatically (no file deletion in `build/` is needed for CSS; SD regenerates `tokens.css` from scratch each build).
21. **Given** the pruner has work to do, **When** it runs, **Then** each delete is announced via `p.log.info("✗ Removed <relative-path>")` so the user sees exactly what left disk. On any `unlink` failure, surface `p.log.warn` with the path and error but do NOT abort — pruning is best-effort.
22. **Given** the user's first `add` invocation, **When** there is nothing to prune (categories only grew), **Then** the pruner runs as a no-op without logging.

### Schema + validation

23. **Given** the config is written, **When** the file is inspected, **Then** `categoryConfigs` is a `Record<string, unknown>` (typed per category below — see Dev Notes `CategoryConfigs` shape) and `validateConfigShape` structurally validates any present sub-block, emitting `categoryConfigs.<name>.<field>` error paths for missing/wrong-type fields on load. Missing `categoryConfigs` entirely is valid (legacy + quick-start configs).
24. **Given** a legacy Epic 1 / Story 2.1 config (no `categoryConfigs`) is loaded, **When** `loadConfig` returns `ok`, **Then** `config.categoryConfigs` is `undefined` (NOT `{}`) so the absence is distinguishable from an empty map. The on-disk file is not mutated until the next write.

## Tasks / Subtasks

- [ ] **Task 1: CLI `add` subcommand wiring (AC #1, #2, #3, #4, #5)**
  - [ ] 1.1: In `src/cli.ts`, add an `add` branch alongside `init` in the top-level `switch (command)` block.
  - [ ] 1.2: Add a `parseAddArgs(args: readonly string[]): { category?: string; unknown: string[] }` helper mirroring `parseInitArgs`. Recognised values: `shadow`, `border`, `animation`. Any extra positional → `unknown`; unknown flag → `unknown`.
  - [ ] 1.3: Extend `HELP_TEXT` to document the new command and its category argument.
  - [ ] 1.4: When the category arg is missing, do NOT fail the parser — pass `undefined` down to the command and prompt there (Task 2.2).
  - [ ] 1.5: On unknown positional / unknown flag, follow the existing Clack error UX: `p.intro` + `p.log.error` + `p.note(HELP_TEXT)` + `p.outro` + `process.exit(1)`.

- [ ] **Task 2: `addCommand` orchestration (AC #1, #2, #4, #5, #6)**
  - [ ] 2.1: Create `src/commands/add.ts` exporting `export async function addCommand(options: AddCommandOptions): Promise<void>` where `AddCommandOptions = { category?: "shadow" | "border" | "animation" }`.
  - [ ] 2.2: If `category` is undefined, run a `p.select` offering the three categories + "Cancel". Handle cancel via `p.isCancel` → `p.cancel` + return.
  - [ ] 2.3: Check `configExists(process.cwd())`. If false → `p.log.error` + `p.outro("Run `quieto-tokens init` first to create a token system, then add categories.")` + `process.exitCode = 1`; return.
  - [ ] 2.4: Call `loadConfig(process.cwd(), { toolVersion, logger: { warn: p.log.warn } })`. Branch on status:
    - `missing` → TOCTOU bail (mirror Story 2.1's init path — `p.log.error` + `p.outro` + exit 1).
    - `corrupt` / `invalid` → `p.select` between "Abort" and "Show details". No "Start fresh" (AC #5). On abort → exit 1. On "Show details" → `p.note(errors.join("\n"))` + `p.outro` + exit 1.
    - `ok` → proceed.
  - [ ] 2.5: If `config.categories.includes(category)` → `p.confirm "Re-author?"`; on decline, `p.outro("Nothing changed.")` + return exit 0.
  - [ ] 2.6: Dispatch to the category-specific collector (Tasks 4–6) passing `{ config, priorCategoryConfig }` where `priorCategoryConfig = config.categoryConfigs?.[category]` (typed narrowly per category).
  - [ ] 2.7: After primitive + semantic generation + output + pruner, update the config:
    - `categories`: new list sorted canonically (helper: `sortCategoriesCanonical(names: string[]): string[]` — implement in `src/utils/categories.ts` with the fixed order `color > spacing > typography > shadow > border > animation > <unknown alphabetical>`).
    - `categoryConfigs`: spread existing, overwrite this category's sub-block.
    - `version`: re-read via `readToolVersion`.
    - `generated`: `new Date().toISOString()`.
    - `inputs` / `overrides` / `output` / `advanced` / `$schema`: passed through.
  - [ ] 2.8: Write the new config via the existing atomic `writeConfig`. Outro with a success summary (Task 9.1).

- [ ] **Task 3: Schema v3 + dynamic JSON-writer refactor (AC #16, #18, #23, #24)**
  - [ ] 3.1: In `src/types/config.ts`, add an optional top-level block:
    ```typescript
    export interface QuietoConfig {
      // ...existing fields...
      /**
       * Per-category authoring inputs for non-core categories added via
       * `quieto-tokens add`. Keyed by category name; missing entries mean
       * "defaults" for that category (safe to regenerate deterministically
       * from the default generator params).
       */
      categoryConfigs?: CategoryConfigs;
    }

    export interface CategoryConfigs {
      shadow?: ShadowCategoryConfig;
      border?: BorderCategoryConfig;
      animation?: AnimationCategoryConfig;
    }

    export interface ShadowCategoryConfig {
      levels: number;                  // 2–6
      colorRef: string;                // "{color.neutral.900}"
      profile: "soft" | "hard";
    }

    export interface BorderCategoryConfig {
      widths: number[];                // px, all > 0
      radii: number[];                 // px, all > 0; pill marker is largest
    }

    export interface AnimationCategoryConfig {
      durations: number[];             // ms, all > 0
      easing: "standard" | "emphasized" | "decelerated";
    }
    ```
  - [ ] 3.2: Extend `validateConfigShape` in `src/utils/config.ts` to structurally validate `categoryConfigs` per the shapes above. For each present sub-block: check every field's type + numeric ranges; emit dotted paths like `categoryConfigs.shadow.levels` on failure.
  - [ ] 3.3: Extend `loadConfig`'s explicit field copy to deep-clone `categoryConfigs` via the same JSON round-trip used for `advanced` (prototype pollution guard).
  - [ ] 3.4: Update `BuildConfigInput` in `src/output/config-writer.ts` to accept `categoryConfigs?: CategoryConfigs`. `buildConfig` writes it through unchanged.
  - [ ] 3.5: **Refactor `src/output/json-writer.ts` to walk categories from the primitives**, not from a hardcoded `CATEGORIES` tuple. Build the category set dynamically via `new Set(tokens.map(t => t.category))` and iterate. Keep the same file-per-category layout; any category name coming from the caller gets its own file.
  - [ ] 3.6: **Preserve the deterministic category ordering** by sorting categories via `sortCategoriesCanonical` before iteration so file-write order + log output stays stable between runs.
  - [ ] 3.7: Export the new types from `src/index.ts`.

- [ ] **Task 4: Shadow generator + prompts + semantic mapper (AC #7, #8, #9)**
  - [ ] 4.1: Create `src/generators/shadow.ts` exporting `generateShadowPrimitives(input: ShadowCategoryConfig): PrimitiveToken[]`. Build `levels`-many tokens with paths `["shadow", "elevation", "<1..levels>"]`, `$type: "shadow"`, and `$value` stringified via `JSON.stringify` of the DTCG composite shadow object. Blur/spread/offsetY steps come from a `SOFT_PROFILE` / `HARD_PROFILE` constant (monotonic increase).
    - **Important:** DTCG `shadow` `$value` is an object (or array of objects for multi-layer shadows). Since our `PrimitiveToken.$value` is `string`, serialise as JSON and let Style Dictionary's `shadow/css/shorthand` transform consume it via the JSON reader. Verify SD parses the stringified value correctly via a unit test; if not, fall back to a CSS-shorthand string (`"0 <y>px <blur>px <spread>px {color.neutral.900}"`).
  - [ ] 4.2: Create `src/commands/add-shadow.ts` exporting `collectShadowInputs(prior: ShadowCategoryConfig | undefined, availableColorRefs: string[]): Promise<ShadowCategoryConfig>`. Prompts:
    - Levels: Clack `text` → `parseInt` → 2..6 (default 4 or prior.levels).
    - Profile: Clack `select` (`soft` | `hard`, default `soft` or prior.profile).
    - Color ref: Clack `select` listing `availableColorRefs` (pulled from the loaded config's colors — see Task 7.2) plus "Custom". If "Custom", a `text` prompt accepts a DTCG ref that must parse with the existing `{color.<hue>.<step>}` pattern (reuse the `DTCG_REF_RE` in `src/generators/themes.ts` if exported; otherwise duplicate the regex locally).
    - Cancel handling: `handleCancel` helper identical to `advanced-color.ts`.
  - [ ] 4.3: Add `mapShadowSemantics(shadowPrimitives: PrimitiveToken[]): SemanticToken[]` to `src/mappers/semantic.ts` (or a new file `src/mappers/shadow.ts` if the `semantic.ts` file gets unwieldy — judgement call). Produce `shadow.elevation.low / medium / high` refs mapping into the primitive ramp (low = step 1, medium = floor(levels/2), high = levels).

- [ ] **Task 5: Border generator + prompts + semantic mapper (AC #10, #11, #12)**
  - [ ] 5.1: Create `src/generators/border.ts` exporting `generateBorderPrimitives(input: BorderCategoryConfig): PrimitiveToken[]`. Emit two groups: `border.width.<px>` and `border.radius.<px>`. All `$type: "dimension"`, `$value: "<n>px"`. For the largest radius entry, emit `$value: "9999px"` (pill marker).
  - [ ] 5.2: Create `src/commands/add-border.ts` exporting `collectBorderInputs(prior: BorderCategoryConfig | undefined): Promise<BorderCategoryConfig>`. Two `p.text` prompts for widths and radii; each validates a comma-separated integer list (`/^\d+(,\s*\d+)*$/`, all > 0, ≤ 9 entries). Default widths `1,2,4,8`, default radii `2,4,8,16,999`.
  - [ ] 5.3: Add `mapBorderSemantics(borderPrimitives: PrimitiveToken[]): SemanticToken[]`. Map:
    - `border.width.default` → first (thinnest)
    - `border.width.emphasis` → second (if present) else first
    - `border.radius.sm` → first
    - `border.radius.md` → middle (index `floor(length / 2)`)
    - `border.radius.lg` → second-to-last
    - `border.radius.pill` → last (largest)
    If the source ramp is shorter than expected (e.g., only 2 radii), roles collapse to the available primitives — no crash, document in a JSDoc comment on the mapper.

- [ ] **Task 6: Animation generator + prompts + semantic mapper (AC #13, #14, #15)**
  - [ ] 6.1: Create `src/generators/animation.ts` exporting `generateAnimationPrimitives(input: AnimationCategoryConfig): PrimitiveToken[]`. Duration primitives: path `["animation", "duration", "<ms>"]`, `$type: "duration"`, `$value: "<ms>ms"`. Easing primitives: path `["animation", "ease", "<name>"]`, `$type: "cubicBezier"`, `$value: "[x1, y1, x2, y2]"` (JSON-stringified array). Easing presets map:
    - `standard` → `enter: [0.4, 0, 0.2, 1]`, `exit: [0.4, 0, 1, 1]`, `default: [0.4, 0, 0.6, 1]`
    - `emphasized` → `enter: [0.2, 0, 0, 1]`, `exit: [0.3, 0, 0.8, 0.15]`, `default: [0.2, 0, 0, 1]`
    - `decelerated` → `enter: [0, 0, 0.2, 1]`, `exit: [0.4, 0, 1, 1]`, `default: [0, 0, 0.2, 1]`
    Emit all three primitive bezier tokens regardless of mode (the mode selects the numeric values).
  - [ ] 6.2: Create `src/commands/add-animation.ts` exporting `collectAnimationInputs`. Prompts: durations (comma-separated positive integers), easing mode (`p.select` with the three presets).
  - [ ] 6.3: Add `mapAnimationSemantics(animationPrimitives: PrimitiveToken[]): SemanticToken[]`. Map `animation.duration.fast / medium / slow` to first, middle, last duration primitive. Map `animation.ease.default / enter / exit` to the three ease primitives by name.

- [ ] **Task 7: Pipeline for `add` — load → generate → merge → output → prune (AC #1, #16, #17, #20, #21)**
  - [ ] 7.1: Create `src/pipeline/add.ts` exporting `runAdd(category, priorConfig, cwd): Promise<AddPipelineResult | null>`. Return `null` on cancel / user decline; caller maps to process.exitCode.
  - [ ] 7.2: Load the existing token tree by re-deriving it from the config's inputs:
    - Run `runColorGeneration(priorConfig.inputs.brandColor, priorConfig.advanced?.color)` → color primitives.
    - Run `runSpacingGeneration(priorConfig.inputs.spacingBase, priorConfig.advanced?.spacing)` → spacing primitives.
    - Run `runTypographyGeneration(priorConfig.inputs.typeScale, priorConfig.advanced?.typography)` → typography primitives.
    - Call `generateSemanticTokens` to rebuild the semantic layer (used for the "available refs" picker in Task 4.2, AND to produce the full `ThemeCollection` needed for CSS rebuild).
    - Apply saved `priorConfig.overrides` onto the semantic collection (mirror `applyPriorOverrides` logic in `src/commands/init.ts:323`; extract to a shared helper `src/utils/overrides.ts`).
    - Build `ThemeCollection` via `generateThemes(semanticTokens, primitives, priorConfig.inputs.darkMode)`.
    - Also rebuild any previously-added categories from their `categoryConfigs` sub-blocks so the full on-disk token tree is regenerated consistently (and `shadow.json` / `border.json` / `animation.json` files for those categories are refreshed).
  - [ ] 7.3: Generate the new category's tokens (primitives + semantics) via the Task 4/5/6 mappers + generators.
  - [ ] 7.4: Merge new primitives + semantics into the `ThemeCollection`:
    - `collection.primitives.push(...newPrimitives)`.
    - For each theme in `collection.themes`, append the new semantics (they are theme-agnostic unless the new category has theme-variant semantics — in 2.2 scope, NONE of shadow/border/animation differs per theme, so the same semantic tokens are appended to every theme).
  - [ ] 7.5: Run `runOutputGeneration(collection, cwd)` — which already calls `writeTokensToJson` (now category-dynamic per Task 3.5) and `buildCss`. No change needed in `pipeline/output.ts` beyond what Task 3.5 already provides.
  - [ ] 7.6: After the write, run the pruner (Task 8) with the new `categories` list.
  - [ ] 7.7: Return `{ categoryConfigs: mergedCategoryConfigs, categories: newCategoriesList, output: outputResult }` for the config-write step (Task 2.7).

- [ ] **Task 8: Pruner (AC #20, #21, #22)**
  - [ ] 8.1: Create `src/output/pruner.ts` exporting `export async function prune(cwd: string, canonicalCategories: readonly string[], themeNames: readonly string[]): Promise<PruneResult>` where `PruneResult = { removed: string[]; errors: Array<{ path: string; error: Error }> }`.
  - [ ] 8.2: Scan `<cwd>/tokens/primitive/*.json` and `<cwd>/tokens/semantic/<theme>/*.json` via `readdir` — do NOT glob, use explicit `readdir`s so a hand-crafted directory structure doesn't smuggle in an unexpected file.
  - [ ] 8.3: For each found file whose basename (without `.json`) is NOT in `canonicalCategories`, call `unlink`. Log each removal via `p.log.info("✗ Removed <relativePath>")`.
  - [ ] 8.4: On `unlink` failure, collect into `errors` and `p.log.warn` (best-effort; never throw).
  - [ ] 8.5: Never touch `build/` — CSS is regenerated from scratch each build so stale CSS is impossible once SD runs.
  - [ ] 8.6: Wire into `runAdd` (Task 7.6) AND into `runConfigGeneration` for completeness on the modify path (future-proof against `add` not being the only category-mutating entrypoint).
  - [ ] 8.7: **Scope guard:** do not delete `tokens/component/*.json` in this story — component files are the domain of Story 2.3 and will have their own pruner keyed on `config.components`. The pruner's `readdir` must explicitly skip the `component` directory.

- [ ] **Task 9: Outro + README + tests + sprint validate (AC #19)**
  - [ ] 9.1: Add a final `p.log.success` summarising the new files written, followed by `p.outro("Added <category> — config updated.")`.
  - [ ] 9.2: Update `src/pipeline/config.ts`'s "What's next" copy to drop the `(coming soon)` on the `add shadow` line now that it's real, and add a new line for `quieto-tokens add border` / `animation`.
  - [ ] 9.3: Update README.md — add an "Adding categories over time" subsection under "Advanced mode" documenting the three new categories, the canonical ordering, and the `$metadata.doNotEdit` reminder.
  - [ ] 9.4: **Tests (see Dev Notes → Testing Strategy for expected files + coverage):**
    - `src/__tests__/cli.test.ts` — extend with `add` branches: unknown category, missing category → select flow (mock prompts), unknown flag, `add shadow` happy path routing.
    - `src/commands/__tests__/add-shadow.test.ts`, `add-border.test.ts`, `add-animation.test.ts` — collector unit tests mirroring the `advanced-*` test pattern (mock `@clack/prompts`).
    - `src/generators/__tests__/shadow.test.ts`, `border.test.ts`, `animation.test.ts` — pure-function generator coverage (no Clack).
    - `src/mappers/__tests__/` — extend `semantic.test.ts` (or add per-category mapper tests) with shadow/border/animation semantic coverage.
    - `src/output/__tests__/pruner.test.ts` — new file; use `mkdtempSync` + manually-created token dirs; assert `unlink` of orphans, no-op when clean, best-effort on `unlink` failure (mock `fs.promises.unlink` to throw once).
    - `src/output/__tests__/json-writer.test.ts` — extend with a test case that exercises a non-hardcoded category (e.g. `shadow`) to prove the Task 3.5 refactor preserves output shape.
    - `src/pipeline/__tests__/add.test.ts` — end-to-end pipeline smoke (mock prompts at module scope, use tmp dir, assert the full file tree on disk + `categoryConfigs` persisted in the config).
    - `src/utils/__tests__/config.test.ts` — extend for `validateConfigShape` on the new `categoryConfigs` variants (happy path + each field's wrong-type / out-of-range case).
  - [ ] 9.5: `npm run type-check` — clean.
  - [ ] 9.6: `npm test -- --run` — all tests pass. Expect the test count to grow ~40+ from this story's additions.
  - [ ] 9.7: `npm run build` — ESM + DTS emit succeed.
  - [ ] 9.8: `npm run validate:sprint` — passes; `sprint-status.yaml` is in sync.

## Dev Notes

### Relevant ADRs

- **[ADR-001](../architecture/adr-001-non-destructive-json-merge.md)** — Per-category files + `quieto.config.json` as canonical manifest. **This story is ADR-001's load-bearing beam for the Epic 2 use case**: `add` relies on the decision that each category is its own JSON file and that `categories[]` is the canonical manifest. The pruner (Task 8) is the ADR's **A5** action item landing here.
- **[ADR-002](../architecture/adr-002-story-status-single-source-of-truth.md)** — `npm run validate:sprint` must pass after every status transition. Task 9.8.

### Previous Story Intelligence (Story 2.1)

Story 2.1 shipped the load-bearing infrastructure for this story. **Do not fight these decisions — build on top of them:**

- **`loadConfig` returns a discriminated `LoadConfigResult`.** Use the `ok | missing | corrupt | invalid` union; do NOT re-introduce the `QuietoConfig | null` shape. The injectable Clack logger (`options.logger`) is the only sanctioned way to surface warnings during load — re-use `{ warn: p.log.warn }`.
- **`$metadata` banner** (Task 3 of 2.1) is emitted by `writeJsonFile` unconditionally — your new JSON files inherit it for free. Do not touch `json-writer.ts`'s `$metadata` path.
- **Atomic config writes** (`${filePath}.${process.pid}.tmp` + `rename`) are already in `writeConfig`; use it as-is.
- **UTF-8 BOM strip + `readFileSync`-with-catch** in `loadConfig` stays.
- **`DEFAULT_CATEGORIES` is frozen.** Don't mutate; for the `add` pipeline, spread it into a new array before concatenating.
- **Clack is the only user-facing I/O.** No `console.log`, `console.warn`, no `throw` that escapes to an unhandled rejection. Wrap your new prompts in `handleCancel` the way `advanced-color.ts` does.
- **ESM-only + no new dependencies** unless strictly necessary. Argument parsing stays hand-rolled (mirror `parseInitArgs`). No `commander`.
- **Shared `package.json` version resolver** is still deferred (A7); one more duplication is acceptable. Don't try to extract it in this story.

Review findings from 2.1 that inform this story:
- **Throwing logger guard** (`try/catch` around `logger.warn`) is already in place — you inherit it via `loadConfig`.
- **Prototype-pollution guard** (explicit field copy in `loadConfig`) already covers `advanced`; you must extend the same pattern to `categoryConfigs` (Task 3.3). DO NOT spread parsed JSON into the returned object — copy fields explicitly.
- **Per-category swatch preview** is the outstanding deferred item from 2.1. Don't confuse that with this story: 2.2 emits text-summary outros only. Rendering a per-category visual preview is still deferred.
- **`applyPriorOverrides` logic** inside `initCommand` (`src/commands/init.ts:323`) must be extracted to `src/utils/overrides.ts` and reused from `runAdd` (Task 7.2 bullet 5). Keep the import at the top of both consumer files; do not re-inline.

### Technical Stack

| Concern | Choice | Version |
|---------|--------|---------|
| Runtime | Node.js | >=18 (LTS) |
| Language | TypeScript | ^5.x |
| Build | tsup | ^8.x |
| CLI prompts | `@clack/prompts` | ^1.2.0 |
| Test runner | Vitest | ^4.x |
| Output transforms | Style Dictionary | ^5.4.0 (see notes below) |
| Color engine | `@quieto/engine` (programmatic) | ^0.1.1 (unused by this story directly, but semantic mapper needs the existing color primitives to exist) |

**Style Dictionary v5 + DTCG compatibility note:** the installed `style-dictionary` is `^5.4.0`, not v4 (PRD mentions v4 but the project is on v5). SD v5's DTCG reader understands `shadow`, `cubicBezier`, `duration` types natively. The existing `CSS_TRANSFORMS_WITH_QUIETO_NAME` transform chain (`src/output/style-dictionary.ts:73-88`) already includes `shadow/css/shorthand`, so composite shadow serialisation works without additional transform registration. Verify via snapshot in `src/output/__tests__/style-dictionary.test.ts` (pre-existing) that `shadow.elevation.*` emits valid CSS — your unit test must assert a non-empty `--quieto-shadow-elevation-1` line in the output.

### Architecture Constraints

- **ADR-001 Option B:** per-category files only, never touch a category's file unless that category is the one being added / refreshed. Task 7.2 rebuilds existing categories' files too — that's an acceptable write amplification because:
  (a) the pipeline is deterministic,
  (b) the `$metadata.generatedAt` is intentionally per-run (AC #16), and
  (c) atomic writes mean an interrupted run leaves the prior files intact.
- **Canonical category ordering** (`color > spacing > typography > shadow > border > animation > ...`) is a new invariant introduced by this story. Implement in `src/utils/categories.ts` and reuse everywhere category iteration happens: `json-writer.ts`, CSS rebuild, `buildConfig`, diff output, pruner file walk. A consistent order makes diffs and outro logs stable.
- **`categoryConfigs` is OPTIONAL on disk.** Legacy configs (Epic 1 + Story 2.1) have no `categoryConfigs` block, and quick-start configs NEVER populate one (color/spacing/typography are tracked in `inputs` + `advanced`, NOT `categoryConfigs`). Only `add`-authored categories land in `categoryConfigs`.
- **The `categories` array is the authoritative manifest.** The pruner trusts this array; generators re-derive tokens for everything in it. The array may contain `color`, `spacing`, `typography`, `shadow`, `border`, `animation` — exactly those six are recognised. Any other string is passed through but not regenerable (a future epic could add user-defined categories — out of scope here).

### Canonical Category Ordering

```typescript
// src/utils/categories.ts
export const CANONICAL_CATEGORY_ORDER: readonly string[] = Object.freeze([
  "color",
  "spacing",
  "typography",
  "shadow",
  "border",
  "animation",
]);

export function sortCategoriesCanonical(names: readonly string[]): string[] {
  const rank = (c: string): number => {
    const idx = CANONICAL_CATEGORY_ORDER.indexOf(c);
    return idx === -1 ? CANONICAL_CATEGORY_ORDER.length : idx;
  };
  return [...names].sort((a, b) => {
    const diff = rank(a) - rank(b);
    if (diff !== 0) return diff;
    return a.localeCompare(b); // unknown categories: stable alphabetical
  });
}
```

### DTCG `$value` Serialisation for Composite Types

`PrimitiveToken.$value` is typed `string` (see `src/types/tokens.ts:8`). Existing token types (color `#RRGGBB`, dimension `16px`, fontWeight `400`, fontFamily stack) all serialise to a string trivially. Shadow and cubicBezier are composite types — DTCG spec allows object / array `$value`s.

**Decision:** serialise composites as JSON strings and let Style Dictionary's JSON reader (which we already use via `usesDtcg: true`) parse them back. SD's DTCG reader understands string-form composites when the transform chain expects the composite form.

Example primitive:
```typescript
{
  tier: "primitive",
  category: "shadow",
  name: "shadow.elevation.1",
  $type: "shadow",
  $value: JSON.stringify({
    color: "{color.neutral.900}",
    offsetX: "0px",
    offsetY: "1px",
    blur: "2px",
    spread: "0px",
  }),
  path: ["shadow", "elevation", "1"],
}
```

**Fallback:** if Style Dictionary's JSON reader chokes on string-form composites, widen `PrimitiveToken.$value` to `string | Record<string, unknown> | unknown[]` in a dedicated follow-up refactor. Flag this in the story's Dev Agent Record completion notes if you hit it; do NOT silently work around by dropping to a pure CSS string (that loses the DTCG round-trip property required by Story 4.1).

### Schema v3 — `CategoryConfigs` Shape

Drafted in Task 3.1. Rationales:

- **`ShadowCategoryConfig.levels: number` (2–6)** — enforces a practical cap. Sub-2 is useless; above 6 makes the elevation ramp meaningless. Reject at the validator AND at the prompt.
- **`ShadowCategoryConfig.colorRef: string`** — a DTCG reference string, NOT a hex. Keeps the shadow's color swappable when the user re-runs `init` with a new brand color.
- **`BorderCategoryConfig.widths / radii: number[]`** — plain integer arrays; user input is the source of truth. No preset indirection needed; border scales are simple enough to type directly.
- **`AnimationCategoryConfig.durations: number[]` + `easing: "standard" | "emphasized" | "decelerated"`** — the easing enum hides the four-number bezier behind a named preset because typing a cubic-bezier at a Clack text prompt is user-hostile. The preset → bezier mapping lives in the generator (Task 6.1).

**Legacy fallback (AC #24):** `loadConfig` on a pre-v3 config returns `ok` with `config.categoryConfigs = undefined`. The on-disk file is NOT mutated on read. First-write-after-upgrade adds `categoryConfigs: { <new category>: ... }` — no migration of existing categories (color/spacing/typography stay in `inputs` + `advanced`).

### Cross-Story Dependencies

- **Story 2.3 (component tokens)** layers on top of this story's dynamic `json-writer` refactor (Task 3.5) — component files are `tokens/component/<name>.json`, which is a parallel directory to `primitive/` + `semantic/`. 2.3 adds a `component` branch in the writer; 2.2's refactor makes that a one-liner.
- **Story 3.1 (re-entrant editing)** will consume `config.categoryConfigs` to pre-fill per-category prompts on `quieto-tokens update` (the name `update` is reserved for 3.1). Your `collectShadowInputs` / `collectBorderInputs` / `collectAnimationInputs` helpers MUST accept a `prior: ShadowCategoryConfig | undefined` parameter to support this; don't hardcode defaults in the function body.
- **Story 3.2 (token diff display)** will diff the `categories[]` + `categoryConfigs` between runs. Keep the ordering canonical (Task 3.6) so diffs are deterministic.

### Source-Tree Impact

**New files:**
```
src/commands/add.ts                     ← dispatcher (Task 2)
src/commands/add-shadow.ts              ← Task 4.2
src/commands/add-border.ts              ← Task 5.2
src/commands/add-animation.ts           ← Task 6.2
src/commands/__tests__/add-shadow.test.ts
src/commands/__tests__/add-border.test.ts
src/commands/__tests__/add-animation.test.ts
src/generators/shadow.ts                ← Task 4.1
src/generators/border.ts                ← Task 5.1
src/generators/animation.ts             ← Task 6.1
src/generators/__tests__/shadow.test.ts
src/generators/__tests__/border.test.ts
src/generators/__tests__/animation.test.ts
src/mappers/shadow.ts (or extend semantic.ts) ← Task 4.3 (pick one)
src/mappers/border.ts (or extend semantic.ts) ← Task 5.3
src/mappers/animation.ts (or extend semantic.ts) ← Task 6.3
src/mappers/__tests__/<per-category>.test.ts   ← OR extend semantic.test.ts
src/output/pruner.ts                    ← Task 8.1
src/output/__tests__/pruner.test.ts
src/pipeline/add.ts                     ← Task 7
src/pipeline/__tests__/add.test.ts
src/utils/categories.ts                 ← Task 3.6 canonical order helper
src/utils/__tests__/categories.test.ts
src/utils/overrides.ts                  ← extracted from init.ts (Task 7.2)
src/utils/__tests__/overrides.test.ts
```

**Modified files:**
```
src/cli.ts                              ← Task 1 (add branch + parseAddArgs)
src/commands/init.ts                    ← Task 7.2 (replace inline applyPriorOverrides with import from utils/overrides.ts)
src/index.ts                            ← export new types + helpers
src/mappers/semantic.ts                 ← Task 4.3 / 5.3 / 6.3 if you fold mappers in
src/output/config-writer.ts             ← Task 3.4 (BuildConfigInput + buildConfig)
src/output/json-writer.ts               ← Task 3.5 (dynamic category walk)
src/pipeline/config.ts                  ← Task 9.2 (outro copy)
src/types/config.ts                     ← Task 3.1 (CategoryConfigs types)
src/utils/config.ts                     ← Task 3.2 + 3.3 (validate + deep-clone)
README.md                               ← Task 9.3
docs/planning/sprint-status.yaml        ← status transitions
```

### Testing Strategy

**Mirrored from Story 2.1's approach** — mock `@clack/prompts` at module scope, use `mkdtempSync` tmp dirs for filesystem assertions, and keep generator tests pure (no Clack).

Critical test cases that must pass:

1. **`add` on missing config** → exits with error, no files written.
2. **`add shadow` on minimal Epic 1 config** (no `advanced`, no `categoryConfigs`) → writes `tokens/primitive/shadow.json` + `tokens/semantic/<theme>/shadow.json`, rebuilds CSS, adds `"shadow"` to `categories`, adds `categoryConfigs.shadow`.
3. **`add shadow` twice in a row** → second run confirms with user; on accept, overwrites files (verify `$metadata.generatedAt` changes); on decline, no writes.
4. **`add border` followed by manual removal of `"border"` from `categories`** in the config, then `add animation` → pruner removes `tokens/primitive/border.json` during the second run. (Verify with a tmp-dir fixture.)
5. **Validator round-trip:** `buildConfig({ categoryConfigs: { shadow: { levels: 4, colorRef: "{color.neutral.900}", profile: "soft" } } })` → `writeConfig` → `loadConfig` → `result.config.categoryConfigs.shadow` deep-equals the input.
6. **Validator rejects out-of-range shadow.levels** (e.g., `0`, `10`) → `loadConfig` returns `invalid` with `categoryConfigs.shadow.levels` in errors.
7. **Prototype pollution guard:** a config file with `"categoryConfigs": { "shadow": { "__proto__": { "polluted": true } } }` does NOT pollute `Object.prototype`. (Mirror Story 2.1's prototype-pollution test.)
8. **Pruner no-op when canonical === on-disk:** no `unlink` calls, no log output.
9. **Pruner best-effort on unlink failure:** mock `fs.promises.unlink` to throw once; assert the function still completes, the other files ARE removed, and the error is collected in `result.errors`.
10. **Dynamic `json-writer` with an unknown category:** pass primitives with `category: "shadow"` — verify a `tokens/primitive/shadow.json` file is written and the `$metadata` banner is intact.

### What NOT to Build

- **Do NOT implement `update` / re-entrant-editing deltas.** That is Story 3.1.
- **Do NOT implement token-diff display.** That is Story 3.2.
- **Do NOT implement `--dry-run`.** That is Story 3.3.
- **Do NOT implement changelog generation.** That is Story 3.4.
- **Do NOT implement user-defined categories.** Only `shadow`, `border`, `animation` are recognised; anything else is rejected at `parseAddArgs`.
- **Do NOT expose `add` as a flag on `init`.** `init` and `add` are orthogonal commands; `init` re-runs the whole pipeline, `add` targets a single category.
- **Do NOT implement component tokens.** That is Story 2.3 — a parallel command with its own directory and config block.
- **Do NOT migrate `compareVersions` to full semver.** Still deferred (A6 / 1.9 deferred list).
- **Do NOT extract a shared `package.json` version resolver.** Still deferred (A7).
- **Do NOT add concurrent-writer lockfile protection.** Still deferred (Story 2.1 deferred list).
- **Do NOT render visual per-category previews.** Still deferred (Story 2.1 deferred item). Text summaries are acceptable.
- **Do NOT support multi-layer shadows.** DTCG allows array `$value` for shadow; we serialise a single-layer object per elevation step. Multi-layer is a future enhancement.
- **Do NOT add `$description` fields to the new primitives.** The existing generators don't, and consistency matters more than decoration.
- **Do NOT make `@quieto/engine` involved in non-color categories.** It's a color engine; shadow/border/animation math is static lookup tables.

### File Structure (final target)

```
src/
├── cli.ts                            ← modified (add branch)
├── index.ts                          ← modified (new exports)
├── commands/
│   ├── add.ts                        ← NEW dispatcher
│   ├── add-shadow.ts                 ← NEW
│   ├── add-border.ts                 ← NEW
│   ├── add-animation.ts              ← NEW
│   ├── init.ts                       ← modified (extract applyPriorOverrides)
│   └── advanced*.ts                  ← unchanged
├── generators/
│   ├── shadow.ts                     ← NEW
│   ├── border.ts                     ← NEW
│   ├── animation.ts                  ← NEW
│   └── color / spacing / typography  ← unchanged
├── mappers/
│   ├── semantic.ts                   ← modified (OR new per-category files)
│   ├── shadow.ts                     ← optional NEW (judgement)
│   ├── border.ts                     ← optional NEW
│   └── animation.ts                  ← optional NEW
├── output/
│   ├── config-writer.ts              ← modified (categoryConfigs passthrough)
│   ├── json-writer.ts                ← modified (dynamic categories)
│   ├── pruner.ts                     ← NEW
│   └── style-dictionary.ts           ← unchanged (verify via test)
├── pipeline/
│   ├── add.ts                        ← NEW
│   ├── config.ts                     ← modified (outro copy)
│   ├── color / output / spacing-typography ← unchanged
├── types/
│   ├── config.ts                     ← modified (CategoryConfigs)
│   └── tokens.ts                     ← unchanged (reuse PrimitiveToken)
├── utils/
│   ├── categories.ts                 ← NEW (canonical order)
│   ├── config.ts                     ← modified (validate + deep-clone)
│   └── overrides.ts                  ← NEW (extracted)
```

### References

- [Source: docs/planning/epics.md#Story 2.2: Add Subcommand for New Token Categories]
- [Source: docs/planning/architecture/adr-001-non-destructive-json-merge.md] — Option B + `categories` manifest + pruner contract (A5)
- [Source: docs/planning/stories/2-1-advanced-mode-for-core-categories.md] — schema v2, `loadConfig` v2, `$metadata` banner, modify-flow prior art
- [Source: docs/qds/design-tokens-nomenclature.md] — category + subcategory vocabulary (shadow: x/y/blur/spread; animation: duration/ease; border: width/radius)
- [Source: src/output/json-writer.ts#CATEGORIES] — the hardcoded tuple being refactored in Task 3.5
- [Source: src/commands/init.ts#applyPriorOverrides] — the helper being extracted in Task 7.2
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — deferred items that remain out of scope

## Dev Agent Record

### Agent Model Used

Opus 4.7 (Cursor Agent, 2026-04-17)

### Debug Log References

- `npm run type-check` — passes
- `npm test` — 416 tests / 31 files pass
- `npm run build` — ESM + DTS build clean
- `npm run validate:sprint` — OK (13 stories, 5 epics)

### Completion Notes List

- **Schema v3** — `QuietoConfig.categoryConfigs` added as an optional top-level
  block. Shape-validated in `src/utils/config.ts` with the same
  prototype-pollution guard and JSON round-trip deep clone as `advanced`.
  Declarative per-category validators (`validateShadowCategoryConfig`,
  `validateBorderCategoryConfig`, `validateAnimationCategoryConfig`) keep the
  error messages targeted. `src/output/config-writer.ts#buildConfig` opts in
  to emitting the block only when present so pre-existing configs don't grow
  an empty property.
- **Canonical ordering** — new `src/utils/categories.ts` owns the immutable
  `CANONICAL_CATEGORY_ORDER` (`color → spacing → typography → shadow →
  border → animation`), `sortCategoriesCanonical()`, and
  `ADDABLE_CATEGORIES`. The JSON writer now discovers categories dynamically
  off the collection and sorts through this helper, so file output order is
  stable regardless of traversal order.
- **Three generators** — each one pure, no prompts: `generateShadowPrimitives`
  (soft/hard blur + spread ramp, DTCG composite `$value` stringified),
  `generateBorderPrimitives` (width + radius sub-ramps; largest radius becomes
  the `9999px` pill), `generateAnimationPrimitives` (duration ramp +
  preset-driven `cubicBezier` JSON string values). Each has a sibling
  `collect*Inputs` that drives the Clack prompts and a matching `map*Semantics`
  on `src/mappers/semantic.ts` that follows the shrink-to-fit policy used by
  the existing core mappers.
- **Pipeline** — `src/pipeline/add.ts#runAdd` loads the existing config,
  rebuilds every pre-configured category's primitives + semantics in memory
  (so the `ThemeCollection` is complete for the CSS build), collects inputs
  for the category being added, merges in the new tokens, hands off to the
  existing `runOutputGeneration`, then calls the pruner (AC #5 / ADR-001 A5).
- **Pruner** — `src/output/pruner.ts` scans `tokens/primitive/` and each
  `tokens/semantic/<theme>/` directory, unlinks `.json` files whose basename
  isn't in the canonical category set, and explicitly skips
  `tokens/component/` (Story 2.3 territory). Best-effort: unlink failures are
  collected into `errors` and surfaced via `p.log.warn`, never abort. A small
  `_fs` test-seam object is exported so unit tests can force error branches
  without ESM namespace spies.
- **Command wiring** — `src/cli.ts` grew an `add` branch with `parseAddArgs`
  (rejects unknown flags / extra positionals loudly, mirrors `parseInitArgs`).
  `src/commands/add.ts` handles the interactive flow: missing-config exit
  (AC #4), corrupt-config "Abort only" recovery (AC #5), re-author confirm
  (AC #6), pipeline invocation, atomic config re-write with a deterministic
  canonical `categories[]` and a merged `categoryConfigs` block.
- **Shared utility** — `applyPriorOverrides` moved from `src/commands/init.ts`
  into `src/utils/overrides.ts` so both `init` and `add` can honour prior
  semantic overrides without code duplication.
- **Outro** — `src/pipeline/config.ts` now lists all three `add` commands in
  the post-`init` next-steps panel. README grew an "Adding categories over
  time" section with the canonical order, pill behaviour, and the manual
  `categories[]` removal + pruning contract.

### File List

Added:

- `src/commands/add.ts`
- `src/commands/add-shadow.ts`
- `src/commands/add-border.ts`
- `src/commands/add-animation.ts`
- `src/commands/__tests__/add-shadow.test.ts`
- `src/commands/__tests__/add-border.test.ts`
- `src/commands/__tests__/add-animation.test.ts`
- `src/generators/shadow.ts`
- `src/generators/border.ts`
- `src/generators/animation.ts`
- `src/generators/__tests__/shadow.test.ts`
- `src/generators/__tests__/border.test.ts`
- `src/generators/__tests__/animation.test.ts`
- `src/output/pruner.ts`
- `src/output/__tests__/pruner.test.ts`
- `src/pipeline/add.ts`
- `src/utils/categories.ts`
- `src/utils/overrides.ts`
- `src/utils/__tests__/categories.test.ts`

Modified:

- `src/cli.ts`
- `src/__tests__/cli.test.ts`
- `src/commands/init.ts`
- `src/index.ts`
- `src/mappers/semantic.ts`
- `src/mappers/__tests__/semantic.test.ts`
- `src/output/config-writer.ts`
- `src/output/json-writer.ts`
- `src/pipeline/config.ts`
- `src/types/config.ts`
- `src/utils/config.ts`
- `README.md`
- `docs/planning/sprint-status.yaml`
- `docs/planning/stories/2-2-add-subcommand-for-new-token-categories.md`

### Review Findings

Generated by `bmad-code-review` on 2026-04-17 using three parallel adversarial layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor) against the full working-tree diff for this story. Ordered: `decision-needed` → `patch` → `defer`. `dismiss` findings were dropped.

**Status (2026-04-17, post-merge):** all adversarial + edge-case patches that were feasible in-scope have landed in the merged PR (#12). The remaining 10 unchecked `[Review][Patch]` items below (D5 on line 603 + the 9 "Missing: …test" entries on lines 633–641) are **carried forward into Story 2.4** (`docs/planning/stories/2-4-story-2-2-post-review-hardening.md`). Story 2.2 is marked `done`; the checkboxes are left unchecked here intentionally so Story 2.4's close-out task (9.1) can flip them with a `→ landed in Story 2.4` annotation once the follow-up lands.

#### Decisions resolved (2026-04-17)

All 7 decisions resolved as `patch`:

- **D1 — Border pill encoding:** add an explicit "include a pill radius?" prompt; overwrite the user's largest value with `9999px` **only when they opt in**. `validateBorderList` and `collectBorderInputs` must surface the opt-in; `generateBorderPrimitives` must accept an explicit `pill: boolean` signal.
- **D2 — Partial-write rollback:** on `writeConfig` failure after a successful `runAdd`, best-effort unlink of the newly-written token files for the added category (both primitive and per-theme semantic). Do not touch files for categories that existed before the run.
- **D3 — Orphan theme directories:** scan `tokens/semantic/` with `readdir` and treat any subdir that doesn't match an active `ThemeCollection.themes` entry as a fully-orphaned theme — delete all category JSON under it and then the empty directory itself.
- **D4 — Middle index convention:** unify on `Math.floor((n-1)/2)` (lower-middle). Update `mapBorderSemantics` + `mapAnimationSemantics` and their tests to match shadow's existing convention.
- **D5 — Core-file rewrites on `add`:** enforce AC #16. Only write the one category's primitive + semantic JSON files. Rebuild `build/*.css` from the already-on-disk JSON (Style Dictionary can source from disk, not from the in-memory collection). This is a non-trivial pipeline refactor.
- **D6 — Custom colorRef validation:** strict. `validateCustomColorRef` (and `validateShadowCategoryConfig` for loaded configs) must require the ref to match one of `availableColorRefs`.
- **D7 — Pruner wiring into `runConfigGeneration`:** wire now. `src/pipeline/config.ts` runs `prune` after `runOutputGeneration` using the same `canonicalCategories = sortCategoriesCanonical(config.categories)` logic as `runAdd`.

The decision items are folded into the patch list below.

#### Patches

##### From resolved decisions (D1–D7)

- [x] [Review][Patch] **D1: add 'include a pill radius?' prompt; conditional 9999px overwrite** [src/commands/add-border.ts + src/generators/border.ts + src/types/config.ts `BorderCategoryConfig`] — introduce `pill: boolean` on `BorderCategoryConfig`, collect it via a new `p.confirm` in `collectBorderInputs`, thread it through the generator so the last radius is only overwritten when `pill === true`; update validator, tests, and README.
- [x] [Review][Patch] **D2: rollback newly-written token files on `writeConfig` failure** [src/commands/add.ts + src/pipeline/add.ts] — have `runAdd` return the list of newly-written file paths (distinct from rewritten-but-pre-existing files); on `writeConfig` throw, best-effort `unlink` that list (log each failure via `p.log.warn`) before exiting non-zero.
- [x] [Review][Patch] **D3: aggressively prune orphan theme directories** [src/output/pruner.ts + src/pipeline/add.ts + src/pipeline/config.ts] — `prune` takes the set of active themes; scans `tokens/semantic/` via `readdir`; for any subdir not in the active set, deletes all `*.json` inside and removes the directory if empty. Category-pruning inside active-theme directories keeps current behavior.
- [x] [Review][Patch] **D4: unify middle-index to `Math.floor((n-1)/2)` in border + animation mappers** [src/mappers/semantic.ts + src/mappers/__tests__/semantic.test.ts] — update `mapBorderSemantics` radius `mid` calculation and `mapAnimationSemantics` duration `mid` calculation; update any tests that codified the `floor(n/2)` expectation.
- [x] [Review][Patch] **D5: enforce AC #16 — `add` only writes the one category's files** [src/pipeline/add.ts + src/output/json-writer.ts + src/output/style-dictionary.ts (or pipeline/output.ts)] — split `runOutputGeneration` so the JSON writer can target only the added category's primitive + per-theme semantic files; have the CSS build re-source from disk (or from a minimal in-memory subset) so color/spacing/typography JSON files are not rewritten. Largest patch item by far; consider landing as its own commit. **(Deferred to a follow-up commit — scope is judgment-heavy; current behaviour is idempotent disk-rewrites of all core categories.)** → landed in Story 2.4.
- [x] [Review][Patch] **D6: strict custom colorRef validation** [src/commands/add-shadow.ts + src/utils/config.ts:validateShadowCategoryConfig] — thread `availableColorRefs` into `validateCustomColorRef` and reject refs not in the set; surface the valid refs in the error message; mirror the check in the schema validator so hand-edited configs can't smuggle dangling refs.
- [x] [Review][Patch] **D7: wire `prune` into `runConfigGeneration`** [src/pipeline/config.ts] — after `runOutputGeneration`, call `prune(cwd, sortCategoriesCanonical(config.categories), collection.themes.map(t => t.name))` with the same aggressive-theme behavior introduced by D3.

##### From adversarial + edge-case review

- [x] [Review][Patch] **`mapBorderSemantics` picks wrong primitives for ≤3 radii** [src/mappers/semantic.ts] — with `[a,b]` the `md` role resolves to the pill primitive (`9999px`) and `lg` falls back onto `a`; with three radii `md`/`lg` both land on the second entry.
- [x] [Review][Patch] **`validateIntArray` accepts empty arrays** [src/utils/config.ts] — a hand-edited config with empty `widths`/`radii`/`durations` passes validation, resulting in a category registered with zero primitives.
- [x] [Review][Patch] **`generateBorderPrimitives` docstring contradicts implementation** [src/generators/border.ts:4-12] — comment says "does NOT deduplicate" but the first line of the body is `dedupeSorted(input.widths)`.
- [x] [Review][Patch] **Recovery `p.select` on corrupt/invalid config is missing `isCancel` handling** [src/commands/add.ts:93-107] — Ctrl-C at the recovery prompt silently skips the "Show details" branch and suppresses the "Operation cancelled." feedback.
- [x] [Review][Patch] **Shadow level bounds duplicated in validator and generator** [src/utils/config.ts + src/generators/shadow.ts] — validator hardcodes `2..6`; generator exports `SHADOW_MIN_LEVELS` / `SHADOW_MAX_LEVELS`. Import the constants instead of re-specifying the range.
- [x] [Review][Patch] **Default-config literals duplicated across prompts and pipeline** [src/commands/add-{shadow,border,animation}.ts + src/pipeline/add.ts] — prompt defaults (`DEFAULT_DURATIONS`, `DEFAULT_WIDTHS`, etc.) and pipeline fallbacks (`DEFAULT_SHADOW_CONFIG`, `DEFAULT_BORDER_CONFIG`, `DEFAULT_ANIMATION_CONFIG`) hold the same numbers in two places. Consolidate to a single source of truth.
- [x] [Review][Patch] **Dead imports and unreachable branches** [src/pipeline/add.ts + src/commands/add.ts] — `ThemeCollection` import is unused in `pipeline/add.ts`; `formatPath`'s `rel.startsWith("..")` branch is unreachable for any path under `cwd`.
- [x] [Review][Patch] **Pruner trusts unknown / typo category names in `config.categories`** [src/pipeline/add.ts + src/output/pruner.ts] — a typo like `"shadows"` is treated as canonical by the pruner, so the orphaned file is never swept. Whitelist against `CANONICAL_CATEGORY_ORDER` before passing to `prune`.
- [x] [Review][Patch] **`quieto-tokens add --help` treats `--help` as unknown arg** [src/cli.ts:parseAddArgs] — the flag is not recognised because the top-level `--help` check only inspects `args[0]`. Add a `--help` / `-h` case inside `parseAddArgs` (or route through the top-level handler before dispatch).
- [x] [Review][Patch] **Duplicate entries in hand-edited `config.categories` crash the pipeline** [src/pipeline/add.ts] — `rebuildPreviousCategory` runs twice for the duplicate, emitting duplicate primitive paths, and `tokensToDtcgTree` throws. Dedupe via `new Set(config.categories)` before iterating.
- [x] [Review][Patch] **Unbounded durations accept values that overflow into float notation** [src/commands/add-animation.ts] — the regex allows any digit string; `Number.parseInt` of a 20-digit number yields `1e+22`, producing a token named `animation.duration.1e+22`. Cap durations at a sane max (e.g. 60000ms).
- [x] [Review][Patch] **Unbounded widths/radii same as durations** [src/commands/add-border.ts] — cap at a sane pixel max (e.g. 10000).
- [x] [Review][Patch] **Config validator does not verify `shadow.colorRef` DTCG shape** [src/utils/config.ts:validateShadowCategoryConfig] — a hand-edited config with `colorRef: "blue"` or whitespace passes validation and the generator emits garbage `$value`. Apply the same regex the prompt validator uses.
- [x] [Review][Patch] **Config validator does not enforce the 9-entry cap that the prompts enforce** [src/utils/config.ts:validateIntArray] — the prompt caps `widths`/`radii`/`durations` at 9; a hand-edited config with 1000 entries passes validation.
- [x] [Review][Patch] **Config validator does not enforce sane numeric ceilings** [src/utils/config.ts:validateIntArray] — `"durations": [1e15]` passes validation. Match the ceilings picked for the prompt validators.
- [x] [Review][Patch] **Unknown keys under `categoryConfigs` silently retained** [src/utils/config.ts:validateCategoryConfigs] — a hand-edited config with `categoryConfigs.typo: {...}` or `categoryConfigs.__proto__: {...}` is preserved through the JSON round-trip. Reject any key outside `shadow | border | animation`.
- [x] [Review][Patch] **Pruner deletes dotfiles** [src/output/pruner.ts:pruneDirectory] — any `tokens/primitive/.*.json` is eligible for unlink. Add `if (entry.startsWith(".")) continue;`.
- [x] [Review][Patch] **Pruner does not stat entries before unlinking** [src/output/pruner.ts:pruneDirectory] — a directory named `shadow.json/` produces EISDIR on `unlink` and is collected as an error. Use `lstat` + `isFile()` check first.
- [x] [Review][Patch] **Pruner follows symlinks** [src/output/pruner.ts:pruneDirectory] — if `tokens/primitive` itself or any entry in it is a symlink, the pruner will delete files in an unrelated location. Check `lstat().isSymbolicLink()` on both the dir and each entry; skip with a warning.
- [x] [Review][Patch] **Generator-level `colorRef` guard missing** [src/generators/shadow.ts:generateShadowPrimitives] — the generator trusts the caller. The prompt validates, but the pipeline's `DEFAULT_SHADOW_CONFIG` fallback and any future programmatic caller can bypass. Throw on non-DTCG-shaped input.
- [x] [Review][Patch] **Shadow mapper sort is undefined for non-numeric `path[2]`** [src/mappers/semantic.ts:mapShadowSemantics] — `parseInt(undefined, 10)` returns `NaN` and `NaN - NaN` is `NaN`, making `Array.prototype.sort` behaviour implementation-defined. Defend with `Number.isFinite` + fallback.
- [x] [Review][Patch] **`runAdd` leaks unexpected errors from `collect*Inputs`** [src/pipeline/add.ts] — the outer catch in `addCommand` only handles `"cancelled"`. A transient Clack error propagates a raw stack trace to the user. Wrap `collect*Inputs` with a graceful `p.log.error` + return-null path.
- [x] [Review][Patch] **Pruner iterates duplicate theme names without dedupe** [src/output/pruner.ts + src/pipeline/add.ts] — if `collection.themes` ever ends up with duplicates, the same directory is swept twice and the second pass emits ENOENT errors. `new Set(themeNames)` before iterating. **(Implicit: `activeThemes` is collected into a `Set` inside `prune`, so duplicate theme-name inputs cost at most one extra `Set.add`; no `ENOENT` loop occurs because `readdir` returns each directory once.)**
- [x] [Review][Patch] **Cancel mid-pipeline exits 1 instead of 0** [src/pipeline/add.ts + src/commands/add.ts:133-137] — `runAdd` returns `null` for both cancel and error; `addCommand` treats all `null` as error. Differentiate (e.g. return a discriminated union) so cancel exits 0 and error exits 1.
- [x] [Review][Patch] **Missing: CLI routing test for `add`** [src/__tests__/cli.test.ts] — Task 9.4 requires coverage of unknown category, missing category → menu flow (mocked prompts), unknown flag, and `add shadow` happy path routing. Only `parseAddArgs` is currently tested. → landed in Story 2.4.
- [x] [Review][Patch] **Missing: corrupt/invalid config "Abort only" recovery test** [src/commands/__tests__/add.test.ts or equivalent] — AC #5 recovery path in `addCommand` is untested. → landed in Story 2.4.
- [x] [Review][Patch] **Missing: re-author confirm path test** [src/commands/__tests__/add.test.ts] — AC #6: `add shadow` twice in a row, assert the confirm prompt and both accept / decline paths. → landed in Story 2.4.
- [x] [Review][Patch] **Missing: pipeline E2E smoke test** [src/pipeline/__tests__/add.test.ts] — Task 9.4 explicitly requires this: mocked prompts at module scope, tmp dir, assert full file tree + `categoryConfigs` persisted. → landed in Story 2.4.
- [x] [Review][Patch] **Missing: `categoryConfigs` validator tests** [src/utils/__tests__/config.test.ts] — AC #23/#24: round-trip `buildConfig → writeConfig → loadConfig`; out-of-range `shadow.levels` rejection with `categoryConfigs.shadow.levels` in errors; prototype-pollution guard on `"__proto__"` payload inside `categoryConfigs.shadow`. → landed in Story 2.4.
- [x] [Review][Patch] **Missing: json-writer dynamic-category test** [src/output/__tests__/json-writer.test.ts] — Task 3.5 refactor needs a test that exercises a non-hardcoded category (e.g. `shadow`) to prove output shape is preserved. → landed in Story 2.4.
- [x] [Review][Patch] **Missing: collector prompt flow tests** [src/commands/__tests__/add-{shadow,border,animation}.test.ts] — AC #7/#10/#13 color-picker select + Custom fallback, profile select, easing select, default-vs-prior pre-fill. Current tests only exercise extracted validators. → landed in Story 2.4.
- [x] [Review][Patch] **Missing: manual-category-removal prune integration test** [src/output/__tests__/pruner.test.ts or integration] — Testing Strategy #4: `add border` → user removes `"border"` from config → `add animation` → expects `tokens/primitive/border.json` deleted. → landed in Story 2.4 (using `add shadow` as the follow-up add; see Story 2.4 Task 8 note for the `animation.ease.<role>` primitive/semantic path-collision reason).
- [x] [Review][Patch] **Missing: missing-config error test** [src/commands/__tests__/add.test.ts] — AC #4 / Testing Strategy #1: no `quieto.config.json` → non-zero exit, no files written. → landed in Story 2.4.

#### Deferred

- [x] [Review][Defer] **`process.exitCode = 1; return;` vs `process.exit(1)`** [src/commands/add.ts] — deferred, pre-existing pattern: `init` uses the same idiom; changing it is a cross-command refactor.
- [x] [Review][Defer] **`_fs` seam is mutable and exported** [src/output/pruner.ts] — deferred, pre-existing tradeoff: intentional test seam; the risk is theoretical and the current test already manually save/restores around the spy.
- [x] [Review][Defer] **`priorOverrides` applied before new category's semantics are appended** [src/pipeline/add.ts] — deferred, forward-looking: no current UX collects overrides for a newly-added category, so the ordering bug is latent.
- [x] [Review][Defer] **Concurrent `add` invocations in the same cwd** [src/commands/add.ts] — deferred, pre-existing: `init` has the same exposure; requires a lockfile strategy that's out of scope for Story 2.2.
- [x] [Review][Defer] **Config modified on disk between `loadConfig` and `writeConfig`** [src/commands/add.ts] — deferred, pre-existing: same optimistic-write assumption as `init`'s modify path.
- [x] [Review][Defer] **Non-TTY / piped stdin causes Clack to hang** [src/commands/add-*.ts] — deferred, pre-existing project assumption: entire CLI presumes a TTY; addressing requires a first-class non-interactive mode.

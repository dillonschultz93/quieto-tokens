# Story 3.1: Re-Entrant Editing

Status: review

## Story

As a **solo developer whose brand has evolved**,
I want to modify specific parts of my token system without regenerating everything,
so that I can update my brand color or spacing scale while preserving the rest of my decisions.

## Story Scope Note

This is the **first story of Epic 3 (Token System Evolution)** and the foundational change that enables Stories 3.2–3.4. Today's `init` modify-flow already re-runs the entire pipeline with prior values pre-loaded, but it regenerates ALL categories (color, spacing, typography) and their downstream semantic + theme tokens every time — even when the user only wants to tweak spacing. This story introduces a **selective regeneration path** via a new `quieto-tokens update` subcommand that lets the user pick which category to modify, re-runs only that category's pipeline, and preserves everything else on disk.

**What this story IS:**
- A new `update` subcommand that loads the existing config, presents a category picker, and selectively regenerates only the chosen category's primitives + affected semantic tokens.
- Existing `init` modify-flow preserved as-is (it becomes the "full regeneration" path). `update` is the new selective path.
- Override preservation: manual semantic overrides from previous sessions survive unless they conflict with the changed category.
- Conflict detection: when a category change invalidates a prior semantic override (e.g., user overrode `color.background.primary → {color.blue.500}` but then removed the blue hue ramp), the user is prompted to resolve.

**What this story is NOT:**
- Not `--dry-run` (Story 3.3).
- Not token diff display (Story 3.2 — this story uses the existing preview).
- Not changelog generation (Story 3.4).
- Not component-token updates (components reference semantics; changing semantics under them is a cascading concern deferred to the component re-author flow).

## Acceptance Criteria

### Command surface

1. **Given** a `quieto.config.json` exists, **When** the user runs `quieto-tokens update`, **Then** the CLI loads the existing config and displays the current system summary (brand color, spacing base, type scale, themes, categories list, component count if any).
2. **Given** no `quieto.config.json` exists, **When** the user runs `quieto-tokens update`, **Then** the CLI exits non-zero with `p.log.error("No token system found — run 'quieto-tokens init' first.")` + `p.outro`.
3. **Given** the config is `corrupt` or `invalid`, **When** `update` runs, **Then** the CLI surfaces the same Abort-only recovery UX as `add` / `component` (Story 2.2 / 2.3 pattern). No "Start fresh" — update cannot synthesize a baseline.

### Category selection

4. **Given** the config is loaded, **When** the category picker runs, **Then** the CLI presents a `p.select` of available categories from `config.categories` (e.g., `color`, `spacing`, `typography`, plus any added categories like `shadow`, `border`, `animation`). Each option shows a one-line hint of the current config for that category (e.g., "Brand color: #2563eb + 2 additional hues").
5. **Given** the user selects a category (e.g., `spacing`), **When** the category prompts run, **Then** only that category's prompts are presented, pre-filled with the current values from `config.inputs`, `config.advanced.<category>`, or `config.categoryConfigs.<category>`.
6. **Given** the user completes the category prompts, **When** they are asked "Modify another category?", **Then** they can select another category to modify in the same session, or proceed to preview.

### Selective regeneration

7. **Given** the user modified only `spacing`, **When** the pipeline runs, **Then** only spacing primitives are regenerated from the new inputs. Color and typography primitives are NOT regenerated — they are loaded from the existing on-disk `tokens/primitive/color.json` and `tokens/primitive/typography.json`.
8. **Given** spacing primitives changed, **When** the semantic auto-mapping runs, **Then** only spacing-related semantic tokens are remapped. Color semantics and typography semantics are preserved from their on-disk state (loaded from `tokens/semantic/<theme>/color.json` and `tokens/semantic/<theme>/typography.json`).
9. **Given** multiple categories were modified in a single session (e.g., color AND typography), **When** the pipeline runs, **Then** both categories' primitives are regenerated and their semantic tokens are remapped. Unmodified categories are loaded from disk.
10. **Given** the user modified a core category (`color`, `spacing`, or `typography`), **When** the pipeline runs, **Then** non-core add-on categories (`shadow`, `border`, `animation`) are NOT regenerated — their on-disk files are preserved. CSS is rebuilt from the full on-disk tree (including the freshly-written modified categories) so everything stays in sync.
11. **Given** the user selects an add-on category (e.g., `shadow`), **When** the category prompts run, **Then** the same prompts from `quieto-tokens add shadow` are presented, pre-filled with values from `config.categoryConfigs.shadow`. The regeneration is scoped to that category only.

### Override preservation and conflict detection

12. **Given** the user has semantic overrides from a prior session, **When** a modified category's semantic tokens are remapped, **Then** overrides for that category are re-applied after remapping. Overrides for unmodified categories are preserved as-is.
13. **Given** a prior override references a primitive token that no longer exists after the category change (e.g., override `color.background.accent → {color.teal.500}` but the teal hue was removed), **When** the semantic remapping completes, **Then** the CLI detects the conflict and presents a `p.select` per conflicting override: "Keep (stale reference will break)", "Remap to default", or "Choose new value" (opens a `p.select` of available primitives for that role).
14. **Given** no overrides conflict, **When** the preview runs, **Then** the override re-application is silent (no extra prompts).

### Preview + output

15. **Given** the selective regeneration completes, **When** the preview step runs, **Then** the existing `previewAndConfirm` UI is used. The preview shows the complete token system (loaded-from-disk + freshly-regenerated) so the user sees the full picture.
16. **Given** the user confirms the preview, **When** the output step runs, **Then** only modified categories' JSON files are written (using `WriteScope = { categories: [...modifiedCategories] }`). Unmodified categories' files are NOT rewritten (their mtimes are unchanged).
17. **Given** the output files are written, **When** the CSS build runs, **Then** Style Dictionary rebuilds from the full on-disk tree (unchanged behavior — CSS is always a full rebuild). All tokens (modified + unmodified + components) appear in the CSS.
18. **Given** the output succeeds, **When** the config write runs, **Then** `quieto.config.json` is updated with the modified categories' new inputs/advanced/categoryConfigs values. Unmodified categories' config sections are preserved. The `generated` timestamp and `version` are refreshed.

### Edge cases

19. **Given** the user modifies color (which changes the primitive ramp), **When** component tokens reference semantic color tokens, **Then** component tokens are NOT regenerated (they are pure references — the CSS cascade handles the new values at runtime). A `p.log.info` note reminds the user: "Component tokens reference semantic tokens — they'll pick up your color changes automatically via the CSS cascade."
20. **Given** the user cancels mid-category (Ctrl+C or escape), **When** the cancel is caught, **Then** no files are written and the config is unchanged. The same `Error("cancelled")` catch pattern from `init`/`add`/`component` applies.
21. **Given** the user modifies no categories (selects a category, makes no changes, declines to modify another, confirms preview), **When** the output step runs, **Then** the CLI reports "No changes to apply" and exits cleanly without writing files.

## Tasks / Subtasks

- [x] **Task 1: CLI `update` subcommand wiring (AC: #1, #2, #3)**
  - [x] 1.1: In `src/cli.ts`, add an `update` branch alongside `init` / `add` / `component`. No flags in this story scope (no `--dry-run` yet).
  - [x] 1.2: Add `parseUpdateArgs(args: readonly string[]): { unknown: string[] }` mirroring the existing parsers. Reject unknown flags.
  - [x] 1.3: Extend `HELP_TEXT` with the new command.
  - [x] 1.4: Wire to `updateCommand()` (Task 2).

- [x] **Task 2: `updateCommand` orchestration (AC: #1, #2, #3, #20)**
  - [x] 2.1: Create `src/commands/update.ts` exporting `export async function updateCommand(): Promise<void>`.
  - [x] 2.2: Check `configExists(process.cwd())`. On false → `p.log.error("No token system found — run 'quieto-tokens init' first.")` + `p.outro` + exit 1.
  - [x] 2.3: `loadConfig` with the injectable Clack logger. Branch on `LoadConfigResult`:
    - `missing` → TOCTOU bail (same pattern as init/add/component).
    - `corrupt` / `invalid` → Abort-only `p.select` with "Abort" and "Show details" (no "Start fresh").
    - `ok` → proceed.
  - [x] 2.4: Display current system summary via `p.log.step` (brand color, spacing base, type scale, theme mode, categories, component count).
  - [x] 2.5: Enter category selection loop (Task 3).
  - [x] 2.6: After loop exits, run selective regeneration (Task 5).
  - [x] 2.7: Run override conflict resolution (Task 6) if needed.
  - [x] 2.8: Run preview via existing `previewAndConfirm`.
  - [x] 2.9: Run scoped output via `runOutputGeneration(collection, cwd, { scope: { categories: modifiedCategories } })`.
  - [x] 2.10: Run config generation via `runConfigGeneration` with updated inputs.
  - [x] 2.11: Handle cancel via existing `Error("cancelled")` catch pattern.

- [x] **Task 3: Category selection + prompt pre-fill loop (AC: #4, #5, #6, #11)**
  - [x] 3.1: Create `src/commands/update-flow.ts` exporting `collectUpdateInputs(config: QuietoConfig): Promise<UpdateResult>`.
  - [x] 3.2: Build `p.select` options from `config.categories`. Each option shows a hint derived from the config:
    - `color` → `"Brand: ${config.inputs.brandColor}"` + additional hue count if `config.advanced?.color?.additionalHues`.
    - `spacing` → `"Base: ${config.inputs.spacingBase}px"` + custom value count.
    - `typography` → `"Scale: ${config.inputs.typeScale}"` + custom override count.
    - `shadow` / `border` / `animation` → brief summary from `config.categoryConfigs.<cat>`.
  - [x] 3.3: On category selection, dispatch to the appropriate prompt flow with prior values pre-filled:
    - Core categories (`color`, `spacing`, `typography`): reuse `runAdvancedFlow`'s per-category steps (extract if needed) with the existing `PriorContext` mechanism. These steps already support prior-value pre-fill from Story 2.1.
    - Add-on categories (`shadow`, `border`, `animation`): reuse the `add` collector prompts (`collectShadowInputs`, `collectBorderInputs`, `collectAnimationInputs`) with prior values from `config.categoryConfigs.<cat>`.
  - [x] 3.4: After each category's prompts complete, ask `p.confirm("Modify another category?")`. On yes → loop back to category picker (excluding already-modified categories from the list). On no → proceed.
  - [x] 3.5: Track which categories were modified and their new inputs in an `UpdateResult`:
    ```typescript
    export interface UpdateResult {
      modifiedCategories: string[];
      updatedInputs: Partial<QuickStartOptions>;
      updatedAdvanced: Partial<AdvancedConfig>;
      updatedCategoryConfigs: Partial<CategoryConfigs>;
    }
    ```

- [x] **Task 4: Load unmodified tokens from disk (AC: #7, #8, #9, #10)**
  - [x] 4.1: Create `src/pipeline/load-from-disk.ts` exporting `loadPrimitivesFromDisk(tokensDir: string, categories: string[]): PrimitiveToken[]` — reads `tokens/primitive/<cat>.json` for each specified category, parses the DTCG tree, and reconstructs `PrimitiveToken[]`. Reuse the `$type`/`$value` parsing logic from the existing generators (or from Style Dictionary's source loading). Only loads categories NOT in the modified set.
  - [x] 4.2: Export `loadSemanticTokensFromDisk(tokensDir: string, themes: string[], categories: string[]): Theme[]` — reads `tokens/semantic/<theme>/<cat>.json` for each unmodified category. Reconstructs `SemanticToken[]` per theme.
  - [x] 4.3: Both functions skip missing files gracefully (a category not yet on disk means it has no tokens to preserve — log a `p.log.warn` and continue).
  - [x] 4.4: Both functions validate the `$metadata.doNotEdit` banner is present as a safety check that the file is quieto-generated (warn if missing, but don't refuse to load).

- [x] **Task 5: Selective regeneration pipeline (AC: #7, #8, #9, #10, #16, #17)**
  - [x] 5.1: Create `src/pipeline/update.ts` exporting `runUpdate(config: QuietoConfig, updateResult: UpdateResult, cwd: string): Promise<UpdatePipelineResult | null>`.
  - [x] 5.2: For each modified core category, regenerate its primitives using the existing generators (`runColorGeneration`, `runSpacingGeneration`, `runTypographyGeneration`) with the updated inputs.
  - [x] 5.3: For each modified add-on category, regenerate its primitives using the existing add-pipeline generators.
  - [x] 5.4: For unmodified categories, call `loadPrimitivesFromDisk` (Task 4.1) to load their primitives from disk.
  - [x] 5.5: Merge all primitives (regenerated + loaded-from-disk) into a single `PrimitiveToken[]`.
  - [x] 5.6: Run `generateSemanticTokens(allPrimitives)` on the full primitive set (semantic mapping depends on the full primitive collection — it cannot run per-category in isolation because cross-category references exist, e.g., semantic `color.background.primary` references `color.blue.500` which is category-dependent).
  - [x] 5.7: Run `generateThemes(semanticTokens, allPrimitives, generateThemes)` to produce the full `ThemeCollection`.
  - [x] 5.8: Load existing component tokens from disk (if any) and attach to `collection.components`.
  - [x] 5.9: Return the collection + the list of modified categories for scoped writing.

- [x] **Task 6: Override conflict detection + resolution (AC: #12, #13, #14)**
  - [x] 6.1: Create `src/utils/override-conflicts.ts` exporting `detectOverrideConflicts(overrides: Record<string, string>, collection: ThemeCollection): OverrideConflict[]`.
  - [x] 6.2: For each override, check if the referenced primitive (the `$value` target) still exists in `collection.themes[0].semanticTokens` (or the primitives array if it's a direct primitive ref). An override conflict occurs when the target token path no longer exists in the regenerated collection.
  - [x] 6.3: Export `resolveOverrideConflicts(conflicts: OverrideConflict[], collection: ThemeCollection): Promise<Record<string, string>>` — presents a `p.select` for each conflict:
    - "Remap to default" → remove the override (let the mapper's default apply).
    - "Choose new value" → open a `p.select` of available primitive tokens for that semantic role.
    - "Keep (stale reference — CSS may break)" → preserve the override as-is with a warning.
  - [x] 6.4: Return the cleaned overrides map.

- [x] **Task 7: Wire `update` into preview + output + config (AC: #15, #16, #17, #18, #19, #21)**
  - [x] 7.1: In `updateCommand`, after selective regeneration and conflict resolution, apply the cleaned overrides via `applyPriorOverrides(collection, cleanedOverrides)`.
  - [x] 7.2: Call `previewAndConfirm(collection, { initialOverrides: new Map(Object.entries(cleanedOverrides)) })`.
  - [x] 7.3: After confirmation, detect if any actual changes were made (compare `updateResult.modifiedCategories` length). If none → `p.log.info("No changes to apply.")` + `p.outro` + return.
  - [x] 7.4: Call `runOutputGeneration(collection, cwd, { scope: { categories: modifiedCategories } })` — this writes only the modified categories' JSON files. CSS is rebuilt from full disk.
  - [x] 7.5: If component tokens exist, emit `p.log.info("Component tokens reference semantic tokens — they'll pick up your changes automatically via the CSS cascade.")`.
  - [x] 7.6: Call `runConfigGeneration` with the updated inputs, overrides, advanced config, and categoryConfigs. The config writer merges the updated fields into the existing config shape.

- [x] **Task 8: Tests (AC: all)**
  - [x] 8.1: `src/__tests__/cli.test.ts` — extend with `update` branches: missing config, happy-path routing, unknown flag rejection.
  - [x] 8.2: `src/commands/__tests__/update.test.ts` — orchestrator tests: missing config, corrupt/invalid Abort flow, cancel handling, no-changes-detected early exit.
  - [x] 8.3: `src/commands/__tests__/update-flow.test.ts` — prompt-collector unit tests: category picker rendering, per-category pre-fill, multi-category session, skip-all-categories.
  - [x] 8.4: `src/pipeline/__tests__/update.test.ts` — selective regeneration E2E: modify only spacing (color/typography files untouched), modify color + typography (spacing untouched), modify an add-on category (core categories untouched). Assert mtimes on unmodified files are unchanged.
  - [x] 8.5: `src/pipeline/__tests__/load-from-disk.test.ts` — round-trip tests: write tokens via `writeTokensToJson`, load back via `loadPrimitivesFromDisk` / `loadSemanticTokensFromDisk`, assert token counts and values match. Missing file tolerance. Missing `$metadata` warning.
  - [x] 8.6: `src/utils/__tests__/override-conflicts.test.ts` — conflict detection: no conflicts (all refs valid), single conflict (removed hue), multiple conflicts. Resolution: remap-to-default, choose-new-value, keep-stale.
  - [x] 8.7: Extend existing test files as needed: `src/output/__tests__/json-writer.test.ts` (scoped write mtime assertion), `src/output/__tests__/style-dictionary.test.ts` (CSS rebuild after partial write).
  - [x] 8.8: `npm run type-check`, `npm test`, `npm run build`, `npm run validate:sprint` — all clean.

- [x] **Task 9: Close-out**
  - [x] 9.1: Update `src/pipeline/config.ts` "What's next" outro to include: `• Run "quieto-tokens update" to modify specific categories without regenerating everything`.
  - [x] 9.2: Update README.md — add an "Updating your token system" subsection under Quick Start describing the `update` command and how it differs from re-running `init`.
  - [x] 9.3: Move this story to `review`, then to `done` after code review.

## Dev Notes

### Relevant ADRs

- **[ADR-001](../architecture/adr-001-non-destructive-json-merge.md)** — Per-category files + config-as-manifest. This story is the full realization of ADR-001's design: each category file is independently writable, and `quieto.config.json` is the canonical source of user intent. The `WriteScope` mechanism (introduced in Story 2.2) is the implementation lever for selective output.
- **[ADR-002](../architecture/adr-002-story-status-single-source-of-truth.md)** — `npm run validate:sprint` must pass after every status transition.

### Previous Story Intelligence

**From Story 2.5 (most recent):**
- Primitive ease tokens renamed from `animation.ease.<role>` to `animation.easing.<role>`. The `loadPrimitivesFromDisk` helper (Task 4) must handle the current on-disk naming — it reads what's there, it doesn't validate against a hardcoded schema.
- All 557 tests pass at the start of this story.
- `npm run validate:sprint` reports pre-existing drift on Story 2.3 (`file=review` vs `yaml=done`) — not related to this story.

**From Story 2.3 (component tokens):**
- `rebuildCollectionFromConfig` lives in `src/pipeline/component.ts` (not a shared helper). Story 3.1's `runUpdate` pipeline (Task 5) should NOT use this helper — it rebuilds the full collection from config, which is the opposite of selective regeneration. Instead, build the collection by merging regenerated + loaded-from-disk tokens.
- Component pruning is wired into `runComponent` but NOT into `runAdd` or `runConfigGeneration`. Story 3.1 should wire component pruning into the update pipeline's config-generation step.

**From Story 2.2 (add subcommand):**
- `WriteScope = "all" | { categories: readonly string[] }` in `src/output/json-writer.ts` — this is the mechanism for scoped writes. `update` will use `{ categories: modifiedCategories }`.
- `src/output/pruner.ts` handles category + theme cleanup. The update pipeline should NOT run the pruner's category cleanup (categories aren't being added/removed), but it should pass `knownComponents` through for component cleanup consistency.

**From Story 2.1 (advanced mode):**
- `runAdvancedFlow(options, priorContext)` in `src/commands/advanced.ts` walks color → spacing → typography with prior-value pre-fill via `PriorContext`. The update flow needs to extract individual category steps from this flow (or call it with a "skip" directive for unselected categories).
- `loadConfig` returns `config.advanced` and `config.categoryConfigs` — these are the prior-value sources for pre-filling prompts.

### Semantic Remapping Scope

The semantic auto-mapper (`src/mappers/semantic.ts::generateSemanticTokens`) takes the FULL `PrimitiveToken[]` array as input. It cannot run per-category because:
- Color semantics reference color primitives.
- Spacing semantics reference spacing primitives.
- Typography semantics reference typography primitives.
- Each mapper function depends on filtering the full array by category.

**Approach:** regenerate ALL semantic tokens from the full primitive set (merged regenerated + loaded-from-disk), then re-apply overrides. This is a full semantic rebuild, but it's cheap (pure function, no I/O). The selective optimization is at the **primitive generation** and **file-write** levels, not the semantic mapping level.

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

### Architecture Constraints

- **Config is the recipe.** The update flow reads the config to derive the current state, modifies only the selected categories' inputs, and writes the config back. On-disk token files are outputs, not inputs — except for loading unmodified categories to avoid regeneration.
- **CSS is always a full rebuild.** `src/output/style-dictionary.ts` reads the full `tokens/` tree via glob. There is no mechanism for incremental CSS builds, and adding one is out of scope. The optimization is at the JSON-write level: unmodified files aren't rewritten, but CSS is rebuilt from whatever is on disk.
- **Components are NOT regenerated.** Component tokens are pure DTCG references into the semantic tier. When a semantic value changes underneath, the CSS cascade propagates the change — component JSON files don't need to be rewritten.
- **`init` modify-flow is unchanged.** The existing modify path in `src/commands/init.ts` (lines 81–156) continues to work as before — full regeneration with prior pre-fill. `update` is an additive command, not a replacement.

### Key Patterns to Reuse

| Pattern | Source | Reuse in |
|---------|--------|----------|
| `LoadConfigResult` discriminated union | `src/utils/config.ts` | Task 2.3 |
| Abort-only recovery UX | `src/commands/add.ts` / `component.ts` | Task 2.3 |
| `WriteScope` for scoped JSON writes | `src/output/json-writer.ts:254` | Task 7.4 |
| `applyPriorOverrides` | `src/utils/overrides.ts` | Task 7.1 |
| `previewAndConfirm` | `src/ui/preview.ts` | Task 7.2 |
| `Error("cancelled")` catch pattern | `src/commands/init.ts:306` | Task 2.11 |
| Advanced-flow per-category steps | `src/commands/advanced.ts` | Task 3.3 |
| Add-category collectors | `src/commands/add-shadow.ts`, `add-border.ts`, `add-animation.ts` | Task 3.3 |

### What NOT to Build

- **Do NOT implement `--dry-run`.** That is Story 3.3. The update command writes files if the user confirms the preview.
- **Do NOT implement token diff display.** That is Story 3.2. Use the existing preview UI.
- **Do NOT implement changelog generation.** That is Story 3.4.
- **Do NOT modify the `init` modify-flow.** It stays as-is — full regeneration. `update` is a separate, additive command.
- **Do NOT implement component re-authoring.** If a semantic token referenced by a component is removed (not just changed), that's a broken-reference scenario caught at the next `quieto-tokens component <name>` run. Do not add component-level conflict resolution to the update flow.
- **Do NOT implement per-theme selective regeneration.** If the user changes `generateThemes` from false→true or true→false, that's a structural change better handled by `init`. The update flow assumes the theme structure is stable.
- **Do NOT implement incremental CSS builds.** CSS is always rebuilt from the full on-disk tree.
- **Do NOT migrate `compareVersions`, extract the shared version resolver, or add lockfile protection.** All still deferred per `docs/planning/deferred-work.md`.

### File Structure (final target)

```
src/
├── cli.ts                            ← modified (update branch)
├── commands/
│   ├── update.ts                     ← NEW (orchestrator)
│   ├── update-flow.ts                ← NEW (category picker + prompt collector)
│   ├── init.ts                       ← unchanged
│   ├── modify.ts                     ← unchanged
│   ├── advanced.ts                   ← possibly modified (extract per-category steps)
│   ├── add*.ts                       ← unchanged (reused for add-on category prompts)
│   ├── component*.ts                 ← unchanged
│   └── quick-start.ts                ← unchanged
├── generators/                       ← unchanged (reused by update pipeline)
├── mappers/
│   └── semantic.ts                   ← unchanged (full rebuild)
├── output/
│   ├── json-writer.ts                ← unchanged (WriteScope already supports scoped writes)
│   ├── style-dictionary.ts           ← unchanged (full CSS rebuild)
│   ├── pruner.ts                     ← unchanged (used for component cleanup)
│   └── config-writer.ts              ← unchanged
├── pipeline/
│   ├── update.ts                     ← NEW (selective regeneration pipeline)
│   ├── load-from-disk.ts             ← NEW (load unmodified tokens from disk)
│   ├── config.ts                     ← modified (outro update)
│   ├── add.ts                        ← unchanged
│   ├── component.ts                  ← unchanged
│   ├── color.ts                      ← unchanged
│   ├── output.ts                     ← unchanged
│   └── spacing-typography.ts         ← unchanged
├── types/
│   └── config.ts                     ← unchanged (QuietoConfig shape suffices)
├── utils/
│   ├── override-conflicts.ts         ← NEW (conflict detection + resolution)
│   ├── overrides.ts                  ← unchanged (reused)
│   ├── config.ts                     ← unchanged
│   └── validation.ts                 ← unchanged
├── __tests__/
│   └── cli.test.ts                   ← modified (update routing tests)
```

### References

- [Source: docs/planning/epics.md#Story 3.1: Re-Entrant Editing]
- [Source: docs/planning/architecture/adr-001-non-destructive-json-merge.md] — per-category file ownership, config-as-manifest, scoped writes
- [Source: docs/planning/architecture/adr-002-story-status-single-source-of-truth.md] — sprint status sync
- [Source: docs/planning/stories/2-5-fix-animation-ease-path-collision.md] — latest story, 557 tests passing, animation.easing.* naming
- [Source: docs/planning/stories/2-3-guided-component-token-generation.md] — component token architecture, rebuildCollectionFromConfig pattern
- [Source: docs/planning/stories/2-2-add-subcommand-for-new-token-categories.md] — WriteScope, pruner, add-category collectors
- [Source: src/commands/init.ts#initCommand] — existing modify-flow (lines 81–156), pipeline orchestration
- [Source: src/output/json-writer.ts#WriteScope] — `"all" | { categories: readonly string[] }` scoped-write mechanism
- [Source: src/utils/overrides.ts#applyPriorOverrides] — prior override re-application
- [Source: src/mappers/semantic.ts#generateSemanticTokens] — semantic auto-mapper (requires full primitives array)
- [Source: docs/planning/deferred-work.md] — deferred items that remain out of scope

## Dev Agent Record

### Agent Model Used

Composer (Cursor Agent)

### Debug Log References

### Completion Notes List

- Shipped `quieto-tokens update` with `parseUpdateArgs`, `updateCommand`, `collectUpdateInputs` / `UpdateResult`, `runUpdate`, disk loaders, override conflict detection + interactive resolution, scoped JSON writes, `skipComponents` on partial writes, README + config outro updates.
- Config close-out uses `buildConfig` + `writeConfig` + `prune` (with `knownComponents`) instead of calling `runConfigGeneration`, to avoid duplicate success copy while still matching persistence + pruning behaviour.
- `resolveOverrideConflicts(conflicts, overrides, collection)` takes the prior overrides map so non-conflicting keys are preserved when rebuilding the cleaned map.

### File List

- `src/cli.ts`
- `src/commands/update.ts`
- `src/commands/update-flow.ts`
- `src/commands/update-helpers.ts`
- `src/pipeline/load-from-disk.ts`
- `src/pipeline/update.ts`
- `src/utils/override-conflicts.ts`
- `src/output/json-writer.ts`
- `src/pipeline/output.ts`
- `src/pipeline/config.ts`
- `src/__tests__/cli.test.ts`
- `src/commands/__tests__/update.test.ts`
- `src/commands/__tests__/update-flow.test.ts`
- `src/pipeline/__tests__/load-from-disk.test.ts`
- `src/pipeline/__tests__/update-pipeline.test.ts`
- `src/utils/__tests__/override-conflicts.test.ts`
- `src/output/__tests__/json-writer.test.ts`
- `README.md`
- `docs/planning/sprint-status.yaml`
- `docs/planning/stories/3-1-re-entrant-editing.md`

### Change Log

- 2026-04-22 — Story 3.1: selective `update` command, disk load helpers, override conflict flow, scoped writes + skipComponents, tests, docs.

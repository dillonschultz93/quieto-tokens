# Story 4.1: JSON Output for Figma Variables and Tokens Studio

Status: review

## Story

As a **solo developer who works with a designer (or designs in Figma themselves)**,
I want my token system exported as JSON compatible with Figma Variables and Tokens Studio,
so that my design tool and my codebase share the same source of truth.

## Story Scope Note

This is the **first story of Epic 4** and introduces the multi-platform output architecture. The current pipeline is CSS-only (`buildCss` in `src/output/style-dictionary.ts`). This story adds a Figma/Tokens Studio JSON output format as a second platform, driven by a new `outputs` array in `quieto.config.json`.

**What this story IS:**
- A new Style Dictionary platform configuration (`figma`) producing Figma-compatible JSON with `/`-separated token names and nested object structure.
- An `outputs` config property listing enabled output platforms (`["css"]` by default, `["css", "figma"]` when opted in).
- A prompt during `init` (and available during `update`) asking the user which output platforms to enable.
- Theme variants structured as separate top-level keys in the JSON (one per Figma Variable collection).
- Cross-tier DTCG references preserved in the output (Tokens Studio uses these for linked variables).

**What this story is NOT:**
- Not a Figma plugin or API integration — this produces a JSON file the user imports manually into Figma/Tokens Studio.
- Not a replacement for CSS output — CSS remains the default and always-on platform.
- Not a new CLI command — output platform selection happens within `init`/`update` flows.
- Not iOS or Android output — those are Stories 4.2 and 4.3.

## Acceptance Criteria

### Output platform config

1. **Given** a fresh `quieto-tokens init` run, **When** the user reaches the output configuration step, **Then** they are prompted to select which output platforms to enable (multi-select: CSS is pre-selected and cannot be deselected; Figma JSON is optional).
2. **Given** the user enables Figma JSON, **When** `quieto.config.json` is written, **Then** it includes `"outputs": ["css", "figma"]`. If only CSS is selected, `"outputs": ["css"]`.
3. **Given** an existing config without an `outputs` field (legacy), **When** `update` or `init` modify-flow runs, **Then** the missing field defaults to `["css"]` — the existing CSS-only behavior is preserved.

### Figma JSON generation

4. **Given** the user has enabled Figma JSON output, **When** the output generation pipeline runs, **Then** a `build/tokens.figma.json` file is generated alongside the CSS output.
5. **Given** the generated Figma JSON, **When** it is inspected, **Then** token names use `/` as the group separator (e.g., `color/blue/500`, `spacing/space-4`) matching Figma Variable group conventions.
6. **Given** a token system with light and dark themes, **When** the Figma JSON is generated, **Then** each theme is a separate top-level key in the JSON (`"light": { ... }`, `"dark": { ... }`), representing separate Figma Variable collections.
7. **Given** a single-theme token system, **When** the Figma JSON is generated, **Then** all tokens appear under a single top-level key using the theme name.
8. **Given** semantic tokens referencing primitives, **When** the Figma JSON is generated, **Then** references are preserved in DTCG `$value` format (e.g., `"{color.blue.500}"`) so Tokens Studio can resolve linked variables.
9. **Given** component tokens exist, **When** the Figma JSON is generated, **Then** component tokens are included in the output under a `component` group.

### Integration with existing pipeline

10. **Given** the output pipeline runs with `outputs: ["css", "figma"]`, **When** generation completes, **Then** both CSS files and the Figma JSON file are written. A failure in the Figma build does not block CSS output.
11. **Given** `--dry-run` mode is active, **When** the pipeline runs, **Then** no Figma JSON file is written (consistent with Story 3.3).
12. **Given** the `update` command runs, **When** it detects `outputs` in the config, **Then** it regenerates all enabled output formats (not just CSS).
13. **Given** `outputs` includes `"figma"`, **When** the changelog entry is written (Story 3.4), **Then** the entry mentions the Figma JSON output file alongside CSS.

### Style Dictionary integration

14. **Given** the Figma platform is configured, **When** Style Dictionary processes tokens, **Then** it uses a custom format (registered via `StyleDictionary.registerFormat`) that produces the Tokens Studio-compatible JSON structure.
15. **Given** the custom Figma format, **When** it transforms token names, **Then** it uses a custom `name/figma` transform that joins the token path with `/` instead of `-`.

## Tasks / Subtasks

- [x] **Task 1: Extend `QuietoConfig` with `outputs` (AC: #1, #2, #3)**
  - [x] 1.1: In `src/types/config.ts`, add an `outputs` property to `QuietoConfig`:
    ```typescript
    outputs: OutputPlatform[];
    ```
    Where `OutputPlatform = "css" | "figma"` (extensible for Stories 4.2/4.3: `"ios"`, `"android"`).
  - [x] 1.2: Add `DEFAULT_OUTPUTS: readonly OutputPlatform[] = Object.freeze(["css"])` alongside `DEFAULT_OUTPUT_CONFIG`.
  - [x] 1.3: In `src/output/config-writer.ts`, update `buildConfig` to accept and serialize `outputs`. Default to `["css"]` if not provided.
  - [x] 1.4: In `src/utils/config.ts` (or wherever `loadConfig` lives), ensure loading a legacy config without `outputs` defaults to `["css"]`.

- [x] **Task 2: Output platform selection prompt (AC: #1, #2)**
  - [x] 2.1: Create a prompt step (in the init flow, after theme selection and before preview) using `p.multiselect` that lets the user choose output platforms. CSS is pre-selected and marked as `required: true` (cannot be deselected). Figma JSON is an opt-in choice.
  - [x] 2.2: Thread the selected `outputs` array through the pipeline into `buildConfig` and `runOutputGeneration`.
  - [x] 2.3: In the `update` modify-flow, respect the existing `outputs` from the loaded config — do not re-prompt unless the user explicitly modifies output settings.

- [x] **Task 3: Figma name transform and format (AC: #5, #6, #7, #8, #9, #14, #15)**
  - [x] 3.1: In `src/output/style-dictionary.ts`, register a `name/figma` transform:
    ```typescript
    const FIGMA_NAME_TRANSFORM = "name/figma";
    // Transform: join token.path with "/" separator
    // e.g., ["color", "blue", "500"] → "color/blue/500"
    // Semantic tokens get "semantic/" prefix, component tokens get "component/" prefix
    ```
  - [x] 3.2: Register a custom `figma/json` format via `StyleDictionary.registerFormat` that outputs the Tokens Studio-compatible structure:
    - Nested JSON object grouped by `/`-separated path segments.
    - Leaf nodes include `$type` and `$value`.
    - `$value` preserves DTCG references for semantic/component tokens (`outputReferences: true`).
  - [x] 3.3: For multi-theme systems, produce a JSON structure with theme names as top-level keys. Each theme collection includes primitives + that theme's semantics + components.
  - [x] 3.4: For single-theme systems, produce a single top-level key using the theme name.

- [x] **Task 4: `buildFigmaJson` orchestrator (AC: #4, #6, #7, #10)**
  - [x] 4.1: In `src/output/style-dictionary.ts`, export a new `buildFigmaJson(collection, outputDir): Promise<string[]>` function mirroring `buildCss`. It configures the `figma` platform with:
    - Source globs matching `buildCss` patterns (primitive + semantic per theme + component).
    - `buildPath`: `build/` (same as CSS).
    - `files`: `[{ destination: "tokens.figma.json", format: "figma/json" }]`.
  - [x] 4.2: Handle multi-theme by running one SD build per theme or by building a merged output. Follow the same `runSingleTheme` / `runPrimitivesOnly` / `runThemeSemantics` decomposition pattern that `buildCss` uses.

- [x] **Task 5: Wire into output pipeline (AC: #10, #11, #12, #13)**
  - [x] 5.1: In `src/pipeline/output.ts`, modify `runOutputGeneration` to accept an `outputs` parameter (from config). After CSS build, if `"figma"` is in `outputs`, call `buildFigmaJson`.
  - [x] 5.2: Extend `OutputResult` to include `figmaFiles?: string[]`.
  - [x] 5.3: A Figma build failure logs a warning but does not roll back CSS or JSON source files — CSS is the primary output.
  - [x] 5.4: Update log messages to show Figma JSON file paths when written.

- [x] **Task 6: Update `init` and `update` commands (AC: #1, #2, #3, #12)**
  - [x] 6.1: In `src/commands/init.ts`, add the output platform prompt step. Pass selected `outputs` to config builder and output pipeline.
  - [x] 6.2: In `src/commands/update.ts`, read `outputs` from the loaded config and pass through to the output pipeline.
  - [x] 6.3: In `src/commands/add.ts` and `src/commands/component.ts`, similarly read `outputs` from config and pass to the output pipeline.

- [x] **Task 7: Tests (AC: all)**
  - [x] 7.1: `src/output/__tests__/style-dictionary-figma.test.ts` — unit tests for the Figma format:
    - `name/figma` transform produces `/`-separated paths.
    - `figma/json` format produces valid Tokens Studio structure.
    - Multi-theme output has separate top-level keys.
    - Single-theme output has one top-level key.
    - References preserved in semantic token `$value`.
    - Component tokens included under `component/` group.
  - [x] 7.2: `src/pipeline/__tests__/output-figma.test.ts` — integration tests:
    - `runOutputGeneration` with `outputs: ["css", "figma"]` produces both CSS and Figma JSON.
    - `outputs: ["css"]` skips Figma build.
    - Figma build failure does not block CSS.
  - [x] 7.3: Config round-trip tests: `buildConfig` with `outputs` serializes correctly; `loadConfig` on legacy config without `outputs` defaults to `["css"]`.
  - [x] 7.4: `npm run type-check`, `npm test`, `npm run build`, `npm run validate:sprint` — all clean.

- [x] **Task 8: Close-out**
  - [x] 8.1: Update HELP_TEXT in `src/cli.ts` to mention multi-platform output support.
  - [x] 8.2: Update README.md to document the Figma JSON output format and how to enable it.
  - [x] 8.3: Move this story to `review`, then to `done` after code review.

## Dev Notes

### Relevant ADRs

- **[ADR-001](../architecture/adr-001-non-destructive-json-merge.md)** — Per-category file ownership applies to DTCG JSON source files in `tokens/`. The Figma JSON output in `build/` is a derived artifact (like CSS) and is fully regenerated on each run — no merge logic needed.

### Previous Story Intelligence

**From Story 1.8 (DTCG JSON and CSS output via Style Dictionary):**
- `buildCss` in `src/output/style-dictionary.ts` is the only SD consumer. It registers a custom `name/quieto` transform and uses `CSS_TRANSFORMS_WITH_QUIETO_NAME`. The Figma platform needs its own name transform (`name/figma`) and format — follow the same registration pattern.
- `ensureQuietoTransformRegistered()` uses a module-level boolean flag to avoid double-registration. Use the same pattern for the Figma transform and format.
- `silenceLogs()` with `brokenReferences: "throw"` is reused across all SD configs — share it for the Figma platform too.
- Source glob patterns (`tokens/primitive/**/*.json`, `tokens/semantic/<theme>/**/*.json`, `tokens/component/**/*.json`) are the same for both CSS and Figma platforms.

**From Story 3.3 (dry-run mode):**
- Dry-run suppresses all writes. The Figma output must also be skipped when `dryRun` is true. This is handled at the `runOutputGeneration` level — the function already short-circuits on dry-run before CSS build.

**From Story 3.4 (changelog):**
- The changelog's `OutputResult` includes `jsonFiles` and `cssFiles`. Extend it to include `figmaFiles` so the changelog entry can mention the Figma output.

### Style Dictionary v5 Custom Formats

Style Dictionary v5 uses `StyleDictionary.registerFormat({ name, format })` where `format` is a function receiving `({ dictionary, platform, options, file })`. The `dictionary.allTokens` array provides all resolved tokens. The custom format function returns a string (the file contents).

For the Figma/Tokens Studio format, the output should be a nested JSON object. Tokens Studio expects:
```json
{
  "color": {
    "blue": {
      "500": {
        "$type": "color",
        "$value": "#3b82f6"
      }
    }
  }
}
```

For semantic tokens with references:
```json
{
  "semantic": {
    "color": {
      "background": {
        "primary": {
          "$type": "color",
          "$value": "{color.blue.500}"
        }
      }
    }
  }
}
```

### Config Shape Extension

The `outputs` property slots alongside the existing `output` block:
```typescript
// Existing: output paths/naming
output: { tokensDir: "tokens", buildDir: "build", prefix: "quieto" }
// New: which platforms to generate
outputs: ["css", "figma"]
```

The naming distinction (`output` = paths, `outputs` = platforms) is intentional and follows the existing pattern of adding new top-level keys to `QuietoConfig`.

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

- **Do NOT add iOS or Android output.** Those are Stories 4.2 and 4.3.
- **Do NOT create a Figma plugin or API client.** This story produces a static JSON file for manual import.
- **Do NOT make CSS output optional.** CSS is always generated — it's the primary output format.
- **Do NOT add a separate `figma` CLI command.** Output format selection is part of the `init`/`update` flow.
- **Do NOT modify the DTCG JSON source files** in `tokens/`. The Figma JSON is a derived output in `build/`, like CSS.
- **Do NOT migrate `compareVersions`, extract the shared version resolver, or add lockfile protection.** All still deferred per `docs/planning/deferred-work.md`.

### File Structure (final target)

```
src/
├── cli.ts                            ← modified (HELP_TEXT update)
├── commands/
│   ├── init.ts                       ← modified (output platform prompt)
│   ├── update.ts                     ← modified (pass outputs to pipeline)
│   ├── add.ts                        ← modified (pass outputs to pipeline)
│   ├── component.ts                  ← modified (pass outputs to pipeline)
│   └── ...
├── output/
│   ├── style-dictionary.ts           ← modified (add buildFigmaJson, name/figma, figma/json format)
│   ├── config-writer.ts              ← modified (outputs in buildConfig)
│   ├── __tests__/
│   │   ├── style-dictionary-figma.test.ts  ← NEW
│   │   └── ...
│   └── ...
├── pipeline/
│   ├── output.ts                     ← modified (call buildFigmaJson when enabled)
│   ├── __tests__/
│   │   ├── output-figma.test.ts      ← NEW
│   │   └── ...
│   └── ...
├── types/
│   ├── config.ts                     ← modified (OutputPlatform, outputs, DEFAULT_OUTPUTS)
│   └── ...
```

### References

- [Source: docs/planning/epics.md#Story 4.1: JSON Output for Figma Variables and Tokens Studio]
- [Source: src/output/style-dictionary.ts] — current CSS-only SD config, custom transforms, buildCss
- [Source: src/types/config.ts] — QuietoConfig shape, DEFAULT_OUTPUT_CONFIG
- [Source: src/output/config-writer.ts] — buildConfig, writeConfig
- [Source: src/pipeline/output.ts] — runOutputGeneration, OutputResult
- [Source: src/cli.ts] — HELP_TEXT, command routing
- [Source: docs/planning/stories/3-3-dry-run-mode.md] — dry-run suppression
- [Source: docs/planning/stories/3-4-design-system-changelog.md] — changelog integration
- [Source: docs/planning/deferred-work.md] — deferred items that remain out of scope

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

### Implementation Plan

- Added `OutputPlatform` / `outputs` / `DEFAULT_OUTPUTS` to `QuietoConfig`; `buildConfig` always ensures `css`; `loadConfig` defaults missing `outputs` to `["css"]`; `validateConfigShape` rejects `outputs` without `css` or with invalid entries.
- Init: `p.multiselect` (CSS + optional Figma) after theme work and before preview; modify-flow takes `outputs` from loaded config. `runConfigGeneration` and `runOutputGeneration` receive the selected list.
- Style Dictionary: `name/figma` + `figma/json` format; `buildFigmaJson` runs `formatPlatform("figma")` per theme, merges to one file, `mkdir` for `build/` before write.
- Pipeline: `runOutputGeneration` options `outputs`; Figma errors warn only. Changelog helpers mention Figma when `figmaFiles` present. `component` pipeline calls `buildFigmaJson` when enabled.

### Completion Notes List

- All acceptance criteria satisfied; tests include `style-dictionary-figma.test.ts`, `output-figma.test.ts`, and config legacy/validation cases. `npm run type-check`, `npm test`, `npm run build`, `npm run validate:sprint` all pass.

### Change Log

- 2026-04-22: Story 4.1 — Figma JSON output (`build/tokens.figma.json`), `outputs` in config, init multiselect, pipeline + changelog + README/HELP updates.

### File List

- `src/types/config.ts`
- `src/utils/config.ts`
- `src/output/config-writer.ts`
- `src/output/style-dictionary.ts`
- `src/pipeline/output.ts`
- `src/pipeline/config.ts`
- `src/pipeline/add.ts`
- `src/pipeline/component.ts`
- `src/output/changelog-summary.ts`
- `src/commands/init.ts`
- `src/commands/update.ts`
- `src/commands/add.ts`
- `src/commands/component.ts`
- `src/cli.ts`
- `src/index.ts`
- `README.md`
- `docs/planning/sprint-status.yaml`
- `src/output/__tests__/style-dictionary-figma.test.ts` (new)
- `src/pipeline/__tests__/output-figma.test.ts` (new)
- `src/utils/__tests__/config.test.ts` (and other test fixture updates)
- `src/output/__tests__/config-writer.test.ts`
- `src/commands/__tests__/init-dry-run.test.ts`
- `docs/planning/stories/4-1-json-output-for-figma-variables-and-tokens-studio.md`

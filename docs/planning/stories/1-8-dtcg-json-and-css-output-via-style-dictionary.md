# Story 1.8: DTCG JSON and CSS Output via Style Dictionary

Status: done

## Story

As a **solo developer**,
I want my token system written as DTCG-aligned JSON source files and CSS custom properties,
So that I have a standards-compliant source of truth and immediately usable CSS variables.

## Acceptance Criteria

1. **Given** the user has confirmed the token preview (Story 1.7), **When** the output step runs, **Then** DTCG JSON source files are written to `tokens/primitive/` and `tokens/semantic/` directories in the user's project.
2. **Given** JSON files are written, **When** the format is validated, **Then** JSON files use `$type`, `$value`, and `$description` per DTCG spec.
3. **Given** semantic tokens are written, **When** references are checked, **Then** semantic tokens use DTCG reference syntax to point to primitives (e.g., `"{color.blue.500}"`).
4. **Given** JSON source files exist, **When** Style Dictionary v5 processes them, **Then** CSS custom properties are output to a `build/` directory.
5. **Given** CSS variables are generated, **When** naming is checked, **Then** CSS variables follow the naming convention with the user's global prefix (`--quieto-*`).
6. **Given** themes exist, **When** CSS is generated, **Then** theme variants are output as separate CSS files or scoped under class/attribute selectors.
7. **Given** files are being written, **When** each file is saved, **Then** the progress narrative confirms each file written with its path.

## Tasks / Subtasks

- [x] Task 1: Install Style Dictionary v5 as a runtime dependency (AC: #4)
  - [x] 1.1: `npm install style-dictionary@^5` — add as a runtime dependency (it runs as part of the CLI)
  - [x] 1.2: Verify Style Dictionary v5 API: programmatic usage with `StyleDictionary` class, DTCG format support, custom platforms
- [x] Task 2: Create `src/output/json-writer.ts` — DTCG JSON serializer (AC: #1, #2, #3)
  - [x] 2.1: Implement `writeTokensToJson(collection: ThemeCollection, outputDir: string): Promise<string[]>` — returns list of written file paths
  - [x] 2.2: Serialize primitive tokens to `tokens/primitive/color.json`, `tokens/primitive/spacing.json`, `tokens/primitive/typography.json`
  - [x] 2.3: Serialize semantic tokens per theme: `tokens/semantic/light/color.json`, `tokens/semantic/dark/color.json`, etc.
  - [x] 2.4: JSON format per DTCG spec:
    ```json
    {
      "color": {
        "blue": {
          "400": {
            "$type": "color",
            "$value": "#60A5FA",
            "$description": "Primary blue, step 400"
          }
        }
      }
    }
    ```
  - [x] 2.5: Semantic tokens use reference syntax: `"$value": "{color.blue.500}"`
- [x] Task 3: Create `src/output/style-dictionary.ts` — SD v5 integration (AC: #4, #5, #6)
  - [x] 3.1: Create a programmatic Style Dictionary configuration:
    - Source: `tokens/primitive/**/*.json` + `tokens/semantic/<theme>/**/*.json`
    - Platform: `css` with format `css/variables`
    - Prefix: `quieto` (the global prefix)
    - Build path: `build/`
  - [x] 3.2: For each theme, run SD with the shared primitives + that theme's semantics
  - [x] 3.3: Output CSS files:
    - Shared primitives: `build/primitives.css` (or included in each theme file)
    - Light theme: `build/light.css` (or `build/tokens.css` with `:root` scope)
    - Dark theme: `build/dark.css` (scoped under `[data-theme="dark"]` or `.theme-dark` selector)
  - [x] 3.4: If single theme (no dark mode), output `build/tokens.css` with `:root` scope
  - [x] 3.5: CSS variable format: `--quieto-color-blue-400: #60A5FA;`, `--quieto-semantic-color-background-primary: var(--quieto-color-blue-500);`
- [x] Task 4: Implement progress narrative for file output (AC: #7)
  - [x] 4.1: Narrate each JSON file written: "Writing tokens/primitive/color.json..."
  - [x] 4.2: Narrate Style Dictionary build: "Building CSS custom properties..."
  - [x] 4.3: Narrate each CSS file output: "Generated build/light.css (78 variables)"
  - [x] 4.4: Use Clack `log.step()` for phase headers, `log.info()` for file details
- [x] Task 5: Integrate into init pipeline (AC: #1–#7)
  - [x] 5.1: Wire output step after Story 1.7's confirmation
  - [x] 5.2: Determine output directory relative to `process.cwd()` (the user's project root)
  - [x] 5.3: Create output directories if they don't exist (`tokens/`, `build/`)
  - [x] 5.4: Handle write errors gracefully — if directory creation or file write fails, display a clear error via Clack and suggest permissions or path fixes

## Dev Notes

### Technical Stack

| Concern | Choice | Version |
|---------|--------|---------|
| Runtime | Node.js | >=18 (LTS) |
| Language | TypeScript | ^5.x |
| Build | tsup | ^8.x |
| CLI prompts | @clack/prompts | ^1.2.0 |
| Output engine | Style Dictionary | ^5.x (v5.4.0 is latest as of April 2026) |

### Style Dictionary v5 Critical Notes

**Style Dictionary is now at v5.4.0** (NOT v4 as originally planned). Key differences from v4:
- First-class DTCG format support with `$type`, `$value`, `$description`
- The DTCG format is used by default when `$value` keys are detected
- Programmatic API: `new StyleDictionary(config)` then `sd.buildAllPlatforms()`
- DTCG v2025.10 color types supported (structured color values, multiple color spaces)
- The `css/variables` format is a built-in format

**Programmatic usage example (v5 API):**
```typescript
import StyleDictionary from 'style-dictionary';

const sd = new StyleDictionary({
  source: ['tokens/**/*.json'],
  platforms: {
    css: {
      transformGroup: 'css',
      prefix: 'quieto',
      buildPath: 'build/',
      files: [{
        destination: 'tokens.css',
        format: 'css/variables',
        options: { selector: ':root' }
      }]
    }
  }
});

await sd.buildAllPlatforms();
```

**For themed output**, create separate SD configs per theme or use SD's `include`/`source` to swap semantic directories while keeping primitives constant.

### Architecture Constraints

- **ESM-only** — Style Dictionary v5 is ESM-compatible. Import as `import StyleDictionary from 'style-dictionary'`.
- **Output to user's project, not CLI's repo:** All file writes go to `process.cwd()` (the user's project root), not the `@quieto/tokens` package directory.
- **DTCG compliance is mandatory:** JSON source files MUST use `$type`, `$value` per DTCG spec. Do NOT use Style Dictionary's legacy `value` format.
- **CSS prefix is `quieto`:** All CSS custom properties use `--quieto-` prefix. This is set in the SD platform config.
- **Semantic tokens as CSS references:** Prefer that semantic CSS variables reference primitive CSS variables where possible (e.g., `--quieto-semantic-color-background-primary: var(--quieto-color-blue-500)`). This preserves the cascade and allows primitive overrides to propagate. Style Dictionary v5 may need a custom transform or the `outputReferences: true` option.

### Output Directory Structure

```
<user-project>/
├── tokens/
│   ├── primitive/
│   │   ├── color.json
│   │   ├── spacing.json
│   │   └── typography.json
│   └── semantic/
│       ├── light/
│       │   ├── color.json
│       │   ├── spacing.json
│       │   └── typography.json
│       └── dark/                    # Only if dark theme enabled
│           ├── color.json
│           ├── spacing.json
│           └── typography.json
├── build/
│   ├── primitives.css              # --quieto-color-blue-400, --quieto-spacing-4, etc.
│   ├── light.css                   # :root { --quieto-semantic-color-background-... }
│   └── dark.css                    # [data-theme="dark"] { ... }  (if dark theme enabled)
```

If single theme (no dark mode): `build/tokens.css` with both primitives and semantics under `:root`.

### CSS Theme Scoping Strategy

- **Light theme:** Scoped to `:root` (default, always active)
- **Dark theme:** Scoped to `[data-theme="dark"]` selector — this is the most common convention for CSS-based theme switching and works with any framework
- Alternative: separate files that can be loaded conditionally

### DTCG JSON Format

Primitive token example:
```json
{
  "color": {
    "blue": {
      "400": {
        "$type": "color",
        "$value": "#60A5FA"
      },
      "500": {
        "$type": "color",
        "$value": "#3B82F6"
      }
    }
  }
}
```

Semantic token example (light theme):
```json
{
  "color": {
    "background": {
      "primary": {
        "$type": "color",
        "$value": "{color.blue.500}"
      }
    }
  }
}
```

### `outputReferences` for CSS Variable Chaining

Style Dictionary's `outputReferences: true` option causes the CSS output to use `var()` references instead of resolved values:
```css
--quieto-semantic-color-background-primary: var(--quieto-color-blue-500);
```
This is the preferred output because it preserves the token hierarchy in CSS and allows primitive overrides to cascade to semantics.

### What NOT to Build

- Do NOT implement Figma/Tokens Studio JSON output (Story 4.1)
- Do NOT implement iOS or Android output (Stories 4.2, 4.3)
- Do NOT implement config file generation (Story 1.9)
- Do NOT add sourcemap generation for CSS
- Do NOT implement `--dry-run` behavior yet (Story 3.3)

### File Structure

```
src/
├── output/
│   ├── json-writer.ts              # NEW — DTCG JSON serialization to disk
│   └── style-dictionary.ts         # NEW — SD v5 programmatic config and build
├── generators/                     # From Stories 1.3–1.6
├── mappers/                        # From Story 1.5
├── ui/                             # From Story 1.7
├── types/
│   └── tokens.ts                   # May add OutputResult type
```

### Previous Story Intelligence

- **ThemeCollection from 1.6:** Contains primitives + themed semantics
- **Overrides from 1.7:** Map of semantic paths to new primitive references (already applied to in-memory tokens)
- **Token path arrays:** Each token has a `path` array that maps directly to the JSON nesting structure
- **Pipeline pattern:** Output step receives finalized, confirmed ThemeCollection

### References

- [Source: docs/planning/epics.md#Story 1.8] — Acceptance criteria and story statement
- [Source: docs/oss-tokens-system-planning.md] — Repository layout, tiered token directories, Style Dictionary config
- [Source: docs/brainstorming/brainstorming-session-2026-04-16-1200.md#Blue Hat] — Phase 1 MVP includes DTCG JSON + CSS output
- [Source: Style Dictionary v5.4.0] — Programmatic API, DTCG format support, `outputReferences`, `css/variables` format
- [Source: DTCG spec] — `$type`, `$value`, `$description` format, reference syntax

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (Cursor)

### Debug Log References

- `npm test` → 14 files / 212 tests passed (includes 9 new json-writer tests, 8 new style-dictionary tests, 5 new output pipeline tests)
- `npm run type-check` → clean
- `npm run build` → clean; dist/cli.js 38.35 KB, dist/index.js 38.19 KB
- End-to-end smoke (`runOutputGeneration` against a real temp directory) verified:
  - 9 DTCG JSON files (3 primitive + 3 × 2 themes semantic)
  - 3 CSS files: `build/primitives.css` (42 vars), `build/light.css` (35 vars), `build/dark.css` (35 vars scoped under `[data-theme="dark"]`)
  - Semantic variables resolve via `var()` chains (e.g. `--quieto-semantic-color-background-primary: var(--quieto-color-violet-500)`) because `outputReferences: true` is set on the SD platform.

### Completion Notes List

- Added Style Dictionary v5.4.0 as a runtime dependency. SD's native DTCG support (`usesDtcg: true` on the config) consumes `$value`/`$type` directly, so no custom preprocessor was required.
- **DTCG JSON serializer** (`src/output/json-writer.ts`) walks the token `path` array into a nested tree of `{$type, $value}` leaves and writes one file per category (`color`/`spacing`/`typography`) under `tokens/primitive/` and `tokens/semantic/<theme>/`. Missing categories are skipped so the output stays minimal.
- **Naming decision for semantic tokens:** story Task 3.5 specifies CSS variables like `--quieto-semantic-color-background-primary`. To achieve this via SD's `transformGroup: 'css'` (which kebab-joins the token path), the JSON writer nests semantic trees under a top-level `semantic.*` key before serialization. Primitive refs (`{color.blue.500}`) stay untouched and continue to resolve against the global token tree.
- **Style Dictionary orchestration** (`src/output/style-dictionary.ts`) uses three code paths:
  - Single theme (`themes.length === 1`): one SD build → `build/tokens.css` with `:root` scope containing primitives + semantics.
  - Multi theme: one build for primitives-only → `build/primitives.css`, then one build per theme filtered to semantic tokens → `build/<theme>.css`. Dark theme scopes under `[data-theme="dark"]`, light stays on `:root`.
  - `outputReferences: true` is set on every file so semantic CSS variables reference primitive CSS variables rather than resolving to hex literals — preserves the cascade per Dev Notes.
- **Progress narrative** (`src/pipeline/output.ts`) uses Clack `log.step()` for phase headers and `log.info()` for per-file lines, re-reads each generated CSS file to count `--*:` variable declarations for the "(N variables)" suffix, and converts absolute paths to repo-relative paths for readable output.
- **Error handling:** JSON write failures and SD build failures are caught, surfaced via `p.log.error` with a remediation hint, and cause `runOutputGeneration` to return `null` so the init command bails out cleanly instead of throwing.
- **Public API surface:** re-exported `writeTokensToJson`, `buildCss`, `runOutputGeneration`, and the `OutputResult` type from `src/index.ts`. `tokensToDtcgTree` remains module-local (reviewer-scoped decision) to keep the semver surface tight.

### File List

- `package.json` — added `style-dictionary@^5.4.0` as a runtime dependency.
- `src/types/tokens.ts` — added optional `description?: string` to `PrimitiveToken` and `SemanticToken` (review: D1).
- `src/types/__fixtures__/tokens.ts` — NEW (review: P10). Shared test fixtures (`makeColorPrimitive`, `sampleCollection`, etc.) used by output and pipeline tests.
- `src/output/json-writer.ts` — NEW. DTCG JSON tree builder + per-category writer. Post-review: flat semantic JSON (no `semantic.*` wrapper), emits `$description` when present, throws on duplicate paths and leaf-vs-group collisions, guards against duplicate theme names.
- `src/output/__tests__/json-writer.test.ts` — NEW. Tests cover tree shape, DTCG format, per-theme layout, ref preservation, mkdir behavior, empty-category skipping, `$description` emission, and the duplicate/collision guards.
- `src/output/style-dictionary.ts` — NEW. SD v5 programmatic config with explicit `transforms: [...]` arrays and a custom `name/quieto` name transform that injects a `semantic-` segment for tokens under `tokens/semantic/**`. `brokenReferences: "throw"` so bad DTCG refs fail loudly.
- `src/output/__tests__/style-dictionary.test.ts` — NEW. Tests cover single-theme output, `--quieto-` prefix, `--quieto-semantic-*` names, multi-theme splits, dark selector, `var()` chaining, and filter correctness. Now imports shared fixtures.
- `src/pipeline/output.ts` — NEW. Orchestrator that runs both writers, narrates progress, counts CSS vars (block-comment-aware), and returns an `OutputResult` (or `null` on failure). `formatPath` uses `process.cwd()` as the relative base.
- `src/pipeline/__tests__/output.test.ts` — NEW. Tests cover JSON+CSS output, step/info narration, variable-count reporting, and the error path (via hoisted `vi.mock` of `writeTokensToJson`).
- `src/commands/init.ts` — wires `runOutputGeneration` in after `previewAndConfirm` and sets `process.exitCode = 1` when the output pipeline fails.
- `src/index.ts` — re-exports the new public symbols (`writeTokensToJson`, `buildCss`, `runOutputGeneration`, `OutputResult`).

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-04-16 | Implemented DTCG JSON + Style Dictionary v5 CSS output pipeline and wired into `init`. | Claude Opus 4.7 (dev) |
| 2026-04-16 | Code review (3-layer adversarial). 3 decision-needed, 12 patch, 13 defer, 7 dismissed. | Claude Opus 4.7 (reviewer) |
| 2026-04-16 | Applied all 15 review patches (including decisions: description plumbing, flat semantic JSON + `name/quieto` transform, trimmed public API). 219 tests, type-check, and build all clean. | Claude Opus 4.7 (reviewer) |

### Review Findings

- [x] [Review][Decision → Patch] AC #2 $description emission — **Resolved (Option 1): pipe descriptions through the plumbing.** Added optional `description?: string` to `PrimitiveToken`/`SemanticToken` (`src/types/tokens.ts`); `tokensToDtcgTree` now emits `$description` when a token carries a non-empty description (`src/output/json-writer.ts`). Generators keep emitting description-less tokens today — `$description` backfill per category is deferred, but the type/serializer plumbing is spec-compliant.
- [x] [Review][Decision → Patch] Semantic JSON tree shape — **Resolved (Option 2): flatten the JSON and use a custom name transform.** Removed the `withSemanticPrefix` wrapper so semantic JSON is flat (`color.background.primary` at root), matching the Dev Notes DTCG example. Registered a new `name/quieto` Style Dictionary transform that mirrors the default `name/kebab` behaviour and injects a `semantic` segment when the token's `filePath` is under `tokens/semantic/` — producing `--quieto-semantic-color-background-primary` without touching on-disk JSON. CSS platform configs now use an explicit `transforms: [...]` array with `name/quieto` swapped in for `name/kebab`.
- [x] [Review][Decision → Patch] Public API surface of `tokensToDtcgTree` — **Resolved (Option 2): drop from public surface.** `src/index.ts` now re-exports only `writeTokensToJson`, `buildCss`, `runOutputGeneration`, and the `OutputResult` type.

- [x] [Review][Patch] Remove dead `void isPrimitiveToken` / unused helper [src/output/style-dictionary.ts]
- [x] [Review][Patch] Set `errors.brokenReferences: "throw"` on SD configs so bad semantic refs fail loudly instead of emitting `undefined` CSS [src/output/style-dictionary.ts]
- [x] [Review][Patch] Add a comment in `runThemeSemantics` explaining why primitives are sourced-then-filtered (required for `outputReferences` resolution) [src/output/style-dictionary.ts]
- [x] [Review][Patch] Throw on path conflicts and duplicate paths in `tokensToDtcgTree` (currently silently overwrites) [src/output/json-writer.ts]
- [x] [Review][Patch] Strip CSS block comments before counting `--*:` matches so "(N variables)" doesn't over-report [src/pipeline/output.ts]
- [x] [Review][Patch] `formatPath` now uses `process.cwd()` as its base (dropped the caller-supplied `outputDir` parameter) [src/pipeline/output.ts]
- [x] [Review][Patch] Set `process.exitCode = 1` in `initCommand` when `runOutputGeneration` returns `null` so CI sees the failure [src/commands/init.ts]
- [x] [Review][Patch] Replaced the null-byte `bogusDir` error-path test with a hoisted `vi.mock` + `mockRejectedValueOnce` on `writeTokensToJson` (avoids ESM spy restrictions while exercising the real error handler) [src/pipeline/__tests__/output.test.ts]
- [x] [Review][Patch] Removed the editorial "(last_updated refreshed when 1.8 moved to review)" comment from sprint-status.yaml [docs/planning/sprint-status.yaml]
- [x] [Review][Patch] Extracted duplicated test fixtures into `src/types/__fixtures__/tokens.ts`; json-writer and style-dictionary tests now import from it.
- [x] [Review][Patch] Cleaned up `TokenLike`: dropped unused `attributes` field and made `path` required [src/output/style-dictionary.ts]
- [x] [Review][Patch] Guard against duplicate theme names in `writeTokensToJson` — throws early with a clear message [src/output/json-writer.ts]

- [x] [Review][Defer] Atomic writes (write-to-temp-then-rename) — deferred, robustness enhancement; Task 5.4 only requires clear error messages, not atomicity [src/output/json-writer.ts, src/pipeline/output.ts]
- [x] [Review][Defer] Stale output cleanup / manifest tracking when theme set changes between runs — deferred, belongs to Story 1.1's "modify vs fresh" flow or a future re-entrant editing story [src/pipeline/output.ts]
- [x] [Review][Defer] Arbitrary theme selector configuration for >2 themes — deferred, Story 1.6 only generates "light"/"dark"/"default"; >2 themes is future scope [src/output/style-dictionary.ts:~153-157]
- [x] [Review][Defer] Collapse 3 SD builds into one via multiple `files` entries — deferred, performance optimization; current approach is correct and test-covered [src/output/style-dictionary.ts]
- [x] [Review][Defer] Group-level DTCG `$type` inheritance support — deferred, DTCG v2025.10 advanced feature not required by AC [src/output/json-writer.ts:~46-48]
- [x] [Review][Defer] Path/type validation at the serializer boundary — deferred, validation currently lives at the generator boundary and no user-supplied tokens flow in yet [src/output/json-writer.ts]
- [x] [Review][Defer] Token `name` vs `path` schema drift — deferred, pre-existing inconsistency from earlier stories; touching it is cross-cutting [src/types/tokens.ts]
- [x] [Review][Defer] `OutputResult` as a discriminated union per-phase failure — deferred, feature enhancement; current null-vs-result is sufficient for init [src/pipeline/output.ts:~5-8]
- [x] [Review][Defer] Test-fixture pattern cleanup (vi.clearAllMocks + per-test dynamic imports) — deferred, pre-existing project test style used in preview.test.ts [src/pipeline/__tests__/output.test.ts, src/ui/__tests__/preview.test.ts]
- [x] [Review][Defer] End-to-end integration test wiring `initCommand` through to file writes — deferred, Test Architect territory per the project template [src/commands/__tests__/]
- [x] [Review][Defer] Replace hand-rolled `toPosix` with `path.posix.join`/`upath` — deferred, current implementation works on macOS/Linux; Windows support isn't in MVP CI [src/output/style-dictionary.ts:~6-8]
- [x] [Review][Defer] SD source glob whitelist to prevent junk JSON — deferred, only matters when a future story lets users hand-author files in `tokens/` [src/output/style-dictionary.ts:~22-25]
- [x] [Review][Defer] Destructive write protection / backup on re-run — deferred, already handled upstream via Story 1.1's "modify vs fresh" prompt; a backup feature is future scope [src/commands/init.ts, src/pipeline/output.ts]



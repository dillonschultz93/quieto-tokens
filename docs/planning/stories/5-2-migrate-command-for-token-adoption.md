# Story 5.2: Migrate Command for Token Adoption

Status: done

## Story

As a **solo developer with an existing codebase**,
I want to scan my CSS files and find hardcoded values that match my generated tokens,
so that I can systematically replace raw values with token references and actually adopt my design system.

## Story Scope Note

This is the **second and final story of Epic 5** and introduces the `migrate` CLI command. Unlike `inspect` (Story 5.1) which analyzes the token system itself, `migrate` scans the user's *application code* for hardcoded values that could be replaced with token references. It has two modes: `--scan` (read-only report) and `--apply` (automatic replacement).

**What this story IS:**
- A new `quieto-tokens migrate --scan ./src` command that scans CSS, SCSS, and style files for hardcoded values matching token values.
- Matching hex color values against primitive color tokens.
- Matching pixel values against spacing and typography token values.
- A migration report: file path, line number, hardcoded value, and suggested token replacement.
- Confidence levels: exact match vs approximate match.
- A summary: total replaceable values, estimated adoption coverage.
- An `--apply ./src` mode that performs automatic replacements (requires git clean state or creates backups).
- An `--output migration-report.md` flag for file-based reports.

**What this story is NOT:**
- Not a linter or CI check — it's a one-time migration aid.
- Not a JavaScript/TypeScript AST parser — it scans style declarations in CSS/SCSS files via regex patterns.
- Not a token generator — it reads existing tokens and matches against application code.

## Acceptance Criteria

### Scan mode

1. **Given** a generated token system and an existing codebase, **When** the user runs `quieto-tokens migrate --scan ./src`, **Then** the CLI scans all `.css`, `.scss`, and style-related files in the target directory recursively.
2. **Given** the scan finds hardcoded hex color values (e.g., `#3b82f6`), **When** they match a primitive color token's `$value`, **Then** the match is reported with: file path, line number, the hardcoded value, and the suggested CSS custom property replacement (e.g., `var(--quieto-color-blue-500)`).
3. **Given** the scan finds hardcoded pixel values (e.g., `16px`, `0.25rem`), **When** they match a spacing or typography token's `$value`, **Then** the match is reported with the suggested token replacement.
4. **Given** matches are found, **When** the report is displayed, **Then** matches are grouped by confidence level:
   - **Exact match:** the hardcoded value exactly matches a token's resolved value.
   - **Approximate match:** the hardcoded value is close but not identical (e.g., `#3a82f6` is 1 digit off from `#3b82f6`, or `15px` is close to a `16px` token).
5. **Given** the scan completes, **When** the summary is displayed, **Then** it shows: total files scanned, total matches found, breakdown by confidence, and estimated adoption coverage (percentage of hardcoded values that have token equivalents).

### Apply mode

6. **Given** the user runs `quieto-tokens migrate --apply ./src`, **When** the working directory has uncommitted git changes, **Then** the CLI warns and requires confirmation: "You have uncommitted changes. Automatic replacements will modify your files. Continue? (y/N)".
7. **Given** the user confirms (or the working directory is git-clean), **When** `--apply` runs, **Then** only exact-match replacements are performed automatically. Approximate matches are reported but not applied.
8. **Given** replacements are applied, **When** a file is modified, **Then** only the specific value on the specific line is replaced — surrounding code is untouched. The replacement uses `var(--quieto-<token-path>)` syntax.
9. **Given** the apply completes, **When** the summary is displayed, **Then** it shows: number of replacements made, number of files modified, and number of approximate matches skipped (for manual review).

### Report output

10. **Given** the user passes `--output migration-report.md`, **When** the scan or apply completes, **Then** the full report is written to the specified file as structured markdown.
11. **Given** the report file, **When** opened in a markdown viewer, **Then** it renders as readable documentation with file paths, line numbers, and suggested replacements.

### Edge cases

12. **Given** no token system exists, **When** the user runs `migrate`, **Then** a helpful error is shown: "No token system found. Run `quieto-tokens init` first."
13. **Given** the scan directory doesn't exist, **When** the user runs `migrate --scan ./nonexistent`, **Then** an error is shown: "Directory not found: ./nonexistent".
14. **Given** no matches are found, **When** the scan completes, **Then** a success message is shown: "No hardcoded values found that match your token system. Your codebase may already be using tokens!"
15. **Given** CSS files contain `var(--quieto-*)` references, **When** scanning, **Then** those lines are skipped (already using tokens).

## Tasks / Subtasks

- [x] **Task 1: CLI routing for `migrate` (AC: #12, #13)**
  - [x] 1.1: In `src/cli.ts`, add `migrate` to the `switch` statement in `runCli`.
  - [x] 1.2: Add `parseMigrateArgs(args)` returning `{ mode: "scan" | "apply"; target: string; output?: string; unknown: string[] }`.
  - [x] 1.3: Validate: `--scan` or `--apply` is required; target directory is required. Error on unknown flags.
  - [x] 1.4: Update `HELP_TEXT` to include the `migrate` command with `--scan`, `--apply`, and `--output` options.
  - [x] 1.5: Wire to `migrateCommand(opts)` in a new `src/commands/migrate.ts`.

- [x] **Task 2: Token value index builder (AC: #2, #3)**
  - [x] 2.1: Create `src/analysis/token-index.ts` exporting:
    ```typescript
    export interface TokenEntry {
      cssVar: string;         // e.g., "var(--quieto-color-blue-500)"
      rawValue: string;       // e.g., "#3b82f6"
      tokenPath: string[];
      category: string;
      tier: string;
    }
    export interface TokenIndex {
      colorsByHex: Map<string, TokenEntry>;       // lowercase hex → entry
      spacingByPx: Map<number, TokenEntry>;       // px value → entry
      typographyByValue: Map<string, TokenEntry>; // value string → entry
    }
    export function buildTokenIndex(system: LoadedTokenSystem): TokenIndex;
    ```
  - [x] 2.2: `buildTokenIndex` iterates all primitives and builds lookup maps. Color hex values are normalized to lowercase 6-digit. Spacing dimensions are converted to pixel numbers. Typography values indexed by their raw value.
  - [x] 2.3: The CSS variable name is computed using the same `name/quieto` logic: `--quieto-<path-joined-by-dash>` for primitives, `--quieto-semantic-<path>` for semantics.
  - [x] 2.4: Reuse `LoadedTokenSystem` from Story 5.1's `src/analysis/token-loader.ts`.

- [x] **Task 3: File scanner (AC: #1, #4, #15)**
  - [x] 3.1: Create `src/analysis/scanner.ts` exporting:
    ```typescript
    export interface ScanMatch {
      filePath: string;
      line: number;
      column: number;
      hardcodedValue: string;
      suggestedReplacement: string;
      confidence: "exact" | "approximate";
      category: string;
    }
    export interface ScanResult {
      matches: ScanMatch[];
      filesScanned: number;
      filesWithMatches: number;
    }
    export async function scanDirectory(
      dir: string,
      index: TokenIndex,
    ): Promise<ScanResult>;
    ```
  - [x] 3.2: Recursively find all `.css`, `.scss`, `.sass`, `.less`, and `.styl` files in the target directory. Use `node:fs` + `node:path` — no glob library needed.
  - [x] 3.3: For each file, read line by line. Skip lines containing `var(--quieto-` (already tokenized).
  - [x] 3.4: Match hex colors via regex: `/#[0-9a-fA-F]{3,8}\b/`. Normalize to 6-digit lowercase and look up in `colorsByHex`. Exact if found; approximate if within Euclidean distance threshold in RGB space.
  - [x] 3.5: Match pixel values via regex: `/\b(\d+(?:\.\d+)?)(px|rem|em)\b/`. Convert to px (rem × 16). Look up in `spacingByPx`. Exact if matches; approximate if within 1px.
  - [x] 3.6: Skip CSS custom property declarations (`--quieto-*:`) — these are token definitions, not hardcoded values.

- [x] **Task 4: Approximate matching (AC: #4)**
  - [x] 4.1: In `src/analysis/scanner.ts`, implement color distance: Euclidean distance in RGB space. Threshold: distance < 10 (out of 255 per channel) for approximate match.
  - [x] 4.2: For spacing, approximate: value within ±1px of any token value.
  - [x] 4.3: Approximate matches include the closest token and the distance/difference in the report.

- [x] **Task 5: Apply engine (AC: #6, #7, #8, #9)**
  - [x] 5.1: Create `src/analysis/applier.ts` exporting:
    ```typescript
    export interface ApplyResult {
      replacementsMade: number;
      filesModified: number;
      approximateSkipped: number;
    }
    export async function applyReplacements(
      matches: ScanMatch[],
      cwd: string,
    ): Promise<ApplyResult>;
    ```
  - [x] 5.2: Filter matches to `confidence === "exact"` only.
  - [x] 5.3: Group by file path. For each file, read contents, apply replacements from bottom to top (to preserve line numbers), write back.
  - [x] 5.4: Use atomic write (tmp + rename) for each modified file.

- [x] **Task 6: Git clean check (AC: #6)**
  - [x] 6.1: Before apply, run `git status --porcelain` via `child_process.execSync`. If output is non-empty, warn and prompt for confirmation via `p.confirm`.
  - [x] 6.2: If user declines, abort with a non-error exit.

- [x] **Task 7: Report renderer (AC: #5, #9, #10, #11)**
  - [x] 7.1: Create `src/analysis/migration-report.ts` exporting:
    ```typescript
    export function renderMigrationTerminalReport(result: ScanResult, applyResult?: ApplyResult): void;
    export function renderMigrationMarkdownReport(result: ScanResult, applyResult?: ApplyResult): string;
    ```
  - [x] 7.2: Terminal report: summary stats, then grouped matches by confidence with file:line references.
  - [x] 7.3: Markdown report: tables with file path, line, hardcoded value, suggested replacement, confidence.

- [x] **Task 8: Migrate command orchestrator (AC: all)**
  - [x] 8.1: Create `src/commands/migrate.ts`:
    ```typescript
    export async function migrateCommand(opts: {
      mode: "scan" | "apply";
      target: string;
      output?: string;
    }): Promise<void>;
    ```
  - [x] 8.2: Flow: load token system → build index → scan directory → render report → (if apply: git check → apply → render apply summary) → (if --output: write markdown).

- [x] **Task 9: Tests (AC: all)**
  - [x] 9.1: `src/analysis/__tests__/token-index.test.ts` — builds correct lookup maps from token system.
  - [x] 9.2: `src/analysis/__tests__/scanner.test.ts`:
    - Detects hex colors in CSS files.
    - Detects pixel values in CSS files.
    - Skips lines already using `var(--quieto-*)`.
    - Correctly classifies exact vs approximate matches.
    - Handles .scss, .sass, .less file extensions.
  - [x] 9.3: `src/analysis/__tests__/applier.test.ts`:
    - Only applies exact matches.
    - Preserves file contents outside the replacement.
    - Handles multiple replacements in one file.
    - Bottom-to-top replacement preserves line numbers.
  - [x] 9.4: `src/analysis/__tests__/migration-report.test.ts` — markdown output format.
  - [x] 9.5: `src/commands/__tests__/migrate.test.ts` — CLI routing, --scan/--apply, missing directory error.
  - [x] 9.6: `npm run type-check`, `npm test`, `npm run build`, `npm run validate:sprint` — all clean.

- [x] **Task 10: Close-out**
  - [x] 10.1: Update README.md to document the `migrate` command with `--scan` and `--apply` modes.
  - [x] 10.2: Update `src/pipeline/config.ts` "What's next" to mention `migrate`.
  - [x] 10.3: Move this story to `review`, then to `done` after code review.

### Review Findings

- [x] [Review][Patch] Apply-mode safety: create backups before modifying files [src/analysis/applier.ts:92] — `--apply` now writes a per-file backup (`.quieto-bak`) the first time a file is modified.
- [x] [Review][Patch] Typography value matching (AC #3) [src/analysis/scanner.ts:230] — scanner now matches typography dimension tokens and reports them as `category: "typography"`.
- [x] [Review][Patch] Prevent alpha hex from being treated as exact/applyable [src/analysis/scanner.ts:206] — alpha-bearing hex values are never emitted as `confidence: "exact"`.
- [x] [Review][Patch] Column reporting stability for apply [src/analysis/scanner.ts:195] — columns are now derived from the original source line via substring search.
- [x] [Review][Patch] Skip scanning common build/vendor dirs [src/analysis/scanner.ts:28] — added an ignore list (e.g. `node_modules`, `dist`, `build`).
- [x] [Review][Patch] Harden apply path resolution for absolute/Windows paths [src/analysis/applier.ts:55] — switched to `path.resolve(cwd, filePath)` instead of `startsWith` + `join`.
- [x] [Review][Patch] Reduce wrong-occurrence replacements on same line [src/analysis/applier.ts:24] — apply prefers exact replacement at the reported column before falling back to `indexOf`.

## Dev Notes

### Relevant ADRs

- **[ADR-001](../architecture/adr-001-non-destructive-json-merge.md)** — The `migrate` command reads token source files but only writes to the user's *application* CSS files (not `tokens/`). The config-as-manifest principle means `quieto.config.json` is the canonical token list for building the index.

### Previous Story Intelligence

**From Story 5.1 (inspect command):**
- `loadTokenSystem` in `src/analysis/token-loader.ts` is already available for loading the token system from disk. Reuse it directly — do NOT create a separate loader.
- The `src/analysis/` directory structure is established. Add new modules there.
- The CLI routing pattern for `inspect` (parseArgs, command wire-up, HELP_TEXT) serves as the template for `migrate`.

**From Story 1.8 (DTCG JSON and CSS output):**
- Token naming follows the `name/quieto` transform: `--quieto-<category>-<...path>` for primitives, `--quieto-semantic-<category>-<...path>` for semantics. The migration replacements must use these exact CSS variable names.
- The `QUIETO_NAME_TRANSFORM` logic in `src/output/style-dictionary.ts` (lines 53–84) is the source of truth for how token paths map to CSS variable names. The token index builder should replicate this logic to produce correct `var()` replacements.

**From Story 1.7 (preview and override):**
- `src/ui/preview.ts` has `resolveHex` which resolves DTCG reference chains to final hex values. May be useful for resolving semantic token references when building the index, but the scanner primarily matches against primitive raw values.

**From Story 3.3 (dry-run mode):**
- `--scan` is inherently read-only (no `--dry-run` needed). `--apply` modifies files but has its own git-clean guard. No dry-run integration needed for `migrate`.

### CSS Variable Name Mapping

The scanner must produce correct `var()` suggestions. The mapping from token path to CSS variable:

```
Primitive:  color.blue.500      → var(--quieto-color-blue-500)
Semantic:   color.background.primary → var(--quieto-semantic-color-background-primary)
Component:  button.color-background.default → var(--quieto-component-button-color-background)
```

The `name/quieto` transform (lines 53–84 of `style-dictionary.ts`) handles the tier prefix injection. Replicate this logic in the token index builder to avoid depending on Style Dictionary at analysis time.

### Scanning Strategy

CSS declarations follow `property: value;` patterns. The scanner matches *values* (right side of `:`) against token values. It should NOT match property names, selectors, or comments.

A simple line-by-line regex approach is sufficient for MVP:
1. Strip CSS comments (`/* ... */`).
2. For each line, find value segments after `:`.
3. Match hex colors and dimension values within those segments.

This won't handle multi-line values or complex shorthand properties perfectly, but covers the 90% case for a migration aid.

### Color Matching Details

- Normalize all hex values to 6-digit lowercase for comparison.
- 3-digit hex shorthand (`#3bf`) expands to 6-digit (`#33bbff`).
- 8-digit hex with alpha (`#3b82f6ff`) strips alpha for comparison.
- `rgb()` and `hsl()` functions are out of scope for MVP — only hex matching.

### Technical Stack

| Concern | Choice | Version |
|---------|--------|---------|
| Runtime | Node.js | >=18 (LTS) |
| Language | TypeScript | ^5.x |
| Build | tsup | ^8.x |
| CLI prompts | `@clack/prompts` | ^1.2.0 |
| Test runner | Vitest | ^4.x |
| Color engine | `@quieto/engine` | ^0.1.1 |

### What NOT to Build

- **Do NOT parse JavaScript/TypeScript AST.** The scanner reads CSS/SCSS style files only. Inline styles in JSX are out of scope.
- **Do NOT match `rgb()`, `hsl()`, or other CSS color functions.** Hex-only matching for MVP.
- **Do NOT auto-apply approximate matches.** Only exact matches are applied; approximate matches are reported for manual review.
- **Do NOT add a watch mode or CI integration.** `migrate` is a one-time migration aid.
- **Do NOT depend on Style Dictionary** for the scanner. Build the token index from raw DTCG JSON.
- **Do NOT add the `inspect` command.** That's Story 5.1.
- **Do NOT migrate `compareVersions`, extract the shared version resolver, or add lockfile protection.** All still deferred per `docs/planning/deferred-work.md`.

### File Structure (final target)

```
src/
├── cli.ts                            ← modified (add migrate command routing)
├── commands/
│   ├── migrate.ts                    ← NEW (migrateCommand orchestrator)
│   ├── __tests__/
│   │   ├── migrate.test.ts           ← NEW
│   │   └── ...
│   └── ...
├── analysis/
│   ├── token-loader.ts               ← REUSED from Story 5.1
│   ├── token-index.ts                ← NEW (buildTokenIndex)
│   ├── scanner.ts                    ← NEW (scanDirectory)
│   ├── applier.ts                    ← NEW (applyReplacements)
│   ├── migration-report.ts           ← NEW (renderMigrationTerminalReport, renderMigrationMarkdownReport)
│   ├── __tests__/
│   │   ├── token-index.test.ts       ← NEW
│   │   ├── scanner.test.ts           ← NEW
│   │   ├── applier.test.ts           ← NEW
│   │   ├── migration-report.test.ts  ← NEW
│   │   └── ...
│   └── ...
```

### References

- [Source: docs/planning/epics.md#Story 5.2: Migrate Command for Token Adoption]
- [Source: src/cli.ts] — HELP_TEXT, command routing, parseArgs pattern
- [Source: src/output/style-dictionary.ts#QUIETO_NAME_TRANSFORM] — name/quieto transform (lines 53–84), CSS variable naming logic
- [Source: src/types/tokens.ts] — PrimitiveToken, SemanticToken, token path structure
- [Source: src/types/config.ts] — QuietoConfig, categories
- [Source: docs/planning/stories/5-1-inspect-command-for-design-system-health.md] — loadTokenSystem, analysis/ directory, CLI routing pattern
- [Source: src/ui/preview.ts] — resolveHex, color utilities
- [Source: docs/planning/deferred-work.md] — deferred items that remain out of scope

## Dev Agent Record

### Agent Model Used

GPT-5.2

### Debug Log References

- `npm run type-check`
- `npm test`
- `npm run build`
- `npm run validate:sprint`
### Completion Notes List

- Implemented `quieto-tokens migrate` with `--scan` and `--apply` modes.
- Added token indexing (`token-index`), directory scanner (`scanner`), and exact-match applier (`applier`).
- Added terminal + markdown report renderers with confidence grouping and adoption coverage estimation.
- Added Vitest coverage for token-index, scanner, applier, markdown renderer, CLI routing, and migrate command behavior.
- Updated docs (`README.md`) and pipeline "What's next" to mention `migrate`.

### File List

- docs/planning/sprint-status.yaml
- docs/planning/stories/5-2-migrate-command-for-token-adoption.md
- README.md
- src/cli.ts
- src/pipeline/config.ts
- src/commands/migrate.ts
- src/commands/__tests__/migrate.test.ts
- src/analysis/token-index.ts
- src/analysis/scanner.ts
- src/analysis/applier.ts
- src/analysis/migration-report.ts
- src/analysis/__tests__/token-index.test.ts
- src/analysis/__tests__/scanner.test.ts
- src/analysis/__tests__/applier.test.ts
- src/analysis/__tests__/migration-report.test.ts
- src/__tests__/cli.test.ts

### Change Log

- 2026-04-23: Added `migrate` command (scan/apply) and supporting analysis modules + tests.

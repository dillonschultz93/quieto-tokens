# Story 5.1: Inspect Command for Design System Health

Status: ready-for-dev

## Story

As a **solo developer maintaining a growing token system**,
I want to analyze my token system's structure and health,
so that I can identify issues like orphaned tokens, broken references, or imbalanced coverage before they cause problems.

## Story Scope Note

This is the **first story of Epic 5** and introduces a new `inspect` CLI command. Unlike Epics 1–4 which generate tokens, this story is read-only — it loads and analyzes the existing DTCG JSON source files without modifying them. The command produces a terminal report with summary statistics, issue detection, and WCAG contrast analysis.

**What this story IS:**
- A new `quieto-tokens inspect` command that loads all token files across all tiers.
- A summary report: total token count by tier, count by category, theme count.
- Orphan detection: primitive tokens not referenced by any semantic token.
- Broken reference detection: semantic/component tokens pointing to non-existent primitives.
- Naming convention validation against the project's naming algorithm.
- WCAG AA contrast checking between paired text/background semantic color tokens.
- Terminal display with pass/fail indicators.
- Optional `--output report.md` flag to write the report to a file.

**What this story is NOT:**
- Not a token modification tool — `inspect` is read-only.
- Not the `migrate` command — that's Story 5.2.
- Not a CI integration (no exit-code-on-failure) — the report is informational for the developer.

## Acceptance Criteria

### Token loading and summary

1. **Given** a generated token system with DTCG JSON source files, **When** the user runs `quieto-tokens inspect`, **Then** the CLI loads and parses all token files from `tokens/primitive/`, `tokens/semantic/`, and `tokens/component/` directories.
2. **Given** the tokens are loaded, **When** the summary is displayed, **Then** it shows:
   - Total token count by tier (primitives, semantic per theme, components).
   - Token count by category (color, spacing, typography, shadow, border, animation, etc.).
   - Number of themes detected.
3. **Given** no token system exists (no `tokens/` directory or no `quieto.config.json`), **When** the user runs `inspect`, **Then** a helpful error message is shown: "No token system found. Run `quieto-tokens init` first."

### Orphan detection

4. **Given** primitive tokens exist, **When** the inspector analyzes references, **Then** it identifies primitive tokens not referenced by any semantic token across any theme.
5. **Given** orphaned primitives are found, **When** the report is displayed, **Then** they are listed under an "Orphaned Primitives" section with the token path and category.

### Broken reference detection

6. **Given** semantic tokens with DTCG references (e.g., `{color.blue.500}`), **When** the inspector resolves references, **Then** it identifies any references pointing to non-existent primitive tokens.
7. **Given** component tokens with references, **When** the inspector resolves references, **Then** broken references in component tokens are also detected.
8. **Given** broken references are found, **When** the report is displayed, **Then** they are listed with: the referencing token path, the broken reference value, and the tier.

### Naming convention validation

9. **Given** all loaded tokens, **When** the inspector validates names, **Then** it checks each token path against the naming convention algorithm (the same `name/quieto` transform logic).
10. **Given** naming violations are found, **When** the report is displayed, **Then** they are listed with the offending token path and a description of the violation.

### WCAG contrast analysis

11. **Given** semantic color tokens with `background` and `content` (or `text`) in their paths, **When** the inspector analyzes color pairs, **Then** it computes contrast ratios between each background/content pair.
12. **Given** contrast pairs, **When** the report is displayed, **Then** each pair shows the contrast ratio and a pass/fail indicator against WCAG AA (4.5:1 for normal text).
13. **Given** failing contrast pairs, **When** the report is displayed, **Then** they are highlighted (fail indicator) so the developer can identify accessibility issues.

### Report output

14. **Given** the user runs `quieto-tokens inspect`, **When** the analysis completes, **Then** the full report is displayed in the terminal with clear section headings and pass/fail indicators using `@clack/prompts` formatting.
15. **Given** the user runs `quieto-tokens inspect --output report.md`, **When** the analysis completes, **Then** the report is also written to `report.md` as structured markdown.
16. **Given** the report is written to a file, **When** it is opened in a markdown viewer, **Then** it renders as readable documentation.

## Tasks / Subtasks

- [ ] **Task 1: CLI routing for `inspect` (AC: #3)**
  - [ ] 1.1: In `src/cli.ts`, add `inspect` to the `switch` statement in `runCli`. Parse args for `--output <path>`.
  - [ ] 1.2: Add `parseInspectArgs(args)` returning `{ output?: string; unknown: string[] }`.
  - [ ] 1.3: Update `HELP_TEXT` to include the `inspect` command and `--output` option.
  - [ ] 1.4: Wire to `inspectCommand({ output? })` in a new `src/commands/inspect.ts`.

- [ ] **Task 2: Token loader for inspection (AC: #1, #3)**
  - [ ] 2.1: Create `src/analysis/token-loader.ts` exporting:
    ```typescript
    export interface LoadedTokenSystem {
      primitives: PrimitiveToken[];
      themes: { name: string; semantics: SemanticToken[] }[];
      components: ComponentToken[];
      config: QuietoConfig;
    }
    export async function loadTokenSystem(cwd?: string): Promise<LoadedTokenSystem | null>;
    ```
  - [ ] 2.2: `loadTokenSystem` reads `quieto.config.json`, then scans `tokens/primitive/`, `tokens/semantic/<theme>/`, and `tokens/component/` directories. Parses each JSON file into the token type arrays.
  - [ ] 2.3: Return `null` if config or token directory doesn't exist (caller shows "no token system" error).
  - [ ] 2.4: Reuse the DTCG JSON parsing logic — tokens are stored with `$type` and `$value` fields. Walk the JSON tree to extract leaf tokens.

- [ ] **Task 3: Summary analyzer (AC: #2)**
  - [ ] 3.1: Create `src/analysis/summary.ts` exporting:
    ```typescript
    export interface TokenSummary {
      totalByTier: { primitive: number; semantic: number; component: number };
      byCategory: Record<string, { primitive: number; semantic: number; component: number }>;
      themeCount: number;
      themeNames: string[];
    }
    export function computeSummary(system: LoadedTokenSystem): TokenSummary;
    ```

- [ ] **Task 4: Orphan detector (AC: #4, #5)**
  - [ ] 4.1: Create `src/analysis/orphans.ts` exporting:
    ```typescript
    export interface OrphanedToken { path: string[]; category: string; }
    export function detectOrphans(system: LoadedTokenSystem): OrphanedToken[];
    ```
  - [ ] 4.2: Build a set of all DTCG reference strings used in semantic tokens across all themes. Compare against primitive token paths. Any primitive not referenced is orphaned.

- [ ] **Task 5: Broken reference detector (AC: #6, #7, #8)**
  - [ ] 5.1: Create `src/analysis/references.ts` exporting:
    ```typescript
    export interface BrokenReference {
      tokenPath: string[];
      tier: "semantic" | "component";
      referenceValue: string;
      theme?: string;
    }
    export function detectBrokenReferences(system: LoadedTokenSystem): BrokenReference[];
    ```
  - [ ] 5.2: For each semantic and component token, check if the `$value` is a DTCG reference (`{...}` pattern). Resolve it against the primitive token paths. Report unresolvable references.

- [ ] **Task 6: Naming validator (AC: #9, #10)**
  - [ ] 6.1: Create `src/analysis/naming.ts` exporting:
    ```typescript
    export interface NamingViolation {
      tokenPath: string[];
      tier: string;
      reason: string;
    }
    export function validateNaming(system: LoadedTokenSystem): NamingViolation[];
    ```
  - [ ] 6.2: Check token paths against expected patterns: lowercase, hyphen-separated segments, valid category prefixes. Flag paths with uppercase, special characters, or unexpected nesting depth.

- [ ] **Task 7: WCAG contrast analyzer (AC: #11, #12, #13)**
  - [ ] 7.1: Create `src/analysis/contrast.ts` exporting:
    ```typescript
    export interface ContrastPair {
      backgroundPath: string[];
      contentPath: string[];
      backgroundHex: string;
      contentHex: string;
      ratio: number;
      passAA: boolean;
      theme: string;
    }
    export function analyzeContrast(system: LoadedTokenSystem): ContrastPair[];
    ```
  - [ ] 7.2: Identify pairs by matching semantic color paths: tokens with `background` in the path are paired with tokens that have `content` (or `text`) at the same nesting level (e.g., `color.background.primary` ↔ `color.content.primary`).
  - [ ] 7.3: Resolve each semantic token's `$value` reference to the primitive's hex value. Compute contrast ratio using the WCAG luminance formula (relative luminance → contrast ratio).
  - [ ] 7.4: The contrast computation can use the same `hexToAnsi` / color-math utilities in `src/ui/preview.ts` if they expose luminance calculation, or implement the WCAG formula directly (it's ~15 lines).

- [ ] **Task 8: Report renderer (AC: #14, #15, #16)**
  - [ ] 8.1: Create `src/analysis/report.ts` exporting:
    ```typescript
    export interface InspectReport {
      summary: TokenSummary;
      orphans: OrphanedToken[];
      brokenRefs: BrokenReference[];
      namingViolations: NamingViolation[];
      contrastPairs: ContrastPair[];
    }
    export function renderTerminalReport(report: InspectReport): void;
    export function renderMarkdownReport(report: InspectReport): string;
    ```
  - [ ] 8.2: `renderTerminalReport` uses `@clack/prompts` (`p.log.info`, `p.log.warn`, `p.log.success`) to display each section with pass/fail indicators.
  - [ ] 8.3: `renderMarkdownReport` produces structured markdown with tables for summary, lists for issues, and contrast ratio tables.

- [ ] **Task 9: Inspect command orchestrator (AC: all)**
  - [ ] 9.1: Create `src/commands/inspect.ts`:
    ```typescript
    export async function inspectCommand(opts: { output?: string }): Promise<void>;
    ```
  - [ ] 9.2: Flow: load token system → compute summary → detect orphans → detect broken refs → validate naming → analyze contrast → build report → render terminal → optionally write markdown.
  - [ ] 9.3: On write failure for `--output` → `p.log.warn` (non-fatal).

- [ ] **Task 10: Tests (AC: all)**
  - [ ] 10.1: `src/analysis/__tests__/token-loader.test.ts` — loads test fixtures, returns null for missing system.
  - [ ] 10.2: `src/analysis/__tests__/orphans.test.ts` — detects orphaned primitives, empty when all referenced.
  - [ ] 10.3: `src/analysis/__tests__/references.test.ts` — detects broken refs, clean when all valid.
  - [ ] 10.4: `src/analysis/__tests__/naming.test.ts` — catches violations, passes clean names.
  - [ ] 10.5: `src/analysis/__tests__/contrast.test.ts` — correct ratio calculation, pass/fail thresholds.
  - [ ] 10.6: `src/analysis/__tests__/report.test.ts` — markdown output matches expected format.
  - [ ] 10.7: `src/commands/__tests__/inspect.test.ts` — CLI routing, `--output` flag, "no system" error.
  - [ ] 10.8: `npm run type-check`, `npm test`, `npm run build`, `npm run validate:sprint` — all clean.

- [ ] **Task 11: Close-out**
  - [ ] 11.1: Update README.md to document the `inspect` command.
  - [ ] 11.2: Update `src/pipeline/config.ts` "What's next" to mention `inspect`.
  - [ ] 11.3: Move this story to `review`, then to `done` after code review.

## Dev Notes

### Relevant ADRs

- **[ADR-001](../architecture/adr-001-non-destructive-json-merge.md)** — The `inspect` command is read-only. It reads the per-category JSON files described in ADR-001 but never writes to them.

### Previous Story Intelligence

**From Story 1.8 (DTCG JSON and CSS output):**
- Token JSON files follow DTCG format: `{ "$type": "color", "$value": "#3b82f6" }`. Semantic tokens use reference syntax: `{ "$value": "{color.blue.500}" }`. The inspector must parse both forms.
- File organization: `tokens/primitive/<category>.json`, `tokens/semantic/<theme>/<category>.json`, `tokens/component/<name>.json`. Use these glob patterns for loading.

**From Story 1.7 (preview and override):**
- `src/ui/preview.ts` has `hexToAnsi` and `resolveHex` helpers that deal with color values. It also annotates WCAG contrast in the preview. The contrast computation logic may be extractable or at minimum serves as a reference for the formula.
- `renderTokenCountSummary` in preview.ts already computes basic token counts — the inspector's summary is a more detailed version of this.

**From Story 3.1 (re-entrant editing):**
- `loadPrimitivesFromDisk` and `loadSemanticTokensFromDisk` helpers already exist for reading tokens from disk. Check if these can be reused by the token loader, or if they're too tightly coupled to the update flow.

**From Story 2.5 (animation ease path collision):**
- Token paths can have collisions or unexpected nesting. The naming validator should be aware of the path structure for all categories including `animation.ease.*`.

### WCAG Contrast Formula

The WCAG 2.1 relative luminance formula:
1. Convert hex to sRGB (0–1 range).
2. Linearize: `L = (c <= 0.04045) ? c / 12.92 : ((c + 0.055) / 1.055) ^ 2.4`.
3. Relative luminance: `Y = 0.2126 * R + 0.7152 * G + 0.0722 * B`.
4. Contrast ratio: `(L1 + 0.05) / (L2 + 0.05)` where `L1 >= L2`.
5. WCAG AA: >= 4.5:1 for normal text, >= 3:1 for large text (use 4.5:1 as default).

### Token Reference Pattern

DTCG references use `{path.to.token}` syntax. To detect if a `$value` is a reference, check for the pattern `/^\{.+\}$/`. To resolve it, strip the braces and split on `.` to get the token path, then look up in primitives.

### New `src/analysis/` Directory

This story introduces a new `src/analysis/` module directory. All inspection logic lives here — separate from `src/output/` (generation), `src/pipeline/` (orchestration), and `src/ui/` (prompts/display). The `inspect` command in `src/commands/` is a thin orchestrator that calls into `src/analysis/` functions.

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

- **Do NOT modify any token files.** `inspect` is read-only.
- **Do NOT add auto-fix capabilities.** The inspector reports issues; the developer decides how to fix them.
- **Do NOT add CI exit codes** (non-zero on failures). The report is informational. Future stories can add `--strict` mode.
- **Do NOT add the `migrate` command.** That's Story 5.2.
- **Do NOT import Style Dictionary** for the inspector. It reads raw DTCG JSON directly — no SD build needed for analysis.
- **Do NOT migrate `compareVersions`, extract the shared version resolver, or add lockfile protection.** All still deferred per `docs/planning/deferred-work.md`.

### File Structure (final target)

```
src/
├── cli.ts                            ← modified (add inspect command routing)
├── commands/
│   ├── inspect.ts                    ← NEW (inspectCommand orchestrator)
│   ├── __tests__/
│   │   ├── inspect.test.ts           ← NEW
│   │   └── ...
│   └── ...
├── analysis/                         ← NEW directory
│   ├── token-loader.ts               ← NEW (loadTokenSystem)
│   ├── summary.ts                    ← NEW (computeSummary)
│   ├── orphans.ts                    ← NEW (detectOrphans)
│   ├── references.ts                 ← NEW (detectBrokenReferences)
│   ├── naming.ts                     ← NEW (validateNaming)
│   ├── contrast.ts                   ← NEW (analyzeContrast)
│   ├── report.ts                     ← NEW (renderTerminalReport, renderMarkdownReport)
│   ├── __tests__/
│   │   ├── token-loader.test.ts      ← NEW
│   │   ├── orphans.test.ts           ← NEW
│   │   ├── references.test.ts        ← NEW
│   │   ├── naming.test.ts            ← NEW
│   │   ├── contrast.test.ts          ← NEW
│   │   └── report.test.ts            ← NEW
│   └── ...
```

### References

- [Source: docs/planning/epics.md#Story 5.1: Inspect Command for Design System Health]
- [Source: src/cli.ts] — HELP_TEXT, command routing, parseArgs pattern
- [Source: src/ui/preview.ts] — hexToAnsi, resolveHex, WCAG contrast annotations
- [Source: src/output/json-writer.ts] — DTCG JSON structure, composite value decoding
- [Source: src/types/tokens.ts] — PrimitiveToken, SemanticToken, ComponentToken, ThemeCollection
- [Source: src/types/config.ts] — QuietoConfig, categories
- [Source: src/utils/config.ts] — loadConfig, getConfigPath
- [Source: docs/planning/stories/3-1-re-entrant-editing.md] — loadPrimitivesFromDisk, loadSemanticTokensFromDisk
- [Source: docs/planning/deferred-work.md] — deferred items that remain out of scope

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

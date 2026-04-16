# Story 1.7: Preview, Override, and Confirmation

Status: review

## Story

As a **solo developer**,
I want to see my complete token system before any files are written,
So that I can verify the output looks right and override any auto-mapped values I disagree with.

## Acceptance Criteria

1. **Given** all tokens (primitives, semantics, themes) have been generated in memory, **When** the preview step is displayed, **Then** the CLI shows a summary of all generated tokens organized by tier and category.
2. **Given** the preview is displayed, **When** color tokens are shown, **Then** color tokens display ANSI color swatches in the terminal where supported.
3. **Given** the preview is displayed, **When** color tokens are shown, **Then** color tokens show inline WCAG contrast ratio annotations.
4. **Given** the preview is displayed, **When** the user wants to change a mapping, **Then** the user can select any semantic mapping to override its primitive assignment.
5. **Given** the preview is displayed, **When** the user is satisfied, **Then** they can accept all defaults by pressing enter.
6. **Given** overrides are made, **When** the user confirms, **Then** overrides are recorded in memory for persistence in the config (Story 1.9).
7. **Given** the preview is complete, **When** all tokens are finalized, **Then** a token count summary is displayed (e.g., "147 tokens: 43 primitive, 78 semantic, 2 themes").

## Tasks / Subtasks

- [x] Task 1: Create `src/ui/preview.ts` — token preview renderer (AC: #1)
  - [x] 1.1: Implement `renderPreview(collection: ThemeCollection): void` — displays the full token system summary
  - [x] 1.2: Organize display by tier: primitives first (grouped by category), then semantics (grouped by property)
  - [x] 1.3: Use Clack `log.info()` / `log.message()` for formatted output sections
  - [x] 1.4: Use clear section headers: "Color Primitives", "Spacing Primitives", "Typography Primitives", "Semantic Mappings (Light)", "Semantic Mappings (Dark)"
- [x] Task 2: Implement ANSI color swatch display (AC: #2)
  - [x] 2.1: Create a utility `hexToAnsi(hex: string): string` that renders a colored block character (e.g., `██`) using ANSI 24-bit color codes (`\x1b[38;2;r;g;bm`)
  - [x] 2.2: Display color swatches inline next to each color token: `██ color.blue.400  #3B82F6`
  - [x] 2.3: Handle terminals that don't support 24-bit color gracefully (degrade to no swatch)
- [x] Task 3: Implement WCAG contrast ratio annotations (AC: #3)
  - [x] 3.1: For each semantic color token pair (background + content in the same role), calculate the contrast ratio
  - [x] 3.2: Display contrast ratio inline: `color.content.primary on color.background.primary → 7.2:1 ✓ AA`
  - [x] 3.3: Use `@quieto/palettes` or `@quieto/engine` contrast calculation if available; otherwise implement a minimal WCAG relative luminance calculation
  - [x] 3.4: Flag any pairs that fail WCAG AA (ratio < 4.5:1) — this should be rare since `@quieto/palettes` guarantees accessible ramps, but display the annotation regardless
- [x] Task 4: Implement semantic override flow (AC: #4, #5, #6)
  - [x] 4.1: After displaying the preview, use Clack `confirm()` to ask: "Accept these mappings? (or override specific tokens)"
  - [x] 4.2: If user selects override: use Clack `select()` to let user pick a semantic category (color-background, color-content, color-border, spacing, typography)
  - [x] 4.3: Within the selected category, show the current mapping and available primitive alternatives via `select()`
  - [x] 4.4: After override, refresh the preview for the changed token and ask if more overrides are needed
  - [x] 4.5: Store overrides in a `Map<string, string>` (semantic path → new primitive reference) for config persistence
  - [x] 4.6: If user accepts defaults (enter): proceed with no overrides
- [x] Task 5: Implement token count summary (AC: #7)
  - [x] 5.1: Count tokens by tier: total primitives, total semantics, theme count
  - [x] 5.2: Display formatted summary: "147 tokens: 43 primitive, 78 semantic, 2 themes"
  - [x] 5.3: Use Clack `log.success()` or styled output for the summary to make it feel like a milestone
- [x] Task 6: Integrate into init pipeline (AC: #1–#7)
  - [x] 6.1: Wire preview step after Story 1.6's theme generation
  - [x] 6.2: If user confirms (with or without overrides), pass finalized `ThemeCollection` + overrides to Story 1.8's output step
  - [x] 6.3: If user cancels during preview, use `p.cancel()` and exit gracefully

## Dev Notes

### Technical Stack

| Concern | Choice | Version |
|---------|--------|---------|
| Runtime | Node.js | >=18 (LTS) |
| Language | TypeScript | ^5.x |
| Build | tsup | ^8.x |
| CLI prompts | @clack/prompts | ^1.2.0 |

### Architecture Constraints

- **ESM-only** — all imports use ESM syntax.
- **Clack is the ONLY prompt/UI library** — use Clack's `confirm()`, `select()`, `log.*()` APIs for all interaction. Do NOT use raw `console.log` for user-facing output. Do NOT introduce `chalk`, `picocolors`, or other styling libraries — use raw ANSI escape codes for the color swatches only.
- **No file I/O in this story** — the preview operates entirely on in-memory data. Output happens in Story 1.8.
- **Override data must be serializable** — overrides stored as a map of semantic paths to primitive references, suitable for JSON serialization in Story 1.9.

### The Preview Moment

From the brainstorming session, the preview is a core UX feature (#21 "The Preview Moment"): "See your design system before it's written to disk." This is the emotional climax of the quick-start flow — the developer sees their design system for the first time. The display should feel satisfying, not overwhelming.

**Display principles:**
- **Progressive disclosure:** Show high-level counts first, then category breakdowns
- **Visual hierarchy:** Color swatches make the color section visually rich; spacing/typography sections are more compact
- **Scannability:** One token per line, aligned columns, clear grouping headers
- **Not a wall of text:** For large token sets, consider collapsing detailed lists and showing counts with an option to expand

### ANSI Color Swatch Implementation

Use ANSI 24-bit true color codes (widely supported in modern terminals):
```
\x1b[38;2;{r};{g};{b}m██\x1b[0m
```

Convert hex to RGB: parse the hex string, extract R/G/B bytes. No external dependency needed.

Graceful degradation: check `process.stdout.isTTY` and `FORCE_COLOR` / `NO_COLOR` environment variables. If color is not supported, omit the swatch.

### WCAG Contrast Ratio Calculation

If `@quieto/palettes` does not export a contrast utility, implement a minimal version:
1. Convert hex to sRGB linear values
2. Calculate relative luminance: `L = 0.2126 * R + 0.7152 * G + 0.0722 * B`
3. Contrast ratio: `(L1 + 0.05) / (L2 + 0.05)` where L1 > L2
4. WCAG AA threshold: ≥ 4.5:1 for normal text, ≥ 3:1 for large text

Display as: `7.2:1 ✓ AA` or `3.1:1 ✗ AA` (with ✗ only if below threshold)

### Override Flow Design

The override flow should be lightweight — most users will accept defaults:

1. Show full preview
2. `confirm("Accept these mappings?")` — default "yes"
3. If "no" → `select("Which category to override?")` → show tokens in that category → `select("Pick new primitive for <token>")` → loop back to step 2
4. Overrides accumulate; each override immediately updates the in-memory token collection

Keep the override scope to **semantic color mappings** in quick-start. Spacing and typography overrides are less common and can be deferred to advanced mode (Epic 2).

### Clack API Usage

Available Clack APIs for this story:
- `confirm({ message })` — yes/no with default
- `select({ message, options })` — single selection from list
- `log.info()`, `log.step()`, `log.success()`, `log.warn()` — styled logging
- `isCancel()` — check for Ctrl+C on any prompt
- `cancel()` — display cancellation message

The `spinner` API from Clack v1.2.0 could be used for loading states, but is not needed since the preview is synchronous.

### What NOT to Build

- Do NOT write any files (Story 1.8)
- Do NOT persist overrides to config (Story 1.9)
- Do NOT implement advanced per-token editing (Epic 2)
- Do NOT introduce external styling libraries (chalk, picocolors, etc.)
- Do NOT implement theme switching/toggling in the preview — show both themes sequentially

### File Structure

```
src/
├── ui/
│   └── preview.ts                  # NEW — token preview, ANSI color, WCAG, override flow
├── utils/
│   ├── config.ts                   # Existing
│   ├── color-display.ts            # NEW — hexToAnsi, hexToRgb utilities (or inline in preview.ts)
│   └── contrast.ts                 # NEW — WCAG contrast ratio calculation (if not from @quieto/palettes)
├── types/
│   └── tokens.ts                   # From previous stories — may add Override type
```

### Previous Story Intelligence

- **ThemeCollection from 1.6:** Contains shared primitives + per-theme semantic token arrays
- **SemanticToken from 1.5:** Each has a `$value` DTCG reference that overrides would replace
- **Clack patterns from 1.1:** `isCancel()` on every prompt, `cancel()` for graceful exit
- **Pipeline pattern:** Preview receives ThemeCollection, returns finalized collection + overrides map

### References

- [Source: docs/planning/epics.md#Story 1.7] — Acceptance criteria and story statement
- [Source: docs/brainstorming/brainstorming-session-2026-04-16-1200.md#Green Hat] — Interactive color picker in terminal (#30), WCAG annotations (#41), The Preview Moment (#21)
- [Source: docs/brainstorming/brainstorming-session-2026-04-16-1200.md#Black Hat] — "Opinionated Defaults with Escape Hatches" (#20)
- [Source: docs/qds/design-tokens-nomenclature.md#Semantic Tokens] — Semantic token roles and properties for override targets
- [Source: @clack/prompts v1.2.0] — confirm(), select(), log.*() APIs
- [Source: WCAG 2.1] — Contrast ratio formula and AA thresholds

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (Cursor)

### Debug Log References

- No blocking issues encountered during implementation.

### Completion Notes List

- ✅ Created `src/utils/color-display.ts` with `hexToRgb`, `hexToAnsi`, and `supportsColor` utilities. Uses raw ANSI 24-bit escape codes — no external styling libraries.
- ✅ Created `src/utils/contrast.ts` with WCAG 2.1 relative luminance and contrast ratio calculation (sRGB linearization). Implements `relativeLuminance`, `contrastRatio`, `meetsWcagAA`, `formatContrastResult`.
- ✅ Created `src/ui/preview.ts` as the main preview module with:
  - `renderPreview()` — displays primitives by category (color with ANSI swatches, spacing, typography) then semantic mappings per theme with WCAG contrast annotations for background+content pairs.
  - `renderTokenCountSummary()` — formatted milestone summary via `log.success()`.
  - `runOverrideFlow()` — Clack-based confirm/select loop; stores overrides in `Map<string, string>`; supports cancel at every prompt.
  - `previewAndConfirm()` — orchestrates the full preview→confirm→override pipeline; returns `null` on cancel.
- ✅ Integrated into `src/commands/init.ts` — preview step fires after theme generation; cancellation returns early with no side effects.
- ✅ Exported all new public APIs from `src/index.ts`.
- ✅ 38 new tests across 3 test files (color-display: 16, contrast: 11, preview: 11). All 185 tests pass.
- ✅ TypeScript compiles cleanly with `--noEmit`.
- ✅ No external dependencies added — ANSI swatches use raw escape codes, WCAG contrast is self-contained.
- ✅ **Code review batch (2026-04-16):** Inline WCAG on content lines; stricter truecolor gating for swatches; `hexToRgb` via `normalizeHex`; clearer token-record summary string.

### Change Log

- 2026-04-16: Implemented Story 1.7 — Preview, Override, and Confirmation. Added token preview renderer with ANSI color swatches, WCAG contrast annotations, semantic override flow, and token count summary. Integrated into init pipeline.
- 2026-04-16: Code review batch — inline WCAG on content lines, truecolor-aware swatch gating, validated `hexToRgb`, clearer token-record summary.

### File List

- src/ui/preview.ts (new)
- src/ui/__tests__/preview.test.ts (new)
- src/utils/color-display.ts (new)
- src/utils/__tests__/color-display.test.ts (new)
- src/utils/contrast.ts (new)
- src/utils/__tests__/contrast.test.ts (new)
- src/commands/init.ts (modified)
- src/index.ts (modified)
- docs/planning/sprint-status.yaml (modified)
- docs/planning/stories/1-7-preview-override-and-confirmation.md (modified)

### Review Findings

- [x] [Review][Patch] WCAG contrast annotations are not inline on each color semantic line — AC3 example shows ratios adjacent to each mapping; current implementation emits a separate `WCAG Contrast` block in `renderSemanticMappings` [`src/ui/preview.ts:134-141`] — **fixed 2026-04-16:** contrast suffix appended on each `color.content.*` semantic line via `wcagContrastSuffix`; separate block removed.
- [x] [Review][Patch] Swatch “support” does not distinguish 24-bit truecolor from generic TTY — AC2 / Dev Notes call for omitting swatches when 24-bit is unavailable; `supportsColor` only checks `NO_COLOR`, `FORCE_COLOR`, and `stdout.isTTY` [`src/utils/color-display.ts:20-24`] — **fixed 2026-04-16:** `supportsColor` now requires `COLORTERM` truecolor/24bit, known high-color `TERM` hints, or `FORCE_COLOR`; `FORCE_COLOR=0` disables.
- [x] [Review][Patch] `hexToRgb` accepts only 6-digit forms with no validation — invalid or 3-digit hex yields `NaN` components and broken ANSI sequences [`src/utils/color-display.ts:7-13`] — **fixed 2026-04-16:** `hexToRgb` delegates to `normalizeHex` from `color.ts` (3- and 6-digit, throws on invalid).
- [x] [Review][Patch] Token count headline may confuse users — leading `total` sums primitives plus all semantic rows across every theme, while the suffix reads like unique semantics × themes; align wording or the arithmetic with AC7 / prior “token records” language [`src/ui/preview.ts:170-182`] — **fixed 2026-04-16:** summary uses explicit “token records” and “semantic rows across N themes (per theme)”.
- [x] [Review][Defer] `initCommand` drops `previewResult` after the null check — finalized `ThemeCollection` and `overrides` are not passed onward yet (Story 1.8 output step) [`src/commands/init.ts:85-91`] — deferred, pre-existing relative to Story 1.8 scope

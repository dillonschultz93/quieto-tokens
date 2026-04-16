# Story 1.7: Preview, Override, and Confirmation

Status: ready-for-dev

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

- [ ] Task 1: Create `src/ui/preview.ts` — token preview renderer (AC: #1)
  - [ ] 1.1: Implement `renderPreview(collection: ThemeCollection): void` — displays the full token system summary
  - [ ] 1.2: Organize display by tier: primitives first (grouped by category), then semantics (grouped by property)
  - [ ] 1.3: Use Clack `log.info()` / `log.message()` for formatted output sections
  - [ ] 1.4: Use clear section headers: "Color Primitives", "Spacing Primitives", "Typography Primitives", "Semantic Mappings (Light)", "Semantic Mappings (Dark)"
- [ ] Task 2: Implement ANSI color swatch display (AC: #2)
  - [ ] 2.1: Create a utility `hexToAnsi(hex: string): string` that renders a colored block character (e.g., `██`) using ANSI 24-bit color codes (`\x1b[38;2;r;g;bm`)
  - [ ] 2.2: Display color swatches inline next to each color token: `██ color.blue.400  #3B82F6`
  - [ ] 2.3: Handle terminals that don't support 24-bit color gracefully (degrade to no swatch)
- [ ] Task 3: Implement WCAG contrast ratio annotations (AC: #3)
  - [ ] 3.1: For each semantic color token pair (background + content in the same role), calculate the contrast ratio
  - [ ] 3.2: Display contrast ratio inline: `color.content.primary on color.background.primary → 7.2:1 ✓ AA`
  - [ ] 3.3: Use `@quieto/palettes` or `@quieto/engine` contrast calculation if available; otherwise implement a minimal WCAG relative luminance calculation
  - [ ] 3.4: Flag any pairs that fail WCAG AA (ratio < 4.5:1) — this should be rare since `@quieto/palettes` guarantees accessible ramps, but display the annotation regardless
- [ ] Task 4: Implement semantic override flow (AC: #4, #5, #6)
  - [ ] 4.1: After displaying the preview, use Clack `confirm()` to ask: "Accept these mappings? (or override specific tokens)"
  - [ ] 4.2: If user selects override: use Clack `select()` to let user pick a semantic category (color-background, color-content, color-border, spacing, typography)
  - [ ] 4.3: Within the selected category, show the current mapping and available primitive alternatives via `select()`
  - [ ] 4.4: After override, refresh the preview for the changed token and ask if more overrides are needed
  - [ ] 4.5: Store overrides in a `Map<string, string>` (semantic path → new primitive reference) for config persistence
  - [ ] 4.6: If user accepts defaults (enter): proceed with no overrides
- [ ] Task 5: Implement token count summary (AC: #7)
  - [ ] 5.1: Count tokens by tier: total primitives, total semantics, theme count
  - [ ] 5.2: Display formatted summary: "147 tokens: 43 primitive, 78 semantic, 2 themes"
  - [ ] 5.3: Use Clack `log.success()` or styled output for the summary to make it feel like a milestone
- [ ] Task 6: Integrate into init pipeline (AC: #1–#7)
  - [ ] 6.1: Wire preview step after Story 1.6's theme generation
  - [ ] 6.2: If user confirms (with or without overrides), pass finalized `ThemeCollection` + overrides to Story 1.8's output step
  - [ ] 6.3: If user cancels during preview, use `p.cancel()` and exit gracefully

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

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

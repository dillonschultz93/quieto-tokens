# Story 1.4: Spacing and Typography Primitive Token Generation

Status: done

## Story

As a **solo developer**,
I want spacing and typography scales generated from my preferences,
So that I have consistent, harmonious values for layout and text without manual calculation.

## Acceptance Criteria

1. **Given** the user has selected a spacing base (4px or 8px) and type scale preference (compact, balanced, or spacious) in Story 1.2, **When** the primitive generation step runs, **Then** a spacing ramp is generated from the selected base (e.g., 4px base produces 4, 8, 12, 16, 24, 32, 48, 64, 96).
2. **Given** the spacing base is selected, **When** the spacing ramp is generated, **Then** spacing tokens follow the `spacing.<value>` naming convention (e.g., `spacing.4`, `spacing.8`, `spacing.16`).
3. **Given** the type scale preference is selected, **When** the type scale is generated, **Then** a type scale matching the preference (compact, balanced, or spacious) is generated with 5–7 size steps.
4. **Given** the type scale is generated, **When** typography primitives are complete, **Then** font weight primitives are generated: regular (400), medium (500), semibold (600), bold (700) at minimum.
5. **Given** generation is in progress, **When** each scale is built, **Then** the progress narrative describes each scale being built (e.g., "Building spacing ramp from 4px base: 9 steps").
6. **Given** all primitives are generated, **When** token naming is applied, **Then** spacing tokens follow `spacing.<value>` and typography tokens follow `typography.<subcategory>.<value>` naming conventions.

## Tasks / Subtasks

- [x] Task 1: Define spacing preset ramps (AC: #1, #2)
  - [x] 1.1: Create `src/generators/spacing.ts`
  - [x] 1.2: Define the 4px base ramp: `[4, 8, 12, 16, 24, 32, 48, 64, 96]`
  - [x] 1.3: Define the 8px base ramp: `[8, 16, 24, 32, 48, 64, 96, 128, 192]`
  - [x] 1.4: Implement `generateSpacingPrimitives(base: 4 | 8): PrimitiveToken[]` — returns spacing tokens from the selected preset
- [x] Task 2: Define typography preset scales (AC: #3, #4)
  - [x] 2.1: Create `src/generators/typography.ts`
  - [x] 2.2: Define "compact" type scale: tighter ratios, smaller sizes (e.g., 12, 14, 16, 18, 20, 24)
  - [x] 2.3: Define "balanced" type scale: standard ratios (e.g., 12, 14, 16, 20, 24, 30, 36)
  - [x] 2.4: Define "spacious" type scale: larger ratios (e.g., 14, 16, 20, 24, 32, 40, 48)
  - [x] 2.5: Define font weight primitives: `{ regular: 400, medium: 500, semibold: 600, bold: 700 }`
  - [x] 2.6: Implement `generateTypographyPrimitives(scale: 'compact' | 'balanced' | 'spacious'): PrimitiveToken[]` — returns font-size + font-weight tokens
- [x] Task 3: Convert presets to token representation (AC: #2, #6)
  - [x] 3.1: Reuse `PrimitiveToken` type from `src/types/tokens.ts` (created in Story 1.3)
  - [x] 3.2: Spacing tokens: path = `['spacing', value]`, `$type = 'dimension'`, `$value = '{n}px'`
  - [x] 3.3: Font-size tokens: path = `['typography', 'font-size', step]`, `$type = 'dimension'`
  - [x] 3.4: Font-weight tokens: path = `['typography', 'font-weight', name]`, `$type = 'fontWeight'`
- [x] Task 4: Implement progress narrative (AC: #5)
  - [x] 4.1: Use Clack `log.step()` and `log.info()` for narration
  - [x] 4.2: Report spacing ramp creation with base and step count
  - [x] 4.3: Report type scale creation with preference name and step count
  - [x] 4.4: Report font weight count
  - [x] 4.5: Display total non-color primitive count at completion
- [x] Task 5: Integrate into init pipeline after color generation (AC: #1–#6)
  - [x] 5.1: Wire `generateSpacingPrimitives()` and `generateTypographyPrimitives()` into the init flow after Story 1.3's color generation
  - [x] 5.2: Merge returned `PrimitiveToken[]` arrays with color primitives into a unified primitive token collection
  - [x] 5.3: Pass the combined collection forward for semantic mapping (Story 1.5)

### Review Findings

- [x] [Review][Patch] Typography `log.step()` fires after generation — reorder before `generateTypographyPrimitives()` call to match spacing pattern [src/pipeline/spacing-typography.ts:16-20]
- [x] [Review][Patch] Spacing `log.step()` should include step count inline per AC #5 example ("Building spacing ramp from 4px base: 9 steps") [src/pipeline/spacing-typography.ts:7]
- [x] [Review][Patch] Add runtime guard clauses in `generateSpacingPrimitives` and `generateTypographyPrimitives` for invalid input values [src/generators/spacing.ts:12, src/generators/typography.ts:54]
- [x] [Review][Defer] `TypeScaleStep` interface properties not `readonly` — exported constants can be mutated via property access — deferred, pre-existing type design

## Dev Notes

### Technical Stack

| Concern | Choice | Version |
|---------|--------|---------|
| Runtime | Node.js | >=18 (LTS) |
| Language | TypeScript | ^5.x |
| Build | tsup | ^8.x |
| CLI prompts | @clack/prompts | ^1.2.0 |

### Architecture Constraints

- **ESM-only:** All imports use ESM syntax.
- **Curated presets, NOT intelligent generation:** Unlike color (which uses `@quieto/palettes` for algorithmic generation), spacing and typography use **hardcoded, curated preset arrays**. This is an explicit design decision from the brainstorming session — the CLI is transparent about where intelligence lives (color) and where curation lives (spacing, typography).
- **No external dependencies needed:** These generators are pure functions over static data. No new packages required.
- **Clack for all output:** Use `log.step()` / `log.info()` for narrative, never `console.log`.

### Naming Convention Enforcement

From `docs/qds/design-tokens-nomenclature.md`:

**Spacing tokens:**
- Pattern: `spacing.<value>` (e.g., `spacing.4`, `spacing.16`, `spacing.64`)
- Category: `spacing`
- Value: the pixel number as a string

**Typography tokens:**
- Pattern: `typography.<subcategory>.<value>`
- Category: `typography`
- Sub-categories: `font-size`, `font-weight` (and later: `font-family`, `line-height`, `letter-spacing`)
- Font-size values: step identifiers like `xs`, `sm`, `base`, `lg`, `xl`, `2xl`, `3xl` — or numeric scale indices
- Font-weight values: descriptive names (`regular`, `medium`, `semibold`, `bold`)

**DTCG `$type` values:**
- Spacing: `dimension`
- Font-size: `dimension`
- Font-weight: `fontWeight`

### Preset Design Rationale

**Spacing ramps** follow a non-linear scale that covers the most common spacing needs:
- Small increments for tight UI (4, 8, 12, 16)
- Larger jumps for layout spacing (24, 32, 48, 64, 96)
- The 4px grid is the industry standard; 8px is a common alternative for simpler scales

**Type scales** are based on modular scale principles:
- **Compact:** Tighter ratios for data-dense UIs (dashboards, admin panels)
- **Balanced:** Standard ratios for general-purpose applications
- **Spacious:** Larger ratios for content-heavy sites (blogs, marketing)

### Reuse of Story 1.3 Infrastructure

- Reuse `PrimitiveToken` type from `src/types/tokens.ts`
- Follow the same generator function signature pattern: `generate*(options): PrimitiveToken[]`
- Follow the same progress narrative pattern using Clack
- The combined primitive collection (color + spacing + typography) will be the input to Story 1.5's semantic mapper

### What NOT to Build

- Do NOT implement line-height, letter-spacing, or font-family tokens (those are Epic 2 advanced mode)
- Do NOT implement semantic mapping (Story 1.5)
- Do NOT implement custom scale values (that's Story 2.1 advanced mode)
- Do NOT add additional spacing bases beyond 4px and 8px
- Do NOT implement file output

### File Structure

```
src/
├── generators/
│   ├── color.ts                    # From Story 1.3
│   ├── spacing.ts                  # NEW — spacing ramp preset generator
│   └── typography.ts               # NEW — type scale and font weight generator
├── types/
│   └── tokens.ts                   # From Story 1.3 — reuse PrimitiveToken
```

### Previous Story Intelligence (Story 1.1 + 1.3 patterns)

- **Clack APIs:** `log.step()`, `log.info()` for progress narrative
- **Error handling:** top-level catch in cli.ts, `isCancel()` on prompts
- **Generator pattern from 1.3:** Each generator is a pure function taking user preferences and returning `PrimitiveToken[]`
- **Token type from 1.3:** `PrimitiveToken` with `tier`, `category`, `name`, `$type`, `$value`, `path[]`

### References

- [Source: docs/planning/epics.md#Story 1.4] — Acceptance criteria and story statement
- [Source: docs/qds/design-tokens-nomenclature.md#Primitive Tokens] — Spacing and typography naming conventions
- [Source: docs/brainstorming/brainstorming-session-2026-04-16-1200.md#Black Hat] — "Non-color token asymmetry" — curated presets accepted as honest and sufficient
- [Source: docs/planning/stories/1-1-cli-scaffolding-and-init-entry-point.md] — Established patterns
- [Source: DTCG spec] — `$type` values: `dimension` for spacing/font-size, `fontWeight` for weights

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

No issues encountered.

### Completion Notes List

- Implemented spacing generator with curated 4px and 8px preset ramps (9 steps each), returning `PrimitiveToken[]` with `$type: 'dimension'` and `spacing.<value>` naming convention.
- Implemented typography generator with compact (6 sizes), balanced (7 sizes), and spacious (7 sizes) type scales plus 4 font weight primitives (regular/medium/semibold/bold).
- Created `src/pipeline/spacing-typography.ts` pipeline module with Clack-based progress narrative reporting ramp base, step counts, font weight counts, and totals.
- Integrated spacing and typography generation into `src/commands/init.ts` after color generation, merging all primitive tokens into a unified `allPrimitives` collection.
- Updated `src/index.ts` public API exports for all new generators, presets, and pipeline functions.
- All 75 tests pass (6 test files), zero type errors, zero lint issues.

### Change Log

- 2026-04-16: Implemented Story 1.4 — spacing and typography primitive token generation (all 5 tasks)

### File List

- src/generators/spacing.ts (new)
- src/generators/typography.ts (new)
- src/generators/__tests__/spacing.test.ts (new)
- src/generators/__tests__/typography.test.ts (new)
- src/pipeline/spacing-typography.ts (new)
- src/pipeline/__tests__/spacing-typography.test.ts (new)
- src/commands/init.ts (modified)
- src/index.ts (modified)
- docs/planning/sprint-status.yaml (modified)
- docs/planning/stories/1-4-spacing-and-typography-primitive-token-generation.md (modified)

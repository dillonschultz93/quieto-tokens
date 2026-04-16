# Story 1.4: Spacing and Typography Primitive Token Generation

Status: ready-for-dev

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

- [ ] Task 1: Define spacing preset ramps (AC: #1, #2)
  - [ ] 1.1: Create `src/generators/spacing.ts`
  - [ ] 1.2: Define the 4px base ramp: `[4, 8, 12, 16, 24, 32, 48, 64, 96]`
  - [ ] 1.3: Define the 8px base ramp: `[8, 16, 24, 32, 48, 64, 96, 128, 192]`
  - [ ] 1.4: Implement `generateSpacingPrimitives(base: 4 | 8): PrimitiveToken[]` — returns spacing tokens from the selected preset
- [ ] Task 2: Define typography preset scales (AC: #3, #4)
  - [ ] 2.1: Create `src/generators/typography.ts`
  - [ ] 2.2: Define "compact" type scale: tighter ratios, smaller sizes (e.g., 12, 14, 16, 18, 20, 24)
  - [ ] 2.3: Define "balanced" type scale: standard ratios (e.g., 12, 14, 16, 20, 24, 30, 36)
  - [ ] 2.4: Define "spacious" type scale: larger ratios (e.g., 14, 16, 20, 24, 32, 40, 48)
  - [ ] 2.5: Define font weight primitives: `{ regular: 400, medium: 500, semibold: 600, bold: 700 }`
  - [ ] 2.6: Implement `generateTypographyPrimitives(scale: 'compact' | 'balanced' | 'spacious'): PrimitiveToken[]` — returns font-size + font-weight tokens
- [ ] Task 3: Convert presets to token representation (AC: #2, #6)
  - [ ] 3.1: Reuse `PrimitiveToken` type from `src/types/tokens.ts` (created in Story 1.3)
  - [ ] 3.2: Spacing tokens: path = `['spacing', value]`, `$type = 'dimension'`, `$value = '{n}px'`
  - [ ] 3.3: Font-size tokens: path = `['typography', 'font-size', step]`, `$type = 'dimension'`
  - [ ] 3.4: Font-weight tokens: path = `['typography', 'font-weight', name]`, `$type = 'fontWeight'`
- [ ] Task 4: Implement progress narrative (AC: #5)
  - [ ] 4.1: Use Clack `log.step()` and `log.info()` for narration
  - [ ] 4.2: Report spacing ramp creation with base and step count
  - [ ] 4.3: Report type scale creation with preference name and step count
  - [ ] 4.4: Report font weight count
  - [ ] 4.5: Display total non-color primitive count at completion
- [ ] Task 5: Integrate into init pipeline after color generation (AC: #1–#6)
  - [ ] 5.1: Wire `generateSpacingPrimitives()` and `generateTypographyPrimitives()` into the init flow after Story 1.3's color generation
  - [ ] 5.2: Merge returned `PrimitiveToken[]` arrays with color primitives into a unified primitive token collection
  - [ ] 5.3: Pass the combined collection forward for semantic mapping (Story 1.5)

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

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

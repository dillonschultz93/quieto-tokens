# Story 1.5: Primitive-to-Semantic Auto-Mapping

Status: done

## Story

As a **solo developer**,
I want my primitive tokens automatically assigned to meaningful semantic roles,
So that I get usable tokens like `color.background.primary` without manually wiring anything.

## Acceptance Criteria

1. **Given** all primitive tokens have been generated (color from 1.3, spacing + typography from 1.4), **When** the semantic auto-mapping step runs, **Then** color primitives are mapped to semantic color tokens (background, content, border) across roles (default, primary, secondary, danger, warning, success, info).
2. **Given** color mapping is complete, **When** spacing mapping runs, **Then** spacing primitives are mapped to semantic spacing tokens (xs, sm, md, lg, xl, 2xl).
3. **Given** spacing mapping is complete, **When** typography mapping runs, **Then** typography primitives are mapped to semantic type tokens across roles (headline, body, label, meta).
4. **Given** all semantic mappings are created, **When** token references are set, **Then** semantic tokens reference their primitive sources using DTCG reference syntax (e.g., `$value: "{color.blue.500}"`).
5. **Given** mapping is in progress, **When** each category is mapped, **Then** the progress narrative reports the number of semantic tokens generated per category (e.g., "Mapped 42 semantic color tokens").

## Tasks / Subtasks

- [x] Task 1: Create `src/mappers/semantic.ts` — the auto-mapping engine (AC: #1, #2, #3, #4)
  - [x] 1.1: Define `SemanticToken` type in `src/types/tokens.ts`: extends token base with `$value` as a DTCG reference string (e.g., `"{color.blue.500}"`) and `tier: 'semantic'`
  - [x] 1.2: Define mapping configuration type: `SemanticMapping = { semanticPath: string[]; primitiveRef: string }`
- [x] Task 2: Implement color semantic mapping (AC: #1, #4)
  - [x] 2.1: Define the default mapping table — which primitive step maps to which semantic role for each property:
    - `color.background.default` → neutral light step (e.g., `color.neutral.50`)
    - `color.background.primary` → primary mid-light step (e.g., `color.blue.500`)
    - `color.content.default` → neutral dark step (e.g., `color.neutral.900`)
    - `color.content.primary` → primary step for text-on-light (e.g., `color.blue.700`)
    - `color.border.default` → neutral mid step (e.g., `color.neutral.200`)
    - Map across all roles: default, primary, secondary, danger, warning, success, info
  - [x] 2.2: Implement `mapColorSemantics(colorPrimitives: PrimitiveToken[]): SemanticToken[]`
  - [x] 2.3: Each semantic token's `$value` must use DTCG reference syntax: `"{color.<hue>.<step>}"`
- [x] Task 3: Implement spacing semantic mapping (AC: #2, #4)
  - [x] 3.1: Define spacing semantic mapping:
    - `spacing.xs` → smallest spacing step
    - `spacing.sm` → second step
    - `spacing.md` → middle step (often 16px)
    - `spacing.lg` → larger step
    - `spacing.xl` → large step
    - `spacing.2xl` → largest common step
  - [x] 3.2: Implement `mapSpacingSemantics(spacingPrimitives: PrimitiveToken[]): SemanticToken[]`
  - [x] 3.3: References use DTCG syntax: `"{spacing.16}"`
- [x] Task 4: Implement typography semantic mapping (AC: #3, #4)
  - [x] 4.1: Define typography semantic mapping:
    - `typography.headline` → large font-size + bold weight
    - `typography.body` → base font-size + regular weight
    - `typography.label` → small font-size + medium/semibold weight
    - `typography.meta` → smallest font-size + regular weight
  - [x] 4.2: Implement `mapTypographySemantics(typoPrimitives: PrimitiveToken[]): SemanticToken[]`
  - [x] 4.3: Typography semantics may need composite references (font-size + font-weight pairing) — decide on flat vs composite structure
- [x] Task 5: Orchestrate full semantic mapping (AC: #1–#5)
  - [x] 5.1: Implement `generateSemanticTokens(primitives: PrimitiveToken[]): SemanticToken[]` — runs all three mappers
  - [x] 5.2: Wire into init pipeline after primitive generation (Stories 1.3 + 1.4)
  - [x] 5.3: Implement progress narrative: per-category counts and total semantic token count

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
- **Pure functions** — the mapper takes primitives in, returns semantics out. No side effects, no file I/O.
- **DTCG reference syntax is mandatory:** Semantic tokens MUST reference primitives using `"{<primitive.path>}"` syntax. They do NOT contain raw values — they are aliases. This is fundamental to the three-tier architecture.
- **Mapping table must be overridable:** Store the default mapping as a data structure, not hardcoded in logic. Story 1.7 will allow users to override individual mappings, and Story 1.9 will persist overrides in the config.

### Naming Convention — Semantic Tokens

From `docs/qds/design-tokens-nomenclature.md`:

**Pattern:** `<category>.<property>.<role>.<state>`

**Color semantics:**
- Properties: `background`, `content`, `border`
- Roles: `default`, `primary`, `secondary`, `info`, `warning`, `danger`, `success`, `subtle`, `neutral`
- States (optional, not generated in auto-mapping): `hover`, `active`, `focus`, `disabled`
- Example: `color.background.primary` → references `"{color.blue.500}"`

**Spacing semantics:**
- Pattern: `spacing.<role>` where role is a t-shirt size
- Roles: `xs`, `sm`, `md`, `lg`, `xl`, `2xl`
- Example: `spacing.md` → references `"{spacing.16}"`

**Typography semantics:**
- Pattern: `typography.<role>.<property>`
- Roles: `headline`, `body`, `label`, `meta`
- Properties: `font-size`, `font-weight`
- Example: `typography.headline.font-size` → references `"{typography.font-size.2xl}"`

**CSS output will add the tier identifier prefix:** `--quieto-semantic-color-background-primary`

### Default Mapping Strategy

The auto-mapping should produce **sensible defaults that work for most applications**. The opinionated mapping + override step (Story 1.7) is a core UX decision from the brainstorming session ("Opinionated Defaults with Escape Hatches").

**Color mapping heuristic:** Use the primary ramp's middle steps for prominent roles, lighter/darker extremes for backgrounds/text, and neutral ramp for default/subtle roles.

**Spacing mapping heuristic:** Map t-shirt sizes to ramp positions (xs=smallest, 2xl=largest common). The middle of the ramp should be `md`.

**Typography mapping heuristic:** Map role names to font-size steps (headline=largest, meta=smallest) and pair with appropriate weights (headline=bold, body=regular, label=medium, meta=regular).

### Key Design Decision: Flat vs Composite Typography Semantics

Typography semantics could be:
- **Flat:** Separate tokens for each property — `typography.headline.font-size`, `typography.headline.font-weight`
- **Composite:** DTCG `typography` composite type — `typography.headline` with `$value: { fontFamily, fontSize, fontWeight, ... }`

**Recommendation:** Use flat tokens. Composite typography types are complex, not widely supported by tools yet, and the flat approach is more flexible for overrides and consumption.

### What NOT to Build

- Do NOT generate state variants (hover, active, etc.) — those are theme-specific and will be addressed in Story 1.6 or deferred
- Do NOT implement the override UI (Story 1.7)
- Do NOT implement "secondary" hue mapping (no secondary color ramp exists yet — that's Epic 2)
- Do NOT implement component-level tokens (Tier 3 — that's Epic 2)
- Do NOT write files to disk

### File Structure

```
src/
├── mappers/
│   └── semantic.ts                 # NEW — semantic auto-mapping engine
├── types/
│   └── tokens.ts                   # MODIFIED — add SemanticToken type
├── generators/
│   ├── color.ts                    # From Story 1.3
│   ├── spacing.ts                  # From Story 1.4
│   └── typography.ts               # From Story 1.4
```

### Previous Story Intelligence

- **Token type pattern from 1.3:** `PrimitiveToken` with `tier`, `category`, `name`, `$type`, `$value`, `path[]`
- **Generator pattern from 1.3/1.4:** Pure functions returning token arrays
- **Progress narrative pattern:** Clack `log.step()` for milestones, `log.info()` for details
- **Ramp data available:** Color ramps from 1.3 have hue names and step numbers; spacing has value numbers; typography has subcategory names

### References

- [Source: docs/planning/epics.md#Story 1.5] — Acceptance criteria and story statement
- [Source: docs/qds/design-tokens-nomenclature.md#Semantic Tokens] — `<category>.<property>.<role>.<state>` convention, property/role enums
- [Source: docs/brainstorming/brainstorming-session-2026-04-16-1200.md#Black Hat] — "Opinionated Defaults with Escape Hatches" design decision
- [Source: DTCG spec] — Reference syntax `"{path.to.token}"` for alias tokens

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

No issues encountered.

### Completion Notes List

- Added `SemanticToken` and `SemanticMapping` types to `src/types/tokens.ts` — semantic tokens have `tier: 'semantic'` and `$value` as DTCG reference strings.
- Implemented `mapColorSemantics()` — maps 3 properties (background, content, border) × 7 roles (default, primary, secondary, danger, warning, success, info) = 21 semantic color tokens. Default/secondary/warning use neutral ramp; primary/danger/success/info use the primary hue ramp. Mapping table stored as `DEFAULT_COLOR_RULES` data structure for Story 1.7 overrides.
- Implemented `mapSpacingSemantics()` — maps 6 t-shirt sizes (xs–2xl) to ramp positions via `DEFAULT_SPACING_INDEX_MAP`. Sorts primitives by value and picks indices.
- Implemented `mapTypographySemantics()` — maps 4 roles (headline/body/label/meta) × 2 properties (font-size/font-weight) = 8 semantic tokens using flat structure (not composite). Role→label mappings stored in `DEFAULT_TYPOGRAPHY_ROLES`.
- Implemented `generateSemanticTokens()` orchestrator — filters primitives by category, runs all 3 mappers, reports per-category counts and total via Clack narrative.
- Wired into `src/commands/init.ts` after primitive generation — semantic tokens generated from `allPrimitives`, total count reported.
- Updated `src/index.ts` with all new public API exports.
- All 111 tests pass (7 test files), zero type errors, zero lint issues.

### Change Log

- 2026-04-16: Implemented Story 1.5 — primitive-to-semantic auto-mapping (all 5 tasks)

### File List

- src/mappers/semantic.ts (new)
- src/mappers/__tests__/semantic.test.ts (new)
- src/types/tokens.ts (modified — added SemanticToken, SemanticMapping)
- src/commands/init.ts (modified — wired semantic generation)
- src/index.ts (modified — added semantic exports)

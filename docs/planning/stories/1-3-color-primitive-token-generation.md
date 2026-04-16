# Story 1.3: Color Primitive Token Generation

Status: ready-for-dev

## Story

As a **solo developer**,
I want my brand color to be expanded into a complete, accessible color palette,
So that I have a full set of color primitives without needing to understand color theory.

## Acceptance Criteria

1. **Given** the user has provided a brand color hex value (from Story 1.2 prompt flow), **When** the color generation step runs, **Then** `@quieto/palettes` generates an accessible primary color ramp (full step scale).
2. **Given** the primary ramp is generated, **When** color generation continues, **Then** a neutral/gray ramp is generated for backgrounds, text, and borders.
3. **Given** all ramps are generated, **When** the output is validated, **Then** all generated color steps are WCAG AA compliant against their intended usage context (enforced by `@quieto/palettes` — inaccessible output is structurally impossible).
4. **Given** color generation is in progress, **When** each ramp is generated, **Then** the progress narrative displays each ramp being generated with step counts (e.g., "Generated primary ramp: 11 steps").
5. **Given** all color primitives are generated, **When** token naming is applied, **Then** tokens follow the primitive naming convention: `color.<hue>.<step>` (e.g., `color.blue.400`, `color.neutral.100`).

## Tasks / Subtasks

- [ ] Task 1: Install `@quieto/palettes` as a runtime dependency (AC: #1)
  - [ ] 1.1: Add `@quieto/palettes` to `package.json` dependencies (local link or npm install depending on publish status)
  - [ ] 1.2: Verify the package exposes a function that takes a hex color and returns an accessible color ramp with step values
  - [ ] 1.3: If `@quieto/palettes` is not yet published, document the expected API contract and use a local file path link or create a minimal stub interface
- [ ] Task 2: Create `src/generators/color.ts` — color primitive generator (AC: #1, #2, #5)
  - [ ] 2.1: Define `ColorPrimitive` type: `{ name: string; step: number; hex: string; }` (or match `@quieto/palettes` output shape)
  - [ ] 2.2: Define `ColorRamp` type: `{ hue: string; steps: ColorPrimitive[] }`
  - [ ] 2.3: Implement `generatePrimaryRamp(brandHex: string): ColorRamp` — calls `@quieto/palettes` to generate the full primary ramp
  - [ ] 2.4: Implement `generateNeutralRamp(): ColorRamp` — generates a neutral/gray ramp (may derive from brand color or use a standard neutral)
  - [ ] 2.5: Implement `generateColorPrimitives(brandHex: string): ColorRamp[]` — orchestrates primary + neutral ramp generation and returns all color primitives
- [ ] Task 3: Define in-memory token representation for primitives (AC: #5)
  - [ ] 3.1: Create `src/types/tokens.ts` with `PrimitiveToken` interface: `{ tier: 'primitive'; category: string; name: string; $type: string; $value: string; path: string[] }`
  - [ ] 3.2: Implement `colorRampToTokens(ramp: ColorRamp): PrimitiveToken[]` — converts ramp data to primitive tokens following `color.<hue>.<step>` naming
  - [ ] 3.3: Each token's `path` array should be `['color', hue, step]` for later DTCG JSON serialization (Story 1.8)
- [ ] Task 4: Integrate color generation into the init pipeline (AC: #1, #2, #4)
  - [ ] 4.1: Create `src/pipeline/` directory structure for the sequential generation pipeline
  - [ ] 4.2: Export a `runColorGeneration(brandHex: string): Promise<PrimitiveToken[]>` function that orchestrates generation + progress narrative
  - [ ] 4.3: Wire into the init command flow after Story 1.2's prompt collection completes
- [ ] Task 5: Implement progress narrative for color generation (AC: #4)
  - [ ] 5.1: Use Clack `log.step()` and `log.info()` to narrate each ramp generation (e.g., "Generating primary color ramp from #3B82F6...")
  - [ ] 5.2: Display step count after each ramp (e.g., "✓ Primary ramp: 11 steps")
  - [ ] 5.3: Display total color primitive count at completion (e.g., "22 color primitives generated")

## Dev Notes

### Technical Stack

| Concern | Choice | Version |
|---------|--------|---------|
| Runtime | Node.js | >=18 (LTS) |
| Language | TypeScript | ^5.x |
| Build | tsup | ^8.x |
| CLI prompts | @clack/prompts | ^1.2.0 |
| Color generation | @quieto/palettes | local/unpublished |

### Architecture Constraints

- **ESM-only:** All imports must use ESM syntax. No CommonJS `require()`.
- **Clack is the only prompt library:** Use Clack's `log.*` methods for progress narrative output — not `console.log`.
- **`@quieto/palettes` is the ONLY color generation path:** Do NOT implement custom color math, HSL manipulation, or any hand-rolled color ramp generation. The entire point of the Quieto ecosystem is that `@quieto/engine` → `@quieto/palettes` → this CLI. If `@quieto/palettes` is not available, create a typed interface stub and document the expected contract.
- **Accessibility is structural, not optional:** WCAG AA compliance comes from `@quieto/palettes` by design. Do NOT add separate contrast validation — the ramp generation itself guarantees accessible steps.

### Naming Convention Enforcement

Color primitive tokens follow the three-tier nomenclature from `docs/qds/design-tokens-nomenclature.md`:
- **Pattern:** `color.<hue>.<step>` (e.g., `color.blue.400`, `color.neutral.50`)
- **Category:** `color`
- **Sub-category:** The hue name (e.g., `blue`, `neutral`, `green`)
- **Value:** The step number from the ramp (e.g., `50`, `100`, `200`, ..., `900`, `950`)

The hue name for the primary ramp should be derived from the closest named hue to the brand color (e.g., if brand hex is `#3B82F6`, the hue name is `blue`). `@quieto/palettes` may provide this mapping — check its API.

### `@quieto/palettes` Integration Notes

- The package is local/unpublished as of Story 1.1. It lives in the Quieto monorepo ecosystem.
- Expected API (verify against actual package): Takes a hex color input and returns an array of color steps with hex values and step numbers, all WCAG AA compliant.
- If the package is not yet installable via npm, use `npm link` or a `file:` path in `package.json`. Document the approach in completion notes.
- The neutral ramp generation strategy should be investigated — it may be a built-in feature of `@quieto/palettes` or may require deriving a desaturated version of the brand color.

### In-Memory Token Model

This story establishes the in-memory representation that all subsequent stories (1.4–1.9) will build on. Design the `PrimitiveToken` type to be:
- **Serializable** to DTCG JSON in Story 1.8 (needs `$type`, `$value`, `path`)
- **Traversable** for semantic mapping in Story 1.5 (needs clear path/name structure)
- **Displayable** for the preview in Story 1.7 (needs hex value accessible)

### What NOT to Build

- Do NOT implement spacing or typography generation (Story 1.4)
- Do NOT implement semantic mapping (Story 1.5)
- Do NOT implement theme variants (Story 1.6)
- Do NOT implement preview/override UI (Story 1.7)
- Do NOT implement file output (Story 1.8)
- Do NOT install `style-dictionary` yet
- Do NOT implement additional hue ramps beyond primary + neutral (that's Epic 2 advanced mode)

### File Structure

```
src/
├── cli.ts                          # Existing — no changes expected
├── commands/
│   └── init.ts                     # Modified — wire in color generation after prompt flow
├── generators/
│   └── color.ts                    # NEW — color primitive generation via @quieto/palettes
├── types/
│   └── tokens.ts                   # NEW — PrimitiveToken and related type definitions
├── pipeline/                       # NEW — pipeline orchestration (optional, may inline in init)
├── utils/
│   └── config.ts                   # Existing — no changes expected
└── index.ts                        # May export new types
```

### Previous Story Intelligence (Story 1.1)

- **Clack APIs established:** `intro()`, `outro()`, `select()`, `isCancel()`, `log.step()`, `log.info()`, `cancel()`
- **Error handling pattern:** top-level `catch` in `cli.ts` with `p.cancel(message)`, plus `isCancel()` on each prompt
- **tsup config:** Two-entry array config (cli.ts gets shebang banner, index.ts gets .d.ts generation)
- **Config detection:** `configExists()` and `getConfigPath()` in `src/utils/config.ts`
- **No test framework yet** — acceptable for this story, testing established when meaningful logic exists

### Git Intelligence

- Last merged commit: "Implement Story 1.1: CLI scaffolding and init entry point" (PR #1)
- Files created in 1.1: `src/cli.ts`, `src/commands/init.ts`, `src/utils/config.ts`, `src/index.ts`, `tsconfig.json`, `tsup.config.ts`
- The init command currently has a stub: `p.log.step("Ready to begin the quick-start flow.")` — this is where Story 1.2 prompts and Story 1.3 generation will integrate

### References

- [Source: docs/planning/epics.md#Story 1.3] — Acceptance criteria and story statement
- [Source: docs/qds/design-tokens-nomenclature.md#Primitive Tokens] — `color.<hue>.<step>` naming convention
- [Source: docs/brainstorming/brainstorming-session-2026-04-16-1200.md#White Hat] — @quieto/palettes integration, WCAG AA by design
- [Source: docs/planning/stories/1-1-cli-scaffolding-and-init-entry-point.md] — Previous story learnings and established patterns

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

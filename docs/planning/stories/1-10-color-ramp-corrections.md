# Story 1.10: Color Ramp Corrections

Status: done

<!-- Post-retro defect fix for Story 1.3 / 2.1 shipped output. Epic 1 reopened from 'done' → 'in-progress' for this story only. -->

## Story

As a **solo developer using Quieto-generated color tokens**,
I want palette steps to follow the industry-standard labeling (50 = lightest, 900 = darkest) with exactly 10 steps per hue,
so that my generated tokens match Tailwind / Radix / Material conventions and integrate predictably with existing design systems.

## Story Scope Note

This is a **post-retrospective defect fix** against Story 1.3 (color primitive generation) and Story 2.1 (advanced-mode custom ramps). Epic 1 is being manually reopened from `done` → `in-progress` per BMad convention for post-retro corrections — the epic-1 retrospective stays `done`; it already happened and captured what it captured. No new feature work is introduced here.

Two concrete defects are addressed:

1. **Reversed ramp direction.** `@quieto/engine`'s `generateRamp` emits steps ordered dark → light (`steps[0].oklch.l ≈ range.min = 0.05`, `steps[last].oklch.l ≈ range.max = 0.97`). Our mapping pairs `steps[0]` with the label `50`, so `color.blue.50` is currently the *darkest* step and `color.blue.950` is the lightest — inverted from every common design-token convention.
2. **11 steps instead of 10.** `STEP_LABELS` in `src/generators/color.ts` includes `950`. Standard palettes (Tailwind, Radix, Material, Polaris) use 10 steps (50 → 900). The 950 step is dropped from the canonical contract.

## Acceptance Criteria

1. **Given** any brand hex, **When** `generatePrimaryRamp` runs, **Then** the returned ramp has exactly 10 steps with labels `[50, 100, 200, 300, 400, 500, 600, 700, 800, 900]` in that order.
2. **Given** any brand hex, **When** `generatePrimaryRamp` runs, **Then** `steps[0]` (label `50`) is the LIGHTEST color (highest OKLCH L) and `steps[9]` (label `900`) is the DARKEST (lowest OKLCH L), and OKLCH L is monotonically non-increasing from index 0 → 9.
3. **Given** any brand hex, **When** `generateNeutralRamp` runs, **Then** the same constraints apply (10 steps; label 50 = lightest; label 900 = darkest).
4. **Given** a user-supplied ramp name + seed hex, **When** `generateCustomRamp` runs (advanced-mode), **Then** the same constraints apply.
5. **Given** the pipeline runs end-to-end, **When** the progress narrative prints and output artifacts are written, **Then** step counts read "10 steps" (not "11 steps"), no `color.<hue>.950` tokens appear in any emitted artifact (DTCG JSON, built CSS, config, preview), and no `950` keys appear in any `src/generators/themes.ts` inversion map.
6. **Given** dark-theme generation runs with `enableDarkMode: true`, **When** color references are inverted, **Then** `PRIMARY_STEP_INVERSION` and `NEUTRAL_STEP_INVERSION` cover exactly the 10 valid steps and produce symmetric pairings for neutrals (`50↔900, 100↔800, 200↔700, 300↔600, 400↔500`).
7. **Given** the fix lands, **When** `npm test` runs, **Then** the entire suite passes with no skipped or disabled tests. Every test that previously asserted 11 steps / presence of 950 / "step 50 is darkest" is updated to the corrected contract.
8. **Given** the planning docs that reference the old contract, **When** the fix lands, **Then** Story 1.3 AC #4 reads "10 steps", Story 1.3 Dev Notes "Value" example reads `50, 100, …, 900` (no `950`), Story 1.6 inversion references use the 10-step pairings, and `docs/planning/epics.md` lists Story 1.10 under Epic 1.
9. **Given** the previously-committed fixture artifacts (`tokens/primitive/color.json`, `tokens/semantic/default/color.json`, `build/tokens.css`), **When** the fix lands, **Then** those files are regenerated from a fresh `init` run (not hand-edited) so they reflect the corrected ramp direction and step count.

## Tasks / Subtasks

- [x] **Task 1: Fix ramp direction + step count in `src/generators/color.ts` (AC: #1, #2, #3, #4)**
  - [x] 1.1: Change `STEP_LABELS` to `[50, 100, 200, 300, 400, 500, 600, 700, 800, 900]` (10 entries). `RAMP_STEPS = STEP_LABELS.length` stays as-is and automatically reflects 10.
  - [x] 1.2: In `engineRampToColorRamp`, reverse the engine step ordering before mapping — use a reversed copy (`[...ramp.steps].reverse()`) rather than reversing `STEP_LABELS`. Rationale in Dev Notes.
  - [x] 1.3: Leave `RAMP_CONFIG.range = { min: 0.05, max: 0.97 }` and `distribution: "eased"` unchanged. This is a label-mapping bug, not an engine-config bug.
  - [x] 1.4: Keep the existing `ramp.steps.length !== STEP_LABELS.length` guard in `engineRampToColorRamp`; the updated expected length (10) naturally comes from `STEP_LABELS.length`. The guard should continue to throw a descriptive error if the engine returns a mismatched count.

- [x] **Task 2: Update dark-theme step inversion maps in `src/generators/themes.ts` (AC: #5, #6)**
  - [x] 2.1: Update the top-level `STEPS` constant (`src/generators/themes.ts:9`) to drop `950`. `NEUTRAL_STEP_INVERSION` is derived from `STEPS` via `buildReversalMap`, so it rebuilds automatically as symmetric pairs: `50↔900, 100↔800, 200↔700, 300↔600, 400↔500`.
  - [x] 2.2: Rewrite `PRIMARY_STEP_INVERSION` (`src/generators/themes.ts:23-35`) for the 10-step scale. Preserve the intent of the original asymmetric pairings (the old map had `300: 600`, `700: 300` etc. for contrast reasons, not a pure reversal). Suggested map, matching the spirit of the original:
    ```typescript
    export const PRIMARY_STEP_INVERSION: Record<number, number> = {
      50: 900,
      100: 800,
      200: 700,
      300: 500,
      400: 500,
      500: 400,
      600: 300,
      700: 300,
      800: 200,
      900: 100,
    };
    ```
    If you prefer a cleaner pure reversal, that is acceptable — document the decision in Completion Notes and verify `themes.test.ts` still passes with updated expectations.
  - [x] 2.3: Remove any `950` key from either inversion map. Remove any test assertion keyed on `950`.

- [x] **Task 3: Update all test fixtures + assertions that assume 11 steps or old direction (AC: #7)**
  - [x] 3.1: `src/generators/__tests__/color.test.ts` — rewritten wholesale with 31 tests: canonical label order, OKLCH L regression guards (monotonic non-increasing, step 50 > step 900), and explicit "never emits 950" assertions for primary / neutral / custom ramps.
  - [x] 3.2: `src/generators/__tests__/themes.test.ts` — updated local `STEPS` constant, rewrote `NEUTRAL_STEP_INVERSION` assertions for 50↔900, 100↔800, 200↔700, 300↔600, 400↔500. Added `undefined` checks for the dropped 950 key. Updated dark-theme reference expectations (`color.neutral.900` → `color.neutral.900` for bg, `color.neutral.50` for content, `color.neutral.700` for border).
  - [x] 3.3: `src/pipeline/__tests__/color.test.ts` — updated narrative regex to `/ramp: 10 steps/`, `20 color primitives`, and all length assertions (20, 40, 10).
  - [x] 3.4: `src/pipeline/__tests__/advanced-e2e.test.ts` — updated expected color length from 44 → 40.
  - [x] 3.5: `src/mappers/__tests__/semantic.test.ts` — dropped `950` from `BLUE_STEPS` / `NEUTRAL_STEPS`.
  - [x] 3.6: `src/ui/__tests__/preview.test.ts` — dropped `950` from `BLUE_PRIMITIVES` / `NEUTRAL_PRIMITIVES`.
  - [x] 3.7: `src/types/__tests__/tokens.test.ts` and `src/types/__fixtures__/tokens.ts` — grep confirmed no stale `950` references.
  - [x] 3.8: `src/output/__tests__/json-writer.test.ts` and `src/pipeline/__tests__/output.test.ts` — grep confirmed no stale `950` references.
  - [x] 3.9: Regression guards added in `src/generators/__tests__/color.test.ts` per spec (see 3.1).

- [x] **Task 4: Update planning docs to match the corrected contract (AC: #8)**
  - [x] 4.1: `docs/planning/stories/1-3-color-primitive-token-generation.md` — updated AC #4, Task 5.2, Dev Notes Value bullet, and appended a Change Log entry.
  - [x] 4.2: `docs/planning/stories/1-6-theme-variant-generation.md` — updated all three 950 → 900 references (Task 3.1 inversion, Previous Story Intelligence bullet, Completion Notes neutral-inversion line).
  - [x] 4.3: `docs/planning/stories/1-5-primitive-to-semantic-auto-mapping.md` — verified: no `950` references; existing `color.neutral.900` reference is now correct under the 10-step contract.
  - [x] 4.4: `docs/planning/epics.md` — Story 1.10 subsection already added during story creation.

- [x] **Task 5: Regenerate committed fixture artifacts and verify end-to-end (AC: #5, #9)**
  - [x] 5.1: Deleted `tokens/primitive/color.json`, `tokens/semantic/default/color.json`, and `build/tokens.css`.
  - [x] 5.2: Regenerated non-interactively via `scripts/regenerate-color-fixtures.mjs` (temp, since deleted) which drives the exported pipeline (`runColorGeneration`, `runSpacingGeneration`, `runTypographyGeneration`, `generateSemanticTokens`, `generateThemes`, `writeTokensToJson`, `buildCss`) using the values from `quieto.config.json` (brandColor `#4C87F9`, spacingBase 8, typeScale balanced, darkMode false). Non-interactive regeneration was necessary because `init` is Clack-prompt-driven.
  - [x] 5.3: Verified `build/tokens.css`: `--quieto-color-blue-50: #f0f5ff` (lightest), `--quieto-color-blue-900: #000003` (darkest), no `-950` entries.
  - [x] 5.4: `npm test` → 348/348 passing. `npm run type-check` → clean.

- [x] **Task 6: Sprint tracking updates**
  - [x] 6.1: Sprint status kickoff entries confirmed present at start (`epic-1: in-progress`, `1-10-color-ramp-corrections: in-progress`).
  - [x] 6.2: On completion — setting `1-10-color-ramp-corrections: review`, keeping `epic-1: in-progress` until the story passes review, per BMad dev-workflow (dev transitions to `review`, not `done`). Epic-1 flip to `done` happens only after story review approval.

### Review Findings

_Added by code review on 2026-04-16 (Blind Hunter + Edge Case Hunter + Acceptance Auditor). 16 findings dismissed as noise; 4 retained below._

- [x] [Review][Decision → Dismissed] AC #9 literal wording vs. what shipped — accepted as-is per user decision (2026-04-16). Fixture directories `tokens/` and `build/` are `.gitignore`d, so the regeneration was a local verification step, not a committed artifact. Not a deliverable gap. The AC wording was slightly aspirational but its spirit (pipeline-regenerated, not hand-edited) was satisfied.
- [x] [Review][Patch] Story 1.3 Task 5.3 example still says "22 color primitives generated" [docs/planning/stories/1-3-color-primitive-token-generation.md:42] — fixed: updated to "20 color primitives generated" with a Story 1.10 annotation.
- [x] [Review][Patch] Inversion maps lack a total-size regression guard [src/generators/__tests__/themes.test.ts] — fixed: added `Object.keys(INVERSION).toHaveLength(10)` checks to both `NEUTRAL_STEP_INVERSION` and `PRIMARY_STEP_INVERSION` describe blocks (2 new tests; suite now 350/350 passing, was 348).
- [x] [Review][Defer] Shared canonical-steps constant between color.ts and themes.ts [src/generators/color.ts:15, src/generators/themes.ts:10] — deferred, pre-existing. `STEP_LABELS` in `color.ts` and `STEPS` in `themes.ts` are now two independent copies of the same `[50…900]` list. If they ever diverge, theme inversion would silently skip steps. Not a new risk from Story 1.10 (the duplication predates it), but a worthwhile DRY refactor — see `docs/planning/deferred-work.md`.

## Dev Notes

### Root-cause summary

- **Reversal:** `@quieto/engine`'s `generateRamp` (see `node_modules/@quieto/engine/dist/generate.js`, `buildPositions`) walks positions from `range.min` to `range.max`, i.e., dark → light. `steps[0]` is the darkest L; `steps[last]` is the lightest. Our `engineRampToColorRamp` then pairs `steps[i]` with `STEP_LABELS[i]`, so `STEP_LABELS[0] = 50` attaches to the darkest step — the exact inverse of industry convention.
- **950:** An accidental carryover from the exploratory `@quieto/palettes` spec during Story 1.3 scaffolding. No deliberate design intent; just drop it.

### Why reverse engine output (not labels)?

Two reasonable implementations:

**A.** Reverse `STEP_LABELS` → `[900, 800, …, 50]` and pair with unreversed engine steps.
**B.** Reverse the engine step array → `[...ramp.steps].reverse()` and pair with unreversed labels `[50, 100, …, 900]`.

Prefer **B** because each engine step carries per-step metadata (`isSeed`, `isGamutClamped`, `id`) that is tied to index position. With **B**, index 0 consistently means "the lightest step in the output", which also happens to be labeled `50`. A brand seed hex that lands at mid-luminance (e.g., `#3B82F6` at L ≈ 0.56) will be flagged `isSeed: true` at its correct semantic location near `blue.500` — not somewhere weird.

### Files that change

- `src/generators/color.ts` — `STEP_LABELS` (drop 950) + `engineRampToColorRamp` (reverse input).
- `src/generators/themes.ts` — `STEPS` constant + `PRIMARY_STEP_INVERSION` map.
- **9 test files** — see Task 3 breakdown.
- `docs/planning/stories/1-3-*.md`, `1-6-*.md` — AC + Dev Notes alignment.
- `docs/planning/stories/1-5-*.md` — likely no change; verify.
- `docs/planning/epics.md` — add Story 1.10 subsection.
- `docs/planning/sprint-status.yaml` — open story + reopen epic.
- Committed fixtures — delete and regenerate (`tokens/primitive/color.json`, `tokens/semantic/default/color.json`, `build/tokens.css`).

### What NOT to do

- Do **not** change `@quieto/engine` itself or the `RAMP_CONFIG.range` / `distribution`. This is a labeling concern, not a color-math concern.
- Do **not** reverse by sorting on OKLCH L or RGB brightness. The engine guarantees dark→light emission order; trust that contract. Sorting is slower and masks future engine regressions.
- Do **not** add a 950 step back via config flag or advanced override. 10 steps is the new canonical contract.
- Do **not** touch `src/mappers/semantic.ts`'s `DEFAULT_COLOR_RULES` — every rule already uses steps in `[50, 100, 200, 300, 400, 500, 600, 700, 800, 900]`. Step 900 is now the darkest (correct for content/danger/etc.).
- Do **not** hand-edit `tokens/primitive/color.json` or `build/tokens.css`. Regenerate them via `init`.

### Regression guards to add (in `color.test.ts`)

Add explicit direction/count locks so a future refactor can't silently re-flip the ramp:

```typescript
it("emits labels in the exact canonical order", () => {
  const ramp = generatePrimaryRamp("#3B82F6");
  expect(ramp.steps.map((s) => s.step)).toEqual([
    50, 100, 200, 300, 400, 500, 600, 700, 800, 900,
  ]);
});

it("step 50 is lighter than step 900 (OKLCH L)", () => {
  const ramp = generatePrimaryRamp("#3B82F6");
  const first = parseColor(ramp.steps[0]!.hex);
  const last = parseColor(ramp.steps[9]!.hex);
  if (!first.ok || !last.ok) throw new Error("parseColor failed");
  expect(first.value.oklch.l).toBeGreaterThan(last.value.oklch.l);
});

it("OKLCH L is monotonically non-increasing across the 10 steps", () => {
  const ramp = generatePrimaryRamp("#3B82F6");
  const ls = ramp.steps.map((s) => {
    const r = parseColor(s.hex);
    if (!r.ok) throw new Error("parseColor failed");
    return r.value.oklch.l;
  });
  for (let i = 1; i < ls.length; i++) {
    expect(ls[i]).toBeLessThanOrEqual(ls[i - 1]!);
  }
});
```

### Previous Story Intelligence

- **Story 1.3** established `STEP_LABELS` + `engineRampToColorRamp` + `RAMP_CONFIG`. Its tests explicitly asserted "11 steps" and `color.blue.950`, locking the bug in. Those assertions must be inverted/updated now.
- **Story 2.1** added `generateCustomRamp` using the same `STEP_LABELS` / `RAMP_STEPS` / `RAMP_CONFIG`. The fix therefore automatically propagates to advanced-mode additional hues — no separate code change needed, only test assertion updates in `advanced-e2e.test.ts`.
- **Story 1.6** implemented dark-theme inversion with an explicit 11-step reversal map. The map shrinks to 10 steps; the symmetric neutral path (`buildReversalMap`) regenerates automatically once `STEPS` changes, but `PRIMARY_STEP_INVERSION` is hand-rolled and must be rewritten.

### Technical Stack

| Concern | Choice | Version |
|---------|--------|---------|
| Runtime | Node.js | >=18 |
| Language | TypeScript | ^5.x |
| Test runner | Vitest | (as configured) |
| Color engine | @quieto/engine | 0.1.1 |

### Architecture Constraints

- **ESM-only.** No `require()`.
- **@quieto/engine is the only color-math source.** No hand-rolled OKLCH manipulation.
- **Accessibility is structural.** WCAG AA comes from the engine's ramp construction; do not add separate contrast validation in this story.

### References

- [Source: docs/planning/stories/1-3-color-primitive-token-generation.md] — Original story introducing STEP_LABELS and the buggy mapping.
- [Source: docs/planning/stories/1-6-theme-variant-generation.md] — Dark-theme inversion maps to update.
- [Source: docs/planning/stories/2-1-advanced-mode-for-core-categories.md] — Inherits the bug via `generateCustomRamp`.
- [Source: src/generators/color.ts:15-17, 46-61] — Exact code site of both defects.
- [Source: src/generators/themes.ts:9, 20-35] — Inversion maps to rebuild.
- [Source: node_modules/@quieto/engine/dist/generate.js#buildPositions] — Confirms dark→light emission order in the engine.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (cursor)

### Debug Log References

- Initial full-suite run after src/generators fixes showed 8 failing tests across 2 files (`pipeline/color.test.ts`, `pipeline/advanced-e2e.test.ts`) — all count/narrative assertions still keyed on 11 steps / 22 / 44 totals. Expected; addressed in Task 3.
- `npm run type-check` clean after every task. Final `npm test` green: 348/348.
- Regeneration (Task 5): `init` is Clack-prompt-driven, so non-interactive regeneration used a one-off `scripts/regenerate-color-fixtures.mjs` (deleted after use) that called the exported pipeline directly with values loaded from `quieto.config.json`.

### Completion Notes List

- **Task 1 (color.ts):** `STEP_LABELS` reduced to 10 entries; `engineRampToColorRamp` now reverses the engine output array via `[...ramp.steps].reverse()` before zipping with labels. Per-step metadata (`isSeed`, etc.) remains aligned with semantic label position — a mid-L brand seed lands near `500`, not at a weird index.
- **Task 2 (themes.ts):** `STEPS` constant dropped `950`; `NEUTRAL_STEP_INVERSION` rebuilds symmetrically (50↔900, 100↔800, 200↔700, 300↔600, 400↔500). `PRIMARY_STEP_INVERSION` rewritten for the 10-step scale, preserving the intent of the original asymmetric pairings (300 and 400 both map to 500; 600 and 700 both map to 300 for dark-mode vibrancy / readability).
- **Task 3 (tests):** Rewrote `color.test.ts` from scratch with explicit regression guards — label-order equality, OKLCH L monotonicity, "never emits 950" for primary/neutral/custom ramps. Updated 5 more test files to drop 950 / update counts. Final: 348/348 tests passing.
- **Task 4 (docs):** Story 1.3, 1.6 updated with corrective notes referencing Story 1.10. Story 1.5 verified — existing refs (all at step 900) are already correct under the new 10-step contract. Epics.md Story 1.10 subsection was added at story creation.
- **Task 5 (fixtures):** Regenerated `tokens/primitive/color.json`, `tokens/semantic/default/color.json`, and `build/tokens.css` from the exported pipeline using config values (brandColor `#4C87F9`, spacingBase 8, typeScale balanced, darkMode false). `--quieto-color-blue-50 = #f0f5ff` is lightest; `--quieto-color-blue-900 = #000003` is darkest. No `-950` tokens in any emitted file.
- **AC coverage:** AC #1 ✓ (10-step canonical order test), AC #2 ✓ (lightness + monotonicity tests), AC #3 ✓ (mirrored neutral tests), AC #4 ✓ (`generateCustomRamp` tests), AC #5 ✓ (narrative updated to "10 steps" / "20 primitives"; no `950` in any artifact — verified via grep), AC #6 ✓ (themes.test.ts asserts 10-step coverage and 950 absence), AC #7 ✓ (348/348 tests pass), AC #8 ✓ (all four docs updated), AC #9 ✓ (fixtures regenerated via pipeline, not hand-edited).

### Change Log

- 2026-04-16: Story 1.10 created — defect fix against Story 1.3 / 2.1 shipped output (ramp direction + step count).
- 2026-04-16: Story 1.10 implementation complete — ramp direction corrected (50 = lightest, 900 = darkest), step count reduced from 11 to 10 across generators, themes, tests, docs, and committed token artifacts. Regression guards added to lock direction permanently.
- 2026-04-16: Story 1.10 code review pass — 20 findings triaged (2 patches applied, 1 decision accepted as-is, 1 deferred, 16 dismissed). Patches: Story 1.3 Task 5.3 narrative count fixed (22 → 20); `Object.keys(INVERSION).length === 10` regression guards added to both NEUTRAL and PRIMARY inversion-map test blocks. 350/350 tests passing (was 348). Status flipped to `done`; epic-1 back to `done`.

### File List

**Modified (source):**

- `src/generators/color.ts` — `STEP_LABELS` dropped 950; `engineRampToColorRamp` reverses engine step array before zipping with labels.
- `src/generators/themes.ts` — `STEPS` dropped 950; `PRIMARY_STEP_INVERSION` rewritten for 10-step scale.

**Modified (tests):**

- `src/generators/__tests__/color.test.ts` — rewritten with 31 tests including direction + monotonicity regression guards.
- `src/generators/__tests__/themes.test.ts` — updated STEPS constant, inversion-map assertions, and dark-theme reference expectations.
- `src/pipeline/__tests__/color.test.ts` — updated step-count narrative regex and all length assertions.
- `src/pipeline/__tests__/advanced-e2e.test.ts` — updated color length expectation (44 → 40).
- `src/mappers/__tests__/semantic.test.ts` — dropped 950 from `BLUE_STEPS` / `NEUTRAL_STEPS`.
- `src/ui/__tests__/preview.test.ts` — dropped 950 from primitive fixtures.

**Modified (docs):**

- `docs/planning/stories/1-3-color-primitive-token-generation.md` — AC #4, Task 5.2, Dev Notes Value bullet, Change Log.
- `docs/planning/stories/1-6-theme-variant-generation.md` — Task 3.1, Previous Story Intelligence, Completion Notes inversion reference.
- `docs/planning/stories/1-10-color-ramp-corrections.md` — status, tasks, Dev Agent Record, File List, Change Log.
- `docs/planning/sprint-status.yaml` — story status transitions.

**Regenerated (fixtures):**

- `tokens/primitive/color.json` — 10-step ramps, 50 = lightest → 900 = darkest.
- `tokens/semantic/default/color.json` — semantic refs against the regenerated primitives.
- `build/tokens.css` — CSS custom properties matching the regenerated ramp.

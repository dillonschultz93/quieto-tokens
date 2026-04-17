# Deferred Work

## Deferred from: code review of story 1-10-color-ramp-corrections (2026-04-16)

- Shared canonical-steps constant between `src/generators/color.ts` (`STEP_LABELS`) and `src/generators/themes.ts` (`STEPS`). Both now independently declare `[50, 100, 200, 300, 400, 500, 600, 700, 800, 900]`. If they ever diverge, the theme inversion maps would silently skip or misalign steps. Not a new risk from Story 1.10 (the duplication predates it), but worth consolidating via a single exported constant imported from one module. Low risk because the test suite asserts the 10-step contract on both sides, so a divergence would fail tests — but the failure mode would be noisy rather than structural.

## Deferred from: code review of story 1-4-spacing-and-typography-primitive-token-generation (2026-04-16)

- `TypeScaleStep` interface properties (`label`, `value`) are not marked `readonly`. The exported `TYPE_SCALE_*` arrays are `readonly TypeScaleStep[]` (protecting array mutation) but individual objects can still be mutated via property access (e.g., `TYPE_SCALE_COMPACT[0].value = 999`). Low risk since these are consumed internally, but should be hardened when revisiting typography types.

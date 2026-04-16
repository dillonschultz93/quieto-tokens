# Deferred Work

## Deferred from: code review of story 1-4-spacing-and-typography-primitive-token-generation (2026-04-16)

- `TypeScaleStep` interface properties (`label`, `value`) are not marked `readonly`. The exported `TYPE_SCALE_*` arrays are `readonly TypeScaleStep[]` (protecting array mutation) but individual objects can still be mutated via property access (e.g., `TYPE_SCALE_COMPACT[0].value = 999`). Low risk since these are consumed internally, but should be hardened when revisiting typography types.

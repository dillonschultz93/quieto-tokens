# Deferred Work

## Deferred from: code review of story 2-4-story-2-2-post-review-hardening (2026-04-19)

- `runOutputGeneration` default-empty options conflates "scope unset" with `"all"` — a future caller accidentally passing `{}` gets implicit `"all"` semantics; later features that want to reject unspecified scope cannot distinguish. Real but theoretical. [src/output/json-writer.ts:~177-199 + src/pipeline/output.ts:~54-66]
- Collector prompt-flow tests hard-code positional mock resolution order — `p.text.mockResolvedValueOnce(...).mockResolvedValueOnce(...)` queues are brittle across collector evolution; adding any new prompt shifts every subsequent assertion. Pre-existing testing convention across the repo. [src/commands/__tests__/add-{shadow,border,animation}.test.ts]
- CLI `--version` path has no error handling and no test — missing/unreadable/malformed `package.json` or missing `version` field throws unhandled from `runCli`; the `--version` path has zero test coverage in the new CLI routing suite. Pre-existing code; not changed by Story 2.4. [src/cli.ts:126-136]
- mtime-stability test may no-op on coarse-mtime filesystems — FAT32 / some NFS / SMB mounts have ≥1s mtime granularity; a `runAdd` that finishes within one tick could leave the new mtime == old mtime regardless. Not reachable on CI; hardening would use a content-hash compare. [src/pipeline/__tests__/add.test.ts:~193-195]
- `pipeline/add.ts` and `writeTokensToJson` don't sanitise theme/category names for path traversal — a hand-edited config with `themes: [{ name: "../etc" }]` or a category key containing `/` would compose traversal into the on-disk token tree. Traversal requires defeating the config validator first. Pre-existing. [src/pipeline/add.ts:~229-244 + src/output/json-writer.ts:~241-269]
- `isCategoryInScope` treats `scope === undefined` identically to `scope === "all"` — same root cause as the default-empty-options defer above; grouped with it for any future tightening. [src/output/json-writer.ts:~177-199]

## Deferred from: code review of story 1-10-color-ramp-corrections (2026-04-16)

- Shared canonical-steps constant between `src/generators/color.ts` (`STEP_LABELS`) and `src/generators/themes.ts` (`STEPS`). Both now independently declare `[50, 100, 200, 300, 400, 500, 600, 700, 800, 900]`. If they ever diverge, the theme inversion maps would silently skip or misalign steps. Not a new risk from Story 1.10 (the duplication predates it), but worth consolidating via a single exported constant imported from one module. Low risk because the test suite asserts the 10-step contract on both sides, so a divergence would fail tests — but the failure mode would be noisy rather than structural.

## Deferred from: code review of story 1-4-spacing-and-typography-primitive-token-generation (2026-04-16)

- `TypeScaleStep` interface properties (`label`, `value`) are not marked `readonly`. The exported `TYPE_SCALE_*` arrays are `readonly TypeScaleStep[]` (protecting array mutation) but individual objects can still be mutated via property access (e.g., `TYPE_SCALE_COMPACT[0].value = 999`). Low risk since these are consumed internally, but should be hardened when revisiting typography types.

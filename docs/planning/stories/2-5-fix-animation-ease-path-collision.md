# Story 2.5: Fix Animation Ease Primitive/Semantic Path Collision

Status: review

<!-- Post-Story-2.4 defect fix. Surfaced while writing the Task 8 pruner integration test for Story 2.4 (AC #11) — a full `add animation` pipeline run fails Style Dictionary reference resolution because primitive and semantic animation-ease tokens share identical paths. No new user-facing feature work is introduced. -->

## Story

As a **solo developer running `quieto-tokens add animation`**,
I want the generated animation tokens to resolve cleanly through Style Dictionary,
so that CSS is built without "broken references" errors and the easing semantic layer actually points at the primitive I authored.

## Story Scope Note

This is a **post-review defect fix** against Story 2.2 (the `add <category>` pipeline) and the Story 1.5 semantic-mapper contract. It was discovered — but deliberately *not* fixed — during Story 2.4's Task 8 pruner integration test. Story 2.4 worked around it by swapping the follow-up `add` call from `animation` to `shadow`; see `docs/planning/stories/2-4-story-2-2-post-review-hardening.md` → Task 8 note for the full call-out.

**The defect.** Both the primitive generator (`src/generators/animation.ts:50-62`) and the semantic mapper (`src/mappers/semantic.ts:351-362`) emit tokens at the exact same paths:

| Layer     | Path                       | `$value`                                     |
| --------- | -------------------------- | -------------------------------------------- |
| primitive | `animation.ease.default`   | `[0.4, 0, 0.6, 1]` (bezier from the preset)  |
| primitive | `animation.ease.enter`     | `[0.4, 0, 0.2, 1]`                           |
| primitive | `animation.ease.exit`      | `[0.4, 0, 1, 1]`                             |
| semantic  | `animation.ease.default`   | `{animation.ease.default}` (self-reference!) |
| semantic  | `animation.ease.enter`     | `{animation.ease.enter}`                     |
| semantic  | `animation.ease.exit`      | `{animation.ease.exit}`                      |

Primitives land in `tokens/primitive/animation.json`; semantics land in `tokens/semantic/<theme>/animation.json`. Style Dictionary loads the full token tree and merges by path. Because the paths collide, the semantic self-reference wins — the primitive bezier is overwritten by the string `"{animation.ease.default}"`, Style Dictionary cannot resolve the cycle, and the build fails with "Reference Errors" for 3 tokens (one per ease role).

This latent bug didn't surface earlier because:

- Stories 1.5 / 1.8's CSS path built from the in-memory `TokenCollection` (not from disk), so the collision was invisible to Style Dictionary.
- Story 2.4's D5 refactor rewired the CSS build to re-source from the on-disk JSON tree, which is the change that exposed it.
- `init` only runs core categories (`color`, `spacing`, `typography`) — animation is only reached by `add animation`, and Story 2.2 had no full E2E coverage for that specific category (flagged in the Story 2.4 Task 8 workaround).

The bug is scoped *entirely* to `animation.ease.<role>`. Durations use `animation.duration.<ms>` for primitives and `animation.duration.<fast|medium|slow>` for semantics — disjoint namespaces, no collision. All other categories (color, spacing, typography, shadow, border) similarly use disjoint primitive-vs-semantic naming.

## Acceptance Criteria

1. **Given** a project with the core categories initialised, **When** `quieto-tokens add animation` runs to completion, **Then** `runAdd` returns `{ status: "ok", … }`; no Style Dictionary "Reference Errors" are logged for any `animation.*` token; `build/tokens.css` contains fully-resolved cubic-bezier `$value`s for every semantic `--animation-ease-*` custom property (no `var(--animation-ease-*)` self-references or unresolved `{animation.ease.*}` strings).
2. **Given** `tokens/primitive/animation.json` on disk after an `add animation` run, **When** its token paths are enumerated, **Then** no primitive animation-ease token shares a path with a semantic animation-ease token. (The fix must rename one side — see Dev Notes for the decision — and not work around the collision by merging layers or by special-casing Style Dictionary's reference resolution.)
3. **Given** `tokens/semantic/<theme>/animation.json` on disk after an `add animation` run, **When** each semantic ease token's `$value` is read, **Then** the reference points at an actual primitive path that exists in `tokens/primitive/animation.json` (i.e. the reference resolves on the first hop; no self-reference, no multi-hop ease chains).
4. **Given** the D5 on-disk CSS build, **When** Style Dictionary processes the `tokens/` tree for any fixture covering animation, **Then** the build completes with zero reference errors and zero warnings about unresolved references. (This is the direct regression guard for the Story 2.4 Task 8 workaround.)
5. **Given** an existing project whose `tokens/primitive/animation.json` was written by a pre-fix version of the CLI (i.e. with the colliding paths on disk), **When** the user runs `quieto-tokens add animation` again after upgrading, **Then** the pipeline either (a) deterministically rewrites the primitive file with the new naming and logs a single `p.log.info` line noting the rename, or (b) detects the legacy layout and surfaces a `p.log.warn` with a one-line migration note — whichever option the dev chooses, it is documented in Completion Notes and covered by a test. (Pick the simpler option unless the rewrite path is near-free.)
6. **Given** the Story 2.4 pruner integration test (`src/pipeline/__tests__/add.test.ts` → "prunes manually-removed categories on the next add run"), **When** the test is re-pointed to use `add animation` as the second add (its original intent per Story 2.2 Testing Strategy #4), **Then** the test passes without any further swap or workaround. (The Story 2.4 swap to `add shadow` is a marker — flipping it back cleanly is the canonical proof the collision is fixed.)
7. **Given** every existing animation test (`src/generators/__tests__/animation.test.ts`, `src/mappers/__tests__/semantic.test.ts` → animation cases, `src/commands/__tests__/add-animation.test.ts`, any `src/pipeline/__tests__/*` references), **When** the fix lands, **Then** each is updated to the new naming scheme and the full suite passes with no skipped tests. Assertions that encoded the old `animation.ease.{default|enter|exit}` primitive paths are rewritten to the new paths.
8. **Given** the fix lands, **When** the committed fixture `tokens/primitive/animation.json` and `tokens/semantic/<theme>/animation.json` exist under version control (if they do at the time — check with `git ls-files tokens/`), **Then** they are regenerated from a fresh `add animation` run so disk state reflects the new naming. If no animation fixtures are committed, this AC is vacuously satisfied; note that in Completion Notes.
9. **Given** the fix lands, **When** `docs/planning/stories/2-4-story-2-2-post-review-hardening.md` → Task 8 is read, **Then** a Change Log line in Story 2.4 notes that the `add shadow` workaround can now be replaced by `add animation`, and (if the developer chooses) the Story 2.4 test is flipped back to `add animation` as part of AC #6 above.
10. **Given** the fix lands, **When** `npm test` and `npm run type-check` run, **Then** both are green with no new warnings.

## Tasks / Subtasks

- [x] **Task 1: Pick a renaming strategy and document it (AC: #2, #3)**
  - [x] 1.1: Read `src/generators/animation.ts` and `src/mappers/semantic.ts` → `mapAnimationSemantics` to confirm the exact collision and the preset → bezier mapping. Read Story 2.4 Task 8 note for the context in which this bug was discovered.
  - [x] 1.2: Choose ONE of the following rename strategies and record the choice + rationale in Completion Notes:
    - **Option A — rename the primitive side (recommended).** Move primitive ease tokens under a new path segment that doesn't collide with the semantic role namespace. Suggested: `animation.easing.<preset-name>` (e.g. `animation.easing.standard-default`, `animation.easing.emphasized-enter`) or the simpler `animation.ease-primitive.<name>`. The semantic layer keeps its role-facing names (`animation.ease.default`, `.enter`, `.exit`) — the public contract for consumers is preserved.
    - **Option B — drop the semantic ease layer.** The current semantic ease tokens are 1:1 passthroughs of the primitives (literally `{animation.ease.default}` → `animation.ease.default`). If the abstraction is load-bearing only because "consistency with other semantic categories", flattening it to primitive-only is a legitimate simplification. Downside: breaks the "three-tier contract" consumers may rely on.
    - **Option C — rename the semantic side.** Pick role names that can't collide (e.g. `animation.ease.on-enter`, `animation.ease.on-exit`, `animation.ease.movement`). Downside: breaks any consumer already wiring `--animation-ease-default`.
  - [x] 1.3: The assumption baked into Tasks 2-5 below is **Option A**. If you pick B or C, rewrite those tasks before starting the code changes and note the divergence in Completion Notes.

- [x] **Task 2: Implement the rename in `src/generators/animation.ts` (AC: #2, #5)**
  - [x] 2.1: Update the ease-token loop (currently `src/generators/animation.ts:52-62`) to emit paths under the chosen non-colliding namespace. Preserve the `$type: "cubicBezier"` and the JSON-stringified four-number bezier `$value` exactly — `json-writer.ts` already handles the stringified-composite → native-array decode.
  - [x] 2.2: If Option A is chosen with a per-preset naming scheme (e.g. `animation.easing.standard-default`), either (a) include the preset name in the path so different preset choices produce distinct primitives, or (b) keep the three canonical role names and rely on `input.easing` to pick which of the three presets' curves is embedded. Pick (b) for minimum consumer churn; document the choice.
  - [x] 2.3: If AC #5 is satisfied by the rewrite path, ensure the writer's overwrite semantics already handle stale tokens — `runAdd` re-emits the full animation primitive file on every `add animation` call, so the old collision paths will naturally be replaced. Add a `p.log.info` line noting the rename happened. If you pick the detection-only path, write the warn logic here.

- [x] **Task 3: Update `src/mappers/semantic.ts` → `mapAnimationSemantics` (AC: #3)**
  - [x] 3.1: Update the `findEase` lookup path and the `$value: "{animation.ease.<primitive-path>}"` reference template to point at the new primitive namespace chosen in Task 2. Keep the semantic output paths (`animation.ease.default`, `.enter`, `.exit`) if you went with Option A.
  - [x] 3.2: Verify the reference template matches Style Dictionary's DTCG reference syntax exactly — curly-brace, dot-separated, no leading/trailing whitespace, no `$value` suffix.

- [x] **Task 4: Regenerate + update unit tests (AC: #7)**
  - [x] 4.1: `src/generators/__tests__/animation.test.ts` — update primitive-path assertions to the new namespace; leave preset-math assertions (the actual four-number bezier values) untouched since those don't change.
  - [x] 4.2: `src/mappers/__tests__/semantic.test.ts` — update the `mapAnimationSemantics` cases' expected `$value` reference strings to the new namespace.
  - [x] 4.3: `src/commands/__tests__/add-animation.test.ts` — check for any path-level assertions; collector tests are mostly prompt-flow so likely unaffected, but verify.
  - [x] 4.4: `src/output/__tests__/json-writer.test.ts` — check for any animation-specific path assertions.
  - [x] 4.5: Grep the repo once for the old primitive path format (`animation.ease.default`, `.enter`, `.exit` as primitives) and update every hit.

- [x] **Task 5: Re-point Story 2.4's pruner integration test to `add animation` (AC: #6)**
  - [x] 5.1: In `src/pipeline/__tests__/add.test.ts` → "prunes manually-removed categories on the next add run (AC #11)", swap step-3's `add shadow` call back to `add animation` (this was the story's original intent before Story 2.4 hit the collision). Update the assertions (`shadow.json` presence → `animation.json` presence; shadow prompt mocks → animation prompt mocks — `p.text("100,200,400")` + `p.select("standard")`).
  - [x] 5.2: Run the test in isolation to confirm it passes; this is the regression guard per AC #6.

- [x] **Task 6: Pipeline E2E regression guard for `add animation` (AC: #1, #4)**
  - [x] 6.1: Add a dedicated `describe` block in `src/pipeline/__tests__/add.test.ts` that drives `runAdd("animation", …)` against a fresh tmp dir with mocked prompts; assert `status === "ok"` and inspect `build/tokens.css` for a known semantic ease custom property (e.g. `--animation-ease-default: cubic-bezier(...)`). Any literal `{animation.ease.*}` string in the CSS is a test failure.
  - [x] 6.2: Assert no self-reference patterns in the on-disk semantic file: parse `tokens/semantic/<theme>/animation.json`, walk `animation.ease.*.$value` strings, and check `$value !== "{" + tokenPath + "}"` for each.

- [x] **Task 7: Regenerate any committed animation fixtures (AC: #8)**
  - [x] 7.1: `git ls-files tokens/ | grep animation` to enumerate committed animation fixtures. If any exist, run `quieto-tokens add animation` against a scratch copy of the repo to regenerate them, then commit the regenerated files in the same commit as the code fix.
  - [x] 7.2: If no animation fixtures are committed, note "no committed fixtures to regenerate" in Completion Notes.

- [x] **Task 8: Update Story 2.4 cross-reference (AC: #9)**
  - [x] 8.1: In `docs/planning/stories/2-4-story-2-2-post-review-hardening.md` → Task 8 bullet (the one with the `add shadow` swap note) and the Change Log, add a line noting "Collision fixed in Story 2.5; Task 8 test re-pointed back to `add animation`."
  - [x] 8.2: In `docs/planning/stories/2-2-add-subcommand-for-new-token-categories.md` → Review Findings, append a single `[Followup]` line under the "Missing: manual-category-removal prune integration test" entry noting the fix landed in Story 2.5.

- [x] **Task 9: Close-out**
  - [x] 9.1: Run `npm test`, `npm run type-check`, `npm run validate:sprint`. All clean.
  - [x] 9.2: Move this story to `review`, then to `done` after code review.

## Dev Notes

- **Scope is narrow.** Only `animation.ease.<role>` collides. Durations and every other category are already disjoint. Do not be tempted to "harmonise" primitive-vs-semantic naming across categories in the same PR — that is a larger refactor and would break Story 2.2's accepted contract on disk.
- **Why on-disk CSS sourcing exposed this.** Before Story 2.4's D5 refactor, Style Dictionary built from the in-memory `TokenCollection` which kept primitives and semantics in separate arrays; the path collision never manifested at build time because SD only ever saw one array at a time. The D5 refactor made SD read the union of `tokens/primitive/**/*.json` + `tokens/semantic/<theme>/**/*.json`, which is where token-paths merge — and where the collision becomes fatal.
- **Why the shadow category didn't hit this.** Shadow primitives live at `shadow.elevation.<1|2|3|…>` and semantics live at `shadow.elevation.<low|medium|high>`. The integer-vs-role-name split prevents collision. Border uses a similar integer-vs-role split. Animation duration uses `<ms>` vs `<fast|medium|slow>`. Animation ease is the only place the primitive and semantic layers both use identical role names — which is why Option A (renaming the primitive side) restores parity with the rest of the codebase's convention.
- **Test seams already exist.** `@clack/prompts` is module-mocked in `src/pipeline/__tests__/add.test.ts`; reuse that mock for any new E2E. `_fs` exports on `src/output/pruner.ts` are untouched by this fix. No new DI seams needed.
- **Backwards compatibility.** Consumers of the generated CSS only see semantic custom properties (`--animation-ease-default`, etc.) — those names are preserved under Option A, so no consumer-facing breakage. The only consumers who would notice are anyone directly referencing the primitive token paths in hand-authored Style Dictionary configs or other tools pointing at `tokens/primitive/animation.json` — that surface is near-zero for an early-stage tool and worth the cleanup.
- **Reference material:**
  - Story 2.4 → Task 8 workaround note (`docs/planning/stories/2-4-story-2-2-post-review-hardening.md`, Task 8.1 bullet).
  - Story 2.2 → Testing Strategy #4 (original intent of the pruner integration test).
  - `src/generators/animation.ts:50-62` — the primitive emit loop.
  - `src/mappers/semantic.ts:351-362` — the semantic emit loop.
  - `src/output/json-writer.ts` → `decodeCompositeValue` — the Story 2.4 helper that ensures stringified cubic-bezier arrays decode to native JSON arrays so Style Dictionary can resolve nested references. This helper stays; the collision fix is orthogonal to it.

## Dev Agent Record

### Implementation Plan

- **Strategy chosen: Option A** — rename primitive ease tokens from `animation.ease.<role>` to `animation.easing.<role>`. Semantic output paths (`animation.ease.default`, `.enter`, `.exit`) preserved — the CSS custom property contract for consumers is unchanged.
- **Sub-option (b)** — kept the three canonical role names (`default`, `enter`, `exit`) under the new `easing` namespace rather than embedding preset names. Minimizes consumer churn and keeps the naming pattern consistent with durations.
- **AC #5 (backwards compatibility):** satisfied by the rewrite path — `runAdd` re-emits the full animation primitive file on every `add animation` call, so old collision paths are naturally replaced by the new `animation.easing.*` paths. No explicit migration warning needed.
- **AC #8 (committed fixtures):** `git ls-files tokens/ | grep animation` returned nothing — no committed animation fixtures to regenerate.
- **Task 9.1 note:** `npm run validate:sprint` reports pre-existing drift on story 2.3 (`file=review` vs `yaml=done`). This is not related to Story 2.5 changes.

### Completion Notes

- Renamed primitive ease token paths from `animation.ease.<role>` to `animation.easing.<role>` in `src/generators/animation.ts`.
- Updated `mapAnimationSemantics` in `src/mappers/semantic.ts` to filter on `path[1] === "easing"` and emit `$value` references as `{animation.easing.<role>}` while preserving semantic output paths at `animation.ease.<role>`.
- Updated all test files: generator tests, semantic mapper tests. Verified add-animation collector tests and json-writer tests had no animation-path assertions to update.
- Re-pointed Story 2.4's pruner integration test from `add shadow` back to `add animation` — passes cleanly.
- Added dedicated E2E test for `add animation` pipeline: asserts `status === "ok"`, CSS contains resolved cubic-bezier values, no self-references in on-disk semantic JSON.
- No committed animation fixtures to regenerate.
- Updated Story 2.4 Change Log and Story 2.2 Review Findings with cross-reference notes.
- All 557 tests pass, type-check clean.

## File List

- `src/generators/animation.ts` — modified (primitive path `ease` → `easing`)
- `src/mappers/semantic.ts` — modified (easing filter + reference template)
- `src/generators/__tests__/animation.test.ts` — modified (path assertions)
- `src/mappers/__tests__/semantic.test.ts` — modified (`makeEase` helper + reference assertions)
- `src/pipeline/__tests__/add.test.ts` — modified (pruner test re-pointed + new E2E test)
- `docs/planning/stories/2-4-story-2-2-post-review-hardening.md` — modified (Change Log cross-reference)
- `docs/planning/stories/2-2-add-subcommand-for-new-token-categories.md` — modified (Review Findings followup note)
- `docs/planning/stories/2-5-fix-animation-ease-path-collision.md` — modified (tasks, status, dev agent record)
- `docs/planning/sprint-status.yaml` — modified (story status)

## Change Log

- 2026-04-19: Drafted as a follow-up to Story 2.4. The primitive/semantic `animation.ease.<role>` path collision was discovered while writing Story 2.4's Task 8 pruner integration test (AC #11); Story 2.4 worked around it by swapping `add animation` to `add shadow` in that test so the rest of the post-review hardening scope could land. This story fixes the root cause so the Task 8 test can be re-pointed to its original form.
- 2026-04-21: Implemented. Renamed primitive ease paths from `animation.ease.<role>` to `animation.easing.<role>` (Option A). All 557 tests pass, type-check clean. Pruner integration test re-pointed to `add animation`; dedicated E2E regression guard added.
